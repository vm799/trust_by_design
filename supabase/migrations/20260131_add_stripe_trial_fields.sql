-- Stripe Trial Fields Migration
-- Created: 2026-01-31
-- Purpose: Add missing columns for Stripe trial subscription support

-- Add missing columns to user_subscriptions table
-- These columns are required by the stripe-webhook Edge Function

-- Trial start timestamp
ALTER TABLE user_subscriptions
  ADD COLUMN IF NOT EXISTS trial_start TIMESTAMPTZ;

-- Trial end timestamp (critical for trial countdown)
ALTER TABLE user_subscriptions
  ADD COLUMN IF NOT EXISTS trial_end TIMESTAMPTZ;

-- Current period start (Stripe billing cycle)
ALTER TABLE user_subscriptions
  ADD COLUMN IF NOT EXISTS current_period_start TIMESTAMPTZ;

-- Billing period (monthly/annual)
ALTER TABLE user_subscriptions
  ADD COLUMN IF NOT EXISTS billing_period TEXT CHECK (billing_period IN ('monthly', 'annual'));

-- Canceled at timestamp
ALTER TABLE user_subscriptions
  ADD COLUMN IF NOT EXISTS canceled_at TIMESTAMPTZ;

-- Add 'paused' and 'unpaid' to status enum (for trial end behavior)
-- First check if the constraint exists and recreate it with new values
ALTER TABLE user_subscriptions
  DROP CONSTRAINT IF EXISTS user_subscriptions_status_check;

ALTER TABLE user_subscriptions
  ADD CONSTRAINT user_subscriptions_status_check
  CHECK (status IN ('active', 'canceled', 'past_due', 'trialing', 'paused', 'unpaid', 'incomplete', 'expired'));

-- Index for efficient trial queries
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_trial_end
  ON user_subscriptions(trial_end)
  WHERE trial_end IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status_trialing
  ON user_subscriptions(status)
  WHERE status = 'trialing';

-- RPC function to get trial status efficiently
CREATE OR REPLACE FUNCTION get_trial_status(p_user_id UUID)
RETURNS TABLE (
  is_trialing BOOLEAN,
  trial_days_remaining INTEGER,
  trial_end_date TIMESTAMPTZ,
  tier TEXT,
  status TEXT,
  has_payment_method BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    us.status = 'trialing' AS is_trialing,
    CASE
      WHEN us.trial_end IS NULL THEN 0
      WHEN us.trial_end < NOW() THEN 0
      ELSE GREATEST(0, EXTRACT(DAY FROM (us.trial_end - NOW()))::INTEGER + 1)
    END AS trial_days_remaining,
    us.trial_end AS trial_end_date,
    us.tier,
    us.status,
    us.stripe_subscription_id IS NOT NULL AS has_payment_method
  FROM user_subscriptions us
  WHERE us.user_id = p_user_id
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION get_trial_status(UUID) TO authenticated;

-- Update the default subscription trigger to start with 'trialing' status
-- and set trial_end to 14 days from now
CREATE OR REPLACE FUNCTION create_default_subscription()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_subscriptions (
    user_id,
    tier,
    status,
    trial_start,
    trial_end
  )
  VALUES (
    NEW.id,
    'solo',
    'trialing',
    NOW(),
    NOW() + INTERVAL '14 days'
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE user_subscriptions IS 'Stripe subscription data synced via webhooks. Includes trial tracking for 14-day no-CC trials.';
COMMENT ON COLUMN user_subscriptions.trial_start IS 'When the trial period started';
COMMENT ON COLUMN user_subscriptions.trial_end IS 'When the trial period ends. NULL means no trial or trial data not yet synced from Stripe.';
COMMENT ON COLUMN user_subscriptions.billing_period IS 'monthly or annual billing cycle';
COMMENT ON COLUMN user_subscriptions.canceled_at IS 'When the subscription was canceled. NULL if active.';
