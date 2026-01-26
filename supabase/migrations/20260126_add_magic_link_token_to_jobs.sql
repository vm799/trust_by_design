-- Migration: Add magic_link_token columns to jobs table
-- Purpose: Enable cross-browser technician link validation
-- Date: 2026-01-26
--
-- ROOT CAUSE FIX:
-- Previously, magic link tokens were only stored in:
-- 1. job_access_tokens table (may fail if not stored there)
-- 2. localStorage (doesn't work cross-browser)
--
-- This migration adds the token directly to the jobs table as a fallback,
-- ensuring technicians can always validate their links via Supabase.

-- Add magic_link_token column (stores the raw token for lookup)
ALTER TABLE public.jobs
ADD COLUMN IF NOT EXISTS magic_link_token TEXT;

-- Add magic_link_url column (stores the full URL for reference)
ALTER TABLE public.jobs
ADD COLUMN IF NOT EXISTS magic_link_url TEXT;

-- Create index for fast token lookup
-- This is critical for the validateMagicLink fallback query
CREATE INDEX IF NOT EXISTS idx_jobs_magic_link_token
ON public.jobs (magic_link_token)
WHERE magic_link_token IS NOT NULL;

-- Add comment explaining the columns
COMMENT ON COLUMN public.jobs.magic_link_token IS
'Magic link token for cross-browser technician access. Used as fallback when job_access_tokens lookup fails.';

COMMENT ON COLUMN public.jobs.magic_link_url IS
'Full magic link URL for reference and debugging.';

-- Grant permissions (inherit from existing jobs table RLS)
-- No additional RLS needed as these columns follow existing jobs table policies
