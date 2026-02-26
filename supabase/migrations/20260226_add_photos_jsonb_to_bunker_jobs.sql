-- ============================================================================
-- Fix 53: Add photos JSONB column to bunker_jobs
--
-- ROOT CAUSE: Photo metadata (URLs, GPS, W3W, type) was stored ONLY in
-- IndexedDB. The server had NO record of photos. Every pull returned
-- photos: [], requiring 7+ merge fixes to preserve IndexedDB photos.
-- Each merge had edge cases that caused photo loss.
--
-- FIX: Store photos array in bunker_jobs so server is source of truth.
-- processUploadPhoto writes metadata here after each upload.
-- pullJobs reads it instead of hardcoding [].
-- ============================================================================

-- Add photos JSONB column — stores the Photo[] metadata array
-- Each entry: { id, url, type, timestamp, lat, lng, w3w, syncStatus, ... }
ALTER TABLE bunker_jobs
  ADD COLUMN IF NOT EXISTS photos JSONB DEFAULT '[]'::jsonb;

-- Add signature metadata columns if missing
-- (signature_data exists but these may not)
ALTER TABLE bunker_jobs
  ADD COLUMN IF NOT EXISTS client_confirmation JSONB DEFAULT NULL;

ALTER TABLE bunker_jobs
  ADD COLUMN IF NOT EXISTS completion_notes TEXT DEFAULT NULL;

-- Index for jobs that have photos (partial index — only non-empty arrays)
CREATE INDEX IF NOT EXISTS idx_bunker_jobs_has_photos
  ON bunker_jobs ((photos IS NOT NULL AND photos != '[]'::jsonb))
  WHERE photos IS NOT NULL AND photos != '[]'::jsonb;

COMMENT ON COLUMN bunker_jobs.photos IS
  'Photo metadata array. Each element: {id, url, type, timestamp, lat, lng, w3w, w3w_verified, syncStatus, verified, gps_accuracy, photo_hash}. Written by processUploadPhoto after Storage upload. Source of truth for photo references.';
