/**
 * ManagerFocusDashboard - Modal Integration Tests
 *
 * Comprehensive tests for quick modal button integration, keyboard shortcuts,
 * responsive layout, focus management, and accessibility.
 *
 * Tests: Button clicks, keyboard shortcuts, modal rendering, responsive design,
 * focus restoration, accessibility attributes.
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

describe('ManagerFocusDashboard - Modal Integration', () => {
  // ========== BUTTON RENDERING TESTS ==========

  describe('Quick Actions Grid Rendering', () => {
    it('renders all eight quick action buttons', () => {
      const jobs = [createTestJob({ id: 'job-1', techId: 'user-123' })];
      const technicians = [createTestTechnician({ id: 'tech-1' })];

      render(
        <TestWrapper jobs={jobs} technicians={technicians}>
          <ManagerFocusDashboard />
        </TestWrapper>
      );

      expect(screen.getByLabelText(/Search jobs/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Assign technician/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Create invoice/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/View all jobs/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/View clients/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/View technicians/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Workspace settings/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/View invoices/i)).toBeInTheDocument();
    });

    it('renders button grid with correct responsive classes', () => {
      const jobs = [createTestJob({ id: 'job-1', techId: 'user-123' })];
      const technicians = [createTestTechnician({ id: 'tech-1' })];

      const { container } = render(
        <TestWrapper jobs={jobs} technicians={technicians}>
          <ManagerFocusDashboard />
        </TestWrapper>
      );

      const grid = container.querySelector('[data-testid="quick-actions-grid"]');
      expect(grid).toHaveClass('grid');
      expect(grid).toHaveClass('grid-cols-2');
      expect(grid).toHaveClass('sm:grid-cols-4');
    });

    it('all buttons have minimum 44px height (56px on mobile)', () => {
      const jobs = [createTestJob({ id: 'job-1', techId: 'user-123' })];
      const technicians = [createTestTechnician({ id: 'tech-1' })];

      render(
        <TestWrapper jobs={jobs} technicians={technicians}>
          <ManagerFocusDashboard />
        </TestWrapper>
      );

      const searchBtn = screen.getByLabelText(/Search jobs/i);
      const assignBtn = screen.getByLabelText(/Assign technician/i);
      const invoiceBtn = screen.getByLabelText(/Create invoice/i);

      // Check classes exist
      expect(searchBtn).toHaveClass('min-h-[56px]');
      expect(assignBtn).toHaveClass('min-h-[56px]');
      expect(invoiceBtn).toHaveClass('min-h-[56px]');

      expect(searchBtn).toHaveClass('sm:min-h-[44px]');
      expect(assignBtn).toHaveClass('sm:min-h-[44px]');
      expect(invoiceBtn).toHaveClass('sm:min-h-[44px]');
    });
  });

  // ========== MODAL OPENING TESTS ==========

  describe('Modal Opening via Button Click', () => {
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

    it('opens QuickInvoiceModal when invoice button clicked', async () => {
      const user = userEvent.setup();
      const jobs = [createTestJob({ id: 'job-1', techId: 'user-123' })];
      const technicians = [createTestTechnician({ id: 'tech-1' })];

      render(
        <TestWrapper jobs={jobs} technicians={technicians}>
          <ManagerFocusDashboard />
        </TestWrapper>
      );

      const invoiceBtn = screen.getByLabelText(/Create invoice/i);
      await user.click(invoiceBtn);

      await waitFor(() => {
        expect(screen.getByRole('dialog', { name: /Create Invoice/i }))
          .toBeInTheDocument();
      });
    });

    it('navigation buttons have correct href attributes', () => {
      const jobs = [createTestJob({ id: 'job-1', techId: 'user-123' })];
      const technicians = [createTestTechnician({ id: 'tech-1' })];

      render(
        <TestWrapper jobs={jobs} technicians={technicians}>
          <ManagerFocusDashboard />
        </TestWrapper>
      );

      const allJobsLink = screen.getByLabelText(/View all jobs/i).closest('a');
      const clientsLink = screen.getByLabelText(/View clients/i).closest('a');
      const techniciansLink = screen.getByLabelText(/View technicians/i).closest('a');
      const invoicesLink = screen.getByLabelText(/View invoices/i).closest('a');

      expect(allJobsLink).toHaveAttribute('href', '/admin/jobs');
      expect(clientsLink).toHaveAttribute('href', '/admin/clients');
      expect(techniciansLink).toHaveAttribute('href', '/admin/technicians');
      expect(invoicesLink).toHaveAttribute('href', '/admin/invoices');
    });
  });

  // ========== KEYBOARD SHORTCUT TESTS ==========

  describe('Keyboard Shortcuts', () => {
    it('opens QuickSearchModal with Ctrl+K shortcut', async () => {
      const jobs = [createTestJob({ id: 'job-1', techId: 'user-123' })];
      const technicians = [createTestTechnician({ id: 'tech-1' })];

      render(
        <TestWrapper jobs={jobs} technicians={technicians}>
          <ManagerFocusDashboard />
        </TestWrapper>
      );

      // Press Ctrl+K
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

      // Press Cmd+K (metaKey for macOS)
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

  // ========== MODAL CLOSING TESTS ==========

  describe('Modal Closing', () => {
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

      // Press Escape
      await user.keyboard('{Escape}');

      await waitFor(() => {
        expect(screen.queryByRole('dialog', { name: /Search Jobs/i }))
          .not.toBeInTheDocument();
      });
    });

    it('cleans up properly after escape key', async () => {
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

      // Close modal with Escape
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

  // ========== ACCESSIBILITY TESTS ==========

  describe('Accessibility', () => {
    it('all buttons have proper aria-labels', () => {
      const jobs = [createTestJob({ id: 'job-1', techId: 'user-123' })];
      const technicians = [createTestTechnician({ id: 'tech-1' })];

      render(
        <TestWrapper jobs={jobs} technicians={technicians}>
          <ManagerFocusDashboard />
        </TestWrapper>
      );

      expect(screen.getByLabelText(/Search jobs/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Assign technician/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Create invoice/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/View all jobs/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/View clients/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/View technicians/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Workspace settings/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/View invoices/i)).toBeInTheDocument();
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

    it('buttons have hover effects', () => {
      const jobs = [createTestJob({ id: 'job-1', techId: 'user-123' })];
      const technicians = [createTestTechnician({ id: 'tech-1' })];

      render(
        <TestWrapper jobs={jobs} technicians={technicians}>
          <ManagerFocusDashboard />
        </TestWrapper>
      );

      const searchBtn = screen.getByLabelText(/Search jobs/i);
      expect(searchBtn).toHaveClass('hover:bg-slate-600');
    });

    it('keyboard shortcut hints provided in titles', () => {
      const jobs = [createTestJob({ id: 'job-1', techId: 'user-123' })];
      const technicians = [createTestTechnician({ id: 'tech-1' })];

      render(
        <TestWrapper jobs={jobs} technicians={technicians}>
          <ManagerFocusDashboard />
        </TestWrapper>
      );

      const searchBtn = screen.getByLabelText(/Search jobs/i);
      const assignBtn = screen.getByLabelText(/Assign technician/i);

      expect(searchBtn).toHaveAttribute('title', expect.stringContaining('Ctrl+K'));
      expect(assignBtn).toHaveAttribute('title', expect.stringContaining('Ctrl+A'));
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

  // ========== RESPONSIVE LAYOUT TESTS ==========

  describe('Responsive Layout', () => {
    it('displays 2-column grid on mobile', () => {
      const jobs = [createTestJob({ id: 'job-1', techId: 'user-123' })];
      const technicians = [createTestTechnician({ id: 'tech-1' })];

      const { container } = render(
        <TestWrapper jobs={jobs} technicians={technicians}>
          <ManagerFocusDashboard />
        </TestWrapper>
      );

      const grid = container.querySelector('[data-testid="quick-actions-grid"]');
      expect(grid).toHaveClass('grid-cols-2');
    });

    it('displays 4-column grid on desktop (with sm: responsive class)', () => {
      const jobs = [createTestJob({ id: 'job-1', techId: 'user-123' })];
      const technicians = [createTestTechnician({ id: 'tech-1' })];

      const { container } = render(
        <TestWrapper jobs={jobs} technicians={technicians}>
          <ManagerFocusDashboard />
        </TestWrapper>
      );

      const grid = container.querySelector('[data-testid="quick-actions-grid"]');
      expect(grid).toHaveClass('sm:grid-cols-4');
    });

    it('buttons maintain proper spacing', () => {
      const jobs = [createTestJob({ id: 'job-1', techId: 'user-123' })];
      const technicians = [createTestTechnician({ id: 'tech-1' })];

      const { container } = render(
        <TestWrapper jobs={jobs} technicians={technicians}>
          <ManagerFocusDashboard />
        </TestWrapper>
      );

      const grid = container.querySelector('[data-testid="quick-actions-grid"]');
      expect(grid).toHaveClass('gap-3');
    });
  });

  // ========== EDGE CASE TESTS ==========

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

      // Click rapidly
      for (let i = 0; i < 3; i++) {
        await user.click(searchBtn);
      }

      // Should have at least one modal open
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
