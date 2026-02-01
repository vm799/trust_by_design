/**
 * Job Creation Guard Hook
 *
 * Phase 3: Client-First Flow
 *
 * Validates that prerequisites exist before allowing job creation:
 * - At least one client must exist (required)
 * - Technician is optional (jobs can be unassigned)
 */

import { useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useData } from '../lib/DataContext';
import { showToast } from '../lib/microInteractions';
import type { Client, Technician } from '../types';

export interface JobGuardState {
  // Loading state
  isLoading: boolean;

  // Data
  clients: Client[];
  technicians: Technician[];

  // Validation flags
  hasClients: boolean;
  hasTechnicians: boolean;
  canCreateJob: boolean;

  // Guard actions
  checkAndRedirect: () => Promise<boolean>;
  showClientRequiredToast: () => void;
  showNoTechnicianWarning: () => void;

  // Refresh data
  refresh: () => Promise<void>;
}

/**
 * Hook to guard job creation and enforce client-first flow
 *
 * @param redirectOnFail - If true, automatically redirects to /admin/clients/new when no clients exist
 * @returns JobGuardState with validation status and actions
 */
export const useJobGuard = (redirectOnFail = false): JobGuardState => {
  const navigate = useNavigate();
  const location = useLocation();

  // Use DataContext for state management
  const { clients, technicians, isLoading, refresh } = useData();

  // Derived state
  const hasClients = clients.length > 0;
  const hasTechnicians = technicians.length > 0;
  const canCreateJob = hasClients; // Only clients are required

  // Auto-redirect on fail if enabled
  useEffect(() => {
    if (!isLoading && redirectOnFail && !hasClients) {
      showToast('Create a client first before adding jobs', 'warning', 5000);
      // Preserve the current path as returnTo
      const returnTo = encodeURIComponent(location.pathname);
      navigate(`/admin/clients/new?returnTo=${returnTo}`, { replace: true });
    }
  }, [isLoading, redirectOnFail, hasClients, navigate, location.pathname]);

  // Show toast when client is required
  const showClientRequiredToast = useCallback(() => {
    showToast('Create a client first before adding jobs', 'warning', 5000);
  }, []);

  // Show warning when no technicians (optional, not blocking)
  const showNoTechnicianWarning = useCallback(() => {
    showToast(
      'No technicians available. Job will be created as unassigned.',
      'info',
      4000
    );
  }, []);

  // Check prerequisites and redirect if needed
  const checkAndRedirect = useCallback(async (): Promise<boolean> => {
    // Refresh data first
    await refresh();

    if (!hasClients) {
      showClientRequiredToast();
      const returnTo = encodeURIComponent(location.pathname);
      navigate(`/admin/clients/new?returnTo=${returnTo}`);
      return false;
    }

    // Warn about no technicians but don't block
    if (!hasTechnicians) {
      showNoTechnicianWarning();
    }

    return true;
  }, [refresh, hasClients, hasTechnicians, showClientRequiredToast, showNoTechnicianWarning, navigate, location.pathname]);

  return {
    isLoading,
    clients,
    technicians,
    hasClients,
    hasTechnicians,
    canCreateJob,
    checkAndRedirect,
    showClientRequiredToast,
    showNoTechnicianWarning,
    refresh,
  };
};

/**
 * Guard component that wraps job creation forms
 * Automatically redirects if prerequisites are not met
 */
export const useJobCreationRedirect = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const redirectToClientCreation = useCallback(() => {
    showToast('Create a client first before adding jobs', 'warning', 5000);
    const returnTo = encodeURIComponent(location.pathname);
    navigate(`/admin/clients/new?returnTo=${returnTo}`);
  }, [navigate, location.pathname]);

  const redirectToTechnicianCreation = useCallback(() => {
    showToast('Add a technician to assign jobs', 'info', 4000);
    const returnTo = encodeURIComponent(location.pathname);
    navigate(`/admin/technicians/new?returnTo=${returnTo}`);
  }, [navigate, location.pathname]);

  return {
    redirectToClientCreation,
    redirectToTechnicianCreation,
  };
};

export default useJobGuard;
