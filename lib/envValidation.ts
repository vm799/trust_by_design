/**
 * Environment Variable Validation
 *
 * Validates required environment variables at application startup.
 * Provides clear error messages for missing or invalid configuration.
 */

interface EnvConfig {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
  VITE_STRIPE_PUBLISHABLE_KEY?: string;
  VITE_STRIPE_PRICE_TEAM_MONTHLY?: string;
  VITE_STRIPE_PRICE_TEAM_ANNUAL?: string;
  VITE_STRIPE_PRICE_AGENCY_MONTHLY?: string;
  VITE_STRIPE_PRICE_AGENCY_ANNUAL?: string;
  VITE_W3W_API_KEY?: string;
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate environment variables
 * Returns validation result with errors and warnings
 */
export function validateEnvironment(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const env: EnvConfig = {
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
    VITE_STRIPE_PUBLISHABLE_KEY: import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY,
    VITE_STRIPE_PRICE_TEAM_MONTHLY: import.meta.env.VITE_STRIPE_PRICE_TEAM_MONTHLY,
    VITE_STRIPE_PRICE_TEAM_ANNUAL: import.meta.env.VITE_STRIPE_PRICE_TEAM_ANNUAL,
    VITE_STRIPE_PRICE_AGENCY_MONTHLY: import.meta.env.VITE_STRIPE_PRICE_AGENCY_MONTHLY,
    VITE_STRIPE_PRICE_AGENCY_ANNUAL: import.meta.env.VITE_STRIPE_PRICE_AGENCY_ANNUAL,
    VITE_W3W_API_KEY: import.meta.env.VITE_W3W_API_KEY,
  };

  // Critical: Supabase configuration
  if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY) {
    warnings.push('Supabase credentials not configured. Running in offline-only mode.');
  } else {
    // Validate URL format
    try {
      const url = new URL(env.VITE_SUPABASE_URL);
      if (!url.hostname.includes('supabase')) {
        warnings.push('VITE_SUPABASE_URL does not appear to be a valid Supabase URL.');
      }
    } catch {
      errors.push('VITE_SUPABASE_URL is not a valid URL format.');
    }

    // Validate anon key format
    if (env.VITE_SUPABASE_ANON_KEY && env.VITE_SUPABASE_ANON_KEY.length < 100) {
      warnings.push('VITE_SUPABASE_ANON_KEY appears to be invalid (too short).');
    }
  }

  // Optional: Stripe configuration (for payments)
  if (!env.VITE_STRIPE_PUBLISHABLE_KEY) {
    warnings.push('Stripe not configured. Payment features will be disabled.');
  } else {
    if (!env.VITE_STRIPE_PUBLISHABLE_KEY.startsWith('pk_')) {
      warnings.push('VITE_STRIPE_PUBLISHABLE_KEY format appears invalid (should start with pk_).');
    }

    // Check Stripe price IDs
    const priceIds = [
      { key: 'VITE_STRIPE_PRICE_TEAM_MONTHLY', value: env.VITE_STRIPE_PRICE_TEAM_MONTHLY },
      { key: 'VITE_STRIPE_PRICE_TEAM_ANNUAL', value: env.VITE_STRIPE_PRICE_TEAM_ANNUAL },
      { key: 'VITE_STRIPE_PRICE_AGENCY_MONTHLY', value: env.VITE_STRIPE_PRICE_AGENCY_MONTHLY },
      { key: 'VITE_STRIPE_PRICE_AGENCY_ANNUAL', value: env.VITE_STRIPE_PRICE_AGENCY_ANNUAL },
    ];

    const missingPriceIds = priceIds.filter(p => !p.value);
    const invalidPriceIds = priceIds.filter(p => p.value && !p.value.startsWith('price_'));

    if (missingPriceIds.length > 0) {
      warnings.push(`Missing Stripe price IDs: ${missingPriceIds.map(p => p.key).join(', ')}. Paid plans will show errors.`);
    }

    if (invalidPriceIds.length > 0) {
      warnings.push(`Invalid Stripe price ID format: ${invalidPriceIds.map(p => p.key).join(', ')} (should start with price_).`);
    }
  }

  // Optional: What3Words API (for location addressing)
  if (!env.VITE_W3W_API_KEY) {
    warnings.push('What3Words API not configured. Location features will use mock data.');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Log validation results to console
 * Shows errors in red, warnings in yellow
 */
export function logValidationResults(result: ValidationResult): void {
  if (result.errors.length > 0) {
    console.error('❌ Environment Configuration Errors:');
    result.errors.forEach(error => console.error(`   • ${error}`));
  }

  if (result.warnings.length > 0) {
    console.warn('⚠️  Environment Configuration Warnings:');
    result.warnings.forEach(warning => console.warn(`   • ${warning}`));
  }

  if (result.isValid && result.warnings.length === 0) {
    console.log('✅ Environment configuration validated successfully.');
  }
}

/**
 * Validate environment and optionally throw on errors
 * Call this at application startup
 */
export function validateAndLog(throwOnError = false): boolean {
  const result = validateEnvironment();
  logValidationResults(result);

  if (!result.isValid && throwOnError) {
    throw new Error('Environment validation failed. Check console for details.');
  }

  return result.isValid;
}
