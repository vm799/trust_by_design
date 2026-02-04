/**
 * Feature Flag System
 *
 * Provides deterministic feature flag evaluation with:
 * - Environment detection (local/staging/production)
 * - Percentage-based rollout via consistent hashing
 * - Paid-only feature gates
 * - Development overrides (non-production only)
 *
 * @see CLAUDE.md - Feature flags for gradual rollout
 */

// ============================================================================
// TYPES
// ============================================================================

/**
 * Deployment environment types
 */
export type Environment = 'local' | 'staging' | 'production';

/**
 * Feature flag configuration
 */
export interface FeatureFlag {
  /** Unique identifier for the flag */
  key: string;
  /** Human-readable description */
  description: string;
  /** Percentage of users who should see this feature (0-100) */
  rolloutPercentage: number;
  /** Whether this feature requires a paid subscription */
  paidOnly: boolean;
  /** Environments where this flag is enabled */
  enabledEnvironments: Environment[];
}

/**
 * Feature flag keys as a const union type
 */
export type FeatureFlagKey =
  | 'EDGE_FUNCTION_RATE_LIMITER'
  | 'SEAL_ON_DISPATCH'
  | 'TEAM_STATUS_BAR'
  | 'READY_TO_INVOICE_SECTION'
  | 'WORKSPACE_ISOLATED_STORAGE';

/**
 * Result of evaluating a feature flag
 */
export interface FeatureFlagEvaluation {
  key: FeatureFlagKey;
  enabled: boolean;
  reason: 'rollout' | 'paid_only' | 'environment' | 'override' | 'disabled';
}

// ============================================================================
// ENVIRONMENT DETECTION
// ============================================================================

/**
 * Derive the current environment from window.location.hostname
 *
 * Rules:
 * - localhost / 127.0.0.1 / .local -> 'local'
 * - preview / staging / dev subdomain -> 'staging'
 * - Everything else -> 'production'
 */
export function getEnvironment(): Environment {
  // Handle SSR or non-browser environments
  if (typeof window === 'undefined' || !window.location) {
    return 'local';
  }

  const hostname = window.location.hostname.toLowerCase();

  // Local development
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.endsWith('.local') ||
    hostname.startsWith('192.168.') ||
    hostname.startsWith('10.')
  ) {
    return 'local';
  }

  // Staging environments (Vercel preview, staging subdomain, etc.)
  if (
    hostname.includes('preview') ||
    hostname.includes('staging') ||
    hostname.includes('dev.') ||
    hostname.includes('-git-') ||      // Vercel git branch previews
    hostname.endsWith('.vercel.app')   // All Vercel preview deployments
  ) {
    return 'staging';
  }

  // Production
  return 'production';
}

// ============================================================================
// FEATURE FLAGS CONFIGURATION
// ============================================================================

/**
 * Feature flags configuration
 *
 * IMPORTANT: Changes to rollout percentages should be coordinated with deployment
 */
export const FEATURE_FLAGS = {
  EDGE_FUNCTION_RATE_LIMITER: {
    key: 'EDGE_FUNCTION_RATE_LIMITER',
    description: 'Use Edge Function proxy with Postgres-backed rate limiting',
    rolloutPercentage: 100,
    paidOnly: false,
    enabledEnvironments: ['local', 'staging', 'production'],
  },
  SEAL_ON_DISPATCH: {
    key: 'SEAL_ON_DISPATCH',
    description: 'Automatically seal evidence when job is dispatched',
    rolloutPercentage: 0,
    paidOnly: false,
    enabledEnvironments: ['local', 'staging', 'production'],
  },
  TEAM_STATUS_BAR: {
    key: 'TEAM_STATUS_BAR',
    description: 'Show real-time team status bar on manager dashboard',
    rolloutPercentage: 0,
    paidOnly: false,
    enabledEnvironments: ['local', 'staging', 'production'],
  },
  READY_TO_INVOICE_SECTION: {
    key: 'READY_TO_INVOICE_SECTION',
    description: 'Show ready-to-invoice jobs section on dashboard',
    rolloutPercentage: 0,
    paidOnly: false,
    enabledEnvironments: ['local', 'staging', 'production'],
  },
  WORKSPACE_ISOLATED_STORAGE: {
    key: 'WORKSPACE_ISOLATED_STORAGE',
    description: 'Isolate IndexedDB storage by workspace ID',
    rolloutPercentage: 0,
    paidOnly: false,
    enabledEnvironments: ['local', 'staging', 'production'],
  },
} as const satisfies Record<FeatureFlagKey, FeatureFlag>;

