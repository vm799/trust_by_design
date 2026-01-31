-- Migration: Add missing index on bunker_jobs.created_at
-- Issue: Slow query detected (134ms mean) from Supabase slow query report
-- Expected improvement: Query time reduction from 134ms to <20ms
--
-- Safe to run: Uses CREATE INDEX CONCURRENTLY (non-blocking)
-- Rollback: DROP INDEX CONCURRENTLY IF EXISTS idx_bunker_jobs_created_at;

-- Priority 1: Main query optimization - ORDER BY created_at DESC
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bunker_jobs_created_at
ON public.bunker_jobs USING btree (created_at DESC);

-- Priority 2: Composite index for common query patterns (workspace + created_at)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bunker_jobs_workspace_created
ON public.bunker_jobs USING btree (workspace_id, created_at DESC)
WHERE workspace_id IS NOT NULL;

-- Priority 3: Index for technician lookup (common in portal views)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bunker_jobs_technician_status
ON public.bunker_jobs USING btree (assigned_technician_id, status)
WHERE assigned_technician_id IS NOT NULL;

-- Analyze table after index creation for optimal query planning
ANALYZE public.bunker_jobs;
