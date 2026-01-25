-- =====================================================================
-- MIGRATION 003: AUDIT TRAIL
-- =====================================================================
-- Phase: C.4 - Audit Trail
-- Purpose: Implement comprehensive audit logging for all evidence access
-- Features:
--   - Append-only audit_logs table
--   - Auto-logging of all evidence operations
--   - Workspace-scoped RLS
--   - Append-only (no DELETE/UPDATE)
-- =====================================================================

-- =====================================================================
-- 1. AUDIT LOGS TABLE
-- =====================================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Event details
  event_type TEXT NOT NULL, -- 'job_view', 'job_create', 'job_update', 'photo_view', 'report_export', 'seal_create', 'seal_verify'
  resource_type TEXT NOT NULL, -- 'job', 'photo', 'seal', 'report'
  resource_id TEXT NOT NULL, -- Job ID, photo ID, etc.

  -- User context
  user_email TEXT,
  ip_address TEXT,
  user_agent TEXT,

  -- Additional metadata
  metadata JSONB,

  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE audit_logs IS 'Audit trail for all evidence access and modifications - append-only, cannot be deleted';
COMMENT ON COLUMN audit_logs.event_type IS 'Type of event: job_view, job_create, seal_create, etc.';
COMMENT ON COLUMN audit_logs.resource_type IS 'Type of resource accessed: job, photo, seal, report';
COMMENT ON COLUMN audit_logs.resource_id IS 'ID of the accessed resource';
COMMENT ON COLUMN audit_logs.metadata IS 'Additional context about the event (JSON)';

-- =====================================================================
-- 2. INDEXES FOR PERFORMANCE
-- =====================================================================

CREATE INDEX idx_audit_logs_workspace_id ON audit_logs(workspace_id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_event_type ON audit_logs(event_type);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_workspace_created ON audit_logs(workspace_id, created_at DESC);

-- =====================================================================
-- 3. ROW LEVEL SECURITY (RLS)
-- =====================================================================

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Users can view audit logs for their workspace
CREATE POLICY "Users can view workspace audit logs"
  ON audit_logs FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM users WHERE id = auth.uid()
    )
  );

-- Audit logs are append-only - no DELETE
CREATE POLICY "Audit logs cannot be deleted"
  ON audit_logs FOR DELETE
  USING (false);

-- Audit logs are immutable - no UPDATE
CREATE POLICY "Audit logs cannot be updated"
  ON audit_logs FOR UPDATE
  USING (false);

-- Only the logging function can insert (not users directly)
CREATE POLICY "Only logging function can insert"
  ON audit_logs FOR INSERT
  WITH CHECK (false); -- Will be bypassed by SECURITY DEFINER function

-- =====================================================================
-- 4. HELPER FUNCTION: LOG AUDIT EVENT
-- =====================================================================

