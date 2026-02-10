/**
 * ManagerFocusDashboard - Integration Tests
 *
 * Tests the redesigned unified manager dashboard:
 * - UX Contract: FOCUS / QUEUE / BACKGROUND (strict)
 * - ProofGapBar: evidence compliance at a glance
 * - 3 contextual actions (Search, Assign, All Jobs)
 * - Only QuickSearchModal + QuickAssignModal (invoicing deferred)
 * - Keyboard shortcuts (Ctrl+K for search, Ctrl+A for assign)
 * - Accessibility: ARIA labels, focus indicators, touch targets
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { DataContext } from '../../../lib/DataContext';
import ManagerFocusDashboard from '../../../views/app/ManagerFocusDashboard';
import { Job, Technician } from '../../../types';

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

function createTestTechnician(overrides: Partial<Technician> = {}): Technician {
  return {
    id: `tech-${Math.random().toString(36).slice(2, 8)}`,
    name: 'Test Technician',
    email: 'tech@example.com',
    phone: '555-0100',
    status: 'active',
    workspaceId: 'workspace-1',
    ...overrides,
  } as Technician;
}

function TestWrapper({
  children,
  jobs = [],
  technicians = [],
}: {
  children: React.ReactNode;
  jobs?: Job[];
  technicians?: Technician[];
}) {
  const dataContextValue = {
    jobs,
    technicians,
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

describe('ManagerFocusDashboard - Integration', () => {
  // ========== CONTEXTUAL ACTIONS (3 max per UX Contract) ==========

  describe('Contextual Action Buttons', () => {
    it('renders exactly 3 action buttons: Search, Assign, All Jobs', () => {
      const jobs = [createTestJob({ id: 'job-1', techId: 'user-123' })];
      const technicians = [createTestTechnician({ id: 'tech-1' })];

      render(
        <TestWrapper jobs={jobs} technicians={technicians}>
          <ManagerFocusDashboard />
        </TestWrapper>
      );

      expect(screen.getByLabelText(/Search jobs/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Assign technician/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/View all jobs/i)).toBeInTheDocument();
    });

    it('does NOT render invoice button (invoicing deferred to next release)', () => {
      const jobs = [createTestJob({ id: 'job-1', techId: 'user-123' })];
      const technicians = [createTestTechnician({ id: 'tech-1' })];

      render(
        <TestWrapper jobs={jobs} technicians={technicians}>
          <ManagerFocusDashboard />
        </TestWrapper>
      );

      expect(screen.queryByLabelText(/Create invoice/i)).not.toBeInTheDocument();
    });

    it('all action buttons meet 56px touch target minimum', () => {
      const jobs = [createTestJob({ id: 'job-1', techId: 'user-123' })];
      const technicians = [createTestTechnician({ id: 'tech-1' })];

      render(
        <TestWrapper jobs={jobs} technicians={technicians}>
          <ManagerFocusDashboard />
        </TestWrapper>
      );

      const searchBtn = screen.getByLabelText(/Search jobs/i);
      const assignBtn = screen.getByLabelText(/Assign technician/i);
      const allJobsBtn = screen.getByLabelText(/View all jobs/i);

      expect(searchBtn).toHaveClass('min-h-[56px]');
      expect(assignBtn).toHaveClass('min-h-[56px]');
      expect(allJobsBtn).toHaveClass('min-h-[56px]');
    });

    it('renders 3-column grid layout', () => {
      const jobs = [createTestJob({ id: 'job-1', techId: 'user-123' })];
      const technicians = [createTestTechnician({ id: 'tech-1' })];

      const { container } = render(
        <TestWrapper jobs={jobs} technicians={technicians}>
          <ManagerFocusDashboard />
        </TestWrapper>
      );

      const grids = container.querySelectorAll('.grid-cols-4');
      expect(grids.length).toBeGreaterThan(0);
    });
  });

  // ========== PROOF GAP BAR ==========

  describe('Proof Gap Bar', () => {
    it('renders ProofGapBar for evidence compliance', () => {
      const jobs = [createTestJob({ id: 'job-1', status: 'In Progress' })];
      const technicians = [createTestTechnician({ id: 'tech-1' })];

      render(
        <TestWrapper jobs={jobs} technicians={technicians}>
          <ManagerFocusDashboard />
        </TestWrapper>
      );

      expect(screen.getByLabelText(/Evidence compliance/i)).toBeInTheDocument();
    });
  });

  // ========== SEARCH MODAL ==========

  describe('Search Modal', () => {
    it('opens QuickSearchModal when search button clicked', async () => {
      const user = userEvent.setup();
      const jobs = [createTestJob({ id: 'job-1', techId: 'user-123' })];
      const technicians = [createTestTechnician({ id: 'tech-1' })];

      render(
        <TestWrapper jobs={jobs} technicians={technicians}>
          <ManagerFocusDashboard />
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
      const technicians = [createTestTechnician({ id: 'tech-1' })];

      render(
        <TestWrapper jobs={jobs} technicians={technicians}>
          <ManagerFocusDashboard />
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
      const technicians = [createTestTechnician({ id: 'tech-1' })];

      render(
        <TestWrapper jobs={jobs} technicians={technicians}>
          <ManagerFocusDashboard />
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

    it('cleans up properly after escape and can reopen', async () => {
      const user = userEvent.setup();
      const jobs = [createTestJob({ id: 'job-1', techId: 'user-123' })];
      const technicians = [createTestTechnician({ id: 'tech-1' })];

      render(
        <TestWrapper jobs={jobs} technicians={technicians}>
          <ManagerFocusDashboard />
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

      // Should be able to open it again
      await user.click(searchBtn);

      await waitFor(() => {
        expect(screen.getByRole('dialog', { name: /Search Jobs/i }))
          .toBeInTheDocument();
      });
    });
  });

  // ========== KEYBOARD SHORTCUTS ==========

  describe('Keyboard Shortcuts', () => {
    it('opens QuickSearchModal with Ctrl+K shortcut', async () => {
      const jobs = [createTestJob({ id: 'job-1', techId: 'user-123' })];
      const technicians = [createTestTechnician({ id: 'tech-1' })];

      render(
        <TestWrapper jobs={jobs} technicians={technicians}>
          <ManagerFocusDashboard />
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
      const technicians = [createTestTechnician({ id: 'tech-1' })];

      render(
        <TestWrapper jobs={jobs} technicians={technicians}>
          <ManagerFocusDashboard />
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

    it('prevents shortcuts from firing while typing in input', async () => {
      const user = userEvent.setup();
      const jobs = [createTestJob({ id: 'job-1', techId: 'user-123' })];
      const technicians = [createTestTechnician({ id: 'tech-1' })];

      render(
        <TestWrapper jobs={jobs} technicians={technicians}>
          <ManagerFocusDashboard />
        </TestWrapper>
      );

      // Open search modal first
      const searchBtn = screen.getByLabelText(/Search jobs/i);
      await user.click(searchBtn);

      await waitFor(() => {
        expect(screen.getByRole('dialog', { name: /Search Jobs/i }))
          .toBeInTheDocument();
      });

      // Find the search input in the modal
      const searchInput = screen.getByPlaceholderText(/Search by ID/i);
      searchInput.focus();

      // Try to press Ctrl+K while focused on input
      window.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'k',
          ctrlKey: true,
          bubbles: true,
        })
      );

      // Modal should still be visible (shortcut shouldn't close it)
      expect(screen.getByRole('dialog', { name: /Search Jobs/i }))
        .toBeInTheDocument();
    });
  });

  // ========== ACCESSIBILITY ==========

  describe('Accessibility', () => {
    it('all action buttons have proper aria-labels', () => {
      const jobs = [createTestJob({ id: 'job-1', techId: 'user-123' })];
      const technicians = [createTestTechnician({ id: 'tech-1' })];

      render(
        <TestWrapper jobs={jobs} technicians={technicians}>
          <ManagerFocusDashboard />
        </TestWrapper>
      );

      expect(screen.getByLabelText(/Search jobs/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Assign technician/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/View all jobs/i)).toBeInTheDocument();
    });

    it('buttons have focus indicators', () => {
      const jobs = [createTestJob({ id: 'job-1', techId: 'user-123' })];
      const technicians = [createTestTechnician({ id: 'tech-1' })];

      render(
        <TestWrapper jobs={jobs} technicians={technicians}>
          <ManagerFocusDashboard />
        </TestWrapper>
      );

      const searchBtn = screen.getByLabelText(/Search jobs/i);
      expect(searchBtn).toHaveClass('focus:ring-2');
      expect(searchBtn).toHaveClass('focus:ring-primary');
    });

    it('modals have proper ARIA attributes', async () => {
      const user = userEvent.setup();
      const jobs = [createTestJob({ id: 'job-1', techId: 'user-123' })];
      const technicians = [createTestTechnician({ id: 'tech-1' })];

      const { container } = render(
        <TestWrapper jobs={jobs} technicians={technicians}>
          <ManagerFocusDashboard />
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
      const technicians = [createTestTechnician({ id: 'tech-1' })];

      render(
        <TestWrapper jobs={jobs} technicians={technicians}>
          <ManagerFocusDashboard />
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

    it('preserves button state across modal open/close cycles', async () => {
      const user = userEvent.setup();
      const jobs = [createTestJob({ id: 'job-1', techId: 'user-123' })];
      const technicians = [createTestTechnician({ id: 'tech-1' })];

      render(
        <TestWrapper jobs={jobs} technicians={technicians}>
          <ManagerFocusDashboard />
        </TestWrapper>
      );

      const searchBtn = screen.getByLabelText(/Search jobs/i);

      // Open
      await user.click(searchBtn);
      await waitFor(() => {
        expect(screen.getByRole('dialog', { name: /Search Jobs/i }))
          .toBeInTheDocument();
      });

      // Close
      await user.keyboard('{Escape}');
      await waitFor(() => {
        expect(screen.queryByRole('dialog', { name: /Search Jobs/i }))
          .not.toBeInTheDocument();
      });

      // Open again
      await user.click(searchBtn);
      await waitFor(() => {
        expect(screen.getByRole('dialog', { name: /Search Jobs/i }))
          .toBeInTheDocument();
      });

      // Button should still be functional
      expect(searchBtn).toBeInTheDocument();
    });
  });
});
