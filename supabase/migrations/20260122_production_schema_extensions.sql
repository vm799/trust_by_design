-- ============================================================================
-- MIGRATION: Production Schema Extensions
-- ============================================================================
-- Date: 2026-01-22
-- Purpose: Add 6 missing tables + extend photos table for production completeness
-- Tables Added:
--   1. client_signoffs - Client signatures, satisfaction ratings, feedback
--   2. job_status_history - Audit trail of status changes
--   3. job_dispatches - Magic link dispatch tracking, delivery status
--   4. job_time_entries - Granular time tracking (work/break/travel)
--   5. notifications - Multi-channel notification management
--   6. sync_queue - Server-side sync queue persistence
-- Photos Extended:
--   - w3w_verified, photo_hash, photo_hash_algorithm, exif_data, device_info, gps_accuracy
-- ============================================================================

-- ============================================================================
-- 1. CLIENT SIGNOFFS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS client_signoffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,

  -- Signature & Verification
  signature_url TEXT, -- Supabase Storage URL
  signature_data TEXT, -- Base64 PNG (fallback)
  signature_verified BOOLEAN DEFAULT false,
  signer_name TEXT NOT NULL,
  signer_email TEXT,

  -- Satisfaction & Feedback
  satisfaction_rating INTEGER CHECK (satisfaction_rating BETWEEN 1 AND 5),
  feedback_text TEXT,
  would_recommend BOOLEAN,

  -- Timestamps
  signed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Sync Status
  sync_status TEXT DEFAULT 'pending' CHECK (sync_status IN ('pending', 'synced', 'failed')),

  CONSTRAINT one_signoff_per_job UNIQUE (job_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_client_signoffs_job_id ON client_signoffs(job_id);
CREATE INDEX IF NOT EXISTS idx_client_signoffs_workspace_id ON client_signoffs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_client_signoffs_signed_at ON client_signoffs(signed_at);

-- RLS Policies
ALTER TABLE client_signoffs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view workspace signoffs"
  ON client_signoffs FOR SELECT
  TO authenticated
  USING (workspace_id IN (SELECT user_workspace_ids()));

CREATE POLICY "Users can create signoffs"
  ON client_signoffs FOR INSERT
  TO authenticated
  WITH CHECK (workspace_id IN (SELECT user_workspace_ids()));

CREATE POLICY "Token holders can create signoffs"
  ON client_signoffs FOR INSERT
  TO anon
  WITH CHECK (
    job_id IN (
      SELECT job_id FROM job_access_tokens
      WHERE token_hash = encode(sha256(get_request_job_token()::bytea), 'hex')
      AND expires_at > NOW()
      AND revoked_at IS NULL
    )
  );

COMMENT ON TABLE client_signoffs IS 'Client signatures and satisfaction ratings for completed jobs';
COMMENT ON COLUMN client_signoffs.satisfaction_rating IS 'Rating from 1 (poor) to 5 (excellent)';
COMMENT ON COLUMN client_signoffs.would_recommend IS 'Would client recommend service to others';

-- ============================================================================
-- 2. JOB STATUS HISTORY TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS job_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL,

  previous_status TEXT,
  new_status TEXT NOT NULL,
  changed_by_user_id UUID,
  changed_by_email TEXT,
  reason TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_job_status_history_job_id ON job_status_history(job_id);
CREATE INDEX IF NOT EXISTS idx_job_status_history_workspace_id ON job_status_history(workspace_id);
CREATE INDEX IF NOT EXISTS idx_job_status_history_created_at ON job_status_history(created_at DESC);

-- RLS Policies
ALTER TABLE job_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view workspace status history"
  ON job_status_history FOR SELECT
  TO authenticated
  USING (workspace_id IN (SELECT user_workspace_ids()));

CREATE POLICY "History entries cannot be deleted"
  ON job_status_history FOR DELETE
  TO authenticated
  USING (false);

CREATE POLICY "History entries cannot be updated"
  ON job_status_history FOR UPDATE
  TO authenticated
  USING (false);

COMMENT ON TABLE job_status_history IS 'Immutable audit trail of job status changes';

-- Trigger: Auto-log status changes
CREATE OR REPLACE FUNCTION log_job_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO job_status_history (
      job_id,
      workspace_id,
      previous_status,
      new_status,
      changed_by_user_id,
      changed_by_email
    ) VALUES (
      NEW.id,
      NEW.workspace_id,
      OLD.status,
      NEW.status,
      auth.uid(),
      (SELECT email FROM auth.users WHERE id = auth.uid())
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

DROP TRIGGER IF EXISTS job_status_change_trigger ON jobs;

CREATE TRIGGER job_status_change_trigger
  AFTER UPDATE ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION log_job_status_change();

-- ============================================================================
-- 3. JOB DISPATCHES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS job_dispatches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL,

  sent_by_user_id UUID NOT NULL,
  sent_by_email TEXT,
  sent_to_technician_id UUID REFERENCES technicians(id) ON DELETE SET NULL,
  sent_to_email TEXT,
  sent_to_phone TEXT,

  -- Channel & Link
  dispatch_channel TEXT NOT NULL CHECK (dispatch_channel IN ('sms', 'email', 'qr', 'direct_link', 'in_app')),
  magic_link_token TEXT,
  magic_link_url TEXT,
  qr_code_url TEXT,

  -- Delivery Status
  delivery_status TEXT DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'sent', 'delivered', 'opened', 'failed', 'bounced')),
  opened_at TIMESTAMPTZ,
  error_message TEXT,

  -- Retry Logic
  attempt_number INTEGER DEFAULT 1,
  last_attempt_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_job_dispatches_job_id ON job_dispatches(job_id);
