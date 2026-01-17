-- ============================================================================
-- MIGRATION 001: Authentication & Workspaces
-- Phase C.1 - Real Authentication
-- Date: 2026-01-16
-- ============================================================================

-- ============================================================================
-- WORKSPACES TABLE
-- ============================================================================
-- Multi-tenant workspace isolation
CREATE TABLE IF NOT EXISTS workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,

  -- Subscription info (Phase E)
  subscription_tier TEXT DEFAULT 'free', -- free, pro, team, enterprise
  subscription_status TEXT DEFAULT 'active', -- active, cancelled, suspended

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;

-- Index for slug lookups
CREATE INDEX IF NOT EXISTS idx_workspaces_slug ON workspaces(slug);

-- ============================================================================
-- USERS TABLE (extends auth.users)
-- ============================================================================
-- User profiles with workspace membership
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  -- Profile
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,

  -- Role & permissions
  role TEXT NOT NULL DEFAULT 'member', -- owner, admin, member, technician
  identity_level TEXT NOT NULL DEFAULT 'account', -- account, verified, kyc

  -- MFA (optional in beta)
  mfa_enabled BOOLEAN DEFAULT false,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_sign_in_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_workspace ON users(workspace_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- ============================================================================
-- JOB ACCESS TOKENS (Tokenized Magic Links)
-- ============================================================================
-- Secure, expirable access tokens for technician job access
CREATE TABLE IF NOT EXISTS job_access_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id TEXT NOT NULL, -- Will add FK after migrating jobs table
  token TEXT UNIQUE NOT NULL, -- UUID token in magic link

  -- Access control
  granted_to_email TEXT, -- Optional: limit to specific email
  granted_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Expiration
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,

  -- Usage tracking
  first_used_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  use_count INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE job_access_tokens ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tokens_job ON job_access_tokens(job_id);
CREATE INDEX IF NOT EXISTS idx_tokens_token ON job_access_tokens(token);
CREATE INDEX IF NOT EXISTS idx_tokens_expires ON job_access_tokens(expires_at);

-- ============================================================================
-- AUDIT LOGS (Phase C.4)
-- ============================================================================
-- Append-only audit trail
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  -- Who
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  user_email TEXT,
  ip_address INET,
  user_agent TEXT,

  -- What
  action TEXT NOT NULL, -- job_view, job_seal, photo_view, evidence_export, etc.
  resource_type TEXT NOT NULL, -- job, photo, evidence_bundle, etc.
  resource_id TEXT NOT NULL,

  -- Details
  metadata JSONB, -- Additional context

  -- When
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_audit_workspace ON audit_logs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);

-- ============================================================================
-- MIGRATE EXISTING TABLES: ADD WORKSPACE_ID
-- ============================================================================

