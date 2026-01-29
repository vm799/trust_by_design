-- ============================================================================
-- Fix: Reference 'users' table instead of 'profiles' in RLS policies
-- Date: 2026-01-29
-- Issue: bunker_jobs_delete_workspace policy references non-existent 'profiles' table
-- ============================================================================

-- Drop the incorrect policy
DROP POLICY IF EXISTS "bunker_jobs_delete_workspace" ON bunker_jobs;

-- Recreate with correct table name (users, not profiles)
CREATE POLICY "bunker_jobs_delete_workspace" ON bunker_jobs
  FOR DELETE
  TO authenticated
  USING (
    workspace_id IN (
      SELECT workspace_id FROM users WHERE id = auth.uid()
    )
  );

-- ============================================================================
-- Add index on invites.job_id if missing (from security audit)
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_invites_job_id ON invites(job_id);

COMMENT ON INDEX idx_invites_job_id IS 'Performance: fast lookup of invites by job_id';
