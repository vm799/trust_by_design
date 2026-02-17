/**
 * OfflineIndicator - Sync Recovery Tests
 *
 * Verifies the SELF-SUFFICIENT sync status detection and retry UI:
 * - Reads sync queue directly (no parent passes syncStatus prop)
 * - Shows failed job list with retry buttons
 * - "Retry All" button calls retryFailedSyncItem for each failed item
 * - 44px touch targets on all interactive elements
 * - Banner appears based on live queue polling, not props
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import React from 'react';

// Mock useNetworkStatus
let mockIsOnline = true;
let mockIsChecking = false;
vi.mock('../../../hooks/useNetworkStatus', () => ({
  useNetworkStatus: () => ({
    isOnline: mockIsOnline,
    isChecking: mockIsChecking,
    checkNow: vi.fn().mockResolvedValue(true),
  }),
  default: () => ({
    isOnline: mockIsOnline,
    isChecking: mockIsChecking,
    checkNow: vi.fn().mockResolvedValue(true),
  }),
}));

// Mock syncQueue functions
const mockRetryFailedSyncItem = vi.fn();
const mockGetFailedSyncQueue = vi.fn();
const mockGetSyncQueueStatus = vi.fn();
const mockIsRetryInProgress = vi.fn();
vi.mock('../../../lib/syncQueue', () => ({
  getFailedSyncQueue: (...args: unknown[]) => mockGetFailedSyncQueue(...args),
  getSyncQueueStatus: (...args: unknown[]) => mockGetSyncQueueStatus(...args),
  retryFailedSyncItem: (...args: unknown[]) => mockRetryFailedSyncItem(...args),
  isRetryInProgress: (...args: unknown[]) => mockIsRetryInProgress(...args),
}));

import { OfflineIndicator } from '../../../components/OfflineIndicator';

describe('OfflineIndicator - Sync Recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockIsOnline = true;
    mockIsChecking = false;
    mockGetFailedSyncQueue.mockReturnValue([]);
    mockGetSyncQueueStatus.mockReturnValue({ pending: 0, failed: 0 });
    mockRetryFailedSyncItem.mockResolvedValue(false);
    mockIsRetryInProgress.mockReturnValue(false);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('renders nothing when online with no sync issues', () => {
    const { container } = render(<OfflineIndicator />);
    expect(container.firstChild).toBeNull();
  });

  it('shows Bunker Mode banner when offline', () => {
    mockIsOnline = false;
    render(<OfflineIndicator />);
    expect(screen.getByText('Bunker Mode')).toBeTruthy();
  });

  it('self-detects failed sync items WITHOUT syncStatus prop', () => {
    // No syncStatus prop passed — component reads queue directly
    mockGetSyncQueueStatus.mockReturnValue({ pending: 0, failed: 2 });
    mockGetFailedSyncQueue.mockReturnValue([
      { id: 'job-1', type: 'job', data: {}, retryCount: 7 },
      { id: 'job-2', type: 'job', data: {}, retryCount: 7 },
    ]);

    render(<OfflineIndicator />);

    expect(screen.getByText(/Sync Issues/i)).toBeTruthy();
    expect(screen.getByText(/2 items failed to sync/i)).toBeTruthy();
    expect(screen.getByText(/Retry All/i)).toBeTruthy();
  });

  it('shows failed sync banner with Retry All button when prop is passed', () => {
    mockGetSyncQueueStatus.mockReturnValue({ pending: 0, failed: 1 });
    mockGetFailedSyncQueue.mockReturnValue([
      { id: 'job-1', type: 'job', data: { title: 'HVAC Repair' }, retryCount: 7 },
    ]);

    render(<OfflineIndicator syncStatus={{ pending: 0, failed: 1 }} />);

    expect(screen.getByText(/Sync Issues/i)).toBeTruthy();
    expect(screen.getByText(/Retry All/i)).toBeTruthy();
  });

  it('Retry All button calls retryFailedSyncItem for each failed item', async () => {
    vi.useRealTimers();
    mockGetSyncQueueStatus.mockReturnValue({ pending: 0, failed: 2 });
    mockGetFailedSyncQueue.mockReturnValue([
      { id: 'job-1', type: 'job', data: {}, retryCount: 7 },
      { id: 'job-2', type: 'job', data: {}, retryCount: 7 },
    ]);
    mockRetryFailedSyncItem.mockResolvedValue(true);

    render(<OfflineIndicator syncStatus={{ pending: 0, failed: 2 }} />);

    const retryAllBtn = screen.getByText(/Retry All/i);
    fireEvent.click(retryAllBtn);

    await waitFor(() => {
      expect(mockRetryFailedSyncItem).toHaveBeenCalledWith('job-1');
      expect(mockRetryFailedSyncItem).toHaveBeenCalledWith('job-2');
      expect(mockRetryFailedSyncItem).toHaveBeenCalledTimes(2);
    });
  });

  it('shows retrying state while retry is in progress', async () => {
    vi.useRealTimers();
    // Make retry hang so we can observe the loading state
    let resolveRetry: (v: boolean) => void;
    mockRetryFailedSyncItem.mockImplementation(
      () => new Promise<boolean>((resolve) => { resolveRetry = resolve; })
    );
    mockGetSyncQueueStatus.mockReturnValue({ pending: 0, failed: 1 });
    mockGetFailedSyncQueue.mockReturnValue([
      { id: 'job-1', type: 'job', data: {}, retryCount: 7 },
    ]);

    render(<OfflineIndicator syncStatus={{ pending: 0, failed: 1 }} />);

    const retryAllBtn = screen.getByText(/Retry All/i);
    fireEvent.click(retryAllBtn);

    await waitFor(() => {
      expect(screen.getByText(/Retrying/i)).toBeTruthy();
    });

    // Resolve the retry
    resolveRetry!(true);

    await waitFor(() => {
      expect(screen.queryByText(/Retrying/i)).toBeNull();
    });
  });

  it('Retry All button has minimum 44px touch target', () => {
    mockGetSyncQueueStatus.mockReturnValue({ pending: 0, failed: 1 });
    mockGetFailedSyncQueue.mockReturnValue([
      { id: 'job-1', type: 'job', data: {}, retryCount: 7 },
    ]);

    render(<OfflineIndicator syncStatus={{ pending: 0, failed: 1 }} />);

    const retryAllBtn = screen.getByText(/Retry All/i).closest('button');
    expect(retryAllBtn).toBeTruthy();
    expect(retryAllBtn!.className).toContain('min-h-[44px]');
  });

  it('does not show retry UI when offline (retries would fail)', () => {
    mockIsOnline = false;
    mockGetSyncQueueStatus.mockReturnValue({ pending: 0, failed: 1 });
    mockGetFailedSyncQueue.mockReturnValue([
      { id: 'job-1', type: 'job', data: {}, retryCount: 7 },
    ]);

    render(<OfflineIndicator syncStatus={{ pending: 0, failed: 1 }} />);

    // Should show Bunker Mode, not retry UI
    expect(screen.getByText('Bunker Mode')).toBeTruthy();
    expect(screen.queryByText(/Retry All/i)).toBeNull();
  });

  it('shows syncing banner when items are pending (not failed)', () => {
    mockGetSyncQueueStatus.mockReturnValue({ pending: 3, failed: 0 });

    render(<OfflineIndicator syncStatus={{ pending: 3, failed: 0 }} />);

    expect(screen.getByText(/Syncing Changes/i)).toBeTruthy();
    expect(screen.getByText(/3 items pending sync/i)).toBeTruthy();
  });

  it('polls getSyncQueueStatus on mount', () => {
    mockGetSyncQueueStatus.mockReturnValue({ pending: 0, failed: 0 });

    render(<OfflineIndicator />);

    // Should have called getSyncQueueStatus at least once on mount
    expect(mockGetSyncQueueStatus).toHaveBeenCalled();
  });

  it('refreshes status after successful retry', async () => {
    vi.useRealTimers();
    mockGetSyncQueueStatus.mockReturnValue({ pending: 0, failed: 1 });
    mockGetFailedSyncQueue.mockReturnValue([
      { id: 'job-1', type: 'job', data: {}, retryCount: 7 },
    ]);
    mockRetryFailedSyncItem.mockResolvedValue(true);

    render(<OfflineIndicator />);

    const retryAllBtn = screen.getByText(/Retry All/i);

    // Reset call count to track calls after retry
    mockGetSyncQueueStatus.mockClear();
    mockGetSyncQueueStatus.mockReturnValue({ pending: 0, failed: 0 });

    fireEvent.click(retryAllBtn);

    await waitFor(() => {
      // Should have re-read status after retry completed
      expect(mockGetSyncQueueStatus).toHaveBeenCalled();
    });
  });

  it('skips retry when auto-retry is already in progress', async () => {
    vi.useRealTimers();
    // Auto-retry is running (bunker exit scenario)
    mockIsRetryInProgress.mockReturnValue(true);
    mockGetSyncQueueStatus.mockReturnValue({ pending: 0, failed: 2 });
    mockGetFailedSyncQueue.mockReturnValue([
      { id: 'job-1', type: 'job', data: {}, retryCount: 7 },
      { id: 'job-2', type: 'job', data: {}, retryCount: 7 },
    ]);

    render(<OfflineIndicator />);

    const retryAllBtn = screen.getByText(/Retry All/i);
    fireEvent.click(retryAllBtn);

    await waitFor(() => {
      // Should NOT have called retryFailedSyncItem — auto-retry is handling it
      expect(mockRetryFailedSyncItem).not.toHaveBeenCalled();
    });
  });

  // ============================================================
  // P1: Item-level detail in sync failure banner
  // Field workers need to know WHICH items failed, not just a count
  // ============================================================

  it('shows individual failed item names with type labels', () => {
    mockGetSyncQueueStatus.mockReturnValue({ pending: 0, failed: 2 });
    mockGetFailedSyncQueue.mockReturnValue([
      { id: 'job-1', type: 'job', data: { title: 'HVAC Repair' }, retryCount: 7 },
      { id: 'client-1', type: 'client', data: { name: 'Acme Corp' }, retryCount: 7 },
    ]);

    render(<OfflineIndicator />);

    // Should show individual item details
    expect(screen.getByText(/HVAC Repair/)).toBeTruthy();
    expect(screen.getByText(/Acme Corp/)).toBeTruthy();
  });

  it('shows job type label for job items', () => {
    mockGetSyncQueueStatus.mockReturnValue({ pending: 0, failed: 1 });
    mockGetFailedSyncQueue.mockReturnValue([
      { id: 'job-1', type: 'job', data: { title: 'Plumbing Fix' }, retryCount: 7 },
    ]);

    render(<OfflineIndicator />);

    expect(screen.getByText(/Job:/)).toBeTruthy();
    expect(screen.getByText(/Plumbing Fix/)).toBeTruthy();
  });

  it('shows client type label for client items', () => {
    mockGetSyncQueueStatus.mockReturnValue({ pending: 0, failed: 1 });
    mockGetFailedSyncQueue.mockReturnValue([
      { id: 'client-1', type: 'client', data: { name: 'BuildCo Ltd' }, retryCount: 7 },
    ]);

    render(<OfflineIndicator />);

    expect(screen.getByText(/Client:/)).toBeTruthy();
    expect(screen.getByText(/BuildCo Ltd/)).toBeTruthy();
  });

  it('shows technician type label for technician items', () => {
    mockGetSyncQueueStatus.mockReturnValue({ pending: 0, failed: 1 });
    mockGetFailedSyncQueue.mockReturnValue([
      { id: 'tech-1', type: 'technician', data: { name: 'Mike Smith' }, retryCount: 7 },
    ]);

    render(<OfflineIndicator />);

    expect(screen.getByText(/Tech:/)).toBeTruthy();
    expect(screen.getByText(/Mike Smith/)).toBeTruthy();
  });

  it('truncates long list with +N more indicator', () => {
    mockGetSyncQueueStatus.mockReturnValue({ pending: 0, failed: 5 });
    mockGetFailedSyncQueue.mockReturnValue([
      { id: 'job-1', type: 'job', data: { title: 'Job Alpha' }, retryCount: 7 },
      { id: 'job-2', type: 'job', data: { title: 'Job Beta' }, retryCount: 7 },
      { id: 'job-3', type: 'job', data: { title: 'Job Gamma' }, retryCount: 7 },
      { id: 'job-4', type: 'job', data: { title: 'Job Delta' }, retryCount: 7 },
      { id: 'job-5', type: 'job', data: { title: 'Job Epsilon' }, retryCount: 7 },
    ]);

    render(<OfflineIndicator />);

    // First 3 shown
    expect(screen.getByText(/Job Alpha/)).toBeTruthy();
    expect(screen.getByText(/Job Beta/)).toBeTruthy();
    expect(screen.getByText(/Job Gamma/)).toBeTruthy();
    // Items 4 and 5 NOT shown individually
    expect(screen.queryByText(/Job Delta/)).toBeNull();
    expect(screen.queryByText(/Job Epsilon/)).toBeNull();
    // "+2 more" indicator shown
    expect(screen.getByText(/\+2 more/)).toBeTruthy();
  });

  it('falls back to item ID when title/name is missing', () => {
    mockGetSyncQueueStatus.mockReturnValue({ pending: 0, failed: 1 });
    mockGetFailedSyncQueue.mockReturnValue([
      { id: 'job-abc-123', type: 'job', data: {}, retryCount: 7 },
    ]);

    render(<OfflineIndicator />);

    // Should show the ID as fallback
    expect(screen.getByText(/job-abc-123/)).toBeTruthy();
  });
});
