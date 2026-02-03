-- Migration: Rate Limiter Tables for Magic Link Protection
-- Date: 2026-02-03
-- Purpose: Postgres-backed sliding window rate limiting for magic link requests
--
-- Provides:
--   1. Per-email rate limiting (3/min default)
--   2. Per-IP rate limiting (10/min default)
--   3. Global rate limiting (100/min default)
--   4. Audit logging for rate limit events
--
-- Used by: send-magic-link Edge Function

-- ============================================================================
-- SECTION 1: RATE LIMIT COUNTERS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.rate_limit_counters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Limit type: 'email', 'ip', or 'global'
  limit_type TEXT NOT NULL CHECK (limit_type IN ('email', 'ip', 'global')),

  -- The key being rate limited (email address, IP address, or 'global')
  limit_key TEXT NOT NULL,

  -- Sliding window: array of timestamps for recent requests
  request_timestamps TIMESTAMPTZ[] DEFAULT ARRAY[]::TIMESTAMPTZ[],

  -- Configuration (can be overridden per-key)
  max_requests INTEGER NOT NULL DEFAULT 10,
  window_seconds INTEGER NOT NULL DEFAULT 60,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint on type + key
  CONSTRAINT rate_limit_counters_unique UNIQUE (limit_type, limit_key)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_rate_limit_type_key
  ON public.rate_limit_counters(limit_type, limit_key);

CREATE INDEX IF NOT EXISTS idx_rate_limit_updated
  ON public.rate_limit_counters(updated_at);

-- ============================================================================
-- SECTION 2: RATE LIMIT AUDIT LOG
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.rate_limit_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Request details
  email TEXT,
  ip_address TEXT,

  -- What limit was hit (if any)
  limit_hit TEXT CHECK (limit_hit IN ('email', 'ip', 'global', NULL)),

  -- Whether the request was allowed
  allowed BOOLEAN NOT NULL,

  -- Current counts at time of request
  email_count INTEGER,
  ip_count INTEGER,
  global_count INTEGER,

  -- Retry information
  retry_after_seconds INTEGER,

  -- User agent and other metadata
  user_agent TEXT,
  metadata JSONB DEFAULT '{}'::JSONB,

  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying recent events
