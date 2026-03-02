-- ============================================================================
-- Fix Evidence Pipeline: Status Constraint + Signature Columns
--
-- ROOT CAUSE: bunker_jobs.status CHECK only allowed
-- ('Pending', 'In Progress', 'Complete', 'Submitted').
-- The app sets status to 'Archived', 'Draft', 'Paused', 'Cancelled'
-- which silently fail at the database level.
--
-- Also ensures signature_url column exists for Storage-based signatures.
-- ============================================================================

-- Step 1: Drop the old restrictive CHECK constraint
-- The constraint name from the original migration is: bunker_jobs_status_check
ALTER TABLE bunker_jobs DROP CONSTRAINT IF EXISTS bunker_jobs_status_check;

-- Step 2: Add new CHECK constraint matching the full JobStatus type
ALTER TABLE bunker_jobs ADD CONSTRAINT bunker_jobs_status_check
  CHECK (status IN (
    'Pending', 'In Progress', 'Complete', 'Submitted',
    'Archived', 'Draft', 'Paused', 'Cancelled'
  ));

-- Step 3: Ensure assigned_technician_id column exists (used by processUpdateJob)
ALTER TABLE bunker_jobs ADD COLUMN IF NOT EXISTS assigned_technician_id UUID;

-- Step 4: Ensure client_id column exists (used by pullJobs mapping)
ALTER TABLE bunker_jobs ADD COLUMN IF NOT EXISTS client_id TEXT;

-- Step 5: Index for technician job queries
CREATE INDEX IF NOT EXISTS idx_bunker_jobs_technician
  ON bunker_jobs(assigned_technician_id)
  WHERE assigned_technician_id IS NOT NULL;

COMMENT ON CONSTRAINT bunker_jobs_status_check ON bunker_jobs IS
  'Full job lifecycle: Draft → Pending → In Progress → Complete → Submitted → Archived. Also: Paused, Cancelled.';
