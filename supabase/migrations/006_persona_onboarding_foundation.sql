-- ============================================================================
-- MIGRATION 006: Persona Onboarding Foundation
-- Phase D.3 - Handholding Onboarding Factory
-- Date: 2026-01-18
-- ============================================================================
-- PURPOSE: Create tables, ENUMs, and RPCs for persona-based onboarding flows
-- RISK: LOW (all new tables, no destructive changes)
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: Create persona_type ENUM (if not exists)
-- ============================================================================

-- Create ENUM if it doesn't exist (migration 005 might have created it)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'persona_type') THEN
    CREATE TYPE persona_type AS ENUM (
      'solo_contractor',
      'agency_owner',
      'compliance_officer',
      'safety_manager',
      'site_supervisor'
    );
  END IF;
END $$;

COMMENT ON TYPE persona_type IS 'User persona types for role-based onboarding and permissions';

-- ============================================================================
-- STEP 2: Create user_personas table
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_personas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  -- Persona configuration
  persona_type persona_type NOT NULL,
  is_active BOOLEAN DEFAULT true,
  is_complete BOOLEAN DEFAULT false,

  -- Progress tracking
  current_step TEXT,
  completed_steps JSONB DEFAULT '[]'::jsonb,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  -- Constraints
  UNIQUE(user_id, persona_type),
  CHECK (NOT (is_complete = true AND completed_at IS NULL))
);

-- Enable RLS
ALTER TABLE user_personas ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_personas_user ON user_personas(user_id);
CREATE INDEX IF NOT EXISTS idx_user_personas_workspace ON user_personas(workspace_id);
CREATE INDEX IF NOT EXISTS idx_user_personas_type ON user_personas(persona_type);
CREATE INDEX IF NOT EXISTS idx_user_personas_active ON user_personas(user_id, is_active) WHERE is_active = true;

COMMENT ON TABLE user_personas IS 'Links users to personas with onboarding completion status';
COMMENT ON COLUMN user_personas.is_active IS 'Only one persona can be active per user at a time';
COMMENT ON COLUMN user_personas.is_complete IS 'True when user completes all onboarding steps';
COMMENT ON COLUMN user_personas.current_step IS 'Current step key in onboarding flow';
COMMENT ON COLUMN user_personas.completed_steps IS 'Array of completed step keys';

-- ============================================================================
-- STEP 3: Create onboarding_steps table (metadata)
-- ============================================================================

CREATE TABLE IF NOT EXISTS onboarding_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Step definition
  persona_type persona_type NOT NULL,
  step_key TEXT NOT NULL,
  step_order INTEGER NOT NULL,

  -- Display info
  title TEXT NOT NULL,
  description TEXT,
  icon TEXT,

  -- Validation
  required_data JSONB DEFAULT '{}'::jsonb,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  UNIQUE(persona_type, step_key),
  UNIQUE(persona_type, step_order)
);

-- Enable RLS
ALTER TABLE onboarding_steps ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_onboarding_steps_persona ON onboarding_steps(persona_type, step_order);

COMMENT ON TABLE onboarding_steps IS 'Metadata for each persona onboarding step';
COMMENT ON COLUMN onboarding_steps.step_key IS 'Unique identifier for step (e.g., upload_logo)';
COMMENT ON COLUMN onboarding_steps.step_order IS 'Order in onboarding flow (1-based)';

-- ============================================================================
-- STEP 4: Create user_journey_progress table (detailed tracking)
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_journey_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign keys
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  persona_id UUID NOT NULL REFERENCES user_personas(id) ON DELETE CASCADE,
  step_key TEXT NOT NULL,

  -- Progress
  status TEXT NOT NULL DEFAULT 'pending', -- pending, in_progress, completed, skipped
  step_data JSONB DEFAULT '{}'::jsonb,

  -- Timestamps
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  UNIQUE(persona_id, step_key),
  CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped'))
);

-- Enable RLS
ALTER TABLE user_journey_progress ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_journey_progress_user ON user_journey_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_journey_progress_persona ON user_journey_progress(persona_id);
CREATE INDEX IF NOT EXISTS idx_journey_progress_status ON user_journey_progress(status);

