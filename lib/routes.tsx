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
export const EmailFirstAuth = lazy(() => import('../views/EmailFirstAuth'));
export const OAuthCallback = lazy(() => import('../views/OAuthCallback'));
export const OAuthSetup = lazy(() => import('../views/OAuthSetup'));
export const CompleteOnboarding = lazy(() => import('../views/CompleteOnboarding'));

// Main app views (new)
export const Dashboard = lazy(() => import('../views/app/Dashboard'));
export const ClientList = lazy(() => import('../views/app/clients/ClientList'));
export const ClientDetail = lazy(() => import('../views/app/clients/ClientDetail'));
export const ClientForm = lazy(() => import('../views/app/clients/ClientForm'));
export const JobList = lazy(() => import('../views/app/jobs/JobList'));
export const JobDetail = lazy(() => import('../views/app/jobs/JobDetail'));
export const JobForm = lazy(() => import('../views/app/jobs/JobForm'));
export const EvidenceReview = lazy(() => import('../views/app/jobs/EvidenceReview'));
export const InvoiceList = lazy(() => import('../views/app/invoices/InvoiceList'));
export const InvoiceDetail = lazy(() => import('../views/app/invoices/InvoiceDetail'));
export const TechnicianList = lazy(() => import('../views/app/technicians/TechnicianList'));
export const Settings = lazy(() => import('../views/app/settings/Settings'));

// Technician views
export const TechPortal = lazy(() => import('../views/tech/TechPortal'));
export const TechJobDetail = lazy(() => import('../views/tech/TechJobDetail'));
export const EvidenceCapture = lazy(() => import('../views/tech/EvidenceCapture'));

// Public views
export const CertificateVerify = lazy(() => import('../views/public/CertificateVerify'));
export const Landing = lazy(() => import('../views/Landing'));

// Legacy views (will be deprecated)
export const AdminDashboard = lazy(() => import('../views/AdminDashboard'));
export const Clients = lazy(() => import('../views/Clients'));
export const Jobs = lazy(() => import('../views/Jobs'));
export const Invoices = lazy(() => import('../views/Invoices'));
export const TechnicianPortal = lazy(() => import('../views/TechnicianPortal'));

/**
 * Route path constants
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

  // Main App
  APP: '/app',
  DASHBOARD: '/app',

  // Clients
  CLIENTS: '/app/clients',
  CLIENT_NEW: '/app/clients/new',
  CLIENT_DETAIL: '/app/clients/:id',
  CLIENT_EDIT: '/app/clients/:id/edit',

  // Jobs
  JOBS: '/app/jobs',
  JOB_NEW: '/app/jobs/new',
  JOB_DETAIL: '/app/jobs/:id',
  JOB_EDIT: '/app/jobs/:id/edit',
  JOB_EVIDENCE: '/app/jobs/:id/evidence',
  JOB_SEAL: '/app/jobs/:id/seal',

  // Technicians
  TECHNICIANS: '/app/technicians',
  TECHNICIAN_NEW: '/app/technicians/new',
  TECHNICIAN_DETAIL: '/app/technicians/:id',

  // Invoices
  INVOICES: '/app/invoices',
  INVOICE_DETAIL: '/app/invoices/:id',
  INVOICE_SEND: '/app/invoices/:id/send',

  // Settings
  SETTINGS: '/app/settings',
  SETTINGS_WORKSPACE: '/app/settings/workspace',
  SETTINGS_BILLING: '/app/settings/billing',
  SETTINGS_TEAM: '/app/settings/team',

  // Technician Portal
  TECH: '/tech',
  TECH_JOB: '/tech/job/:jobId',
  TECH_CAPTURE: '/tech/job/:jobId/capture',

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