// ============================================================================
// FLAG OVERRIDES (Development Only)
// ============================================================================

// In-memory storage for flag overrides
const flagOverrides = new Map<FeatureFlagKey, boolean>();

/**
 * Set an override for a feature flag (non-production only)
 *
 * @param flagKey - The flag to override
 * @param enabled - Whether to force-enable or force-disable
 * @returns true if override was set, false if rejected (production)
 */
export function setFlagOverride(flagKey: FeatureFlagKey, enabled: boolean): boolean {
  const env = getEnvironment();

  if (env === 'production') {
    console.warn(`[FeatureFlags] Cannot set overrides in production environment`);
    return false;
  }

  flagOverrides.set(flagKey, enabled);
  return true;
}

/**
 * Clear a specific flag override
 */
export function clearFlagOverride(flagKey: FeatureFlagKey): void {
  flagOverrides.delete(flagKey);
}

/**
 * Clear all flag overrides
 */
export function clearAllFlagOverrides(): void {
  flagOverrides.clear();
}

/**
 * Get the current override value for a flag (if any)
 */
export function getFlagOverride(flagKey: FeatureFlagKey): boolean | undefined {
  return flagOverrides.get(flagKey);
}

// ============================================================================
// DETERMINISTIC BUCKET ASSIGNMENT
// ============================================================================

/**
 * Simple hash function for deterministic bucket assignment
 * Uses DJB2 algorithm for consistent, fast hashing
 *
 * @param str - String to hash
 * @returns Number between 0 and 99 (inclusive)
 */
export function hashToBucket(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) + hash) ^ char; // hash * 33 XOR char
  }
  // Ensure positive number and map to 0-99
  return Math.abs(hash % 100);
}

/**
 * Check if a user is in the rollout bucket for a given flag
 *
 * @param flagKey - The feature flag key
 * @param userId - The user's unique identifier
 * @param rolloutPercentage - The percentage of users to include (0-100)
 * @returns true if user is in the rollout bucket
 */
export function isInRolloutBucket(
  flagKey: FeatureFlagKey,
  userId: string,
  rolloutPercentage: number
): boolean {
  if (rolloutPercentage <= 0) return false;
  if (rolloutPercentage >= 100) return true;

  // Combine flag key and user ID for deterministic assignment
  const bucketKey = `${flagKey}:${userId}`;
  const bucket = hashToBucket(bucketKey);

  return bucket < rolloutPercentage;
}

// ============================================================================
// FEATURE FLAG EVALUATION
// ============================================================================

/**
 * Check if a feature flag is enabled for a given user
 *
 * Evaluation order:
 * 1. Check for override (non-production only)
 * 2. Check environment enablement
 * 3. Check paid-only gate (if userId provided)
 * 4. Check rollout percentage (if userId provided)
 *
 * @param flagKey - The feature flag to evaluate
 * @param userId - Optional user ID for rollout calculation
 * @param isPaidUser - Optional flag indicating if user has paid subscription
 * @returns true if the feature should be enabled
 */
export function isFeatureEnabled(
  flagKey: FeatureFlagKey,
  userId?: string,
  isPaidUser?: boolean
): boolean {
  const flag = FEATURE_FLAGS[flagKey];
  const env = getEnvironment();

  // 1. Check for override (takes precedence in non-production)
  const override = flagOverrides.get(flagKey);
  if (override !== undefined && env !== 'production') {
    return override;
  }

  // 2. Check if flag is enabled for current environment
  if (!flag.enabledEnvironments.includes(env)) {
    return false;
  }

  // 3. Check paid-only gate
  if (flag.paidOnly && isPaidUser !== true) {
    return false;
  }

  // 4. Check rollout percentage
  // If no userId provided, use rollout percentage directly (anonymous user)
  if (!userId) {
    // For anonymous users, return true only if 100% rollout
    return flag.rolloutPercentage >= 100;
  }

  return isInRolloutBucket(flagKey, userId, flag.rolloutPercentage);
}

