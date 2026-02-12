/**
 * SoloContractorDashboard - Integration Tests
 *
 * Tests the redesigned solo contractor dashboard:
 * - UX Contract: FOCUS / QUEUE / BACKGROUND (strict)
 * - 3 contextual actions (New Job, Search, All Jobs)
 * - Only QuickSearchModal (no assign/invoice - solo doesn't need them)
 * - Evidence progress bars on job cards
 * - Keyboard shortcuts (Ctrl+K for search)
 * - Accessibility: ARIA labels, focus indicators, touch targets
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { DataContext } from '../../../lib/DataContext';
import SoloContractorDashboard from '../../../views/app/SoloContractorDashboard';
import { Job } from '../../../types';

// Mock useAuth hook
vi.mock('../../../lib/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    userId: 'user-123',
    userEmail: 'test@example.com',
    workspaceId: 'workspace-1',
    isLoading: false,
  }),
}));

// ============================================================================
// TEST SETUP
// ============================================================================

function createTestJob(overrides: Partial<Job> = {}): Job {
  return {
    id: `job-${Math.random().toString(36).slice(2, 8)}`,
    title: 'Test Job',
    clientId: 'client-1',
    client: 'Test Client',
    techId: 'user-123',
    technicianId: undefined,
    technician: null,
    status: 'Pending',
    syncStatus: 'synced',
    priority: 'normal',
    date: new Date().toISOString(),
    photos: [],
    signature: null,
    notes: '',
    address: 'Test Address',
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
    clients: [],
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

describe('SoloContractorDashboard - Integration', () => {
  // ========== CONTEXTUAL ACTIONS (3 max per UX Contract) ==========

  describe('Contextual Action Buttons', () => {
    it('renders exactly 3 action buttons: New Job, Search, All Jobs', () => {
      const jobs = [createTestJob({ id: 'job-1', techId: 'user-123' })];

      render(
        <TestWrapper jobs={jobs}>
          <SoloContractorDashboard />
        </TestWrapper>
      );

      expect(screen.getByLabelText(/Create new job/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Search jobs/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/View all jobs/i)).toBeInTheDocument();
    });

    it('does NOT render assign or invoice buttons (solo has no team, invoicing deferred)', () => {
      const jobs = [createTestJob({ id: 'job-1', techId: 'user-123' })];

      render(
        <TestWrapper jobs={jobs}>
          <SoloContractorDashboard />
        </TestWrapper>
      );

      expect(screen.queryByLabelText(/Assign technician/i)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/Create invoice/i)).not.toBeInTheDocument();
    });

    it('all action buttons meet 56px touch target minimum', () => {
      const jobs = [createTestJob({ id: 'job-1', techId: 'user-123' })];

      render(
        <TestWrapper jobs={jobs}>
          <SoloContractorDashboard />
        </TestWrapper>
      );

      const newJobBtn = screen.getByLabelText(/Create new job/i);
      const searchBtn = screen.getByLabelText(/Search jobs/i);
      const allJobsBtn = screen.getByLabelText(/View all jobs/i);

      expect(newJobBtn).toHaveClass('min-h-[56px]');
      expect(searchBtn).toHaveClass('min-h-[56px]');
      expect(allJobsBtn).toHaveClass('min-h-[56px]');
    });

    it('renders 3-column grid layout', () => {
      const jobs = [createTestJob({ id: 'job-1', techId: 'user-123' })];

      const { container } = render(
        <TestWrapper jobs={jobs}>
          <SoloContractorDashboard />
        </TestWrapper>
      );

      const grids = container.querySelectorAll('.grid-cols-3');
      expect(grids.length).toBeGreaterThan(0);
    });
  });

  // ========== SEARCH MODAL ==========

  describe('Search Modal', () => {
    it('opens QuickSearchModal when search button clicked', async () => {
      const user = userEvent.setup();
      const jobs = [createTestJob({ id: 'job-1', techId: 'user-123' })];

      render(
        <TestWrapper jobs={jobs}>
          <SoloContractorDashboard />
        </TestWrapper>
      );

      const searchBtn = screen.getByLabelText(/Search jobs/i);
      await user.click(searchBtn);

      await waitFor(() => {
        expect(screen.getByRole('dialog', { name: /Search Jobs/i }))
          .toBeInTheDocument();
      });
    });

    it('closes modal when close button clicked', async () => {
      const user = userEvent.setup();
      const jobs = [createTestJob({ id: 'job-1', techId: 'user-123' })];

      render(
        <TestWrapper jobs={jobs}>
          <SoloContractorDashboard />
        </TestWrapper>
      );

      const searchBtn = screen.getByLabelText(/Search jobs/i);
      await user.click(searchBtn);

      await waitFor(() => {
        expect(screen.getByRole('dialog', { name: /Search Jobs/i }))
          .toBeInTheDocument();
      });

      const closeBtn = screen.getByRole('button', { name: /Close dialog/i });
      await user.click(closeBtn);

      await waitFor(() => {
        expect(screen.queryByRole('dialog', { name: /Search Jobs/i }))
          .not.toBeInTheDocument();
      });
    });

    it('closes modal when Escape key pressed', async () => {
      const user = userEvent.setup();
      const jobs = [createTestJob({ id: 'job-1', techId: 'user-123' })];

      render(
        <TestWrapper jobs={jobs}>
          <SoloContractorDashboard />
        </TestWrapper>
      );

      const searchBtn = screen.getByLabelText(/Search jobs/i);
      await user.click(searchBtn);

      await waitFor(() => {
        expect(screen.getByRole('dialog', { name: /Search Jobs/i }))
          .toBeInTheDocument();
      });

      await user.keyboard('{Escape}');

      await waitFor(() => {
        expect(screen.queryByRole('dialog', { name: /Search Jobs/i }))
          .not.toBeInTheDocument();
      });
    });
  });

  // ========== KEYBOARD SHORTCUTS ==========

  describe('Keyboard Shortcuts', () => {
    it('opens QuickSearchModal with Ctrl+K shortcut', async () => {
      const jobs = [createTestJob({ id: 'job-1', techId: 'user-123' })];

      render(
        <TestWrapper jobs={jobs}>
          <SoloContractorDashboard />
        </TestWrapper>
      );

      window.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'k',
          ctrlKey: true,
          bubbles: true,
        })
      );

      await waitFor(() => {
        expect(screen.getByRole('dialog', { name: /Search Jobs/i }))
          .toBeInTheDocument();
      });
    });

    it('opens QuickSearchModal with Cmd+K (macOS)', async () => {
      const jobs = [createTestJob({ id: 'job-1', techId: 'user-123' })];

      render(
        <TestWrapper jobs={jobs}>
          <SoloContractorDashboard />
        </TestWrapper>
      );

      window.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'k',
          metaKey: true,
          bubbles: true,
        })
      );

      await waitFor(() => {
        expect(screen.getByRole('dialog', { name: /Search Jobs/i }))
          .toBeInTheDocument();
      });
    });
  });

  // ========== EVIDENCE PROGRESS ==========

  describe('Evidence Progress', () => {
    it('renders evidence progress bar in focus job', () => {
      const jobs = [
        createTestJob({
          id: 'job-1',
          techId: 'user-123',
          status: 'In Progress',
          photos: [
            { id: 'p1', url: 'test', timestamp: '', verified: true, syncStatus: 'synced', type: 'before' },
          ],
        }),
      ];

      render(
        <TestWrapper jobs={jobs}>
          <SoloContractorDashboard />
        </TestWrapper>
      );

      // Evidence progress bar should be present
      expect(screen.getByRole('group', { name: /Evidence progress/i })).toBeInTheDocument();
    });

    it('shows capture button on focus job card', () => {
      const jobs = [
        createTestJob({
          id: 'job-1',
          techId: 'user-123',
          status: 'In Progress',
        }),
      ];

      render(
        <TestWrapper jobs={jobs}>
          <SoloContractorDashboard />
        </TestWrapper>
      );

      // Capture button should exist on the focus card
      expect(screen.getByText('Capture')).toBeInTheDocument();
      expect(screen.getByText('Continue')).toBeInTheDocument();
    });
  });

  // ========== ACCESSIBILITY ==========

  describe('Accessibility', () => {
    it('all action buttons have proper aria-labels', () => {
      const jobs = [createTestJob({ id: 'job-1', techId: 'user-123' })];

      render(
        <TestWrapper jobs={jobs}>
          <SoloContractorDashboard />
        </TestWrapper>
      );

      expect(screen.getByLabelText(/Create new job/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Search jobs/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/View all jobs/i)).toBeInTheDocument();
    });

    it('buttons have focus indicators', () => {
      const jobs = [createTestJob({ id: 'job-1', techId: 'user-123' })];

      render(
        <TestWrapper jobs={jobs}>
          <SoloContractorDashboard />
        </TestWrapper>
      );

      const searchBtn = screen.getByLabelText(/Search jobs/i);
      expect(searchBtn).toHaveClass('focus:ring-2');
      expect(searchBtn).toHaveClass('focus:ring-primary');
    });

    it('modals have proper ARIA attributes', async () => {
      const user = userEvent.setup();
      const jobs = [createTestJob({ id: 'job-1', techId: 'user-123' })];

      const { container } = render(
        <TestWrapper jobs={jobs}>
          <SoloContractorDashboard />
        </TestWrapper>
      );

      const searchBtn = screen.getByLabelText(/Search jobs/i);
      await user.click(searchBtn);

      await waitFor(() => {
        const modal = container.querySelector('[role="dialog"]');
        expect(modal).toHaveAttribute('aria-modal', 'true');
        expect(modal).toHaveAttribute('aria-labelledby', 'modal-title');
      });
    });
  });

  // ========== EDGE CASES ==========

  describe('Edge Cases', () => {
    it('handles rapid button clicks without errors', async () => {
      const user = userEvent.setup();
      const jobs = [createTestJob({ id: 'job-1', techId: 'user-123' })];

      render(
        <TestWrapper jobs={jobs}>
          <SoloContractorDashboard />
        </TestWrapper>
      );

      const searchBtn = screen.getByLabelText(/Search jobs/i);

      for (let i = 0; i < 3; i++) {
        await user.click(searchBtn);
      }

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).toBeInTheDocument();
      });
    });
  });
});
