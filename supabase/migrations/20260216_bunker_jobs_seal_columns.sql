-- ============================================================================
-- ADD SEAL + W3W COLUMNS TO BUNKER_JOBS
-- Required for: generate-report reads sealed_at/evidence_hash,
--               seal-evidence writes sealed_at after sealing,
--               generate-report reads before_photo_w3w/after_photo_w3w
-- ============================================================================

-- Seal tracking columns (written by generate-report Step 5 + seal-evidence)
ALTER TABLE bunker_jobs ADD COLUMN IF NOT EXISTS sealed_at TIMESTAMPTZ;
ALTER TABLE bunker_jobs ADD COLUMN IF NOT EXISTS evidence_hash TEXT;
ALTER TABLE bunker_jobs ADD COLUMN IF NOT EXISTS sealed_by TEXT;

-- Per-photo W3W columns (used by generate-report email template)
ALTER TABLE bunker_jobs ADD COLUMN IF NOT EXISTS before_photo_w3w TEXT;
ALTER TABLE bunker_jobs ADD COLUMN IF NOT EXISTS after_photo_w3w TEXT;

-- Index for sealed status queries
CREATE INDEX IF NOT EXISTS idx_bunker_jobs_sealed ON bunker_jobs(sealed_at)
  WHERE sealed_at IS NOT NULL;

COMMENT ON COLUMN bunker_jobs.sealed_at IS 'Timestamp when evidence was cryptographically sealed';
COMMENT ON COLUMN bunker_jobs.evidence_hash IS 'SHA-256 hash of the sealed evidence bundle';
COMMENT ON COLUMN bunker_jobs.sealed_by IS 'Email of user/system that sealed the evidence';
COMMENT ON COLUMN bunker_jobs.before_photo_w3w IS 'What3Words address at before photo capture location';
COMMENT ON COLUMN bunker_jobs.after_photo_w3w IS 'What3Words address at after photo capture location';
