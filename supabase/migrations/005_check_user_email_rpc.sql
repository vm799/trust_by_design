-- Migration: 005_check_user_email_rpc.sql
-- Purpose: Allow public client to check if an email is registered without exposing user list
-- Security: Returns boolean only, prevents data scraping but allows user enumeration (unavoidable for email-first UI)

CREATE OR REPLACE FUNCTION check_user_exists(p_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with privileges of creator (service role) to bypass RLS
SET search_path = public -- Secure search path
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM auth.users 
    WHERE email = lower(trim(p_email))
  );
END;
$$;

-- Grant execute permission to anon and authenticated users
GRANT EXECUTE ON FUNCTION check_user_exists(text) TO anon, authenticated;

-- Comment
COMMENT ON FUNCTION check_user_exists IS 'Checks if a user exists by email. Used for Email-First Auth flow.';