/**
 * Evaluate a feature flag with detailed reason
 *
 * @param flagKey - The feature flag to evaluate
 * @param userId - Optional user ID for rollout calculation
 * @param isPaidUser - Optional flag indicating if user has paid subscription
 * @returns Evaluation result with enabled status and reason
 */
export function evaluateFlag(
  flagKey: FeatureFlagKey,
  userId?: string,
  isPaidUser?: boolean
): FeatureFlagEvaluation {
  const flag = FEATURE_FLAGS[flagKey];
  const env = getEnvironment();

  // 1. Check for override
  const override = flagOverrides.get(flagKey);
  if (override !== undefined && env !== 'production') {
    return {
      key: flagKey,
      enabled: override,
      reason: 'override',
    };
  }

  // 2. Check environment
  if (!flag.enabledEnvironments.includes(env)) {
    return {
      key: flagKey,
      enabled: false,
      reason: 'environment',
    };
  }

  // 3. Check paid-only gate
  if (flag.paidOnly && isPaidUser !== true) {
    return {
      key: flagKey,
      enabled: false,
      reason: 'paid_only',
    };
  }

  // 4. Check rollout
  if (flag.rolloutPercentage <= 0) {
    return {
      key: flagKey,
      enabled: false,
      reason: 'disabled',
    };
  }

  if (!userId && flag.rolloutPercentage < 100) {
    return {
      key: flagKey,
      enabled: false,
      reason: 'rollout',
    };
  }

  const enabled = userId
    ? isInRolloutBucket(flagKey, userId, flag.rolloutPercentage)
    : flag.rolloutPercentage >= 100;

  return {
    key: flagKey,
    enabled,
    reason: 'rollout',
  };
}

/**
 * Get all feature flags with their current evaluation for a user
 *
 * @param userId - Optional user ID for rollout calculation
 * @param isPaidUser - Optional flag indicating if user has paid subscription
 * @returns Record of all flags with their evaluation
 */
export function getAllFlags(
  userId?: string,
  isPaidUser?: boolean
): Record<FeatureFlagKey, FeatureFlagEvaluation> {
  const keys = Object.keys(FEATURE_FLAGS) as FeatureFlagKey[];
  const result = {} as Record<FeatureFlagKey, FeatureFlagEvaluation>;

  for (const key of keys) {
    result[key] = evaluateFlag(key, userId, isPaidUser);
  }

  return result;
}

/**
 * Get a list of all enabled feature flags for a user
 *
 * @param userId - Optional user ID for rollout calculation
 * @param isPaidUser - Optional flag indicating if user has paid subscription
 * @returns Array of enabled flag keys
 */
export function getEnabledFlags(
  userId?: string,
  isPaidUser?: boolean
): FeatureFlagKey[] {
  const keys = Object.keys(FEATURE_FLAGS) as FeatureFlagKey[];
  return keys.filter(key => isFeatureEnabled(key, userId, isPaidUser));
}

// ============================================================================
// LEGACY API (Backward Compatibility)
// ============================================================================

/**
 * @deprecated Use FEATURE_FLAGS directly
 */
export const FEATURE_FLAG_NAMES = FEATURE_FLAGS;

/**
 * @deprecated Use isFeatureEnabled instead
 */
export const enableFeatureFlag = (flag: FeatureFlagKey): void => {
  setFlagOverride(flag, true);
};

/**
 * @deprecated Use clearFlagOverride instead
 */
export const disableFeatureFlag = (flag: FeatureFlagKey): void => {
  setFlagOverride(flag, false);
};

/**
 * @deprecated Use clearAllFlagOverrides instead
 */
export const resetFeatureFlags = (): void => {
  clearAllFlagOverrides();
};

/**
 * @deprecated Use getAllFlags instead
 */
export const getAllFeatureFlags = (): Record<FeatureFlagKey, boolean> => {
  const keys = Object.keys(FEATURE_FLAGS) as FeatureFlagKey[];
  const result = {} as Record<FeatureFlagKey, boolean>;
  for (const key of keys) {
    result[key] = isFeatureEnabled(key);
  }
  return result;
};
