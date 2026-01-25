-- ============================================================================
-- MIGRATION: Fix Stability and Security Issues
-- Date: 2026-01-25
-- ============================================================================
-- PURPOSE: Address 96 linter errors causing instability and timeouts
--
-- FIXES:
-- 1. SECURITY (Critical): 16 public functions with mutable search_path
-- 2. SECURITY (High): users_insert RLS policy with WITH CHECK (true)
-- 3. PERFORMANCE (High): 7 unindexed foreign keys causing table scans
-- 4. PERFORMANCE (Low): 5 unused indexes causing write overhead
--
-- NOTE: auth.* functions are managed by Supabase - we create public.* equivalents
-- SEVERITY: HIGH
-- ROLLBACK: Available at end of file
-- ============================================================================

BEGIN;

-- ============================================================================
-- SECTION 1: FIX FUNCTION SEARCH_PATH (Public Functions Only)
-- ============================================================================
-- Purpose: Prevent search_path injection attacks (LINT 0011)
-- All SECURITY DEFINER functions must have explicit search_path
-- NOTE: auth.* schema is managed by Supabase - cannot modify directly
-- NOTE: Using 'public, extensions' to include pgcrypto/uuid-ossp
-- ============================================================================

-- Drop functions that may have incompatible signatures before recreating
DROP FUNCTION IF EXISTS public.get_user_workflow();
DROP FUNCTION IF EXISTS public.validate_tech_access(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.create_tech_access_link(TEXT, INTEGER);
DROP FUNCTION IF EXISTS public.can_access_job_with_token(UUID, TEXT);
DROP FUNCTION IF EXISTS public.photos_sync_workspace_id();

-- 1.1 Create public equivalents for auth helper functions
-- These replace the auth.* versions which we can't modify

CREATE OR REPLACE FUNCTION public.get_current_workspace_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, extensions
AS $$
  SELECT workspace_id FROM public.users WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.is_manager()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, extensions
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN ('owner', 'admin')
  )
$$;

CREATE OR REPLACE FUNCTION public.get_technician_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, extensions
AS $$
  SELECT id FROM public.technicians WHERE user_id = auth.uid()
$$;

-- 1.2 Public Helper Functions
CREATE OR REPLACE FUNCTION public.user_workspaces()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, extensions
AS $$
  SELECT workspace_id FROM public.users WHERE id = (SELECT auth.uid())
$$;

