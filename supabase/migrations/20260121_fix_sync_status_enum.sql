-- ============================================================================
-- FIX SYNC STATUS ENUM TYPE ERROR
-- ============================================================================
-- Project: Trust by Design (JobProof)
-- Date: 2026-01-21
-- Migration: 20260121_fix_sync_status_enum.sql
--
-- This migration fixes the sync_status enum error by ensuring the column
-- is TEXT type (not enum) and supports all valid values:
-- 'pending', 'syncing', 'synced', 'failed'
--
-- The error occurred because:
-- 1. An enum type may exist in the database with limited values
-- 2. The WHERE clause in an index referenced 'syncing' which wasn't in the enum
-- 3. The TypeScript type and SQL were out of sync
--
-- SAFE TO RUN: This migration is idempotent and handles both cases:
-- - If enum exists: converts to TEXT with CHECK constraint
-- - If already TEXT: ensures CHECK constraint exists
-- ============================================================================

-- Step 1: Drop the enum type if it exists and convert columns to TEXT
DO $$
BEGIN
    -- Check if sync_status_enum exists
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sync_status_enum') THEN
        -- Convert jobs.sync_status from enum to TEXT
        ALTER TABLE public.jobs
            ALTER COLUMN sync_status TYPE TEXT USING sync_status::TEXT;

        -- Convert photos.sync_status from enum to TEXT
        ALTER TABLE public.photos
            ALTER COLUMN sync_status TYPE TEXT USING sync_status::TEXT;

        -- Drop the enum type (no longer needed)
        DROP TYPE IF EXISTS sync_status_enum;

        RAISE NOTICE 'Converted sync_status from enum to TEXT';
    ELSE
        RAISE NOTICE 'sync_status_enum does not exist, columns already TEXT';
    END IF;
END $$;

-- Step 2: Add CHECK constraints to ensure only valid values
-- Drop existing constraints if they exist
ALTER TABLE public.jobs
    DROP CONSTRAINT IF EXISTS jobs_sync_status_check;

ALTER TABLE public.photos
    DROP CONSTRAINT IF EXISTS photos_sync_status_check;

-- Add new CHECK constraints with all 4 valid values
ALTER TABLE public.jobs
    ADD CONSTRAINT jobs_sync_status_check
    CHECK (sync_status IN ('pending', 'syncing', 'synced', 'failed'));

ALTER TABLE public.photos
    ADD CONSTRAINT photos_sync_status_check
    CHECK (sync_status IN ('pending', 'syncing', 'synced', 'failed'));

-- Step 3: Ensure default values are set correctly
ALTER TABLE public.jobs
    ALTER COLUMN sync_status SET DEFAULT 'pending';

ALTER TABLE public.photos
    ALTER COLUMN sync_status SET DEFAULT 'pending';

-- Step 4: Update any NULL values to 'pending' (shouldn't exist but just in case)
UPDATE public.jobs
    SET sync_status = 'pending'
    WHERE sync_status IS NULL;

UPDATE public.photos
    SET sync_status = 'pending'
    WHERE sync_status IS NULL;

-- Step 5: Make sync_status NOT NULL (if not already)
ALTER TABLE public.jobs
    ALTER COLUMN sync_status SET NOT NULL;

ALTER TABLE public.photos
    ALTER COLUMN sync_status SET NOT NULL;

-- Verify the changes
DO $$
BEGIN
    RAISE NOTICE 'sync_status migration completed successfully';
    RAISE NOTICE 'Valid values: pending, syncing, synced, failed';
END $$;
