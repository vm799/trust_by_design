-- JobProof v2 Database Schema
-- Run this SQL in your Supabase SQL Editor (Dashboard -> SQL Editor -> New Query)

-- ============================================================================
-- JOBS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  client TEXT NOT NULL,
  address TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'Pending',

  -- Location data (dual-signal)
  lat DECIMAL(10, 8),
  lng DECIMAL(11, 8),
  w3w TEXT,

  -- Technician assignment
  assignee TEXT,

  -- Evidence metadata
  signer_name TEXT,
  signer_role TEXT,
  signature_url TEXT, -- Supabase Storage URL

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  last_updated BIGINT,

  -- Sync status
  sync_status TEXT DEFAULT 'pending'
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_sync ON jobs(sync_status);
CREATE INDEX IF NOT EXISTS idx_jobs_created ON jobs(created_at DESC);

-- ============================================================================
-- PHOTOS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS photos (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,

  -- Storage URL
  url TEXT NOT NULL, -- Supabase Storage URL

  -- Metadata
  type TEXT NOT NULL, -- Before/During/After/Evidence
  timestamp TIMESTAMPTZ NOT NULL,
  verified BOOLEAN DEFAULT true,

  -- Location data
  lat DECIMAL(10, 8),
  lng DECIMAL(11, 8),
  w3w TEXT,

  -- Sync status
  sync_status TEXT DEFAULT 'pending'
);

-- Index for job lookups
CREATE INDEX IF NOT EXISTS idx_photos_job ON photos(job_id);
CREATE INDEX IF NOT EXISTS idx_photos_type ON photos(type);

-- ============================================================================
-- SAFETY CHECKLIST TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS safety_checks (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,

  label TEXT NOT NULL,
  checked BOOLEAN DEFAULT false,
  required BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_safety_job ON safety_checks(job_id);

-- ============================================================================
-- CLIENTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_updated BIGINT
);

CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(name);

-- ============================================================================
-- TECHNICIANS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS technicians (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  specialty TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_updated BIGINT
);

CREATE INDEX IF NOT EXISTS idx_technicians_name ON technicians(name);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================
-- Enable RLS on all tables
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE safety_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE technicians ENABLE ROW LEVEL SECURITY;

-- Policy: Allow anonymous read/write (magic links have no auth)
-- IMPORTANT: For production, replace with proper auth policies
CREATE POLICY "Allow anonymous access to jobs"
  ON jobs FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anonymous access to photos"
  ON photos FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anonymous access to safety_checks"
  ON safety_checks FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anonymous access to clients"
  ON clients FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anonymous access to technicians"
  ON technicians FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- STORAGE BUCKETS
-- ============================================================================
-- Create storage buckets (run these in SQL Editor)
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('job-photos', 'job-photos', true),
  ('job-signatures', 'job-signatures', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: Allow anonymous upload/download
CREATE POLICY "Allow anonymous upload to job-photos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'job-photos');

CREATE POLICY "Allow anonymous read from job-photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'job-photos');

CREATE POLICY "Allow anonymous upload to job-signatures"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'job-signatures');

CREATE POLICY "Allow anonymous read from job-signatures"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'job-signatures');

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function: Get job with all related data
CREATE OR REPLACE FUNCTION get_job_with_details(job_id TEXT)
RETURNS JSON AS $$
  SELECT json_build_object(
    'job', row_to_json(j.*),
    'photos', COALESCE(json_agg(p.*) FILTER (WHERE p.id IS NOT NULL), '[]'),
    'safety_checks', COALESCE(json_agg(s.*) FILTER (WHERE s.id IS NOT NULL), '[]')
  )
  FROM jobs j
  LEFT JOIN photos p ON p.job_id = j.id
  LEFT JOIN safety_checks s ON s.job_id = j.id
  WHERE j.id = job_id
  GROUP BY j.id;
$$ LANGUAGE SQL;

-- ============================================================================
-- INITIAL DATA (Optional - for testing)
-- ============================================================================

-- You can uncomment this to seed test data:
-- INSERT INTO clients (id, name, email, phone, address)
-- VALUES ('client_1', 'Acme Corp', 'contact@acme.com', '+1-555-0100', '123 Main St, City, ST 12345');

-- INSERT INTO technicians (id, name, email, phone, specialty)
-- VALUES ('tech_1', 'John Smith', 'john@jobproof.com', '+1-555-0101', 'HVAC');
