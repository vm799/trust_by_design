-- ============================================================================
-- HOTFIX: Add search_path protection to complete_onboarding_step
-- ============================================================================
-- Migration: 20260121_fix_complete_onboarding_step.sql
-- Purpose: Fix missing SET search_path = public clause on onboarding functions
-- Issue: Functions created in 006_persona_onboarding_foundation.sql missing
--        search_path protection (required per PHASE 1 security standards)
-- Error: ERROR: 42883: function public.complete_onboarding_step(text, jsonb) does not exist
-- ============================================================================

-- ============================================================================
-- FIX 1: Recreate complete_onboarding_step with search_path protection
-- ============================================================================

CREATE OR REPLACE FUNCTION public.complete_onboarding_step(
  p_step_key TEXT,
  p_step_data JSONB DEFAULT '{}'::jsonb
)
RETURNS json AS $$
DECLARE
  v_user_id UUID;
  v_persona_id UUID;
  v_persona_type persona_type;
  v_current_step TEXT;
  v_next_step TEXT;
  v_next_step_order INTEGER;
  v_is_final_step BOOLEAN;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get active persona
  SELECT id, persona_type, current_step
  INTO v_persona_id, v_persona_type, v_current_step
  FROM user_personas
  WHERE user_id = v_user_id AND is_active = true
  LIMIT 1;

  IF v_persona_id IS NULL THEN
    RAISE EXCEPTION 'No active persona found';
  END IF;

  -- Verify step_key matches current step
  IF v_current_step IS NOT NULL AND v_current_step != p_step_key THEN
    RAISE EXCEPTION 'Step key mismatch: expected %, got %', v_current_step, p_step_key;
  END IF;

  -- Mark current step as completed
  INSERT INTO user_journey_progress (user_id, persona_id, step_key, status, step_data, started_at, completed_at)
  VALUES (v_user_id, v_persona_id, p_step_key, 'completed', p_step_data, NOW(), NOW())
  ON CONFLICT (persona_id, step_key) DO UPDATE
  SET status = 'completed', step_data = p_step_data, completed_at = NOW();

  -- Add to completed_steps array
  UPDATE user_personas
  SET completed_steps = completed_steps || jsonb_build_array(p_step_key)
  WHERE id = v_persona_id;

  -- Get next step
  SELECT step_key, step_order
  INTO v_next_step, v_next_step_order
  FROM onboarding_steps
  WHERE persona_type = v_persona_type
  AND step_order = (
    SELECT step_order + 1
    FROM onboarding_steps
    WHERE persona_type = v_persona_type AND step_key = p_step_key
  )
  LIMIT 1;

  -- Check if this was the final step
  v_is_final_step := v_next_step IS NULL;

  IF v_is_final_step THEN
    -- Mark persona as complete
    UPDATE user_personas
    SET is_complete = true, completed_at = NOW(), current_step = NULL
    WHERE id = v_persona_id;

    -- Log audit event
    PERFORM log_audit_event(
      (SELECT workspace_id FROM users WHERE id = v_user_id),
      v_user_id,
      'persona_onboarding_complete',
      'persona',
      v_persona_id::text,
      jsonb_build_object('persona_type', v_persona_type::text)
    );
  ELSE
    -- Update current_step to next step
    UPDATE user_personas
    SET current_step = v_next_step
    WHERE id = v_persona_id;

    -- Create next step progress record
    INSERT INTO user_journey_progress (user_id, persona_id, step_key, status, started_at)
    VALUES (v_user_id, v_persona_id, v_next_step, 'in_progress', NOW())
    ON CONFLICT (persona_id, step_key) DO UPDATE
    SET status = 'in_progress', started_at = NOW();
  END IF;

  -- Return result
  RETURN json_build_object(
    'success', true,
    'completed_step', p_step_key,
    'next_step', v_next_step,
    'is_complete', v_is_final_step,
    'persona_type', v_persona_type::text
  );
END;
$$ LANGUAGE plpgsql
   SECURITY DEFINER
   STABLE
   SET search_path = public;

COMMENT ON FUNCTION public.complete_onboarding_step(TEXT, JSONB) IS
'Marks current step as complete and advances to next step (atomic). SECURITY DEFINER with search_path protection.';

-- ============================================================================
-- FIX 2: Recreate complete_persona_onboarding with search_path protection
-- ============================================================================

CREATE OR REPLACE FUNCTION public.complete_persona_onboarding(
  p_persona_type persona_type
)
RETURNS json AS $$
DECLARE
  v_user_id UUID;
  v_persona_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get persona
  SELECT id INTO v_persona_id
  FROM user_personas
  WHERE user_id = v_user_id AND persona_type = p_persona_type
  LIMIT 1;

  IF v_persona_id IS NULL THEN
    RAISE EXCEPTION 'Persona not found: %', p_persona_type;
  END IF;

  -- Mark as complete
  UPDATE user_personas
  SET is_complete = true, completed_at = NOW(), current_step = NULL
  WHERE id = v_persona_id;

  -- Log audit event
  PERFORM log_audit_event(
    (SELECT workspace_id FROM users WHERE id = v_user_id),
    v_user_id,
    'persona_onboarding_complete',
    'persona',
    v_persona_id::text,
    jsonb_build_object('persona_type', p_persona_type::text, 'manual', true)
  );

  RETURN json_build_object(
    'success', true,
    'persona_type', p_persona_type::text,
    'persona_id', v_persona_id
  );
END;
$$ LANGUAGE plpgsql
   SECURITY DEFINER
   STABLE
   SET search_path = public;

COMMENT ON FUNCTION public.complete_persona_onboarding(persona_type) IS
'Manually marks persona onboarding as complete (for admin or skip). SECURITY DEFINER with search_path protection.';

-- ============================================================================
-- FIX 3: Ensure EXECUTE grants are in place (from phase1 migration)
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.complete_onboarding_step(TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_persona_onboarding(persona_type) TO authenticated;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify functions exist with correct signature
SELECT
  proname,
  pg_get_function_arguments(oid) as args,
  prosecdef as is_security_definer,
  provolatile as volatility,
  (SELECT setting FROM unnest(proconfig) setting WHERE setting LIKE 'search_path%') as search_path_setting
FROM pg_proc
WHERE proname IN ('complete_onboarding_step', 'complete_persona_onboarding')
AND pronamespace = 'public'::regnamespace;

-- Verify EXECUTE grants
SELECT
  routine_name,
  grantee,
  privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
AND routine_name IN ('complete_onboarding_step', 'complete_persona_onboarding')
AND grantee IN ('authenticated', 'anon')
ORDER BY routine_name, grantee;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
