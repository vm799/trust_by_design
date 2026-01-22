import { useState, useEffect } from 'react';
import { getSupabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';

type Tier = 'solo' | 'team' | 'agency';
type Status = 'active' | 'canceled' | 'past_due' | 'trialing';

interface Subscription {
  tier: Tier;
  status: Status;
  jobsUsed: number;
  limits: { jobs: number; users: number };
}

const TIER_LIMITS: Record<Tier, { jobs: number; users: number }> = {
  solo: { jobs: 5, users: 1 },
  team: { jobs: Infinity, users: 5 },
  agency: { jobs: Infinity, users: Infinity }
};

const CACHE_KEY = 'jobproof_subscription_v1';
const CACHE_TTL = 300000; // 5 minutes

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
    } catch {}
    return {
      tier: 'solo',
      status: 'active',
      jobsUsed: 0,
      limits: TIER_LIMITS.solo
    } as Subscription;
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

    let retryCount = 0;
    const maxRetries = 3;

    const fetchSubscription = async () => {
      const supabase = getSupabase();
      if (!supabase) {
        setLoading(false);
        return;
      }

      try {

        const [subResult, jobsResult] = await Promise.all([
          supabase
            .from('user_subscriptions')
            .select('tier, status')
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

        const newSub: Subscription = {
          tier,
          status,
          jobsUsed,
          limits: TIER_LIMITS[tier]
        };

        setSubscription(newSub);
        setError(null);

        localStorage.setItem(
          CACHE_KEY,
          JSON.stringify({ data: newSub, timestamp: Date.now() })
        );

        setLoading(false);
      } catch (err) {
        if (retryCount < maxRetries) {
          retryCount++;
          setTimeout(fetchSubscription, Math.pow(2, retryCount) * 1000);
        } else {
          setError('Using cached data');
          setLoading(false);
        }
      }
    };

    fetchSubscription();
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
