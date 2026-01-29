-- ============================================================================
-- Fix: Reference 'users' table instead of 'profiles' in RLS policies
-- Date: 2026-01-29
-- Issue: bunker_jobs_delete_workspace policy references non-existent 'profiles' table
-- ============================================================================

-- Drop the incorrect policy (references non-existent 'profiles' table)
DROP POLICY IF EXISTS "bunker_jobs_delete_workspace" ON bunker_jobs;

-- Recreate with correct table name (users, not profiles)
-- Allow delete if:
-- 1. workspace_id matches user's workspace, OR
-- 2. workspace_id is NULL (legacy bunker-mode jobs)
CREATE POLICY "bunker_jobs_delete_workspace" ON bunker_jobs
  FOR DELETE
  TO authenticated
  USING (
    workspace_id IS NULL
    OR workspace_id IN (
      SELECT workspace_id FROM users WHERE id = auth.uid()
    )
  );