CREATE INDEX IF NOT EXISTS idx_job_dispatches_workspace_id ON job_dispatches(workspace_id);
CREATE INDEX IF NOT EXISTS idx_job_dispatches_delivery_status ON job_dispatches(delivery_status);
CREATE INDEX IF NOT EXISTS idx_job_dispatches_created_at ON job_dispatches(created_at DESC);

-- RLS Policies
ALTER TABLE job_dispatches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view workspace dispatches"
  ON job_dispatches FOR SELECT
  TO authenticated
  USING (workspace_id IN (SELECT user_workspace_ids()));

CREATE POLICY "Users can create dispatches"
  ON job_dispatches FOR INSERT
  TO authenticated
  WITH CHECK (workspace_id IN (SELECT user_workspace_ids()));

CREATE POLICY "Users can update their dispatches"
  ON job_dispatches FOR UPDATE
  TO authenticated
  USING (workspace_id IN (SELECT user_workspace_ids()));

COMMENT ON TABLE job_dispatches IS 'Tracks magic link dispatches and delivery status';
COMMENT ON COLUMN job_dispatches.dispatch_channel IS 'sms, email, qr, direct_link, or in_app';
COMMENT ON COLUMN job_dispatches.delivery_status IS 'pending, sent, delivered, opened, failed, bounced';

-- ============================================================================
-- 4. JOB TIME ENTRIES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS job_time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL,
  user_id UUID,

  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,

  activity_type TEXT DEFAULT 'work' CHECK (activity_type IN ('work', 'break', 'travel', 'waiting', 'other')),
  notes TEXT,
  location_lat DECIMAL,
  location_lng DECIMAL,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_job_time_entries_job_id ON job_time_entries(job_id);
CREATE INDEX IF NOT EXISTS idx_job_time_entries_workspace_id ON job_time_entries(workspace_id);
CREATE INDEX IF NOT EXISTS idx_job_time_entries_user_id ON job_time_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_job_time_entries_started_at ON job_time_entries(started_at DESC);

-- RLS Policies
ALTER TABLE job_time_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view workspace time entries"
  ON job_time_entries FOR SELECT
  TO authenticated
  USING (workspace_id IN (SELECT user_workspace_ids()));