-- Jobs table
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS assigned_technician_id UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_jobs_workspace ON jobs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_jobs_created_by ON jobs(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_assigned ON jobs(assigned_technician_id);

-- Clients table
ALTER TABLE clients ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_clients_workspace ON clients(workspace_id);

-- Technicians table
ALTER TABLE technicians ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE technicians ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_technicians_workspace ON technicians(workspace_id);
CREATE INDEX IF NOT EXISTS idx_technicians_user ON technicians(user_id);

-- Photos table (inherits workspace from job)
-- No direct workspace_id needed, accessed via job

-- Safety checks table (inherits workspace from job)
-- No direct workspace_id needed, accessed via job

-- ============================================================================
-- DROP OLD INSECURE RLS POLICIES
-- ============================================================================

-- Jobs
DROP POLICY IF EXISTS "Allow anonymous access to jobs" ON jobs;

-- Photos
DROP POLICY IF EXISTS "Allow anonymous access to photos" ON photos;

-- Safety checks
DROP POLICY IF EXISTS "Allow anonymous access to safety_checks" ON safety_checks;

-- Clients
DROP POLICY IF EXISTS "Allow anonymous access to clients" ON clients;

-- Technicians
DROP POLICY IF EXISTS "Allow anonymous access to technicians" ON technicians;

-- ============================================================================
-- NEW SECURE RLS POLICIES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- WORKSPACES: Users can only see their own workspace
-- ----------------------------------------------------------------------------
CREATE POLICY "Users can view own workspace"
  ON workspaces FOR SELECT
  USING (
    id IN (
      SELECT workspace_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Owners can update own workspace"
  ON workspaces FOR UPDATE
  USING (
    id IN (
      SELECT workspace_id FROM users WHERE id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- ----------------------------------------------------------------------------
-- USERS: Users can view others in same workspace
-- ----------------------------------------------------------------------------
CREATE POLICY "Users can view workspace members"
  ON users FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  USING (id = auth.uid());

CREATE POLICY "Admins can manage workspace users"
  ON users FOR ALL
  USING (
    workspace_id IN (
      SELECT workspace_id FROM users WHERE id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- ----------------------------------------------------------------------------
-- JOBS: Workspace-scoped access
-- ----------------------------------------------------------------------------
CREATE POLICY "Users can view workspace jobs"
  ON jobs FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can create jobs in own workspace"
  ON jobs FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update workspace jobs"
  ON jobs FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM users WHERE id = auth.uid()
    )
  );

-- Special policy: Token-based access for technicians (magic links)
CREATE POLICY "Token holders can view assigned job"
  ON jobs FOR SELECT
  USING (
    id IN (
      SELECT job_id FROM job_access_tokens
      WHERE token = current_setting('request.headers', true)::json->>'x-job-token'
      AND expires_at > NOW()
      AND revoked_at IS NULL
    )
  );

CREATE POLICY "Token holders can update assigned job"
  ON jobs FOR UPDATE
  USING (
    id IN (
      SELECT job_id FROM job_access_tokens
      WHERE token = current_setting('request.headers', true)::json->>'x-job-token'
      AND expires_at > NOW()
      AND revoked_at IS NULL
    )
  );

-- ----------------------------------------------------------------------------
-- PHOTOS: Inherit access from job
-- ----------------------------------------------------------------------------
CREATE POLICY "Users can view photos for accessible jobs"
  ON photos FOR SELECT
  USING (
    job_id IN (
      SELECT id FROM jobs WHERE workspace_id IN (
        SELECT workspace_id FROM users WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert photos for accessible jobs"
  ON photos FOR INSERT
  WITH CHECK (
    job_id IN (
      SELECT id FROM jobs WHERE workspace_id IN (
        SELECT workspace_id FROM users WHERE id = auth.uid()
      )
    )
  );

-- Token-based access for photos
CREATE POLICY "Token holders can view photos for assigned job"
  ON photos FOR SELECT
  USING (
    job_id IN (
      SELECT job_id FROM job_access_tokens
      WHERE token = current_setting('request.headers', true)::json->>'x-job-token'
      AND expires_at > NOW()
      AND revoked_at IS NULL
    )
  );

CREATE POLICY "Token holders can insert photos for assigned job"
  ON photos FOR INSERT
  WITH CHECK (
    job_id IN (
      SELECT job_id FROM job_access_tokens
      WHERE token = current_setting('request.headers', true)::json->>'x-job-token'
      AND expires_at > NOW()
      AND revoked_at IS NULL
    )
  );

-- ----------------------------------------------------------------------------
-- SAFETY CHECKS: Inherit access from job
-- ----------------------------------------------------------------------------
CREATE POLICY "Users can view safety checks for accessible jobs"
  ON safety_checks FOR SELECT
  USING (
    job_id IN (
      SELECT id FROM jobs WHERE workspace_id IN (
        SELECT workspace_id FROM users WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert safety checks for accessible jobs"
  ON safety_checks FOR INSERT
  WITH CHECK (
    job_id IN (
      SELECT id FROM jobs WHERE workspace_id IN (
        SELECT workspace_id FROM users WHERE id = auth.uid()
      )
    )
  );

-- Token-based access
CREATE POLICY "Token holders can view safety checks for assigned job"
  ON safety_checks FOR SELECT
  USING (
    job_id IN (
      SELECT job_id FROM job_access_tokens
      WHERE token = current_setting('request.headers', true)::json->>'x-job-token'
      AND expires_at > NOW()
      AND revoked_at IS NULL
    )
  );

CREATE POLICY "Token holders can insert safety checks for assigned job"
  ON safety_checks FOR INSERT
  WITH CHECK (
    job_id IN (
      SELECT job_id FROM job_access_tokens
      WHERE token = current_setting('request.headers', true)::json->>'x-job-token'
      AND expires_at > NOW()
      AND revoked_at IS NULL
    )
  );

-- ----------------------------------------------------------------------------
-- CLIENTS: Workspace-scoped access
-- ----------------------------------------------------------------------------
CREATE POLICY "Users can view workspace clients"
  ON clients FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can manage workspace clients"
  ON clients FOR ALL
  USING (
    workspace_id IN (
      SELECT workspace_id FROM users WHERE id = auth.uid()
    )
  );

-- ----------------------------------------------------------------------------
-- TECHNICIANS: Workspace-scoped access
-- ----------------------------------------------------------------------------
CREATE POLICY "Users can view workspace technicians"
  ON technicians FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can manage workspace technicians"
  ON technicians FOR ALL
  USING (
    workspace_id IN (
      SELECT workspace_id FROM users WHERE id = auth.uid()
    )
  );

-- ----------------------------------------------------------------------------
-- JOB ACCESS TOKENS: Workspace-scoped
-- ----------------------------------------------------------------------------
CREATE POLICY "Users can view workspace job tokens"
  ON job_access_tokens FOR SELECT
  USING (
    job_id IN (
      SELECT id FROM jobs WHERE workspace_id IN (
        SELECT workspace_id FROM users WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can create job tokens"
  ON job_access_tokens FOR INSERT
  WITH CHECK (
    job_id IN (
      SELECT id FROM jobs WHERE workspace_id IN (
        SELECT workspace_id FROM users WHERE id = auth.uid()
      )
    )
  );

-- ----------------------------------------------------------------------------
-- AUDIT LOGS: Workspace-scoped, read-only
-- ----------------------------------------------------------------------------
CREATE POLICY "Users can view workspace audit logs"
  ON audit_logs FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM users WHERE id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- No UPDATE or DELETE policies - audit logs are append-only

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function: Create workspace with owner user
CREATE OR REPLACE FUNCTION create_workspace_with_owner(
  p_user_id UUID,
  p_email TEXT,
  p_workspace_name TEXT,
  p_workspace_slug TEXT,
  p_full_name TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_workspace_id UUID;
BEGIN
  -- Create workspace
  INSERT INTO workspaces (name, slug)
  VALUES (p_workspace_name, p_workspace_slug)
  RETURNING id INTO v_workspace_id;

  -- Create owner user profile
  INSERT INTO users (id, workspace_id, email, full_name, role, identity_level)
  VALUES (p_user_id, v_workspace_id, p_email, p_full_name, 'owner', 'account');

  RETURN v_workspace_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Generate magic link token
CREATE OR REPLACE FUNCTION generate_job_access_token(
  p_job_id TEXT,
  p_granted_by_user_id UUID,
  p_granted_to_email TEXT DEFAULT NULL,
  p_expires_in_days INTEGER DEFAULT 7
)
RETURNS TEXT AS $$
DECLARE
  v_token TEXT;
BEGIN
  v_token := gen_random_uuid()::TEXT;

  INSERT INTO job_access_tokens (
    job_id,
    token,
    granted_to_email,
    granted_by_user_id,
    expires_at
  )
  VALUES (
    p_job_id,
    v_token,
    p_granted_to_email,
    p_granted_by_user_id,
    NOW() + (p_expires_in_days || ' days')::INTERVAL
  );

  RETURN v_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Log audit event
CREATE OR REPLACE FUNCTION log_audit_event(
  p_workspace_id UUID,
  p_user_id UUID,
  p_action TEXT,
  p_resource_type TEXT,
  p_resource_id TEXT,
  p_metadata JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_audit_id UUID;
  v_user_email TEXT;
BEGIN
  -- Get user email
  SELECT email INTO v_user_email FROM users WHERE id = p_user_id;

  INSERT INTO audit_logs (
    workspace_id,
    user_id,
    user_email,
    action,
    resource_type,
    resource_id,
    metadata
  )
  VALUES (
    p_workspace_id,
    p_user_id,
    v_user_email,
    p_action,
    p_resource_type,
    p_resource_id,
    p_metadata
  )
  RETURNING id INTO v_audit_id;

  RETURN v_audit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Trigger: Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_workspaces_updated_at
  BEFORE UPDATE ON workspaces
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE workspaces IS 'Multi-tenant workspace isolation for organizations';
COMMENT ON TABLE users IS 'User profiles extending auth.users with workspace membership and roles';
COMMENT ON TABLE job_access_tokens IS 'Secure, expirable tokens for magic link access to jobs';
COMMENT ON TABLE audit_logs IS 'Append-only audit trail for compliance and security';

COMMENT ON COLUMN users.identity_level IS 'account = email verified only, verified = additional verification, kyc = KYC completed';
COMMENT ON COLUMN users.role IS 'owner = workspace creator, admin = full access, member = standard user, technician = field worker';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Next steps:
-- 1. Enable Supabase Auth in dashboard (Email + Google providers)
-- 2. Update application code to use real auth
-- 3. Migrate existing localStorage data to workspaces (if needed)
-- 4. Test RLS policies
