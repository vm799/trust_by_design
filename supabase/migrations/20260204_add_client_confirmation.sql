-- Migration: Add client confirmation field to jobs table
-- This stores the client's satisfaction sign-off with signature
-- Created: 2026-02-04

-- Add client_confirmation JSONB column to jobs table
-- Structure: { signature: string (data URL), timestamp: string (ISO UTC), confirmed: boolean }
ALTER TABLE jobs
ADD COLUMN IF NOT EXISTS client_confirmation JSONB DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN jobs.client_confirmation IS 'Client satisfaction confirmation with signature. Structure: { signature: string (data URL), timestamp: string (ISO UTC), confirmed: boolean }';

-- Create index for querying confirmed jobs
CREATE INDEX IF NOT EXISTS idx_jobs_client_confirmation_confirmed
ON jobs ((client_confirmation->>'confirmed'))
WHERE client_confirmation IS NOT NULL;

-- Add check constraint to ensure valid structure when present
ALTER TABLE jobs
ADD CONSTRAINT chk_client_confirmation_structure
CHECK (
  client_confirmation IS NULL
  OR (
    client_confirmation ? 'signature'
    AND client_confirmation ? 'timestamp'
    AND client_confirmation ? 'confirmed'
    AND (client_confirmation->>'confirmed')::boolean = true
  )
);