CREATE POLICY "Users can create time entries"
  ON job_time_entries FOR INSERT
  TO authenticated
  WITH CHECK (workspace_id IN (SELECT user_workspace_ids()));

CREATE POLICY "Users can update their time entries"
  ON job_time_entries FOR UPDATE
  TO authenticated
  USING (workspace_id IN (SELECT user_workspace_ids()) AND (user_id = auth.uid() OR user_id IS NULL));

COMMENT ON TABLE job_time_entries IS 'Granular time tracking for work, breaks, travel, and waiting';
COMMENT ON COLUMN job_time_entries.activity_type IS 'work, break, travel, waiting, or other';
COMMENT ON COLUMN job_time_entries.duration_seconds IS 'Calculated: ended_at - started_at';

-- Trigger: Auto-calculate duration
CREATE OR REPLACE FUNCTION calculate_time_entry_duration()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.ended_at IS NOT NULL AND NEW.started_at IS NOT NULL THEN
    NEW.duration_seconds := EXTRACT(EPOCH FROM (NEW.ended_at - NEW.started_at))::INTEGER;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS time_entry_duration_trigger ON job_time_entries;

CREATE TRIGGER time_entry_duration_trigger
  BEFORE INSERT OR UPDATE ON job_time_entries
  FOR EACH ROW
  EXECUTE FUNCTION calculate_time_entry_duration();

-- ============================================================================
-- 5. NOTIFICATIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  type TEXT NOT NULL CHECK (type IN (
    'job_assigned', 'job_started', 'job_completed', 'job_sealed',
    'signature_needed', 'sync_complete', 'sync_failed',
    'client_feedback', 'admin_alert', 'system_notification'
  )),
  title TEXT NOT NULL,
  message TEXT,
  related_job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,

  -- Delivery Status
  delivery_status TEXT DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'sent', 'read', 'failed', 'dismissed')),
  sent_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,

  -- Channels
  channels JSONB DEFAULT '["in_app"]'::jsonb, -- ['in_app', 'email', 'push', 'sms']

  -- Priority
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),

  -- Action
  action_url TEXT,
  action_label TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_workspace_id ON notifications(workspace_id);
CREATE INDEX IF NOT EXISTS idx_notifications_delivery_status ON notifications(delivery_status);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, delivery_status) WHERE delivery_status IN ('pending', 'sent');

-- RLS Policies
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "System can create notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (true); -- Any authenticated user can create notifications

COMMENT ON TABLE notifications IS 'Multi-channel notification system for in-app, email, push, and SMS';
COMMENT ON COLUMN notifications.channels IS 'Array of delivery channels: in_app, email, push, sms';
COMMENT ON COLUMN notifications.priority IS 'low, normal, high, or urgent';

-- ============================================================================
-- 6. SYNC QUEUE TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS sync_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  user_id UUID NOT NULL,

  operation_type TEXT NOT NULL CHECK (operation_type IN ('create', 'update', 'delete')),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('job', 'photo', 'safety_check', 'signature', 'signoff', 'time_entry')),
  entity_id UUID,

  payload JSONB NOT NULL,
  sync_status TEXT DEFAULT 'pending' CHECK (sync_status IN ('pending', 'synced', 'failed', 'conflict')),
  error_message TEXT,
  conflict_resolution TEXT,

  attempt_count INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  last_attempt_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sync_queue_workspace_id ON sync_queue(workspace_id);
CREATE INDEX IF NOT EXISTS idx_sync_queue_user_id ON sync_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_sync_queue_sync_status ON sync_queue(sync_status);
CREATE INDEX IF NOT EXISTS idx_sync_queue_entity_type ON sync_queue(entity_type);
CREATE INDEX IF NOT EXISTS idx_sync_queue_next_retry ON sync_queue(next_retry_at) WHERE sync_status = 'pending';
CREATE INDEX IF NOT EXISTS idx_sync_queue_created_at ON sync_queue(created_at DESC);

