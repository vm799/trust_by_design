-- ============================================================================
-- MIGRATION: Fix Technician Job Visibility (CRITICAL SECURITY)
-- Date: 2026-02-10
-- Issue: Technicians can see ALL jobs from ALL workspaces
-- ============================================================================
-- Root Cause:
--   1. bunker_jobs RLS uses USING(true) - no access control
--   2. bunker_jobs lacks assigned_technician_id and technician_email columns
--   3. No workspace_id filtering on SELECT queries
--   4. No link between auth.uid() and job assignment
--
-- Fix:
--   1. Add assigned_technician_id UUID column (for future direct assignment)
--   2. Add technician_email TEXT column (for email-based matching)
--   3. Add client_id UUID column (for proper client linking)
--   4. Replace permissive RLS policies with workspace + technician scoped ones
--   5. Backfill technician_email from invites table where available
-- ============================================================================

-- Step 1: Add assigned_technician_id column to bunker_jobs
ALTER TABLE bunker_jobs
  ADD COLUMN IF NOT EXISTS assigned_technician_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Step 2: Add technician_email for email-based matching
-- This is the primary matching field: when a manager dispatches via magic link,
-- the deliveryEmail (technician's email) is stored here. When the technician
-- logs into TechPortal with that same email, they see their assigned jobs.
ALTER TABLE bunker_jobs
  ADD COLUMN IF NOT EXISTS technician_email TEXT;

-- Step 3: Add client_id column for proper client linkage
ALTER TABLE bunker_jobs
  ADD COLUMN IF NOT EXISTS client_id UUID;

-- Step 4: Indexes for the new columns
CREATE INDEX IF NOT EXISTS idx_bunker_jobs_assigned_tech
  ON bunker_jobs(assigned_technician_id)
  WHERE assigned_technician_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bunker_jobs_tech_email
  ON bunker_jobs(technician_email)
  WHERE technician_email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bunker_jobs_workspace_tech
  ON bunker_jobs(workspace_id, assigned_technician_id)
  WHERE workspace_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bunker_jobs_workspace_tech_email
  ON bunker_jobs(workspace_id, technician_email)
  WHERE workspace_id IS NOT NULL AND technician_email IS NOT NULL;

-- ============================================================================
-- Step 5: Replace insecure RLS policies
-- ============================================================================

-- Drop the overly permissive policies
DROP POLICY IF EXISTS "bunker_jobs_select_by_id" ON bunker_jobs;
DROP POLICY IF EXISTS "bunker_jobs_update_by_id" ON bunker_jobs;
DROP POLICY IF EXISTS "bunker_jobs_insert_anon" ON bunker_jobs;

-- New SELECT policy: Authenticated users see jobs they have access to
-- Matching by: workspace_id (managers), assigned_technician_id (UUID), or technician_email
CREATE POLICY "bunker_jobs_workspace_select" ON bunker_jobs
  FOR SELECT
  TO authenticated
  USING (
    -- Workspace members (managers/admins) can see all workspace jobs
    workspace_id IN (
      SELECT workspace_id FROM users WHERE id = auth.uid()
    )
    OR
    -- Technicians can see jobs assigned to them by UUID
    assigned_technician_id = auth.uid()
    OR
    -- Technicians can see jobs dispatched to their email
    technician_email = (SELECT email FROM auth.users WHERE id = auth.uid())
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

-- New UPDATE policy: Workspace members, assigned technician, or matching email
CREATE POLICY "bunker_jobs_workspace_update" ON bunker_jobs
  FOR UPDATE
  TO authenticated
  USING (
    workspace_id IN (
      SELECT workspace_id FROM users WHERE id = auth.uid()
    )
    OR assigned_technician_id = auth.uid()
    OR technician_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  )
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM users WHERE id = auth.uid()
    )
    OR assigned_technician_id = auth.uid()
    OR technician_email = (SELECT email FROM auth.users WHERE id = auth.uid())
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
-- Step 6: Backfill technician_email from invites table
-- ============================================================================
-- The invites table stores granted_to_email (the technician's email) for each job
-- This is the most reliable source for linking jobs to technicians
UPDATE bunker_jobs bj
SET technician_email = inv.granted_to_email
FROM invites inv
WHERE bj.technician_email IS NULL
  AND inv.job_id = bj.id
  AND inv.granted_to_email IS NOT NULL
  AND inv.granted_to_email != '';

-- Step 6b: Also backfill assigned_technician_id where we can match email to auth user
UPDATE bunker_jobs bj
SET assigned_technician_id = au.id
FROM auth.users au
WHERE bj.assigned_technician_id IS NULL
  AND bj.technician_email IS NOT NULL
  AND LOWER(TRIM(au.email)) = LOWER(TRIM(bj.technician_email));

-- Step 6c: Fallback - try matching technician_name to users.full_name
UPDATE bunker_jobs bj
SET assigned_technician_id = u.id
FROM users u
WHERE bj.assigned_technician_id IS NULL
  AND bj.workspace_id IS NOT NULL
  AND u.workspace_id = bj.workspace_id
  AND LOWER(TRIM(u.full_name)) = LOWER(TRIM(bj.technician_name))
  AND bj.technician_name IS NOT NULL
  AND bj.technician_name != '';

-- Analyze after changes
ANALYZE bunker_jobs;