CREATE INDEX IF NOT EXISTS idx_rate_limit_audit_created
  ON public.rate_limit_audit(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rate_limit_audit_email
  ON public.rate_limit_audit(email)
  WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_rate_limit_audit_ip
  ON public.rate_limit_audit(ip_address)
  WHERE ip_address IS NOT NULL;

-- Partial index for blocked requests (for monitoring)
CREATE INDEX IF NOT EXISTS idx_rate_limit_audit_blocked
  ON public.rate_limit_audit(created_at DESC)
  WHERE allowed = false;

-- ============================================================================
-- SECTION 3: HELPER FUNCTIONS
-- ============================================================================

-- Function to check and record a rate limit request
-- Returns: { allowed: boolean, limit_hit: string|null, retry_after: int, counts: {...} }
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_email TEXT,
  p_ip_address TEXT,
  p_email_limit INTEGER DEFAULT 3,
  p_email_window INTEGER DEFAULT 60,
  p_ip_limit INTEGER DEFAULT 10,
  p_ip_window INTEGER DEFAULT 60,
  p_global_limit INTEGER DEFAULT 100,
  p_global_window INTEGER DEFAULT 60
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_now TIMESTAMPTZ := NOW();
  v_email_cutoff TIMESTAMPTZ := v_now - (p_email_window || ' seconds')::INTERVAL;
  v_ip_cutoff TIMESTAMPTZ := v_now - (p_ip_window || ' seconds')::INTERVAL;
  v_global_cutoff TIMESTAMPTZ := v_now - (p_global_window || ' seconds')::INTERVAL;
  v_email_count INTEGER := 0;
  v_ip_count INTEGER := 0;
  v_global_count INTEGER := 0;
  v_limit_hit TEXT := NULL;
  v_retry_after INTEGER := 0;
  v_allowed BOOLEAN := true;
  v_email_timestamps TIMESTAMPTZ[];
  v_ip_timestamps TIMESTAMPTZ[];
  v_global_timestamps TIMESTAMPTZ[];
  v_oldest_email TIMESTAMPTZ;
  v_oldest_ip TIMESTAMPTZ;
  v_oldest_global TIMESTAMPTZ;
BEGIN
  -- ========================================
  -- 1. Check EMAIL rate limit
  -- ========================================
  IF p_email IS NOT NULL THEN
    -- Get or create email counter
    INSERT INTO rate_limit_counters (limit_type, limit_key, max_requests, window_seconds, request_timestamps)
    VALUES ('email', LOWER(p_email), p_email_limit, p_email_window, ARRAY[]::TIMESTAMPTZ[])
    ON CONFLICT (limit_type, limit_key) DO UPDATE SET updated_at = v_now
    RETURNING request_timestamps INTO v_email_timestamps;

    -- Filter to only timestamps within window
    SELECT ARRAY_AGG(ts) INTO v_email_timestamps
    FROM UNNEST(v_email_timestamps) AS ts
    WHERE ts > v_email_cutoff;

    v_email_timestamps := COALESCE(v_email_timestamps, ARRAY[]::TIMESTAMPTZ[]);
    v_email_count := CARDINALITY(v_email_timestamps);

    IF v_email_count >= p_email_limit THEN
      v_allowed := false;
      v_limit_hit := 'email';
      -- Calculate retry_after based on oldest timestamp
      SELECT MIN(ts) INTO v_oldest_email FROM UNNEST(v_email_timestamps) AS ts;
      v_retry_after := GREATEST(v_retry_after, EXTRACT(EPOCH FROM (v_oldest_email + (p_email_window || ' seconds')::INTERVAL - v_now))::INTEGER);
    END IF;
  END IF;

  -- ========================================
  -- 2. Check IP rate limit
  -- ========================================
  IF p_ip_address IS NOT NULL AND v_allowed THEN
    -- Get or create IP counter
    INSERT INTO rate_limit_counters (limit_type, limit_key, max_requests, window_seconds, request_timestamps)
    VALUES ('ip', p_ip_address, p_ip_limit, p_ip_window, ARRAY[]::TIMESTAMPTZ[])
    ON CONFLICT (limit_type, limit_key) DO UPDATE SET updated_at = v_now
    RETURNING request_timestamps INTO v_ip_timestamps;

    -- Filter to only timestamps within window
    SELECT ARRAY_AGG(ts) INTO v_ip_timestamps
    FROM UNNEST(v_ip_timestamps) AS ts
    WHERE ts > v_ip_cutoff;

    v_ip_timestamps := COALESCE(v_ip_timestamps, ARRAY[]::TIMESTAMPTZ[]);
    v_ip_count := CARDINALITY(v_ip_timestamps);

    IF v_ip_count >= p_ip_limit THEN
      v_allowed := false;
      v_limit_hit := 'ip';
      SELECT MIN(ts) INTO v_oldest_ip FROM UNNEST(v_ip_timestamps) AS ts;
      v_retry_after := GREATEST(v_retry_after, EXTRACT(EPOCH FROM (v_oldest_ip + (p_ip_window || ' seconds')::INTERVAL - v_now))::INTEGER);
    END IF;
  END IF;

  -- ========================================
  -- 3. Check GLOBAL rate limit
  -- ========================================
  IF v_allowed THEN
    -- Get or create global counter
    INSERT INTO rate_limit_counters (limit_type, limit_key, max_requests, window_seconds, request_timestamps)
    VALUES ('global', 'global', p_global_limit, p_global_window, ARRAY[]::TIMESTAMPTZ[])
    ON CONFLICT (limit_type, limit_key) DO UPDATE SET updated_at = v_now
    RETURNING request_timestamps INTO v_global_timestamps;

    -- Filter to only timestamps within window
    SELECT ARRAY_AGG(ts) INTO v_global_timestamps
    FROM UNNEST(v_global_timestamps) AS ts
    WHERE ts > v_global_cutoff;

    v_global_timestamps := COALESCE(v_global_timestamps, ARRAY[]::TIMESTAMPTZ[]);
    v_global_count := CARDINALITY(v_global_timestamps);

    IF v_global_count >= p_global_limit THEN
      v_allowed := false;
      v_limit_hit := 'global';
      SELECT MIN(ts) INTO v_oldest_global FROM UNNEST(v_global_timestamps) AS ts;
      v_retry_after := GREATEST(v_retry_after, EXTRACT(EPOCH FROM (v_oldest_global + (p_global_window || ' seconds')::INTERVAL - v_now))::INTEGER);
    END IF;
  END IF;

  -- ========================================
  -- 4. If allowed, record the request
  -- ========================================
  IF v_allowed THEN
    -- Update email counter
    IF p_email IS NOT NULL THEN
      UPDATE rate_limit_counters
      SET request_timestamps = ARRAY_APPEND(COALESCE(v_email_timestamps, ARRAY[]::TIMESTAMPTZ[]), v_now),
          updated_at = v_now
      WHERE limit_type = 'email' AND limit_key = LOWER(p_email);
      v_email_count := v_email_count + 1;
    END IF;

    -- Update IP counter
    IF p_ip_address IS NOT NULL THEN
      UPDATE rate_limit_counters
      SET request_timestamps = ARRAY_APPEND(COALESCE(v_ip_timestamps, ARRAY[]::TIMESTAMPTZ[]), v_now),
          updated_at = v_now
      WHERE limit_type = 'ip' AND limit_key = p_ip_address;
      v_ip_count := v_ip_count + 1;
    END IF;

    -- Update global counter
    UPDATE rate_limit_counters
    SET request_timestamps = ARRAY_APPEND(COALESCE(v_global_timestamps, ARRAY[]::TIMESTAMPTZ[]), v_now),
        updated_at = v_now
    WHERE limit_type = 'global' AND limit_key = 'global';
    v_global_count := v_global_count + 1;
  END IF;

  -- ========================================
  -- 5. Return result
  -- ========================================
  RETURN jsonb_build_object(
    'allowed', v_allowed,
    'limit_hit', v_limit_hit,
    'retry_after', GREATEST(1, v_retry_after),
    'counts', jsonb_build_object(
      'email', v_email_count,
      'ip', v_ip_count,
      'global', v_global_count
    ),
    'limits', jsonb_build_object(
      'email', p_email_limit,
      'ip', p_ip_limit,
      'global', p_global_limit
    )
  );
END;
$$;

-- Function to log rate limit events
CREATE OR REPLACE FUNCTION public.log_rate_limit_event(
  p_email TEXT,
  p_ip_address TEXT,
  p_allowed BOOLEAN,
  p_limit_hit TEXT DEFAULT NULL,
  p_email_count INTEGER DEFAULT NULL,
  p_ip_count INTEGER DEFAULT NULL,
  p_global_count INTEGER DEFAULT NULL,
  p_retry_after INTEGER DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO rate_limit_audit (
    email, ip_address, allowed, limit_hit,
    email_count, ip_count, global_count,
    retry_after_seconds, user_agent, metadata
  )
  VALUES (
    LOWER(p_email), p_ip_address, p_allowed, p_limit_hit,
    p_email_count, p_ip_count, p_global_count,
    p_retry_after, p_user_agent, p_metadata
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- Function to clean up old rate limit data (run periodically)
CREATE OR REPLACE FUNCTION public.cleanup_rate_limit_data(
  p_counter_retention_hours INTEGER DEFAULT 1,
  p_audit_retention_days INTEGER DEFAULT 30
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_counters_deleted INTEGER;
  v_audit_deleted INTEGER;
BEGIN
  -- Delete old counter entries (no requests in retention period)
  DELETE FROM rate_limit_counters
  WHERE updated_at < NOW() - (p_counter_retention_hours || ' hours')::INTERVAL;
  GET DIAGNOSTICS v_counters_deleted = ROW_COUNT;

  -- Delete old audit entries
  DELETE FROM rate_limit_audit
  WHERE created_at < NOW() - (p_audit_retention_days || ' days')::INTERVAL;
  GET DIAGNOSTICS v_audit_deleted = ROW_COUNT;

  RETURN jsonb_build_object(
    'counters_deleted', v_counters_deleted,
    'audit_deleted', v_audit_deleted,
    'cleaned_at', NOW()
  );
END;
$$;

-- ============================================================================
-- SECTION 4: PERMISSIONS
-- ============================================================================

-- Grant execute to authenticated and service_role
GRANT EXECUTE ON FUNCTION public.check_rate_limit TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.log_rate_limit_event TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_rate_limit_data TO service_role;

-- Grant table access for service_role (Edge Functions)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rate_limit_counters TO service_role;
GRANT SELECT, INSERT ON public.rate_limit_audit TO service_role;

-- ============================================================================
-- SECTION 5: RLS POLICIES
-- ============================================================================

ALTER TABLE public.rate_limit_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limit_audit ENABLE ROW LEVEL SECURITY;

-- Only service_role can access these tables (Edge Functions)
CREATE POLICY "Service role full access to rate_limit_counters"
  ON public.rate_limit_counters FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access to rate_limit_audit"
  ON public.rate_limit_audit FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- SECTION 6: COMMENTS
-- ============================================================================

COMMENT ON TABLE public.rate_limit_counters IS
  'Sliding window rate limit counters for magic link requests. Per-email, per-IP, and global limits.';

COMMENT ON TABLE public.rate_limit_audit IS
  'Audit log for rate limit events. Used for monitoring and debugging rate limit issues.';

COMMENT ON FUNCTION public.check_rate_limit IS
  'Check and record a rate limit request. Returns allowed status, which limit was hit, and retry-after seconds.';

COMMENT ON FUNCTION public.log_rate_limit_event IS
  'Log a rate limit event for auditing purposes.';

COMMENT ON FUNCTION public.cleanup_rate_limit_data IS
  'Clean up old rate limit data. Run periodically via cron or scheduled function.';