-- RLS Policies
ALTER TABLE sync_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own sync queue"
  ON sync_queue FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can manage their own sync queue"
  ON sync_queue FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

COMMENT ON TABLE sync_queue IS 'Server-side persistence of offline sync operations';
COMMENT ON COLUMN sync_queue.operation_type IS 'create, update, or delete';
COMMENT ON COLUMN sync_queue.entity_type IS 'job, photo, safety_check, signature, signoff, or time_entry';
COMMENT ON COLUMN sync_queue.sync_status IS 'pending, synced, failed, or conflict';

-- Trigger: Auto-update updated_at
CREATE OR REPLACE FUNCTION update_sync_queue_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_queue_updated_at_trigger ON sync_queue;

CREATE TRIGGER sync_queue_updated_at_trigger
  BEFORE UPDATE ON sync_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_sync_queue_timestamp();

-- ============================================================================
-- EXTEND PHOTOS TABLE
-- ============================================================================

-- Add new columns if they don't exist
DO $$
BEGIN
  -- w3w_verified
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'photos' AND column_name = 'w3w_verified') THEN
    ALTER TABLE photos ADD COLUMN w3w_verified BOOLEAN DEFAULT false;
  END IF;

  -- photo_hash
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'photos' AND column_name = 'photo_hash') THEN
    ALTER TABLE photos ADD COLUMN photo_hash TEXT;
  END IF;

  -- photo_hash_algorithm
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'photos' AND column_name = 'photo_hash_algorithm') THEN
    ALTER TABLE photos ADD COLUMN photo_hash_algorithm TEXT DEFAULT 'sha256';
  END IF;

  -- exif_data
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'photos' AND column_name = 'exif_data') THEN
    ALTER TABLE photos ADD COLUMN exif_data JSONB;
  END IF;

  -- device_info
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'photos' AND column_name = 'device_info') THEN
    ALTER TABLE photos ADD COLUMN device_info JSONB;
  END IF;

  -- gps_accuracy
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'photos' AND column_name = 'gps_accuracy') THEN
    ALTER TABLE photos ADD COLUMN gps_accuracy DECIMAL;
  END IF;
END $$;

-- Index for photo integrity verification
CREATE INDEX IF NOT EXISTS idx_photos_photo_hash ON photos(photo_hash);
CREATE INDEX IF NOT EXISTS idx_photos_w3w_verified ON photos(w3w_verified) WHERE w3w_verified = true;

-- Comments
COMMENT ON COLUMN photos.photo_hash IS 'SHA-256 hash of photo blob for integrity verification';
COMMENT ON COLUMN photos.photo_hash_algorithm IS 'Hash algorithm used (default: sha256)';
COMMENT ON COLUMN photos.exif_data IS 'Full EXIF metadata from photo for audit trail';
COMMENT ON COLUMN photos.device_info IS 'Device make, model, OS version for forensics';
COMMENT ON COLUMN photos.gps_accuracy IS 'GPS accuracy in meters';
COMMENT ON COLUMN photos.w3w_verified IS 'W3W address verified via API';

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON client_signoffs, job_dispatches TO anon; -- For token-based access
GRANT INSERT ON client_signoffs TO anon; -- For client sign-offs via token

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Verify new tables exist
DO $$
DECLARE
  missing_tables TEXT[];
BEGIN
  SELECT ARRAY_AGG(table_name)
  INTO missing_tables
  FROM (VALUES
    ('client_signoffs'),
    ('job_status_history'),
    ('job_dispatches'),
    ('job_time_entries'),
    ('notifications'),
    ('sync_queue')
  ) AS expected(table_name)
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = expected.table_name
  );

  IF missing_tables IS NOT NULL THEN
    RAISE EXCEPTION 'Migration failed: Missing tables: %', array_to_string(missing_tables, ', ');
  END IF;

  RAISE NOTICE 'Migration successful: All 6 tables created, photos table extended';
END $$;