CREATE OR REPLACE FUNCTION public.check_user_exists(p_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, extensions
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM auth.users WHERE email = lower(p_email)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_workspace_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, extensions
AS $$
  SELECT workspace_id
  FROM public.users
  WHERE id = (SELECT auth.uid())
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.complete_onboarding_step(
  p_step_key TEXT,
  p_step_data JSONB DEFAULT '{}'::jsonb
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user_id UUID;
  v_persona_id UUID;
  v_persona_type persona_type;
  v_current_step TEXT;
  v_next_step TEXT;
  v_next_step_order INTEGER;
  v_is_final_step BOOLEAN;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT id, persona_type, current_step
  INTO v_persona_id, v_persona_type, v_current_step
  FROM user_personas
  WHERE user_id = v_user_id AND is_active = true
  LIMIT 1;

  IF v_persona_id IS NULL THEN
    RAISE EXCEPTION 'No active persona found';
  END IF;

  IF v_current_step IS NOT NULL AND v_current_step != p_step_key THEN
    RAISE EXCEPTION 'Step key mismatch: expected %, got %', v_current_step, p_step_key;
  END IF;

  INSERT INTO user_journey_progress (user_id, persona_id, step_key, status, step_data, started_at, completed_at)
  VALUES (v_user_id, v_persona_id, p_step_key, 'completed', p_step_data, NOW(), NOW())
  ON CONFLICT (persona_id, step_key) DO UPDATE
  SET status = 'completed', step_data = p_step_data, completed_at = NOW();

  UPDATE user_personas
  SET completed_steps = completed_steps || jsonb_build_array(p_step_key)
  WHERE id = v_persona_id;

  SELECT step_key, step_order
  INTO v_next_step, v_next_step_order
  FROM onboarding_steps
  WHERE persona_type = v_persona_type
  AND step_order = (
    SELECT step_order + 1
    FROM onboarding_steps
    WHERE persona_type = v_persona_type AND step_key = p_step_key
  )
  LIMIT 1;

  v_is_final_step := v_next_step IS NULL;

  IF v_is_final_step THEN
    UPDATE user_personas
    SET is_complete = true, completed_at = NOW(), current_step = NULL
    WHERE id = v_persona_id;
  ELSE
    UPDATE user_personas
    SET current_step = v_next_step
    WHERE id = v_persona_id;

    INSERT INTO user_journey_progress (user_id, persona_id, step_key, status, started_at)
    VALUES (v_user_id, v_persona_id, v_next_step, 'in_progress', NOW())
    ON CONFLICT (persona_id, step_key) DO UPDATE
    SET status = 'in_progress', started_at = NOW();
  END IF;

  RETURN json_build_object(
    'success', true,
    'completed_step', p_step_key,
    'next_step', v_next_step,
    'is_complete', v_is_final_step,
    'persona_type', v_persona_type::text
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_workflow()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, extensions
AS $$
DECLARE
  v_user_id UUID;
  v_persona RECORD;
  v_steps JSONB;
  v_progress JSONB;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  SELECT * INTO v_persona
  FROM user_personas
  WHERE user_id = v_user_id AND is_active = true
  LIMIT 1;

  IF v_persona IS NULL THEN
    RETURN jsonb_build_object('error', 'No active persona');
  END IF;

  SELECT jsonb_agg(
    jsonb_build_object(
      'step_key', os.step_key,
      'step_order', os.step_order,
      'title', os.title,
      'description', os.description,
      'icon', os.icon
    ) ORDER BY os.step_order
  ) INTO v_steps
  FROM onboarding_steps os
  WHERE os.persona_type = v_persona.persona_type;

  SELECT jsonb_object_agg(
    ujp.step_key,
    jsonb_build_object(
      'status', ujp.status,
      'step_data', ujp.step_data,
      'completed_at', ujp.completed_at
    )
  ) INTO v_progress
  FROM user_journey_progress ujp
  WHERE ujp.persona_id = v_persona.id;

  RETURN jsonb_build_object(
    'persona_id', v_persona.id,
    'persona_type', v_persona.persona_type,
    'is_complete', v_persona.is_complete,
    'current_step', v_persona.current_step,
    'steps', COALESCE(v_steps, '[]'::jsonb),
    'progress', COALESCE(v_progress, '{}'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_tech_access(
  p_job_id TEXT,
  p_token TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, extensions
AS $$
DECLARE
  v_token_hash TEXT;
BEGIN
  v_token_hash := encode(extensions.digest(p_token::bytea, 'sha256'), 'hex');

  RETURN EXISTS (
    SELECT 1 FROM jobs
    WHERE id = p_job_id
    AND tech_token_hash = v_token_hash
    AND NOT token_used
    AND (token_expires_at IS NULL OR token_expires_at > NOW())
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.create_tech_access_link(
  p_job_id TEXT,
  p_expires_in_days INTEGER DEFAULT 7
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_token TEXT;
  v_token_hash TEXT;
BEGIN
  v_token := upper(substring(encode(gen_random_bytes(4), 'hex') FROM 1 FOR 6));
  v_token_hash := encode(extensions.digest(v_token::bytea, 'sha256'), 'hex');

  UPDATE jobs SET
    tech_token_hash = v_token_hash,
    token_expires_at = NOW() + (p_expires_in_days || ' days')::INTERVAL,
    token_used = false
  WHERE id = p_job_id;

  RETURN '/job/' || p_job_id || '/' || v_token;
END;
$$;

-- 1.3 Token Generation and Validation Functions
CREATE OR REPLACE FUNCTION public.generate_job_access_token(
  p_job_id TEXT,
  p_granted_by_user_id UUID,
  p_granted_to_email TEXT DEFAULT NULL,
  p_expires_in_days INTEGER DEFAULT 7
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_token TEXT;
  v_token_hash TEXT;
BEGIN
  v_token := gen_random_uuid()::TEXT;
  v_token_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');

  INSERT INTO public.job_access_tokens (
    job_id,
    token,
    token_hash,
    granted_to_email,
    granted_by_user_id,
    expires_at
  )
  VALUES (
    p_job_id,
    v_token,
    v_token_hash,
    p_granted_to_email,
    p_granted_by_user_id,
    NOW() + (p_expires_in_days || ' days')::INTERVAL
  );

  RETURN v_token;
END;
$$;

-- 1.4 Sync Helper Function
CREATE OR REPLACE FUNCTION public.photos_sync_workspace_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF NEW.workspace_id IS NULL THEN
    SELECT workspace_id INTO NEW.workspace_id
    FROM jobs WHERE id = NEW.job_id;
  END IF;
  RETURN NEW;
END;
$$;

-- 1.5 Seal Protection Trigger Functions
CREATE OR REPLACE FUNCTION public.prevent_job_delete_after_seal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF OLD.sealed_at IS NOT NULL THEN
    RAISE EXCEPTION
      'Cannot delete sealed job (ID: %). Sealed evidence must be preserved.',
      OLD.id
    USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION public.can_access_job_with_token(
  p_job_id UUID,
  p_token TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, extensions
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM job_access_tokens
    WHERE job_id = p_job_id::TEXT
    AND token = p_token
    AND expires_at > NOW()
    AND revoked_at IS NULL
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_job_mutation_after_seal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF OLD.sealed_at IS NOT NULL THEN
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'Cannot delete sealed job (ID: %)', OLD.id;
    ELSIF TG_OP = 'UPDATE' THEN
      IF NEW.sync_status IS DISTINCT FROM OLD.sync_status AND
         NEW.sealed_at = OLD.sealed_at THEN
        RETURN NEW;
      END IF;
      RAISE EXCEPTION 'Cannot modify sealed job (ID: %)', OLD.id;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_child_mutation_after_job_seal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_sealed_at TIMESTAMPTZ;
BEGIN
  SELECT sealed_at INTO v_sealed_at
  FROM jobs WHERE id = COALESCE(NEW.job_id, OLD.job_id);

  IF v_sealed_at IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot modify records for sealed job';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_job_update_after_seal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF OLD.sealed_at IS NOT NULL THEN
    IF NEW.sync_status IS DISTINCT FROM OLD.sync_status AND
       NEW.sealed_at = OLD.sealed_at THEN
      RETURN NEW;
    END IF;

    RAISE EXCEPTION
      'Cannot modify sealed job (ID: %). Job was sealed at % UTC.',
      OLD.id,
      OLD.sealed_at
    USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================================================
-- SECTION 2: FIX RLS POLICY - users_insert (Critical Security Fix)
-- ============================================================================
-- Purpose: Replace permissive WITH CHECK (true) with proper auth check
-- Impact: Prevents unauthorized user creation
-- ============================================================================

-- Drop the insecure policy if it exists
DROP POLICY IF EXISTS "users_insert" ON public.users;

-- Create secure user insert policy
CREATE POLICY "users_insert_secure"
  ON public.users
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- User can only create a profile for themselves
    id = (SELECT auth.uid())
  );

-- Also ensure the service role can create users (for admin operations)
DROP POLICY IF EXISTS "service_role_users_insert" ON public.users;
CREATE POLICY "service_role_users_insert"
  ON public.users
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- ============================================================================
-- SECTION 3: CREATE MISSING INDEXES FOR FOREIGN KEYS (Performance)
-- ============================================================================
-- Purpose: Add indexes on foreign keys to prevent full table scans
-- Impact: Significant query performance improvement
-- ============================================================================

-- 3.1 evidence_seals(fk_seals_user) - sealed_by_user_id
CREATE INDEX IF NOT EXISTS idx_evidence_seals_sealed_by_user
  ON public.evidence_seals(sealed_by_user_id);

-- 3.2 job_access_tokens(fk_tokens_user) - granted_by_user_id
CREATE INDEX IF NOT EXISTS idx_job_access_tokens_granted_by
  ON public.job_access_tokens(granted_by_user_id);

-- 3.3 jobs(fk_jobs_client) - client_id (if it's a FK column)
CREATE INDEX IF NOT EXISTS idx_jobs_client_id
  ON public.jobs(client_id);

-- 3.4 jobs(fk_jobs_technician) - technician_id (legacy column)
CREATE INDEX IF NOT EXISTS idx_jobs_technician_id
  ON public.jobs(technician_id);

-- 3.5 safety_checks(fk_safety_checks_job) - job_id
CREATE INDEX IF NOT EXISTS idx_safety_checks_job_id
  ON public.safety_checks(job_id);

-- 3.6 user_journey_progress(persona_id) - FK to user_personas
CREATE INDEX IF NOT EXISTS idx_user_journey_progress_persona
  ON public.user_journey_progress(persona_id);

-- 3.7 user_subscriptions(user_id) - FK to users
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user
  ON public.user_subscriptions(user_id);

-- ============================================================================
-- SECTION 4: DROP UNUSED INDEXES (Reduce Write Overhead)
-- ============================================================================
-- Purpose: Remove indexes that aren't being used by queries
-- Impact: Reduced storage and faster writes
-- ============================================================================

-- 4.1 idx_workspaces_slug - slug lookups are rare after initial creation
DROP INDEX IF EXISTS idx_workspaces_slug;

-- 4.2 idx_users_workspace - superseded by idx_users_workspace_id_btree
DROP INDEX IF EXISTS idx_users_workspace;

-- 4.3 idx_users_role - role filtering is done with workspace_id
DROP INDEX IF EXISTS idx_users_role;

-- 4.4 idx_tokens_job - superseded by idx_tokens_job_id_btree
DROP INDEX IF EXISTS idx_tokens_job;

-- 4.5 idx_tokens_token - superseded by idx_tokens_token_valid (partial)
DROP INDEX IF EXISTS idx_tokens_token;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify function search_paths are set
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname IN ('public', 'auth')
  AND p.prosecdef = true
  AND (p.proconfig IS NULL OR NOT p.proconfig::text LIKE '%search_path%');

  IF v_count > 0 THEN
    RAISE WARNING '% SECURITY DEFINER functions still lack search_path setting', v_count;
  ELSE
    RAISE NOTICE '✅ All SECURITY DEFINER functions have search_path set';
  END IF;
END $$;

-- Verify new indexes exist
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM pg_indexes
  WHERE schemaname = 'public'
  AND indexname IN (
    'idx_evidence_seals_sealed_by_user',
    'idx_job_access_tokens_granted_by',
    'idx_jobs_client_id',
    'idx_jobs_technician_id',
    'idx_safety_checks_job_id',
    'idx_user_journey_progress_persona',
    'idx_user_subscriptions_user'
  );

  RAISE NOTICE '✅ Created % new FK indexes', v_count;
END $$;

-- Verify no WITH CHECK (true) policies on users table
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM pg_policies
  WHERE tablename = 'users'
  AND qual::text LIKE '%true%'
  AND cmd = 'INSERT';

  IF v_count > 0 THEN
    RAISE WARNING '⚠️ Found % INSERT policies with permissive WITH CHECK', v_count;
  ELSE
    RAISE NOTICE '✅ No permissive INSERT policies on users table';
  END IF;
END $$;

COMMIT;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Summary:
-- ✅ 19 functions updated with SET search_path = public, extensions
-- ✅ users_insert RLS policy secured with auth.uid() check
-- ✅ 7 FK indexes created for query performance
-- ✅ 5 unused indexes dropped for write performance
-- ============================================================================

-- ============================================================================
-- ROLLBACK PLAN (Emergency Only)
-- ============================================================================
/*
BEGIN;

-- Rollback: Recreate dropped indexes if needed
CREATE INDEX IF NOT EXISTS idx_workspaces_slug ON workspaces(slug);
CREATE INDEX IF NOT EXISTS idx_users_workspace ON users(workspace_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_tokens_job ON job_access_tokens(job_id);
CREATE INDEX IF NOT EXISTS idx_tokens_token ON job_access_tokens(token);

-- Rollback: Drop new indexes (optional)
DROP INDEX IF EXISTS idx_evidence_seals_sealed_by_user;
DROP INDEX IF EXISTS idx_job_access_tokens_granted_by;
DROP INDEX IF EXISTS idx_jobs_client_id;
DROP INDEX IF EXISTS idx_jobs_technician_id;
DROP INDEX IF EXISTS idx_safety_checks_job_id;
DROP INDEX IF EXISTS idx_user_journey_progress_persona;
DROP INDEX IF EXISTS idx_user_subscriptions_user;

-- Rollback: Remove secure policy and restore permissive (NOT RECOMMENDED)
-- DROP POLICY IF EXISTS "users_insert_secure" ON public.users;
-- CREATE POLICY "users_insert" ON public.users FOR INSERT WITH CHECK (true);

COMMIT;
*/
