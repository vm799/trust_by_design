/**
 * StorageWarningBanner Tests
 *
 * Tests the redesigned slim progress strip with expandable job deletion panel.
 * Validates:
 * - Strip renders when quota warning fires
 * - Hides when no warning
 * - Dismissal works
 * - Expand/collapse toggles
 * - Deletable jobs exclude sealed/invoiced
 * - Delete button calls DataContext.deleteJob
 * - Touch targets meet 44px minimum
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import React from 'react';
import { HashRouter } from 'react-router-dom';
import type { Job } from '../../types';

// Mock DataContext
const mockDeleteJob = vi.fn();
let mockJobs: Partial<Job>[] = [];

vi.mock('../../lib/DataContext', () => ({
  useData: () => ({
    jobs: mockJobs,
    deleteJob: mockDeleteJob,
    clients: [],
    technicians: [],
    invoices: [],
    templates: [],
    isLoading: false,
    error: null,
    refresh: vi.fn(),
    addJob: vi.fn(),
    updateJob: vi.fn(),
    addClient: vi.fn(),
    updateClient: vi.fn(),
    deleteClient: vi.fn(),
    addTechnician: vi.fn(),
    updateTechnician: vi.fn(),
    deleteTechnician: vi.fn(),
    addInvoice: vi.fn(),
    updateInvoiceStatus: vi.fn(),
  }),
}));

// Mock safeLocalStorage - capture the callback so we can trigger it
let quotaCallback: ((info: { usage: number; quota: number; percent: number }) => void) | null = null;

vi.mock('../../lib/utils/safeLocalStorage', () => ({
  onQuotaExceeded: (cb: (info: { usage: number; quota: number; percent: number }) => void) => {
    quotaCallback = cb;
    return () => { quotaCallback = null; };
  },
}));

// Import after mocks
import { StorageWarningBanner } from '../../components/StorageWarningBanner';

const renderBanner = () => {
  return render(
    <HashRouter>
      <StorageWarningBanner />
    </HashRouter>
  );
};

/** Helper: trigger quota warning inside act() */
function triggerWarning(percent: number, usage?: number, quota?: number) {
  act(() => {
    quotaCallback?.({
      usage: usage ?? (percent / 100) * 5_000_000,
      quota: quota ?? 5_000_000,
      percent,
    });
  });
}