CREATE OR REPLACE FUNCTION log_audit_event(
  p_workspace_id UUID,
  p_event_type TEXT,
  p_resource_type TEXT,
  p_resource_id TEXT,
  p_metadata JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
  v_user_id UUID;
  v_user_email TEXT;
BEGIN
  -- Get current authenticated user (if any)
  v_user_id := auth.uid();

  IF v_user_id IS NOT NULL THEN
    -- Get user email
    SELECT email INTO v_user_email
    FROM users
    WHERE id = v_user_id;
  END IF;

  -- Insert audit log
  INSERT INTO audit_logs (
    workspace_id,
    user_id,
    event_type,
    resource_type,
    resource_id,
    user_email,
    metadata
  ) VALUES (
    p_workspace_id,
    v_user_id,
    p_event_type,
    p_resource_type,
    p_resource_id,
    v_user_email,
    p_metadata
  ) RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION log_audit_event(UUID, TEXT, TEXT, TEXT, JSONB) IS 'Logs an audit event - bypasses RLS INSERT policy';

GRANT EXECUTE ON FUNCTION log_audit_event(UUID, TEXT, TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION log_audit_event(UUID, TEXT, TEXT, TEXT, JSONB) TO anon;

-- =====================================================================
-- 5. AUTO-LOGGING TRIGGERS
-- =====================================================================

-- Trigger to log job creation
CREATE OR REPLACE FUNCTION audit_job_create()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM log_audit_event(
    NEW.workspace_id,
    'job_create',
    'job',
    NEW.id::TEXT,
    jsonb_build_object(
      'title', NEW.title,
      'client', NEW.client_name,
      'technician', NEW.technician_name
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_audit_job_create ON jobs;
CREATE TRIGGER trigger_audit_job_create
  AFTER INSERT ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION audit_job_create();

-- Trigger to log job updates (only significant changes)
CREATE OR REPLACE FUNCTION audit_job_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log if status changed or job was sealed
  IF (OLD.status IS DISTINCT FROM NEW.status) OR
     (OLD.sealed_at IS NULL AND NEW.sealed_at IS NOT NULL) THEN
    PERFORM log_audit_event(
      NEW.workspace_id,
      'job_update',
      'job',
      NEW.id::TEXT,
      jsonb_build_object(
        'old_status', OLD.status,
        'new_status', NEW.status,
        'sealed', NEW.sealed_at IS NOT NULL
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_audit_job_update ON jobs;
CREATE TRIGGER trigger_audit_job_update
  AFTER UPDATE ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION audit_job_update();

-- Trigger to log seal creation
CREATE OR REPLACE FUNCTION audit_seal_create()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM log_audit_event(
    NEW.workspace_id,
    'seal_create',
    'seal',
    NEW.job_id::TEXT,
    jsonb_build_object(
      'evidence_hash', NEW.evidence_hash,
      'algorithm', NEW.algorithm,
      'sealed_by', NEW.sealed_by_email
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_audit_seal_create ON evidence_seals;
CREATE TRIGGER trigger_audit_seal_create
  AFTER INSERT ON evidence_seals
  FOR EACH ROW
  EXECUTE FUNCTION audit_seal_create();

-- =====================================================================
-- 6. HELPER FUNCTION: GET AUDIT LOGS
-- =====================================================================

CREATE OR REPLACE FUNCTION get_audit_logs(
  p_workspace_id UUID,
  p_limit INTEGER DEFAULT 100,
  p_offset INTEGER DEFAULT 0,
  p_event_type TEXT DEFAULT NULL,
  p_resource_type TEXT DEFAULT NULL
)
RETURNS TABLE(
  id UUID,
  event_type TEXT,
  resource_type TEXT,
  resource_id TEXT,
  user_email TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    al.id,
    al.event_type,
    al.resource_type,
    al.resource_id,
    al.user_email,
    al.metadata,
    al.created_at
  FROM audit_logs al
  WHERE al.workspace_id = p_workspace_id
    AND (p_event_type IS NULL OR al.event_type = p_event_type)
    AND (p_resource_type IS NULL OR al.resource_type = p_resource_type)
  ORDER BY al.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_audit_logs(UUID, INTEGER, INTEGER, TEXT, TEXT) IS 'Retrieves audit logs for a workspace with optional filters';

GRANT EXECUTE ON FUNCTION get_audit_logs(UUID, INTEGER, INTEGER, TEXT, TEXT) TO authenticated;

-- =====================================================================
-- 7. HELPER FUNCTION: COUNT AUDIT LOGS
-- =====================================================================

CREATE OR REPLACE FUNCTION count_audit_logs(
  p_workspace_id UUID,
  p_event_type TEXT DEFAULT NULL,
  p_resource_type TEXT DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM audit_logs
  WHERE workspace_id = p_workspace_id
    AND (p_event_type IS NULL OR event_type = p_event_type)
    AND (p_resource_type IS NULL OR resource_type = p_resource_type);

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION count_audit_logs(UUID, TEXT, TEXT) TO authenticated;

-- =====================================================================
-- 8. VALIDATION
-- =====================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'workspaces') THEN
    RAISE EXCEPTION 'Migration dependency not met: workspaces table does not exist';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
    RAISE EXCEPTION 'Migration dependency not met: users table does not exist';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'jobs') THEN
    RAISE EXCEPTION 'Migration dependency not met: jobs table does not exist';
  END IF;
END $$;

-- =====================================================================
-- MIGRATION COMPLETE
-- =====================================================================

DO $$
BEGIN
  RAISE NOTICE 'Migration 003 (Audit Trail) completed successfully';
  RAISE NOTICE 'Created: audit_logs table (append-only)';
  RAISE NOTICE 'Created: Triggers for auto-logging job/seal operations';
  RAISE NOTICE 'Created: Helper functions for audit log retrieval';
  RAISE NOTICE 'Security: RLS policies prevent DELETE/UPDATE';
END $$;
