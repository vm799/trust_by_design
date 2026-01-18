-- Migration: Add Site Supervisor Persona (ADDITIVE ONLY)
-- Date: 2026-01-18
-- Risk: LOW (additive changes only)
-- Rollback: See bottom of file

BEGIN;

-- ============================================
-- STEP 1: Create or Extend persona_type ENUM
-- ============================================

-- Create ENUM if it doesn't exist (migration 006 will create full version)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'persona_type') THEN
    CREATE TYPE persona_type AS ENUM ('solo_contractor', 'agency_owner', 'compliance_officer', 'safety_manager', 'site_supervisor');
  ELSE
    -- Add site_supervisor if ENUM exists but value doesn't
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum e
      JOIN pg_type t ON e.enumtypid = t.oid
      WHERE t.typname = 'persona_type' AND e.enumlabel = 'site_supervisor'
    ) THEN
      ALTER TYPE persona_type ADD VALUE 'site_supervisor';
    END IF;
  END IF;
END $$;

-- ============================================
-- STEP 2: RLS Policy for Site Supervisors (Additive)
-- ============================================

-- Site supervisors can view/manage ALL workspace jobs
CREATE POLICY "site_supervisors_all_jobs" ON public.jobs
  FOR ALL
  USING (
    workspace_id IN (SELECT public.user_workspace_ids())
    AND EXISTS (
      SELECT 1 FROM user_personas
      WHERE user_id = auth.uid()
      AND persona_type = 'site_supervisor'
      AND is_complete = true
    )
  )
  WITH CHECK (
    workspace_id IN (SELECT public.user_workspace_ids())
    AND EXISTS (
      SELECT 1 FROM user_personas
      WHERE user_id = auth.uid()
      AND persona_type = 'site_supervisor'
      AND is_complete = true
    )
  );

-- Site supervisors can view ALL workspace technicians
CREATE POLICY "site_supervisors_all_technicians" ON public.technicians
  FOR SELECT
  USING (
    workspace_id IN (SELECT public.user_workspace_ids())
    AND EXISTS (
      SELECT 1 FROM user_personas
      WHERE user_id = auth.uid()
      AND persona_type = 'site_supervisor'
      AND is_complete = true
    )
  );

-- ============================================
-- STEP 3: Extend get_user_workflow RPC (Backwards Compatible)
-- ============================================

CREATE OR REPLACE FUNCTION public.get_user_workflow()
RETURNS json AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'persona', COALESCE(p.persona_type::text, 'solo_contractor'),
    'current_step', ujp.current_step,
    'completed_steps', COALESCE(ujp.completed_steps, '[]'::jsonb),
    'permissions', CASE p.persona_type
      WHEN 'site_supervisor' THEN json_build_array(
        'all_jobs',
        'crew_assignment',
        'material_tracking',
        'safety_rounds',
        'daily_reporting'
      )
      WHEN 'agency_owner' THEN json_build_array(
        'all_jobs',
        'billing',
        'team_management'
      )
      WHEN 'compliance_officer' THEN json_build_array(
        'audit_logs',
        'seal_verification'
      )
      WHEN 'safety_manager' THEN json_build_array(
        'safety_checks',
        'incident_reports'
      )
      ELSE json_build_array('own_jobs') -- solo_contractor default
    END,
    'workspace_id', u.workspace_id,
    'is_complete', COALESCE(p.is_complete, false)
  )
  INTO result
  FROM public.users u
  LEFT JOIN user_personas p ON p.user_id = u.id AND p.is_active = true
  LEFT JOIN user_journey_progress ujp ON ujp.user_id = u.id AND ujp.persona_id = p.id
  WHERE u.id = auth.uid();

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- STEP 4: Add Supervisor Journey Steps (Metadata Only)
-- ============================================

-- Insert supervisor onboarding steps (idempotent)
INSERT INTO onboarding_steps (persona_type, step_key, step_order, title, description)
VALUES
  ('site_supervisor', 'daily_briefing', 1, 'Daily Briefing', 'Assign crews to jobs'),
  ('site_supervisor', 'material_tracking', 2, 'Material Tracking', 'Log deliveries and inventory'),
  ('site_supervisor', 'safety_rounds', 3, 'Safety Rounds', 'Conduct site inspections'),
  ('site_supervisor', 'end_of_day_report', 4, 'End of Day Report', 'Seal jobs and generate summary')
ON CONFLICT (persona_type, step_key) DO NOTHING;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Verify ENUM extension
SELECT enumlabel FROM pg_enum
WHERE enumtypid = 'persona_type'::regtype
ORDER BY enumsortorder;

-- Verify RLS policies count (should be 32 = 30 existing + 2 new)
SELECT COUNT(*) as total_policies FROM pg_policies;

-- Verify RPC function signature
SELECT proname, prosrc FROM pg_proc
WHERE proname = 'get_user_workflow';

COMMIT;

-- ============================================
-- ROLLBACK PLAN (If Needed)
-- ============================================

/*
BEGIN;

-- Drop new RLS policies
DROP POLICY IF EXISTS "site_supervisors_all_jobs" ON public.jobs;
DROP POLICY IF EXISTS "site_supervisors_all_technicians" ON public.technicians;

-- Restore old get_user_workflow (replace with previous version)
CREATE OR REPLACE FUNCTION public.get_user_workflow()
RETURNS json AS $$
-- [paste previous version here]
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Remove supervisor steps
DELETE FROM onboarding_steps WHERE persona_type = 'site_supervisor';

-- NOTE: Cannot remove ENUM value in PostgreSQL without recreating type
-- Safe to leave 'site_supervisor' in enum (unused)

COMMIT;
*/

-- ============================================
-- DEPLOYMENT CHECKLIST
-- ============================================

/*
1. Backup database: pg_dump > backup.sql
2. Run this migration in transaction
3. Verify queries above pass
4. Test existing personas (4 regression tests)
5. Deploy frontend code
6. Monitor Supabase logs for errors
7. If errors: Run ROLLBACK PLAN above
*/