describe('StorageWarningBanner (Slim Strip)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    quotaCallback = null;
    mockJobs = [];
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================
  // Visibility
  // ============================================================
  describe('Visibility', () => {
    it('should not render when no quota warning has fired', () => {
      renderBanner();
      expect(screen.queryByRole('status')).toBeNull();
    });

    it('should render strip when quota warning fires', () => {
      renderBanner();
      triggerWarning(80);
      expect(screen.getByRole('status')).toBeDefined();
    });

    it('should show percentage text', () => {
      renderBanner();
      triggerWarning(90, 4_500_000, 5_000_000);
      expect(screen.getByText('90% storage used')).toBeDefined();
    });

    it('should hide after dismiss', () => {
      renderBanner();
      triggerWarning(80);

      const dismissBtn = screen.getByLabelText('Dismiss storage warning');
      fireEvent.click(dismissBtn);

      expect(screen.queryByRole('status')).toBeNull();
    });
  });

  // ============================================================
  // Severity Styling
  // ============================================================
  describe('Severity', () => {
    it('should use amber color for 75-89% usage', () => {
      renderBanner();
      triggerWarning(80);

      const percentText = screen.getByText('80% storage used');
      expect(percentText.className).toContain('text-amber-400');
    });

    it('should use red color for 90%+ usage', () => {
      renderBanner();
      triggerWarning(90);

      const percentText = screen.getByText('90% storage used');
      expect(percentText.className).toContain('text-red-400');
    });
  });

  // ============================================================
  // Expand/Collapse
  // ============================================================
  describe('Expand/Collapse', () => {
    it('should start collapsed (no panel visible)', () => {
      renderBanner();
      triggerWarning(80);

      expect(screen.queryByText('Free up space — delete old jobs')).toBeNull();
    });

    it('should expand on strip click', () => {
      mockJobs = [
        { id: 'job-1', title: 'Fix Plumbing', status: 'Pending', createdAt: '2025-01-01' },
      ];
      renderBanner();
      triggerWarning(80);

      const strip = screen.getByText('80% storage used').closest('button');
      fireEvent.click(strip!);

      expect(screen.getByText('Free up space — delete old jobs')).toBeDefined();
    });

    it('should collapse on second click', () => {
      renderBanner();
      triggerWarning(80);

      const strip = screen.getByText('80% storage used').closest('button');
      fireEvent.click(strip!);
      fireEvent.click(strip!);

      expect(screen.queryByText('Free up space — delete old jobs')).toBeNull();
    });

    it('should show "Manage" text when collapsed and "Close" when expanded', () => {
      renderBanner();
      triggerWarning(80);

      expect(screen.getByText('Manage')).toBeDefined();

      const strip = screen.getByText('80% storage used').closest('button');
      fireEvent.click(strip!);

      expect(screen.getByText('Close')).toBeDefined();
    });
  });

  // ============================================================
  // Deletable Jobs Filter
  // ============================================================
  describe('Deletable Jobs', () => {
    it('should show jobs that are not sealed and not invoiced', () => {
      mockJobs = [
        { id: 'job-1', title: 'Regular Job', status: 'Pending', createdAt: '2025-01-01' },
        { id: 'job-2', title: 'Sealed Job', status: 'Complete', sealedAt: '2025-02-01', createdAt: '2025-01-02' },
        { id: 'job-3', title: 'Invoiced Job', status: 'Complete', invoiceId: 'inv-1', createdAt: '2025-01-03' },
      ];
      renderBanner();
      triggerWarning(80);

      const strip = screen.getByText('80% storage used').closest('button');
      fireEvent.click(strip!);

      expect(screen.getByText('Regular Job')).toBeDefined();
      expect(screen.queryByText('Sealed Job')).toBeNull();
      expect(screen.queryByText('Invoiced Job')).toBeNull();
    });

    it('should show empty message when all jobs are sealed/invoiced', () => {
      mockJobs = [
        { id: 'job-2', title: 'Sealed Job', status: 'Complete', sealedAt: '2025-02-01', createdAt: '2025-01-02' },
      ];
      renderBanner();
      triggerWarning(80);

      const strip = screen.getByText('80% storage used').closest('button');
      fireEvent.click(strip!);

      expect(screen.getByText(/No deletable jobs found/)).toBeDefined();
    });

    it('should limit to 10 jobs max', () => {
      mockJobs = Array.from({ length: 15 }, (_, i) => ({
        id: `job-${i}`,
        title: `Job ${i}`,
        status: 'Pending' as const,
        createdAt: `2025-01-${String(i + 1).padStart(2, '0')}`,
      }));
      renderBanner();
      triggerWarning(80);

      const strip = screen.getByText('80% storage used').closest('button');
      fireEvent.click(strip!);

      expect(screen.getByText('10 deletable jobs')).toBeDefined();
    });

    it('should sort jobs oldest first', () => {
      mockJobs = [
        { id: 'job-new', title: 'New Job', status: 'Pending', createdAt: '2025-06-01' },
        { id: 'job-old', title: 'Old Job', status: 'Pending', createdAt: '2025-01-01' },
      ];
      renderBanner();
      triggerWarning(80);

      const strip = screen.getByText('80% storage used').closest('button');
      fireEvent.click(strip!);

      const items = screen.getAllByRole('listitem');
      expect(within(items[0]).getByText('Old Job')).toBeDefined();
      expect(within(items[1]).getByText('New Job')).toBeDefined();
    });
  });

  // ============================================================
  // Deletion
  // ============================================================
  describe('Job Deletion', () => {
    it('should call deleteJob when delete button clicked', () => {
      mockJobs = [
        { id: 'job-1', title: 'Test Job', status: 'Pending', createdAt: '2025-01-01' },
      ];
      renderBanner();
      triggerWarning(80);

      const strip = screen.getByText('80% storage used').closest('button');
      fireEvent.click(strip!);

      const deleteBtn = screen.getByLabelText('Delete job Test Job');
      fireEvent.click(deleteBtn);

      expect(mockDeleteJob).toHaveBeenCalledWith('job-1');
    });

    it('should call deleteJob with correct ID for specific job', () => {
      mockJobs = [
        { id: 'job-a', title: 'Job A', status: 'Pending', createdAt: '2025-01-01' },
        { id: 'job-b', title: 'Job B', status: 'Pending', createdAt: '2025-01-02' },
      ];
      renderBanner();
      triggerWarning(80);

      const strip = screen.getByText('80% storage used').closest('button');
      fireEvent.click(strip!);

      const deleteBtn = screen.getByLabelText('Delete job Job B');
      fireEvent.click(deleteBtn);

      expect(mockDeleteJob).toHaveBeenCalledWith('job-b');
    });
  });

  // ============================================================
  // Accessibility
  // ============================================================
  describe('Accessibility', () => {
    it('should have role="status" on container', () => {
      renderBanner();
      triggerWarning(80);
      expect(screen.getByRole('status')).toBeDefined();
    });

    it('should have aria-expanded on strip button', () => {
      renderBanner();
      triggerWarning(80);

      const strip = screen.getByText('80% storage used').closest('button');
      expect(strip?.getAttribute('aria-expanded')).toBe('false');

      fireEvent.click(strip!);
      expect(strip?.getAttribute('aria-expanded')).toBe('true');
    });

    it('should have aria-label on dismiss button', () => {
      renderBanner();
      triggerWarning(80);

      const dismiss = screen.getByLabelText('Dismiss storage warning');
      expect(dismiss).toBeDefined();
    });

    it('strip and delete buttons should meet 44px touch target', () => {
      mockJobs = [
        { id: 'job-1', title: 'Test Job', status: 'Pending', createdAt: '2025-01-01' },
      ];
      renderBanner();
      triggerWarning(80);

      const strip = screen.getByText('80% storage used').closest('button');
      expect(strip?.className).toContain('min-h-[44px]');

      fireEvent.click(strip!);
      const deleteBtn = screen.getByLabelText('Delete job Test Job');
      expect(deleteBtn.className).toContain('min-h-[44px]');
    });
  });
});
