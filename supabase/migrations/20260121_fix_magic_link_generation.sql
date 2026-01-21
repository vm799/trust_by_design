-- Fix magic link generation function to make user_id optional
-- This allows the function to work when called without a user context

CREATE OR REPLACE FUNCTION public.generate_job_access_token(
  p_job_id TEXT,
  p_granted_by_user_id UUID DEFAULT NULL,
  p_granted_to_email TEXT DEFAULT NULL,
  p_expires_in_days INTEGER DEFAULT 7
)
RETURNS jsonb AS $$
DECLARE
  v_token TEXT;
  v_token_hash TEXT;
  v_expires_at TIMESTAMPTZ;
BEGIN
  -- Generate random token
  v_token := gen_random_uuid()::TEXT;
  v_expires_at := NOW() + (p_expires_in_days || ' days')::INTERVAL;

  -- Hash the token using SHA-256
  v_token_hash := encode(digest(v_token, 'sha256'), 'hex');

  -- Insert with both plaintext (for migration) and hash
  INSERT INTO public.job_access_tokens (
    job_id,
    token,
    token_hash,
    granted_to_email,
    granted_by_user_id,
    expires_at
  )
  VALUES (
    p_job_id,
    v_token,
    v_token_hash,
    p_granted_to_email,
    p_granted_by_user_id,  -- Can be NULL now
    v_expires_at
  );

  -- Return token and expiration as JSON
  RETURN jsonb_build_object(
    'token', v_token,
    'expires_at', v_expires_at
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

COMMENT ON FUNCTION public.generate_job_access_token IS 'Generates secure job access token with SHA-256 hash - returns plaintext once, stores hash. User ID is optional.';
