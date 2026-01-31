import { useState, useEffect, useRef } from 'react';
import { getSupabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';

type Tier = 'solo' | 'team' | 'agency';
type Status = 'active' | 'canceled' | 'past_due' | 'trialing';

interface Subscription {
  tier: Tier;
  status: Status;
  jobsUsed: number;
  limits: { jobs: number; users: number };
  trialEnd?: string | null;
  isTrialing: boolean;
  trialDaysRemaining: number;
}

const TIER_LIMITS: Record<Tier, { jobs: number; users: number }> = {
  solo: { jobs: 5, users: 1 },
  team: { jobs: Infinity, users: 5 },
  agency: { jobs: Infinity, users: Infinity }
};

const CACHE_KEY = 'jobproof_subscription_v1';
const CACHE_TTL = 300000; // 5 minutes

// CRITICAL FIX: Module-level deduplication to prevent concurrent requests
// across multiple component instances
let inFlightPromise: Promise<Subscription | null> | null = null;
let lastFetchTime = 0;
const MIN_FETCH_INTERVAL = 10000; // Minimum 10 seconds between fetches

export const useSubscription = () => {
  // PERFORMANCE FIX: Use AuthContext instead of calling getUser()
  const { userId, workspaceId, isLoading: authLoading } = useAuth();

  const [subscription, setSubscription] = useState<Subscription>(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_TTL) return data;
      }
    } catch {
      // Cache parsing failed - use default subscription
    }
    return {
      tier: 'solo',
      status: 'active',
      jobsUsed: 0,
      limits: TIER_LIMITS.solo,
      trialEnd: null,
      isTrialing: false,
      trialDaysRemaining: 0,
    } as Subscription;
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // CRITICAL FIX: Track if this instance has already started a fetch
  const hasFetchedRef = useRef(false);

  useEffect(() => {
    // Wait for auth to load
    if (authLoading) {
      return;
    }

    // Skip if no user/workspace
    if (!userId || !workspaceId) {
      setLoading(false);
      return;
    }

    // CRITICAL FIX: Prevent duplicate fetches from this component instance
    if (hasFetchedRef.current) {
      return;
    }

    // CRITICAL FIX: Check minimum fetch interval to prevent request storms
    const now = Date.now();
    if (now - lastFetchTime < MIN_FETCH_INTERVAL) {
      // Use cached data if available and skip fetch
      setLoading(false);
      return;
    }

    const fetchSubscription = async (): Promise<Subscription | null> => {
      const supabase = getSupabase();
      if (!supabase) {
        return null;
      }

      const [subResult, jobsResult] = await Promise.all([
        supabase
          .from('user_subscriptions')
          .select('tier, status, trial_end')
          .eq('user_id', userId)
          .maybeSingle(),
        supabase
          .from('jobs')
          .select('id', { count: 'exact', head: true })
          .eq('workspace_id', workspaceId)
      ]);

      const tier = (subResult.data?.tier as Tier) || 'solo';
      const status = (subResult.data?.status as Status) || 'active';
      const jobsUsed = jobsResult?.count || 0;
      const trialEnd = subResult.data?.trial_end || null;
      const isTrialing = status === 'trialing';

      // Calculate trial days remaining
      let trialDaysRemaining = 0;
      if (trialEnd && isTrialing) {
        const trialEndDate = new Date(trialEnd);
        const now = new Date();
        const diffMs = trialEndDate.getTime() - now.getTime();
        trialDaysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
      }

      return {
        tier,
        status,
        jobsUsed,
        limits: TIER_LIMITS[tier],
        trialEnd,
        isTrialing,
        trialDaysRemaining,
      };
    };

    const doFetch = async () => {
      hasFetchedRef.current = true;

      try {
        // CRITICAL FIX: Reuse in-flight promise to deduplicate concurrent requests
        if (!inFlightPromise) {
          lastFetchTime = Date.now();
          inFlightPromise = fetchSubscription();
        }

        const newSub = await inFlightPromise;
        inFlightPromise = null;

        if (newSub) {
          setSubscription(newSub);
          setError(null);
          localStorage.setItem(
            CACHE_KEY,
            JSON.stringify({ data: newSub, timestamp: Date.now() })
          );
        }
      } catch (err) {
        inFlightPromise = null;
        setError('Using cached data');
      } finally {
        setLoading(false);
      }
    };

    doFetch();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, workspaceId, authLoading]);

  const canCreateJob = subscription.jobsUsed < subscription.limits.jobs;
  const usagePercent =
    subscription.limits.jobs === Infinity
      ? 0
      : (subscription.jobsUsed / subscription.limits.jobs) * 100;

  return {
    ...subscription,
    loading,
    error,
    canCreateJob,
    usagePercent,
    isPaid: subscription.tier !== 'solo'
  };
};
