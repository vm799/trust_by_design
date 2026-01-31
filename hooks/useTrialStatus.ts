import { useState, useEffect, useMemo, useRef } from 'react';
import { getSupabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';

export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'paused'
  | 'past_due'
  | 'canceled'
  | 'unpaid'
  | 'incomplete'
  | 'expired'
  | 'none';

export type SubscriptionTier = 'solo' | 'team' | 'agency';

export interface TrialStatus {
  isTrialing: boolean;
  trialDaysRemaining: number;
  trialEndDate: string | null;
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  hasPaymentMethod: boolean;
  isPaused: boolean;
  isActive: boolean;
  hasAccess: boolean;
  loading: boolean;
  error: string | null;
}

const CACHE_KEY = 'jobproof_trial_status_v1';
const CACHE_TTL = 60000; // 1 minute (shorter than subscription cache for trial accuracy)

// Module-level deduplication
let inFlightPromise: Promise<TrialStatus | null> | null = null;
let lastFetchTime = 0;
const MIN_FETCH_INTERVAL = 30000; // 30 seconds minimum between fetches

/**
 * Hook to get trial subscription status
 * Uses the get_trial_status RPC for efficient querying
 */
export const useTrialStatus = (): TrialStatus => {
  const { userId, isLoading: authLoading } = useAuth();

  const [trialStatus, setTrialStatus] = useState<TrialStatus>(() => {
    // Try to load from cache
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_TTL) {
          return data;
        }
      }
    } catch {
      // Ignore cache errors
    }

    // Default state
    return {
      isTrialing: false,
      trialDaysRemaining: 0,
      trialEndDate: null,
      tier: 'solo',
      status: 'none',
      hasPaymentMethod: false,
      isPaused: false,
      isActive: false,
      hasAccess: true, // Default to true to avoid blocking during load
      loading: true,
      error: null,
    };
  });

  const hasFetchedRef = useRef(false);

  useEffect(() => {
    if (authLoading) return;

    if (!userId) {
      setTrialStatus(prev => ({
        ...prev,
        loading: false,
        hasAccess: false,
      }));
      return;
    }

    if (hasFetchedRef.current) return;

    const now = Date.now();
    if (now - lastFetchTime < MIN_FETCH_INTERVAL) {
      setTrialStatus(prev => ({ ...prev, loading: false }));
      return;
    }

    // Type for RPC response
    interface TrialRpcResult {
      is_trialing: boolean;
      trial_days_remaining: number;
      trial_end_date: string | null;
      tier: string;
      status: string;
      has_payment_method: boolean;
    }

    const fetchTrialStatus = async (): Promise<TrialStatus | null> => {
      const supabase = getSupabase();
      if (!supabase) return null;

      // Try using the RPC function first (most efficient)
      const { data: rpcData, error: rpcError } = await supabase
        .rpc('get_trial_status', { p_user_id: userId })
        .single<TrialRpcResult>();

      if (!rpcError && rpcData) {
        const status = (rpcData.status as SubscriptionStatus) || 'none';
        const isTrialing = rpcData.is_trialing || false;
        const isPaused = status === 'paused';
        const isActive = status === 'active';

        return {
          isTrialing,
          trialDaysRemaining: rpcData.trial_days_remaining || 0,
          trialEndDate: rpcData.trial_end_date || null,
          tier: (rpcData.tier as SubscriptionTier) || 'solo',
          status,
          hasPaymentMethod: rpcData.has_payment_method || false,
          isPaused,
          isActive,
          hasAccess: isTrialing || isActive,
          loading: false,
          error: null,
        };
      }

      // Fallback: direct query if RPC fails (RPC might not exist yet)
      const { data: subData, error: subError } = await supabase
        .from('user_subscriptions')
        .select('tier, status, trial_end, stripe_subscription_id')
        .eq('user_id', userId)
        .maybeSingle();

      if (subError) {
        console.error('[useTrialStatus] Query error:', subError);
        return null;
      }

      if (!subData) {
        // No subscription record - user is on free tier
        return {
          isTrialing: false,
          trialDaysRemaining: 0,
          trialEndDate: null,
          tier: 'solo',
          status: 'none',
          hasPaymentMethod: false,
          isPaused: false,
          isActive: false,
          hasAccess: true, // Solo tier always has access
          loading: false,
          error: null,
        };
      }

      const status = (subData.status as SubscriptionStatus) || 'active';
      const isTrialing = status === 'trialing';
      const isPaused = status === 'paused';
      const isActive = status === 'active';

      // Calculate days remaining
      let trialDaysRemaining = 0;
      if (subData.trial_end && isTrialing) {
        const trialEnd = new Date(subData.trial_end);
        const now = new Date();
        const diffMs = trialEnd.getTime() - now.getTime();
        trialDaysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
      }

      return {
        isTrialing,
        trialDaysRemaining,
        trialEndDate: subData.trial_end || null,
        tier: (subData.tier as SubscriptionTier) || 'solo',
        status,
        hasPaymentMethod: !!subData.stripe_subscription_id,
        isPaused,
        isActive,
        hasAccess: isTrialing || isActive || subData.tier === 'solo',
        loading: false,
        error: null,
      };
    };

    const doFetch = async () => {
      hasFetchedRef.current = true;

      try {
        if (!inFlightPromise) {
          lastFetchTime = Date.now();
          inFlightPromise = fetchTrialStatus();
        }

        const result = await inFlightPromise;
        inFlightPromise = null;

        if (result) {
          setTrialStatus(result);
          localStorage.setItem(
            CACHE_KEY,
            JSON.stringify({ data: result, timestamp: Date.now() })
          );
        }
      } catch (err) {
        inFlightPromise = null;
        setTrialStatus(prev => ({
          ...prev,
          loading: false,
          error: 'Failed to load subscription status',
        }));
      }
    };

    doFetch();
  }, [userId, authLoading]);

  return trialStatus;
};

/**
 * Hook to check if user can access a feature based on trial/subscription status
 */
export const useHasAccess = (): boolean => {
  const { hasAccess, loading } = useTrialStatus();
  // During loading, assume access to avoid UI flicker
  return loading ? true : hasAccess;
};

/**
 * Hook to get formatted trial countdown text
 */
export const useTrialCountdown = (): string => {
  const { isTrialing, trialDaysRemaining, isPaused } = useTrialStatus();

  return useMemo(() => {
    if (isPaused) {
      return 'Trial ended - Add payment method to continue';
    }

    if (!isTrialing) {
      return '';
    }

    if (trialDaysRemaining === 0) {
      return 'Trial ends today';
    }

    if (trialDaysRemaining === 1) {
      return '1 day left in trial';
    }

    return `${trialDaysRemaining} days left in trial`;
  }, [isTrialing, trialDaysRemaining, isPaused]);
};

export default useTrialStatus;
