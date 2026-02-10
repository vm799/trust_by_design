/**
 * Route Configuration
 *
 * Defines all application routes in a centralized location.
 *
 * Phase A: Foundation & App Shell
 */

import { lazy } from 'react';

// Lazy load views for code splitting
// Auth views
export const OAuthSetup = lazy(() => import('../views/OAuthSetup'));
export const CompleteOnboarding = lazy(() => import('../views/CompleteOnboarding'));

// Main app views (active in App.tsx routes)
export const ClientForm = lazy(() => import('../views/app/clients/ClientForm'));
export const JobsList = lazy(() => import('../views/app/jobs/JobsList'));
export const JobDetail = lazy(() => import('../views/app/jobs/JobDetail'));
export const JobForm = lazy(() => import('../views/app/jobs/JobForm'));
export const EvidenceReview = lazy(() => import('../views/app/jobs/EvidenceReview'));
export const TechnicianForm = lazy(() => import('../views/app/technicians/TechnicianForm'));

// Technician views
export const TechPortal = lazy(() => import('../views/tech/TechPortal'));
export const TechJobDetail = lazy(() => import('../views/tech/TechJobDetail'));
export const EvidenceCapture = lazy(() => import('../views/tech/EvidenceCapture'));

// Phase 15: Field Proof System
export const TechProofScreen = lazy(() => import('../views/TechProofScreen'));

// Active views (used in App.tsx)
export const AdminDashboard = lazy(() => import('../views/AdminDashboard'));
export const TechnicianPortal = lazy(() => import('../views/TechnicianPortal'));

/**
 * Route path constants
 *
 * IMPORTANT: These must match the actual routes defined in App.tsx
 * The app currently uses /admin/* routes, not /app/* routes
 */
export const ROUTES = {
  // Public
  HOME: '/',
  AUTH: '/auth',
  AUTH_CALLBACK: '/auth/callback',
  VERIFY: '/verify',
  VERIFY_CERTIFICATE: '/verify/:certificateId',

  // Onboarding
  SETUP: '/setup',
  ONBOARDING: '/onboarding',
  ONBOARDING_STEP: '/onboarding/:step',

  // Main App - using actual /admin routes from App.tsx
  APP: '/admin',
  DASHBOARD: '/admin',

  // Clients - actual routes
  CLIENTS: '/admin/clients',
  CLIENT_NEW: '/admin/clients/new',
  CLIENT_DETAIL: '/admin/clients/:id',
  CLIENT_EDIT: '/admin/clients/:id/edit',

  // Jobs - actual routes
  JOBS: '/admin/jobs',
  JOB_NEW: '/admin/jobs/new',
  JOB_CREATE: '/admin/create',
  JOB_DETAIL: '/admin/jobs/:id',
  JOB_EDIT: '/admin/jobs/:id/edit',
  JOB_EVIDENCE: '/admin/jobs/:id/evidence',
  JOB_SEAL: '/admin/jobs/:id/seal',

  // Technicians - actual routes
  TECHNICIANS: '/admin/technicians',
  TECHNICIAN_NEW: '/admin/technicians/new',
  TECHNICIAN_DETAIL: '/admin/technicians/:id',

  // Invoices - actual routes
  INVOICES: '/admin/invoices',
  INVOICE_DETAIL: '/admin/invoices/:id',
  INVOICE_SEND: '/admin/invoices/:id/send',

  // Settings - actual routes
  SETTINGS: '/admin/settings',
  SETTINGS_WORKSPACE: '/admin/settings/workspace',
  SETTINGS_BILLING: '/admin/settings/billing',
  SETTINGS_TEAM: '/admin/settings/team',

  // Technician Portal
  TECH: '/tech',
  TECH_JOB: '/tech/job/:jobId',
  TECH_CAPTURE: '/tech/job/:jobId/capture',

  // Phase 15: Field Proof System (magic link access)
  JOB_PROOF: '/job/:jobId/:token',
  JOB_PROOF_PIN: '/job/:jobId', // With ?pin= query param

  // Legacy (redirects)
  LEGACY_ADMIN: '/admin',
  LEGACY_PRICING: '/pricing',
} as const;

/**
 * Helper to generate route with params
 */
export function route(path: string, params: Record<string, string> = {}): string {
  let result = path;
  Object.entries(params).forEach(([key, value]) => {
    result = result.replace(`:${key}`, value);
  });
  return result;
}