COMMENT ON TABLE user_journey_progress IS 'Detailed tracking of user progress through onboarding steps';
COMMENT ON COLUMN user_journey_progress.step_data IS 'Form data captured during step (e.g., uploaded logo URL)';
COMMENT ON COLUMN user_journey_progress.status IS 'Current status of this step for this user';

-- ============================================================================
-- STEP 5: RLS Policies
-- ============================================================================

-- user_personas: Users can view/manage their own personas
CREATE POLICY "Users can view own personas"
  ON user_personas FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own personas"
  ON user_personas FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own personas"
  ON user_personas FOR UPDATE
  USING (user_id = auth.uid());

-- onboarding_steps: Public read (metadata only)
CREATE POLICY "Anyone can view onboarding steps"
  ON onboarding_steps FOR SELECT
  USING (true);

-- user_journey_progress: Users can view/manage their own progress
CREATE POLICY "Users can view own journey progress"
  ON user_journey_progress FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own journey progress"
  ON user_journey_progress FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own journey progress"
  ON user_journey_progress FOR UPDATE
  USING (user_id = auth.uid());

-- ============================================================================
-- STEP 6: Helper Function - Get User Workspace IDs
-- ============================================================================

CREATE OR REPLACE FUNCTION public.user_workspace_ids()
RETURNS SETOF UUID AS $$
BEGIN
  RETURN QUERY
  SELECT workspace_id
  FROM public.users
  WHERE id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION public.user_workspace_ids IS 'Returns workspace IDs for current authenticated user (for RLS policies)';

-- ============================================================================
-- STEP 7: RPC Function - Complete Onboarding Step
-- ============================================================================

