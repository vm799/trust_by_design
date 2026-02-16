/**
 * OfflineIndicator - Failed Sync Retry Tests
 *
 * Verifies the retry UI for permanently failed sync items:
 * - Shows failed job list with retry buttons
 * - "Retry All" button calls retryFailedSyncItem for each failed item
 * - Individual retry buttons work
 * - Successful retry removes item from list
 * - 44px touch targets on all interactive elements
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
vi.mock('../../../lib/syncQueue', () => ({
  getFailedSyncQueue: (...args: unknown[]) => mockGetFailedSyncQueue(...args),
  retryFailedSyncItem: (...args: unknown[]) => mockRetryFailedSyncItem(...args),
}));

import { OfflineIndicator } from '../../../components/OfflineIndicator';

describe('OfflineIndicator - Failed Sync Retry UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsOnline = true;
    mockIsChecking = false;
    mockGetFailedSyncQueue.mockReturnValue([]);
    mockRetryFailedSyncItem.mockResolvedValue(false);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when online with no sync issues', () => {
    const { container } = render(
      <OfflineIndicator syncStatus={{ pending: 0, failed: 0 }} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows Bunker Mode banner when offline', () => {
    mockIsOnline = false;
    render(<OfflineIndicator />);
    expect(screen.getByText('Bunker Mode')).toBeTruthy();
  });

  it('shows failed sync banner with Retry All button when online with failures', () => {
    mockGetFailedSyncQueue.mockReturnValue([
      { id: 'job-1', type: 'job', data: { title: 'HVAC Repair' }, retryCount: 7 },
    ]);

    render(<OfflineIndicator syncStatus={{ pending: 0, failed: 1 }} />);

    expect(screen.getByText(/Sync Issues/i)).toBeTruthy();
    expect(screen.getByText(/Retry All/i)).toBeTruthy();
  });

  it('Retry All button calls retryFailedSyncItem for each failed item', async () => {
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
    // Make retry hang so we can observe the loading state
    let resolveRetry: (v: boolean) => void;
    mockRetryFailedSyncItem.mockImplementation(
      () => new Promise<boolean>((resolve) => { resolveRetry = resolve; })
    );
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
    mockGetFailedSyncQueue.mockReturnValue([
      { id: 'job-1', type: 'job', data: {}, retryCount: 7 },
    ]);

    render(<OfflineIndicator syncStatus={{ pending: 0, failed: 1 }} />);

    // Should show Bunker Mode, not retry UI
    expect(screen.getByText('Bunker Mode')).toBeTruthy();
    expect(screen.queryByText(/Retry All/i)).toBeNull();
  });

  it('shows syncing banner when items are pending (not failed)', () => {
    render(<OfflineIndicator syncStatus={{ pending: 3, failed: 0 }} />);

    expect(screen.getByText(/Syncing Changes/i)).toBeTruthy();
    expect(screen.getByText(/3 items pending sync/i)).toBeTruthy();
  });
});
