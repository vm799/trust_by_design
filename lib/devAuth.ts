/**
 * Dev Auth Utilities
 *
 * Environment-gated authentication helpers for development and staging.
 * Production builds tree-shake unused code paths via dead code elimination.
 *
 * Environment modes:
 * - Dev (localhost): Quick-login buttons for 3 test roles, no magic link needed
 * - Staging: Password fields + magic link toggle for QA testing
 * - Production: Magic link only (this module's UI helpers return false)
 *
 * SECURITY: Test user credentials come from .env.local (gitignored).
 * Never hardcode passwords. Never expose test users in production.
 */

import type { FocusRole } from '../types';

export interface TestUser {
  role: FocusRole;
  persona: string;
  email: string;
  password: string;
  label: string;
  icon: string;
  description: string;
}

export interface TestUserConfig {
  managerEmail: string;
  managerPassword: string;
  techEmail: string;
  techPassword: string;
  soloEmail: string;
  soloPassword: string;
}

/**
 * Check if running in development mode (localhost)
 */
export function isDevEnvironment(): boolean {
  return import.meta.env.DEV === true;
}

/**
 * Check if running in staging environment
 */
export function isStagingEnvironment(): boolean {
  return import.meta.env.VITE_APP_ENV === 'staging';
}

/**
 * Check if running in production environment
 */
export function isProductionEnvironment(): boolean {
  return !isDevEnvironment() && !isStagingEnvironment();
}

/**
 * Whether to show the dev quick-login buttons (dev only)
 */
export function shouldShowDevLogin(): boolean {
  return isDevEnvironment();
}

/**
 * Whether to show password login fields (dev + staging)
 */
export function shouldShowPasswordLogin(): boolean {
  return isDevEnvironment() || isStagingEnvironment();
}

/**
 * Get configured test users from environment variables.
 *
 * Reads from VITE_TEST_* env vars (set in .env.local, which is gitignored).
 * Returns only users where both email and password are configured.
 *
 * @param overrides - Optional config override (used in tests)
 */
export function getTestUsers(overrides?: TestUserConfig): TestUser[] {
  const config: TestUserConfig = overrides ?? {
    managerEmail: import.meta.env.VITE_TEST_MANAGER_EMAIL || '',
    managerPassword: import.meta.env.VITE_TEST_MANAGER_PASSWORD || '',
    techEmail: import.meta.env.VITE_TEST_TECH_EMAIL || '',
    techPassword: import.meta.env.VITE_TEST_TECH_PASSWORD || '',
    soloEmail: import.meta.env.VITE_TEST_SOLO_EMAIL || '',
    soloPassword: import.meta.env.VITE_TEST_SOLO_PASSWORD || '',
  };

  const allUsers: TestUser[] = [
    {
      role: 'manager',
      persona: 'agency_owner',
      email: config.managerEmail,
      password: config.managerPassword,
      label: 'Manager',
      icon: 'admin_panel_settings',
      description: 'Admin dashboard, team management, job oversight',
    },
    {
      role: 'technician',
      persona: 'solo_contractor',
      email: config.techEmail,
      password: config.techPassword,
      label: 'Technician',
      icon: 'engineering',
      description: 'Field worker portal, evidence capture, job completion',
    },
    {
      role: 'solo_contractor',
      persona: 'solo_contractor',
      email: config.soloEmail,
      password: config.soloPassword,
      label: 'Solo Contractor',
      icon: 'person',
      description: 'Independent worker, self-dispatched jobs, own audit trail',
    },
  ];

  return allUsers.filter(user => user.email && user.password);
}
