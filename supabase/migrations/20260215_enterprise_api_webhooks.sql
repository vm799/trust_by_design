-- =====================================================================
-- MIGRATION: Enterprise API Keys & Webhook System
-- Date: 2026-02-15
-- Purpose: Add API key management and webhook dispatcher tables
-- =====================================================================

-- =====================================================================
-- 1. API KEYS TABLE
-- =====================================================================

CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,
  name TEXT NOT NULL,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  rate_limit INTEGER NOT NULL DEFAULT 1000,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
);

-- Index for key lookup (used on every API request)
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_api_keys_workspace ON api_keys(workspace_id);

-- RLS: Users can only manage their own workspace's API keys
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY api_keys_select ON api_keys
  FOR SELECT USING (workspace_id IN (SELECT workspace_id FROM users WHERE id = auth.uid()));

CREATE POLICY api_keys_insert ON api_keys
  FOR INSERT WITH CHECK (workspace_id IN (SELECT workspace_id FROM users WHERE id = auth.uid()));

CREATE POLICY api_keys_update ON api_keys
  FOR UPDATE USING (workspace_id IN (SELECT workspace_id FROM users WHERE id = auth.uid()));

CREATE POLICY api_keys_delete ON api_keys
  FOR DELETE USING (workspace_id IN (SELECT workspace_id FROM users WHERE id = auth.uid()));

-- =====================================================================
-- 2. WEBHOOK ENDPOINTS TABLE
-- =====================================================================

CREATE TABLE IF NOT EXISTS webhook_endpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  events TEXT[] NOT NULL DEFAULT '{}',
  secret TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  description TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_triggered_at TIMESTAMPTZ,
  failure_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 5
);

CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_workspace ON webhook_endpoints(workspace_id);
CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_active ON webhook_endpoints(workspace_id, is_active) WHERE is_active = true;

-- RLS: Workspace isolation
ALTER TABLE webhook_endpoints ENABLE ROW LEVEL SECURITY;

CREATE POLICY webhook_endpoints_select ON webhook_endpoints
  FOR SELECT USING (workspace_id IN (SELECT workspace_id FROM users WHERE id = auth.uid()));

CREATE POLICY webhook_endpoints_insert ON webhook_endpoints
  FOR INSERT WITH CHECK (workspace_id IN (SELECT workspace_id FROM users WHERE id = auth.uid()));

CREATE POLICY webhook_endpoints_update ON webhook_endpoints
  FOR UPDATE USING (workspace_id IN (SELECT workspace_id FROM users WHERE id = auth.uid()));

CREATE POLICY webhook_endpoints_delete ON webhook_endpoints
  FOR DELETE USING (workspace_id IN (SELECT workspace_id FROM users WHERE id = auth.uid()));

-- =====================================================================
-- 3. WEBHOOK DELIVERIES TABLE (Audit Trail)
-- =====================================================================

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_id UUID NOT NULL REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
  event TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed', 'retrying')),
  response_status INTEGER,
  response_body TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  next_retry_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_endpoint ON webhook_deliveries(endpoint_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status ON webhook_deliveries(status) WHERE status IN ('pending', 'retrying');

-- RLS: Via endpoint's workspace isolation
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY webhook_deliveries_select ON webhook_deliveries
  FOR SELECT USING (
    endpoint_id IN (
      SELECT id FROM webhook_endpoints
      WHERE workspace_id IN (SELECT workspace_id FROM users WHERE id = auth.uid())
    )
  );

CREATE POLICY webhook_deliveries_insert ON webhook_deliveries
  FOR INSERT WITH CHECK (
    endpoint_id IN (
      SELECT id FROM webhook_endpoints
      WHERE workspace_id IN (SELECT workspace_id FROM users WHERE id = auth.uid())
    )
  );

-- =====================================================================
-- 4. SSO CONFIGURATIONS TABLE
-- =====================================================================

CREATE TABLE IF NOT EXISTS sso_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL UNIQUE REFERENCES workspaces(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('saml', 'oidc')),
  domain TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  metadata_url TEXT,
  entity_id TEXT,
  acs_url TEXT,
  certificate TEXT,
  client_id TEXT,
  client_secret TEXT,
  issuer_url TEXT,
  enforce_sso BOOLEAN NOT NULL DEFAULT false,
  allow_magic_link_fallback BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sso_configurations_workspace ON sso_configurations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_sso_configurations_domain ON sso_configurations(domain) WHERE is_active = true;

-- RLS: Workspace isolation
ALTER TABLE sso_configurations ENABLE ROW LEVEL SECURITY;

CREATE POLICY sso_configurations_select ON sso_configurations
  FOR SELECT USING (workspace_id IN (SELECT workspace_id FROM users WHERE id = auth.uid()));

CREATE POLICY sso_configurations_insert ON sso_configurations
  FOR INSERT WITH CHECK (workspace_id IN (SELECT workspace_id FROM users WHERE id = auth.uid()));

CREATE POLICY sso_configurations_update ON sso_configurations
  FOR UPDATE USING (workspace_id IN (SELECT workspace_id FROM users WHERE id = auth.uid()));

CREATE POLICY sso_configurations_delete ON sso_configurations
  FOR DELETE USING (workspace_id IN (SELECT workspace_id FROM users WHERE id = auth.uid()));

-- =====================================================================
-- 5. WORKSPACE INVITATIONS TABLE
-- =====================================================================

CREATE TABLE IF NOT EXISTS workspace_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'manager', 'member', 'technician', 'view_only')),
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '7 days',
  accepted_at TIMESTAMPTZ,
  UNIQUE(workspace_id, email)
);

CREATE INDEX IF NOT EXISTS idx_workspace_invitations_token ON workspace_invitations(token) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_workspace_invitations_workspace ON workspace_invitations(workspace_id);

-- RLS: Workspace isolation
ALTER TABLE workspace_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY workspace_invitations_select ON workspace_invitations
  FOR SELECT USING (workspace_id IN (SELECT workspace_id FROM users WHERE id = auth.uid()));

CREATE POLICY workspace_invitations_insert ON workspace_invitations
  FOR INSERT WITH CHECK (workspace_id IN (SELECT workspace_id FROM users WHERE id = auth.uid()));

CREATE POLICY workspace_invitations_update ON workspace_invitations
  FOR UPDATE USING (workspace_id IN (SELECT workspace_id FROM users WHERE id = auth.uid()));

CREATE POLICY workspace_invitations_delete ON workspace_invitations
  FOR DELETE USING (workspace_id IN (SELECT workspace_id FROM users WHERE id = auth.uid()));
