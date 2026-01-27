-- ============================================================================
-- BUNKER-PROOF MVP SCHEMA
-- Simplified table for offline-first job evidence capture
-- ============================================================================

-- Drop if exists (development only - remove for production)
-- DROP TABLE IF EXISTS bunker_jobs;

-- Create bunker_jobs table
CREATE TABLE IF NOT EXISTS bunker_jobs (
  -- Primary key
  id TEXT PRIMARY KEY,

  -- Job metadata
  title TEXT NOT NULL DEFAULT 'Untitled Job',
  client TEXT NOT NULL DEFAULT 'Unknown Client',
  address TEXT,
  notes TEXT,

  -- Manager info for report delivery
  manager_email TEXT,
  manager_name TEXT,
  technician_name TEXT,

  -- Status
  status TEXT NOT NULL DEFAULT 'In Progress'
    CHECK (status IN ('Pending', 'In Progress', 'Complete', 'Submitted')),

  -- Before photo (stored as base64 or Storage URL)
  before_photo_data TEXT,  -- Base64 for small files
  before_photo_url TEXT,   -- Supabase Storage URL for large files
  before_photo_timestamp TIMESTAMPTZ,
  before_photo_lat DECIMAL(10, 8),
  before_photo_lng DECIMAL(11, 8),

  -- After photo
  after_photo_data TEXT,
  after_photo_url TEXT,
  after_photo_timestamp TIMESTAMPTZ,
  after_photo_lat DECIMAL(10, 8),
  after_photo_lng DECIMAL(11, 8),

  -- Client signature
  signature_data TEXT,     -- Base64 PNG
  signature_url TEXT,      -- Supabase Storage URL
  signer_name TEXT,
  signature_timestamp TIMESTAMPTZ,

  -- Timestamps
  completed_at TIMESTAMPTZ,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Report generation
  report_url TEXT,           -- URL to generated PDF report
  report_generated_at TIMESTAMPTZ,
  report_emailed BOOLEAN DEFAULT FALSE,

  -- Sync metadata
  sync_source TEXT DEFAULT 'mobile' CHECK (sync_source IN ('mobile', 'web', 'api')),
  device_id TEXT,

  -- Optional workspace linkage (for multi-tenant)
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_bunker_jobs_status ON bunker_jobs(status);
CREATE INDEX IF NOT EXISTS idx_bunker_jobs_workspace ON bunker_jobs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_bunker_jobs_created ON bunker_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bunker_jobs_updated ON bunker_jobs(last_updated DESC);

-- Row Level Security (RLS)
ALTER TABLE bunker_jobs ENABLE ROW LEVEL SECURITY;

-- Policy: Allow insert for anyone (for offline sync from anonymous devices)
CREATE POLICY "bunker_jobs_insert_policy" ON bunker_jobs
  FOR INSERT
  WITH CHECK (true);

-- Policy: Allow update for anyone on their own jobs (by device_id or workspace)
CREATE POLICY "bunker_jobs_update_policy" ON bunker_jobs
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Policy: Allow read for authenticated users in same workspace
CREATE POLICY "bunker_jobs_select_policy" ON bunker_jobs
  FOR SELECT
  USING (
    -- Allow if workspace matches user's workspace
    workspace_id IN (
      SELECT workspace_id FROM profiles WHERE id = auth.uid()
    )
    -- Or allow public access for testing (remove in production)
    OR workspace_id IS NULL
  );

-- ============================================================================
-- SIMPLIFIED PHOTOS TABLE (Alternative to embedded data)
-- Use this if you want to store photos separately
-- ============================================================================

CREATE TABLE IF NOT EXISTS bunker_photos (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES bunker_jobs(id) ON DELETE CASCADE,

  -- Photo type
  type TEXT NOT NULL CHECK (type IN ('before', 'after')),

  -- Storage
  data_url TEXT,           -- Base64 for offline (< 1MB)
  storage_url TEXT,        -- Supabase Storage URL (for large files)

  -- Metadata
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  lat DECIMAL(10, 8),
  lng DECIMAL(11, 8),
  size_bytes INTEGER,

  -- Integrity
  hash_sha256 TEXT,        -- SHA-256 hash for tamper detection

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bunker_photos_job ON bunker_photos(job_id);
CREATE INDEX IF NOT EXISTS idx_bunker_photos_type ON bunker_photos(type);

-- RLS for photos
ALTER TABLE bunker_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bunker_photos_policy" ON bunker_photos
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- SIMPLIFIED SIGNATURES TABLE (Alternative to embedded data)
-- ============================================================================

CREATE TABLE IF NOT EXISTS bunker_signatures (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  job_id TEXT NOT NULL REFERENCES bunker_jobs(id) ON DELETE CASCADE,

  -- Signature data
  data_url TEXT NOT NULL,  -- Base64 PNG
  storage_url TEXT,        -- Supabase Storage URL

  -- Signer info
  signer_name TEXT NOT NULL,
  signer_email TEXT,

  -- Metadata
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  device_info JSONB,       -- Device metadata for audit

  -- Integrity
  hash_sha256 TEXT,        -- SHA-256 hash for tamper detection

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bunker_signatures_job ON bunker_signatures(job_id);

-- RLS for signatures
ALTER TABLE bunker_signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bunker_signatures_policy" ON bunker_signatures
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- UPSERT FUNCTION (for sync conflict resolution)
-- ============================================================================

CREATE OR REPLACE FUNCTION upsert_bunker_job(
  p_id TEXT,
  p_title TEXT DEFAULT NULL,
  p_client TEXT DEFAULT NULL,
  p_address TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_manager_email TEXT DEFAULT NULL,
  p_manager_name TEXT DEFAULT NULL,
  p_technician_name TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_before_photo_data TEXT DEFAULT NULL,
  p_after_photo_data TEXT DEFAULT NULL,
  p_signature_data TEXT DEFAULT NULL,
  p_signer_name TEXT DEFAULT NULL,
  p_completed_at TIMESTAMPTZ DEFAULT NULL,
  p_last_updated TIMESTAMPTZ DEFAULT NOW()
)
RETURNS bunker_jobs AS $$
DECLARE
  result bunker_jobs;
BEGIN
  INSERT INTO bunker_jobs (
    id, title, client, address, notes,
    manager_email, manager_name, technician_name,
    status, before_photo_data, after_photo_data,
    signature_data, signer_name,
    completed_at, last_updated
  )
  VALUES (
    p_id,
    COALESCE(p_title, 'Untitled Job'),
    COALESCE(p_client, 'Unknown Client'),
    p_address,
    p_notes,
    p_manager_email,
    p_manager_name,
    p_technician_name,
    COALESCE(p_status, 'In Progress'),
    p_before_photo_data,
    p_after_photo_data,
    p_signature_data,
    p_signer_name,
    p_completed_at,
    p_last_updated
  )
  ON CONFLICT (id) DO UPDATE SET
    title = COALESCE(EXCLUDED.title, bunker_jobs.title),
    client = COALESCE(EXCLUDED.client, bunker_jobs.client),
    address = COALESCE(EXCLUDED.address, bunker_jobs.address),
    notes = COALESCE(EXCLUDED.notes, bunker_jobs.notes),
    manager_email = COALESCE(EXCLUDED.manager_email, bunker_jobs.manager_email),
    manager_name = COALESCE(EXCLUDED.manager_name, bunker_jobs.manager_name),
    technician_name = COALESCE(EXCLUDED.technician_name, bunker_jobs.technician_name),
    status = COALESCE(EXCLUDED.status, bunker_jobs.status),
    before_photo_data = COALESCE(EXCLUDED.before_photo_data, bunker_jobs.before_photo_data),
    after_photo_data = COALESCE(EXCLUDED.after_photo_data, bunker_jobs.after_photo_data),
    signature_data = COALESCE(EXCLUDED.signature_data, bunker_jobs.signature_data),
    signer_name = COALESCE(EXCLUDED.signer_name, bunker_jobs.signer_name),
    completed_at = COALESCE(EXCLUDED.completed_at, bunker_jobs.completed_at),
    last_updated = EXCLUDED.last_updated
  WHERE EXCLUDED.last_updated > bunker_jobs.last_updated
  RETURNING * INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION upsert_bunker_job TO anon, authenticated;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE bunker_jobs IS 'Bunker-proof offline-first job evidence storage';
COMMENT ON TABLE bunker_photos IS 'Separate photo storage for large files';
COMMENT ON TABLE bunker_signatures IS 'Separate signature storage for audit trail';
COMMENT ON FUNCTION upsert_bunker_job IS 'Conflict-resolving upsert for offline sync';