CREATE OR REPLACE FUNCTION public.complete_onboarding_step(
  p_step_key TEXT,
  p_step_data JSONB DEFAULT '{}'::jsonb
)
RETURNS json AS $$
DECLARE
  v_user_id UUID;
  v_persona_id UUID;
  v_persona_type persona_type;
  v_current_step TEXT;
  v_next_step TEXT;
  v_next_step_order INTEGER;
  v_is_final_step BOOLEAN;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get active persona
  SELECT id, persona_type, current_step
  INTO v_persona_id, v_persona_type, v_current_step
  FROM user_personas
  WHERE user_id = v_user_id AND is_active = true
  LIMIT 1;

  IF v_persona_id IS NULL THEN
    RAISE EXCEPTION 'No active persona found';
  END IF;

  -- Verify step_key matches current step
  IF v_current_step IS NOT NULL AND v_current_step != p_step_key THEN
    RAISE EXCEPTION 'Step key mismatch: expected %, got %', v_current_step, p_step_key;
  END IF;

  -- Mark current step as completed
  INSERT INTO user_journey_progress (user_id, persona_id, step_key, status, step_data, started_at, completed_at)
  VALUES (v_user_id, v_persona_id, p_step_key, 'completed', p_step_data, NOW(), NOW())
  ON CONFLICT (persona_id, step_key) DO UPDATE
  SET status = 'completed', step_data = p_step_data, completed_at = NOW();

  -- Add to completed_steps array
  UPDATE user_personas
  SET completed_steps = completed_steps || jsonb_build_array(p_step_key)
  WHERE id = v_persona_id;

  -- Get next step
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

  -- Check if this was the final step
  v_is_final_step := v_next_step IS NULL;

  IF v_is_final_step THEN
    -- Mark persona as complete
    UPDATE user_personas
    SET is_complete = true, completed_at = NOW(), current_step = NULL
    WHERE id = v_persona_id;

    -- Log audit event
    PERFORM log_audit_event(
      (SELECT workspace_id FROM users WHERE id = v_user_id),
      v_user_id,
      'persona_onboarding_complete',
      'persona',
      v_persona_id::text,
      jsonb_build_object('persona_type', v_persona_type::text)
    );
  ELSE
    -- Update current_step to next step
    UPDATE user_personas
    SET current_step = v_next_step
    WHERE id = v_persona_id;

    -- Create next step progress record
    INSERT INTO user_journey_progress (user_id, persona_id, step_key, status, started_at)
    VALUES (v_user_id, v_persona_id, v_next_step, 'in_progress', NOW())
    ON CONFLICT (persona_id, step_key) DO UPDATE
    SET status = 'in_progress', started_at = NOW();
  END IF;

  -- Return result
  RETURN json_build_object(
    'success', true,
    'completed_step', p_step_key,
    'next_step', v_next_step,
    'is_complete', v_is_final_step,
    'persona_type', v_persona_type::text
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.complete_onboarding_step IS 'Marks current step as complete and advances to next step (atomic)';

-- ============================================================================
-- STEP 8: RPC Function - Complete Persona Onboarding (Manual Override)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.complete_persona_onboarding(
  p_persona_type persona_type
)
RETURNS json AS $$
DECLARE
  v_user_id UUID;
  v_persona_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get persona
  SELECT id INTO v_persona_id
  FROM user_personas
  WHERE user_id = v_user_id AND persona_type = p_persona_type
  LIMIT 1;

  IF v_persona_id IS NULL THEN
    RAISE EXCEPTION 'Persona not found: %', p_persona_type;
  END IF;

  -- Mark as complete
  UPDATE user_personas
  SET is_complete = true, completed_at = NOW(), current_step = NULL
  WHERE id = v_persona_id;

  -- Log audit event
  PERFORM log_audit_event(
    (SELECT workspace_id FROM users WHERE id = v_user_id),
    v_user_id,
    'persona_onboarding_complete',
    'persona',
    v_persona_id::text,
    jsonb_build_object('persona_type', p_persona_type::text, 'manual', true)
  );

  RETURN json_build_object(
    'success', true,
    'persona_type', p_persona_type::text,
    'persona_id', v_persona_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.complete_persona_onboarding IS 'Manually marks persona onboarding as complete (for admin or skip)';

-- ============================================================================
-- STEP 9: Seed Onboarding Steps for All Personas
-- ============================================================================

-- Solo Contractor Steps
INSERT INTO onboarding_steps (persona_type, step_key, step_order, title, description, icon) VALUES
  ('solo_contractor', 'upload_logo', 1, 'Upload Your Logo', 'Add your company logo for professional certificates', 'photo_camera'),
  ('solo_contractor', 'create_first_job', 2, 'Create Your First Job', 'Set up your first job to understand the workflow', 'work'),
  ('solo_contractor', 'safety_checklist', 3, 'Add Safety Checklist', 'Create a safety checklist template', 'verified_user'),
  ('solo_contractor', 'generate_certificate', 4, 'Generate Certificate', 'Create your first compliance certificate', 'workspace_premium')
ON CONFLICT (persona_type, step_key) DO NOTHING;

-- Agency Owner Steps
INSERT INTO onboarding_steps (persona_type, step_key, step_order, title, description, icon) VALUES
  ('agency_owner', 'add_first_technician', 1, 'Add Your First Technician', 'Invite team members to your workspace', 'person_add'),
  ('agency_owner', 'bulk_job_import', 2, 'Import Jobs', 'Upload multiple jobs via CSV or create manually', 'upload_file'),
  ('agency_owner', 'setup_billing', 3, 'Setup Billing', 'Configure payment methods and billing settings', 'credit_card'),
  ('agency_owner', 'compliance_dashboard', 4, 'Compliance Dashboard', 'Review team performance and compliance metrics', 'dashboard')
ON CONFLICT (persona_type, step_key) DO NOTHING;

-- Compliance Officer Steps
INSERT INTO onboarding_steps (persona_type, step_key, step_order, title, description, icon) VALUES
  ('compliance_officer', 'enable_audit_logs', 1, 'Enable Audit Logs', 'Activate comprehensive audit trail tracking', 'history'),
  ('compliance_officer', 'review_pending_jobs', 2, 'Review Pending Jobs', 'Inspect jobs awaiting compliance approval', 'task_alt'),
  ('compliance_officer', 'seal_first_job', 3, 'Seal Your First Job', 'Learn the blockchain sealing process', 'lock'),
  ('compliance_officer', 'export_report', 4, 'Export Audit Report', 'Generate compliance reports for regulators', 'description')
ON CONFLICT (persona_type, step_key) DO NOTHING;

-- Safety Manager Steps
INSERT INTO onboarding_steps (persona_type, step_key, step_order, title, description, icon) VALUES
  ('safety_manager', 'create_safety_checklist', 1, 'Create Safety Checklist', 'Build reusable safety inspection templates', 'fact_check'),
  ('safety_manager', 'risk_assessment', 2, 'Risk Assessment Template', 'Define risk assessment criteria and scoring', 'warning'),
  ('safety_manager', 'training_matrix', 3, 'Training Matrix', 'Track technician certifications and training', 'school'),
  ('safety_manager', 'incident_log', 4, 'Incident Logging', 'Set up incident reporting and investigation workflow', 'report_problem')
ON CONFLICT (persona_type, step_key) DO NOTHING;

-- Site Supervisor Steps (already in migration 005, but adding for completeness)
INSERT INTO onboarding_steps (persona_type, step_key, step_order, title, description, icon) VALUES
  ('site_supervisor', 'daily_briefing', 1, 'Daily Crew Briefing', 'Assign crews to jobs for the day', 'engineering'),
  ('site_supervisor', 'material_tracking', 2, 'Material Tracking', 'Log material deliveries and inventory', 'inventory'),
  ('site_supervisor', 'safety_rounds', 3, 'Safety Rounds', 'Conduct daily safety inspections', 'health_and_safety'),
  ('site_supervisor', 'end_of_day_report', 4, 'End of Day Report', 'Seal completed jobs and generate daily summary', 'event_note')
ON CONFLICT (persona_type, step_key) DO NOTHING;

-- ============================================================================
-- STEP 10: Triggers
-- ============================================================================

-- Auto-update updated_at on user_personas
CREATE TRIGGER update_user_personas_updated_at
  BEFORE UPDATE ON user_personas
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify ENUM created
SELECT enumlabel FROM pg_enum
WHERE enumtypid = 'persona_type'::regtype
ORDER BY enumsortorder;

-- Verify tables created
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name IN ('user_personas', 'onboarding_steps', 'user_journey_progress');

-- Verify onboarding steps seeded (should be 20 = 4 steps × 5 personas)
SELECT persona_type, COUNT(*) as step_count
FROM onboarding_steps
GROUP BY persona_type
ORDER BY persona_type;

-- Verify RLS policies count
SELECT tablename, COUNT(*) as policy_count
FROM pg_policies
WHERE tablename IN ('user_personas', 'onboarding_steps', 'user_journey_progress')
GROUP BY tablename;

-- Verify functions created
SELECT proname FROM pg_proc
WHERE proname IN ('user_workspace_ids', 'complete_onboarding_step', 'complete_persona_onboarding');

COMMIT;

-- ============================================================================
-- ROLLBACK PLAN (If Needed)
-- ============================================================================

/*
BEGIN;

-- Drop functions
DROP FUNCTION IF EXISTS public.complete_persona_onboarding(persona_type);
DROP FUNCTION IF EXISTS public.complete_onboarding_step(TEXT, JSONB);
DROP FUNCTION IF EXISTS public.user_workspace_ids();

-- Drop tables (cascade will handle foreign keys)
DROP TABLE IF EXISTS user_journey_progress CASCADE;
DROP TABLE IF EXISTS user_personas CASCADE;
DROP TABLE IF EXISTS onboarding_steps CASCADE;

-- Drop ENUM
DROP TYPE IF EXISTS persona_type CASCADE;

COMMIT;
*/

-- ============================================================================
-- DEPLOYMENT CHECKLIST
-- ============================================================================

/*
PRE-DEPLOYMENT:
✅ 1. Backup database: pg_dump > backup_before_006.sql
✅ 2. Test in development environment
✅ 3. Verify no existing persona_type ENUM or tables

DEPLOYMENT:
✅ 4. Run this migration in transaction (automatic via supabase db push)
✅ 5. Verify queries above pass (20 steps seeded, 3 tables created, 3 functions)
✅ 6. Test RPC functions: complete_onboarding_step, complete_persona_onboarding

POST-DEPLOYMENT:
✅ 7. Monitor Supabase logs for errors
✅ 8. Test persona creation flow in UI
✅ 9. If errors: Run ROLLBACK PLAN above

ESTIMATED TIME: 5 minutes
*/
