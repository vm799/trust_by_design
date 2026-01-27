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
  client_email TEXT,
  w3w TEXT,  -- What3Words location

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

-- ============================================================================
-- PUBLIC ACCESS POLICIES (for Bunker Mode - NO AUTH REQUIRED)
-- The Job ID in the URL is the permission to work
-- ============================================================================

-- Policy: Allow insert for anyone (offline sync from anonymous devices)
CREATE POLICY "bunker_jobs_insert_anon" ON bunker_jobs
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Policy: Allow select by job ID (public access via URL)
CREATE POLICY "bunker_jobs_select_by_id" ON bunker_jobs
  FOR SELECT
  TO anon, authenticated
  USING (true);  -- Anyone with the job ID can view

-- Policy: Allow update by job ID (technician can update their job)
CREATE POLICY "bunker_jobs_update_by_id" ON bunker_jobs
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- AUTHENTICATED ACCESS POLICIES (for Dashboard)
-- ============================================================================

-- Policy: Workspace members can delete jobs
CREATE POLICY "bunker_jobs_delete_workspace" ON bunker_jobs
  FOR DELETE
  TO authenticated
  USING (
    workspace_id IN (
      SELECT workspace_id FROM profiles WHERE id = auth.uid()
    )
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

-- ============================================================================
-- STORAGE BUCKET FOR JOB PHOTOS (PUBLIC ACCESS)
-- This enables technicians to upload photos without authentication
-- ============================================================================

-- Create the storage bucket for job photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'job-photos',
  'job-photos',
  true,  -- PUBLIC ACCESS - required for anonymous uploads
  5242880,  -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880;

-- Create the storage bucket for job reports (PDFs)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'job-reports',
  'job-reports',
  true,  -- PUBLIC for download links
  10485760,  -- 10MB limit
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 10485760;

-- ============================================================================
-- STORAGE POLICIES - Allow anonymous uploads
-- ============================================================================

-- Policy: Anyone can upload to job-photos
CREATE POLICY "job_photos_insert_anon" ON storage.objects
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'job-photos');

-- Policy: Anyone can view job-photos (public download)
CREATE POLICY "job_photos_select_public" ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'job-photos');

-- Policy: Anyone can view job-reports (public download)
CREATE POLICY "job_reports_select_public" ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'job-reports');

-- Policy: Service role can insert reports
CREATE POLICY "job_reports_insert_service" ON storage.objects
  FOR INSERT
  TO service_role
  WITH CHECK (bucket_id = 'job-reports');

-- ============================================================================
-- DATABASE TRIGGER: Auto-generate report on job completion
-- ============================================================================

CREATE OR REPLACE FUNCTION notify_job_completed()
RETURNS TRIGGER AS $$
BEGIN
  -- Only trigger if status changed to 'Complete'
  IF NEW.status = 'Complete' AND (OLD.status IS NULL OR OLD.status != 'Complete') THEN
    -- Log the completion (report generation is handled by Edge Function)
    RAISE NOTICE 'Job % completed. Report will be generated.', NEW.id;

    -- You could also use pg_notify for real-time:
    -- PERFORM pg_notify('job_completed', json_build_object('job_id', NEW.id)::text);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_job_completed
  AFTER INSERT OR UPDATE ON bunker_jobs
  FOR EACH ROW
  EXECUTE FUNCTION notify_job_completed();
