/**
 * QuickSearchModal Tests
 *
 * Comprehensive integration tests with real DataContext (no mock data).
 * Tests: rendering, search, filtering, keyboard navigation, accessibility.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { DataContext } from '../../../lib/DataContext';
import QuickSearchModal from '../../../components/modals/QuickSearchModal';
import { Job } from '../../../types';

// Test data factory
function createTestJob(overrides: Partial<Job> = {}): Job {
  return {
    id: `job-${Math.random().toString(36).slice(2, 8)}`,
    title: 'Test Job',
    clientId: 'client-1',
    client: 'Test Client',
    techId: null,
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

// Test wrapper
function TestWrapper({
  children,
  jobs = [],
}: {
  children: React.ReactNode;
  jobs?: Job[];
}) {
  const contextValue = {
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
      <DataContext.Provider value={contextValue as any}>
        {children}
      </DataContext.Provider>
    </BrowserRouter>
  );
}

describe('QuickSearchModal', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    mockOnClose.mockClear();
    localStorage.clear();
  });

  // Rendering tests
  it('renders modal when isOpen is true', () => {
    const jobs = [
      createTestJob({ id: 'job-1', client: 'Acme Corp' }),
    ];

    render(
      <TestWrapper jobs={jobs}>
        <QuickSearchModal isOpen={true} onClose={mockOnClose} />
      </TestWrapper>
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Search by ID/i)).toBeInTheDocument();
  });

  it('does not render modal when isOpen is false', () => {
    const jobs = [createTestJob({ id: 'job-1' })];

    const { container } = render(
      <TestWrapper jobs={jobs}>
        <QuickSearchModal isOpen={false} onClose={mockOnClose} />
      </TestWrapper>
    );

    expect(container.querySelector('[role="dialog"]')).not.toBeInTheDocument();
  });

  // Search tests
  it('searches by job ID', async () => {
    const user = userEvent.setup();
    const jobs = [
      createTestJob({ id: 'JOB-12345', client: 'Acme' }),
      createTestJob({ id: 'JOB-67890', client: 'Tech' }),
    ];

    render(
      <TestWrapper jobs={jobs}>
        <QuickSearchModal isOpen={true} onClose={mockOnClose} />
      </TestWrapper>
    );

    const searchInput = screen.getByPlaceholderText(/Search by ID/i);
    await user.type(searchInput, '12345');

    await waitFor(() => {
      expect(screen.getByText(/JOB-12345/)).toBeInTheDocument();
    });
    expect(screen.queryByText(/JOB-67890/)).not.toBeInTheDocument();
  });

  it('searches by client name', async () => {
    const user = userEvent.setup();
    const jobs = [
      createTestJob({ id: 'job-1', client: 'Acme Corporation' }),
      createTestJob({ id: 'job-2', client: 'Tech Solutions' }),
    ];

    render(
      <TestWrapper jobs={jobs}>
        <QuickSearchModal isOpen={true} onClose={mockOnClose} />
      </TestWrapper>
    );

    const searchInput = screen.getByPlaceholderText(/Search by ID/i);
    await user.type(searchInput, 'Acme');

    await waitFor(() => {
      expect(screen.getByText(/Acme Corporation/)).toBeInTheDocument();
    });
    expect(screen.queryByText(/Tech Solutions/)).not.toBeInTheDocument();
  });

  it('searches by address', async () => {
    const user = userEvent.setup();
    const jobs = [
      createTestJob({ id: 'job-1', address: '123 Main Street' }),
      createTestJob({ id: 'job-2', address: '456 Oak Avenue' }),
    ];

    render(
      <TestWrapper jobs={jobs}>
        <QuickSearchModal isOpen={true} onClose={mockOnClose} />
      </TestWrapper>
    );

    const searchInput = screen.getByPlaceholderText(/Search by ID/i);
    await user.type(searchInput, 'Main');

    await waitFor(() => {
      expect(screen.getByText(/123 Main Street/)).toBeInTheDocument();
    });
    expect(screen.queryByText(/456 Oak Avenue/)).not.toBeInTheDocument();
  });

  // Filter test
  it('has status filter available', () => {
    const jobs = [
      createTestJob({ id: 'job-1', status: 'Pending' }),
      createTestJob({ id: 'job-2', status: 'Complete' }),
    ];

    render(
      <TestWrapper jobs={jobs}>
        <QuickSearchModal isOpen={true} onClose={mockOnClose} />
      </TestWrapper>
    );

    // Verify status filter exists with the correct options
    const statusFilter = screen.getAllByRole('combobox')[0] as HTMLSelectElement;
    expect(statusFilter).toBeInTheDocument();
    const options = Array.from(statusFilter.options).map(o => o.value);
    expect(options).toContain('Complete');
    expect(options).toContain('Pending');
  });

  // Sort test
  it('has sorting options available', () => {
    const jobs = [
      createTestJob({ id: 'job-1', priority: 'urgent' }),
      createTestJob({ id: 'job-2', priority: 'normal' }),
    ];

    render(
      <TestWrapper jobs={jobs}>
        <QuickSearchModal isOpen={true} onClose={mockOnClose} />
      </TestWrapper>
    );

    const comboboxes = screen.getAllByRole('combobox');
    expect(comboboxes.length).toBeGreaterThanOrEqual(2);
  });

  // Keyboard navigation tests
  it('closes modal with Escape key', async () => {
    const user = userEvent.setup();
    const jobs = [createTestJob({ id: 'job-1' })];

    render(
      <TestWrapper jobs={jobs}>
        <QuickSearchModal isOpen={true} onClose={mockOnClose} />
      </TestWrapper>
    );

    const searchInput = screen.getByPlaceholderText(/Search by ID/i);
    await user.click(searchInput);
    await user.keyboard('{Escape}');

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('navigates results with arrow keys', async () => {
    const user = userEvent.setup();
    const jobs = [
      createTestJob({ id: 'job-1', client: 'A Corp' }),
      createTestJob({ id: 'job-2', client: 'B Corp' }),
    ];

    render(
      <TestWrapper jobs={jobs}>
        <QuickSearchModal isOpen={true} onClose={mockOnClose} />
      </TestWrapper>
    );

    const searchInput = screen.getByPlaceholderText(/Search by ID/i);
    await user.type(searchInput, 'Corp');

    // First result should be selected
    let buttons = screen.getAllByRole('button').filter(b => b.textContent?.includes('Corp'));
    expect(buttons[0]).toHaveAttribute('aria-current', 'true');

    // Press down arrow
    await user.keyboard('{ArrowDown}');

    buttons = screen.getAllByRole('button').filter(b => b.textContent?.includes('Corp'));
    expect(buttons[1]).toHaveAttribute('aria-current', 'true');
  });

  // Empty state test
  it('shows empty state when no results match', async () => {
    const user = userEvent.setup();
    const jobs = [createTestJob({ id: 'job-1', client: 'Acme' })];

    render(
      <TestWrapper jobs={jobs}>
        <QuickSearchModal isOpen={true} onClose={mockOnClose} />
      </TestWrapper>
    );

    const searchInput = screen.getByPlaceholderText(/Search by ID/i);
    await user.type(searchInput, 'nonexistent');

    await waitFor(() => {
      expect(screen.getByText(/No jobs found/i)).toBeInTheDocument();
    });
  });

  // Accessibility test
  it('has proper ARIA attributes and semantic HTML', () => {
    const jobs = [createTestJob({ id: 'job-1' })];

    const { container } = render(
      <TestWrapper jobs={jobs}>
        <QuickSearchModal isOpen={true} onClose={mockOnClose} />
      </TestWrapper>
    );

    const modal = container.querySelector('[role="dialog"]');
    expect(modal).toBeInTheDocument();
    expect(modal).toHaveAttribute('aria-modal', 'true');
    expect(modal).toHaveAttribute('aria-labelledby', 'modal-title');

    expect(screen.getByPlaceholderText(/Search by ID/i)).toBeInTheDocument();
  });

  // Additional tests
  it('displays search results with job details', async () => {
    const user = userEvent.setup();
    const jobs = [
      createTestJob({
        id: 'job-1',
        client: 'Acme Corp',
        address: '123 Main St',
        technician: 'John Doe',
      }),
    ];

    render(
      <TestWrapper jobs={jobs}>
        <QuickSearchModal isOpen={true} onClose={mockOnClose} />
      </TestWrapper>
    );

    const searchInput = screen.getByPlaceholderText(/Search by ID/i);
    await user.type(searchInput, 'Acme');

    await waitFor(() => {
      expect(screen.getByText(/Acme Corp/)).toBeInTheDocument();
      expect(screen.getByText(/123 Main St/)).toBeInTheDocument();
    });
  });

  it('limits search results to 8 items', async () => {
    const user = userEvent.setup();
    const jobs = Array.from({ length: 12 }, (_, i) =>
      createTestJob({ id: `job-${i}`, client: `Client ${i}` })
    );

    render(
      <TestWrapper jobs={jobs}>
        <QuickSearchModal isOpen={true} onClose={mockOnClose} />
      </TestWrapper>
    );

    const searchInput = screen.getByPlaceholderText(/Search by ID/i);
    await user.type(searchInput, 'Client');

    await waitFor(() => {
      const buttons = screen.getAllByRole('button').filter(b => b.textContent?.includes('Client'));
      expect(buttons.length).toBeLessThanOrEqual(8);
    });
  });
});
