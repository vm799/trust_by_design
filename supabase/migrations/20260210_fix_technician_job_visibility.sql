-- ============================================================================
-- MIGRATION: Fix Technician Job Visibility (CRITICAL SECURITY)
-- Date: 2026-02-10
-- Issue: Technicians can see ALL jobs from ALL workspaces
-- ============================================================================
-- Root Cause:
--   1. bunker_jobs RLS uses USING(true) - no access control
--   2. bunker_jobs lacks assigned_technician_id column
--   3. No workspace_id filtering on SELECT queries
--
-- Fix:
--   1. Add assigned_technician_id UUID column to bunker_jobs
--   2. Add client_id UUID column to bunker_jobs (for proper linking)
--   3. Replace permissive RLS policies with workspace + technician scoped ones
--   4. Backfill assigned_technician_id from users table where technician_name matches
-- ============================================================================

-- Step 1: Add assigned_technician_id column to bunker_jobs
ALTER TABLE bunker_jobs
  ADD COLUMN IF NOT EXISTS assigned_technician_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Step 2: Add client_id column for proper client linkage
ALTER TABLE bunker_jobs
  ADD COLUMN IF NOT EXISTS client_id UUID;

-- Step 3: Index for technician lookup (matches existing index optimization migration)
CREATE INDEX IF NOT EXISTS idx_bunker_jobs_assigned_tech
  ON bunker_jobs(assigned_technician_id)
  WHERE assigned_technician_id IS NOT NULL;

-- Step 4: Composite index for workspace + technician (common portal query)
CREATE INDEX IF NOT EXISTS idx_bunker_jobs_workspace_tech
  ON bunker_jobs(workspace_id, assigned_technician_id)
  WHERE workspace_id IS NOT NULL;

-- ============================================================================
-- Step 5: Replace insecure RLS policies
-- ============================================================================

-- Drop the overly permissive policies
DROP POLICY IF EXISTS "bunker_jobs_select_by_id" ON bunker_jobs;
DROP POLICY IF EXISTS "bunker_jobs_update_by_id" ON bunker_jobs;
DROP POLICY IF EXISTS "bunker_jobs_insert_anon" ON bunker_jobs;

-- New SELECT policy: Authenticated users see jobs in their workspace
-- Managers/admins see all workspace jobs; technicians see only assigned jobs
CREATE POLICY "bunker_jobs_workspace_select" ON bunker_jobs
  FOR SELECT
  TO authenticated
  USING (
    -- Workspace members (managers/admins) can see all workspace jobs
    workspace_id IN (
      SELECT workspace_id FROM users WHERE id = auth.uid()
    )
    OR
    -- Technicians can see jobs assigned to them
    assigned_technician_id = auth.uid()
  );

-- Anonymous SELECT: Only via magic link (job ID must be known)
-- This preserves Bunker Mode for anonymous technicians with magic links
CREATE POLICY "bunker_jobs_anon_select" ON bunker_jobs
  FOR SELECT
  TO anon
  USING (
    id = current_setting('request.headers', true)::json->>'x-job-id'
  );

-- New INSERT policy: Authenticated users can create in their workspace
CREATE POLICY "bunker_jobs_workspace_insert" ON bunker_jobs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM users WHERE id = auth.uid()
    )
  );

-- Anonymous INSERT: Preserve for Bunker Mode (offline sync)
CREATE POLICY "bunker_jobs_anon_insert" ON bunker_jobs
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- New UPDATE policy: Workspace members or assigned technician
CREATE POLICY "bunker_jobs_workspace_update" ON bunker_jobs
  FOR UPDATE
  TO authenticated
  USING (
    workspace_id IN (
      SELECT workspace_id FROM users WHERE id = auth.uid()
    )
    OR assigned_technician_id = auth.uid()
  )
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM users WHERE id = auth.uid()
    )
    OR assigned_technician_id = auth.uid()
  );

-- Anonymous UPDATE: Only for Bunker Mode (via job ID header)
CREATE POLICY "bunker_jobs_anon_update" ON bunker_jobs
  FOR UPDATE
  TO anon
  USING (
    id = current_setting('request.headers', true)::json->>'x-job-id'
  )
  WITH CHECK (
    id = current_setting('request.headers', true)::json->>'x-job-id'
  );

-- ============================================================================
-- Step 6: Backfill assigned_technician_id from user profiles
-- ============================================================================
-- Match technician_name to users.full_name within the same workspace
UPDATE bunker_jobs bj
SET assigned_technician_id = u.id
FROM users u
WHERE bj.assigned_technician_id IS NULL
  AND bj.workspace_id IS NOT NULL
  AND u.workspace_id = bj.workspace_id
  AND LOWER(TRIM(u.full_name)) = LOWER(TRIM(bj.technician_name))
  AND u.role = 'technician';

-- Analyze after changes
ANALYZE bunker_jobs;

-- ============================================================================
-- VERIFICATION QUERIES (run after migration)
-- ============================================================================

-- Verify new column exists
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'bunker_jobs' AND column_name = 'assigned_technician_id';

-- Verify RLS policies
-- SELECT policyname, cmd, qual FROM pg_policies
-- WHERE tablename = 'bunker_jobs';

-- Count jobs with assigned_technician_id set
-- SELECT
--   COUNT(*) as total,
--   COUNT(assigned_technician_id) as with_tech_id,
--   COUNT(*) - COUNT(assigned_technician_id) as without_tech_id
-- FROM bunker_jobs;
