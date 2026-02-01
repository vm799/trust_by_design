/**
 * FocusStack Component Tests
 *
 * Tests the Context Thrash Prevention UI pattern:
 * - ONE job in focus
 * - Max 3 jobs in queue
 * - Everything else collapsed
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import FocusStack, {
  DefaultFocusJobCard,
  DefaultQueueJobCard,
  DefaultCollapsedJobCard,
} from '../../../components/ui/FocusStack';
import { Job, Client } from '../../../types';

// Test data
const mockClients: Client[] = [
  { id: 'client-1', name: 'Acme Corp', totalJobs: 5 },
  { id: 'client-2', name: 'Beta Inc', totalJobs: 3 },
  { id: 'client-3', name: 'Gamma LLC', totalJobs: 2 },
];

const createMockJob = (id: string, status: string, lastUpdated: number): Job => ({
  id,
  title: `Job ${id}`,
  client: 'Test Client',
  clientId: 'client-1',
  technician: 'Test Tech',
  techId: 'tech-1',
  status: status as any,
  date: new Date().toISOString(),
  address: '123 Test St',
  notes: 'Test notes',
  photos: [],
  signature: null,
  safetyChecklist: [],
  syncStatus: 'synced',
  lastUpdated,
});

const mockJobs: Job[] = [
  createMockJob('job-1', 'In Progress', Date.now()),
  createMockJob('job-2', 'Pending', Date.now() - 1000),
  createMockJob('job-3', 'Pending', Date.now() - 2000),
  createMockJob('job-4', 'Pending', Date.now() - 3000),
  createMockJob('job-5', 'Pending', Date.now() - 4000),
  createMockJob('job-6', 'Pending', Date.now() - 5000),
];

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
};

describe('FocusStack Component', () => {
  describe('Focus Job', () => {
    it('should render focus job when focusJobId is provided', () => {
      const onContinue = vi.fn();

      renderWithRouter(
        <FocusStack
          jobs={mockJobs}
          clients={mockClients}
          focusJobId="job-1"
          renderFocusJob={({ job }) => <div data-testid="focus-job">{job.title}</div>}
          renderQueueJob={({ job }) => <div data-testid="queue-job">{job.title}</div>}
          onContinueFocusJob={onContinue}
        />
      );

      expect(screen.getByTestId('focus-job')).toBeDefined();
      expect(screen.getByText('Job job-1')).toBeDefined();
    });

    it('should not render focus job when focusJobId is null', () => {
      renderWithRouter(
        <FocusStack
          jobs={mockJobs}
          clients={mockClients}
          focusJobId={null}
          renderFocusJob={({ job }) => <div data-testid="focus-job">{job.title}</div>}
          renderQueueJob={({ job }) => <div data-testid="queue-job">{job.title}</div>}
          onContinueFocusJob={() => {}}
        />
      );

      expect(screen.queryByTestId('focus-job')).toBeNull();
    });
  });

  describe('Queue Jobs', () => {
    it('should render exactly maxQueueSize jobs in queue', () => {
      renderWithRouter(
        <FocusStack
          jobs={mockJobs}
          clients={mockClients}
          focusJobId="job-1"
          renderFocusJob={({ job }) => <div data-testid="focus-job">{job.title}</div>}
          renderQueueJob={({ job }) => <div data-testid="queue-job">{job.title}</div>}
          onContinueFocusJob={() => {}}
          maxQueueSize={3}
        />
      );

      const queueJobs = screen.getAllByTestId('queue-job');
      expect(queueJobs.length).toBe(3);
    });

    it('should default to 3 jobs in queue', () => {
      renderWithRouter(
        <FocusStack
          jobs={mockJobs}
          clients={mockClients}
          focusJobId="job-1"
          renderFocusJob={({ job }) => <div data-testid="focus-job">{job.title}</div>}
          renderQueueJob={({ job }) => <div data-testid="queue-job">{job.title}</div>}
          onContinueFocusJob={() => {}}
        />
      );

      const queueJobs = screen.getAllByTestId('queue-job');
      expect(queueJobs.length).toBe(3);
    });

    it('should exclude focus job from queue', () => {
      renderWithRouter(
        <FocusStack
          jobs={mockJobs}
          clients={mockClients}
          focusJobId="job-1"
          renderFocusJob={({ job }) => <div data-testid="focus-job">{job.title}</div>}
          renderQueueJob={({ job }) => <div data-testid={`queue-${job.id}`}>{job.title}</div>}
          onContinueFocusJob={() => {}}
          maxQueueSize={3}
        />
      );

      expect(screen.queryByTestId('queue-job-1')).toBeNull();
      expect(screen.getByTestId('queue-job-2')).toBeDefined();
    });

    it('should exclude completed jobs from queue', () => {
      const jobsWithComplete = [
        ...mockJobs.slice(0, 2),
        createMockJob('job-complete', 'Complete', Date.now()),
        ...mockJobs.slice(2),
      ];

      renderWithRouter(
        <FocusStack
          jobs={jobsWithComplete}
          clients={mockClients}
          focusJobId="job-1"
          renderFocusJob={({ job }) => <div data-testid="focus-job">{job.title}</div>}
          renderQueueJob={({ job }) => <div data-testid={`queue-${job.id}`}>{job.title}</div>}
          onContinueFocusJob={() => {}}
        />
      );

      expect(screen.queryByTestId('queue-job-complete')).toBeNull();
    });
  });

  describe('Collapsed Jobs', () => {
    it('should render collapsed jobs beyond queue size', () => {
      renderWithRouter(
        <FocusStack
          jobs={mockJobs}
          clients={mockClients}
          focusJobId="job-1"
          renderFocusJob={({ job }) => <div data-testid="focus-job">{job.title}</div>}
          renderQueueJob={({ job }) => <div data-testid="queue-job">{job.title}</div>}
          renderCollapsedJob={({ job }) => <div data-testid={`collapsed-${job.id}`}>{job.title}</div>}
          onContinueFocusJob={() => {}}
          maxQueueSize={3}
          showCollapsed={true}
        />
      );

      // 6 jobs total - 1 focus - 3 queue = 2 collapsed
      expect(screen.getByTestId('collapsed-job-5')).toBeDefined();
      expect(screen.getByTestId('collapsed-job-6')).toBeDefined();
    });

    it('should not render collapsed section when showCollapsed is false', () => {
      renderWithRouter(
        <FocusStack
          jobs={mockJobs}
          clients={mockClients}
          focusJobId="job-1"
          renderFocusJob={({ job }) => <div data-testid="focus-job">{job.title}</div>}
          renderQueueJob={({ job }) => <div data-testid="queue-job">{job.title}</div>}
          renderCollapsedJob={({ job }) => <div data-testid="collapsed-job">{job.title}</div>}
          onContinueFocusJob={() => {}}
          showCollapsed={false}
        />
      );

      expect(screen.queryByTestId('collapsed-job')).toBeNull();
    });
  });

  describe('Empty State', () => {
    it('should render empty state when no jobs', () => {
      renderWithRouter(
        <FocusStack
          jobs={[]}
          clients={mockClients}
          focusJobId={null}
          renderFocusJob={({ job }) => <div>{job.title}</div>}
          renderQueueJob={({ job }) => <div>{job.title}</div>}
          onContinueFocusJob={() => {}}
          emptyState={<div data-testid="empty-state">No jobs</div>}
        />
      );

      expect(screen.getByTestId('empty-state')).toBeDefined();
      expect(screen.getByText('No jobs')).toBeDefined();
    });

    it('should return null when no jobs and no emptyState', () => {
      const { container } = renderWithRouter(
        <FocusStack
          jobs={[]}
          clients={mockClients}
          focusJobId={null}
          renderFocusJob={({ job }) => <div>{job.title}</div>}
          renderQueueJob={({ job }) => <div>{job.title}</div>}
          onContinueFocusJob={() => {}}
        />
      );

      expect(container.firstChild).toBeNull();
    });
  });

  describe('Sorting', () => {
    it('should use custom sort function', () => {
      const customSort = (jobs: Job[]) =>
        [...jobs].sort((a, b) => a.title.localeCompare(b.title));

      renderWithRouter(
        <FocusStack
          jobs={mockJobs}
          clients={mockClients}
          focusJobId="job-1"
          renderFocusJob={({ job }) => <div data-testid="focus-job">{job.title}</div>}
          renderQueueJob={({ job, position }) => (
            <div data-testid={`queue-${position}`}>{job.title}</div>
          )}
          onContinueFocusJob={() => {}}
          sortQueue={customSort}
        />
      );

      // With alphabetical sort, job-2 should be first in queue
      expect(screen.getByTestId('queue-1')).toBeDefined();
    });

    it('should default sort by lastUpdated', () => {
      const unsortedJobs = [
        createMockJob('oldest', 'Pending', 1000),
        createMockJob('newest', 'Pending', 3000),
        createMockJob('middle', 'Pending', 2000),
      ];

      renderWithRouter(
        <FocusStack
          jobs={unsortedJobs}
          clients={mockClients}
          focusJobId={null}
          renderFocusJob={({ job }) => <div>{job.title}</div>}
          renderQueueJob={({ job, position }) => (
            <div data-testid={`queue-${position}`}>{job.id}</div>
          )}
          onContinueFocusJob={() => {}}
        />
      );

      // Newest should be first (position 1)
      expect(screen.getByTestId('queue-1').textContent).toBe('newest');
    });
  });

  describe('Callbacks', () => {
    it('should call onContinueFocusJob when continue is clicked', () => {
      const onContinue = vi.fn();

      renderWithRouter(
        <FocusStack
          jobs={mockJobs}
          clients={mockClients}
          focusJobId="job-1"
          renderFocusJob={({ job, onContinue }) => (
            <button data-testid="continue-btn" onClick={onContinue}>
              Continue {job.title}
            </button>
          )}
          renderQueueJob={({ job }) => <div>{job.title}</div>}
          onContinueFocusJob={onContinue}
        />
      );

      fireEvent.click(screen.getByTestId('continue-btn'));
      expect(onContinue).toHaveBeenCalledWith(mockJobs[0]);
    });
  });

  describe('Client Resolution', () => {
    it('should pass correct client to render functions', () => {
      const jobWithClient: Job = {
        ...createMockJob('job-with-client', 'In Progress', Date.now()),
        clientId: 'client-2',
      };

      renderWithRouter(
        <FocusStack
          jobs={[jobWithClient]}
          clients={mockClients}
          focusJobId="job-with-client"
          renderFocusJob={({ job, client }) => (
            <div data-testid="focus-job">{client?.name}</div>
          )}
          renderQueueJob={({ job }) => <div>{job.title}</div>}
          onContinueFocusJob={() => {}}
        />
      );

      expect(screen.getByTestId('focus-job').textContent).toBe('Beta Inc');
    });
  });
});

describe('DefaultFocusJobCard', () => {
  it('should render job title', () => {
    const job = createMockJob('test-job', 'In Progress', Date.now());

    renderWithRouter(
      <DefaultFocusJobCard
        job={job}
        client={mockClients[0]}
        onContinue={() => {}}
      />
    );

    expect(screen.getByText('Job test-job')).toBeDefined();
  });

  it('should render client name', () => {
    const job = createMockJob('test-job', 'In Progress', Date.now());

    renderWithRouter(
      <DefaultFocusJobCard
        job={job}
        client={mockClients[0]}
        onContinue={() => {}}
      />
    );

    expect(screen.getByText('Acme Corp')).toBeDefined();
  });

  it('should call onContinue when button clicked', () => {
    const onContinue = vi.fn();
    const job = createMockJob('test-job', 'In Progress', Date.now());

    renderWithRouter(
      <DefaultFocusJobCard
        job={job}
        client={mockClients[0]}
        onContinue={onContinue}
      />
    );

    fireEvent.click(screen.getByText('Continue'));
    expect(onContinue).toHaveBeenCalled();
  });
});

describe('DefaultQueueJobCard', () => {
  it('should render position number', () => {
    const job = createMockJob('test-job', 'Pending', Date.now());

    renderWithRouter(
      <DefaultQueueJobCard
        job={job}
        client={mockClients[0]}
        position={2}
      />
    );

    expect(screen.getByText('2')).toBeDefined();
  });

  it('should render job title and client', () => {
    const job = createMockJob('test-job', 'Pending', Date.now());

    renderWithRouter(
      <DefaultQueueJobCard
        job={job}
        client={mockClients[0]}
        position={1}
      />
    );

    expect(screen.getByText('Job test-job')).toBeDefined();
    expect(screen.getByText('Acme Corp')).toBeDefined();
  });
});

describe('DefaultCollapsedJobCard', () => {
  it('should render job title and client inline', () => {
    const job = createMockJob('test-job', 'Pending', Date.now());

    renderWithRouter(
      <DefaultCollapsedJobCard
        job={job}
        client={mockClients[0]}
      />
    );

    expect(screen.getByText('Job test-job')).toBeDefined();
    expect(screen.getByText('Acme Corp')).toBeDefined();
  });
});
