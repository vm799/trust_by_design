/**
 * TechPortal - Hero Card Integration Tests
 *
 * Tests the refined technician hero card:
 * - EvidenceProgressBar replaces text-based indicators
 * - Direct CAPTURE CTA (1-tap to camera)
 * - Conditional COMPLETE CTA (when evidence is sufficient)
 * - CONTINUE CTA (when evidence insufficient)
 * - Accessibility: ARIA labels, touch targets, focus indicators
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { DataContext } from '../../../lib/DataContext';
import TechPortal from '../../../views/tech/TechPortal';
import { Job } from '../../../types';

// Mock useAuth hook
vi.mock('../../../lib/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    userId: 'user-123',
    userEmail: 'tech@example.com',
    workspaceId: 'workspace-1',
    isLoading: false,
    session: {
      user: {
        user_metadata: { full_name: 'Test Tech' },
      },
    },
  }),
}));

// ============================================================================
// TEST SETUP
// ============================================================================

function createTestJob(overrides: Partial<Job> = {}): Job {
  return {
    id: `job-${Math.random().toString(36).slice(2, 8)}`,
    title: 'Fix Boiler Unit 3',
    clientId: 'client-1',
    client: 'Acme Corp',
    techId: 'user-123',
    technicianId: 'user-123',
    technician: null,
    status: 'In Progress',
    syncStatus: 'synced',
    priority: 'normal',
    date: new Date().toISOString(),
    photos: [],
    signature: null,
    notes: '',
    address: '123 Main St',
    lastUpdated: Date.now(),
    safetyChecklist: [],
    ...overrides,
  } as Job;
}

function TestWrapper({
  children,
  jobs = [],
}: {
  children: React.ReactNode;
  jobs?: Job[];
}) {
  const dataContextValue = {
    jobs,
    technicians: [],
    clients: [{ id: 'client-1', name: 'Acme Corp' }],
    updateJob: vi.fn().mockResolvedValue(undefined),
    deleteJob: vi.fn(),
    addJob: vi.fn(),
    isLoading: false,
    error: null,
    refresh: vi.fn(),
  };

  return (
    <BrowserRouter>
      <DataContext.Provider value={dataContextValue as any}>
        {children}
      </DataContext.Provider>
    </BrowserRouter>
  );
}

// ============================================================================
// TESTS
// ============================================================================

describe('TechPortal - Hero Card', () => {
  // ========== EVIDENCE PROGRESS BAR ==========

  describe('Evidence Progress Bar', () => {
    it('renders EvidenceProgressBar on hero card for started job', () => {
      const job = createTestJob({ id: 'job-1', status: 'In Progress' });

      render(
        <TestWrapper jobs={[job]}>
          <TechPortal />
        </TestWrapper>
      );

      // EvidenceProgressBar renders a role="group" with "Evidence progress" label
      expect(screen.getByRole('group', { name: /Evidence progress/i })).toBeInTheDocument();
    });

    it('shows defensible status when all evidence captured', () => {
      const job = createTestJob({
        id: 'job-1',
        status: 'In Progress',
        photos: [
          { id: 'p1', url: 'test', timestamp: '', verified: true, syncStatus: 'synced', type: 'before' },
          { id: 'p2', url: 'test', timestamp: '', verified: true, syncStatus: 'synced', type: 'after' },
        ],
        signature: 'data:image/png;base64,test',
      });

      render(
        <TestWrapper jobs={[job]}>
          <TechPortal />
        </TestWrapper>
      );

      expect(screen.getByText('Defensible')).toBeInTheDocument();
    });
  });

  // ========== DIRECT CTAs ==========

  describe('Direct Action CTAs', () => {
    it('renders Capture button on hero card', () => {
      const job = createTestJob({ id: 'job-1', status: 'In Progress' });

      render(
        <TestWrapper jobs={[job]}>
          <TechPortal />
        </TestWrapper>
      );

      expect(screen.getByText('Capture')).toBeInTheDocument();
      expect(screen.getByLabelText(/Capture evidence/i)).toBeInTheDocument();
    });

    it('Capture button links directly to evidence capture route', () => {
      const job = createTestJob({ id: 'job-1', status: 'In Progress' });

      render(
        <TestWrapper jobs={[job]}>
          <TechPortal />
        </TestWrapper>
      );

      const captureLink = screen.getByLabelText(/Capture evidence/i);
      expect(captureLink).toHaveAttribute('href', '/tech/job/job-1/capture');
    });

    it('shows Continue button when evidence is insufficient', () => {
      const job = createTestJob({
        id: 'job-1',
        status: 'In Progress',
        photos: [],
        signature: null,
      });

      render(
        <TestWrapper jobs={[job]}>
          <TechPortal />
        </TestWrapper>
      );

      expect(screen.getByText('Continue')).toBeInTheDocument();
      expect(screen.getByLabelText(/Continue working/i)).toBeInTheDocument();
    });

    it('shows Complete button when evidence is sufficient (isDoneEnough)', () => {
      const job = createTestJob({
        id: 'job-1',
        status: 'In Progress',
        photos: [
          { id: 'p1', url: 'test', timestamp: '', verified: true, syncStatus: 'synced', type: 'before' },
        ],
        signature: 'data:image/png;base64,test',
      });

      render(
        <TestWrapper jobs={[job]}>
          <TechPortal />
        </TestWrapper>
      );

      expect(screen.getByText('Complete')).toBeInTheDocument();
      expect(screen.getByLabelText(/Complete and submit/i)).toBeInTheDocument();
    });

    it('Complete button links to review route', () => {
      const job = createTestJob({
        id: 'job-1',
        status: 'In Progress',
        photos: [
          { id: 'p1', url: 'test', timestamp: '', verified: true, syncStatus: 'synced', type: 'before' },
        ],
        signature: 'data:image/png;base64,test',
      });

      render(
        <TestWrapper jobs={[job]}>
          <TechPortal />
        </TestWrapper>
      );

      const completeLink = screen.getByLabelText(/Complete and submit/i);
      expect(completeLink).toHaveAttribute('href', '/tech/job/job-1/review');
    });
  });

  // ========== TOUCH TARGETS ==========

  describe('Touch Targets', () => {
    it('all hero card CTAs meet 56px touch target minimum', () => {
      const job = createTestJob({ id: 'job-1', status: 'In Progress' });

      render(
        <TestWrapper jobs={[job]}>
          <TechPortal />
        </TestWrapper>
      );

      const captureBtn = screen.getByLabelText(/Capture evidence/i);
      const continueBtn = screen.getByLabelText(/Continue working/i);

      expect(captureBtn).toHaveClass('min-h-[56px]');
      expect(continueBtn).toHaveClass('min-h-[56px]');
    });
  });

  // ========== NO HERO CARD STATES ==========

  describe('No Started Job', () => {
    it('does not render hero card when no job is in progress', () => {
      const job = createTestJob({ id: 'job-1', status: 'Pending' });

      render(
        <TestWrapper jobs={[job]}>
          <TechPortal />
        </TestWrapper>
      );

      // No evidence progress bar (only on hero card)
      expect(screen.queryByRole('group', { name: /Evidence progress/i })).not.toBeInTheDocument();
      // No Capture/Continue buttons
      expect(screen.queryByText('Capture')).not.toBeInTheDocument();
    });
  });
});
