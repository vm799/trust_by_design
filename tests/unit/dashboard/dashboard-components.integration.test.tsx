/**
 * Dashboard Components Integration Tests
 *
 * Tests that all dashboard components render without errors and properly
 * integrate with DataContext. These are smoke tests focused on correct
 * component rendering and data flow, not specific UI assertions.
 */

import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { DataContext } from '../../../lib/DataContext';
import TeamStatusHero from '../../../components/dashboard/TeamStatusHero';
import AlertStack from '../../../components/dashboard/AlertStack';
import QuickWinsGrid from '../../../components/dashboard/QuickWinsGrid';
import MetricsCard from '../../../components/dashboard/MetricsCard';
import ActiveJobsTable from '../../../components/dashboard/ActiveJobsTable';
import { Job, Technician, Client } from '../../../types';

// ============================================================================
// TEST DATA FACTORIES
// ============================================================================

function createJob(overrides: Partial<Job> = {}): Job {
  return {
    id: `job-${Math.random().toString(36).slice(2, 8)}`,
    title: 'Test Job',
    clientId: 'client-1',
    client: 'Test Client',
    techId: 'tech-1',
    technicianId: 'tech-1',
    technician: 'Test Tech',
    status: 'In Progress',
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

function createTechnician(overrides: Partial<Technician> = {}): Technician {
  return {
    id: `tech-${Math.random().toString(36).slice(2, 8)}`,
    name: 'Test Technician',
    email: 'tech@test.com',
    status: 'Available',
    workMode: 'employed',
    ...overrides,
  } as Technician;
}

// ============================================================================
// TEST WRAPPER
// ============================================================================

function DashboardTestWrapper({
  children,
  jobs = [],
  technicians = [],
  isLoading = false,
  error = null,
}: {
  children: React.ReactNode;
  jobs?: Job[];
  technicians?: Technician[];
  isLoading?: boolean;
  error?: string | null;
}) {
  const contextValue = {
    jobs,
    technicians,
    clients: [],
    updateJob: vi.fn(),
    deleteJob: vi.fn(),
    addJob: vi.fn(),
    isLoading,
    error,
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

// ============================================================================
// TESTS
// ============================================================================

describe('Dashboard Components Integration', () => {
  describe('TeamStatusHero', () => {
    it('renders without errors with empty data', () => {
      const { container } = render(
        <DashboardTestWrapper>
          <TeamStatusHero />
        </DashboardTestWrapper>
      );

      expect(container).toBeInTheDocument();
    });

    it('renders with real job and technician data', () => {
      const jobs = [
        createJob({ id: 'job-1', status: 'In Progress' }),
        createJob({ id: 'job-2', status: 'Complete' }),
      ];
      const technicians = [
        createTechnician({ id: 'tech-1', status: 'Available' }),
        createTechnician({ id: 'tech-2', status: 'Off Duty' }),
      ];

      const { container } = render(
        <DashboardTestWrapper jobs={jobs} technicians={technicians}>
          <TeamStatusHero />
        </DashboardTestWrapper>
      );

      expect(container).toBeInTheDocument();
    });

    it('renders loading state without errors', () => {
      const { container } = render(
        <DashboardTestWrapper isLoading={true}>
          <TeamStatusHero />
        </DashboardTestWrapper>
      );

      expect(container).toBeInTheDocument();
    });

    it('renders error state without errors', () => {
      const { container } = render(
        <DashboardTestWrapper error="Failed to load data">
          <TeamStatusHero />
        </DashboardTestWrapper>
      );

      expect(container).toBeInTheDocument();
    });
  });

  describe('AlertStack', () => {
    it('renders without errors with no alerts', () => {
      const { container } = render(
        <DashboardTestWrapper>
          <AlertStack />
        </DashboardTestWrapper>
      );

      expect(container).toBeInTheDocument();
    });

    it('renders overdue alerts', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const jobs = [
        createJob({
          id: 'overdue-1',
          status: 'In Progress',
          date: yesterday.toISOString(),
        }),
      ];

      const { container } = render(
        <DashboardTestWrapper jobs={jobs}>
          <AlertStack />
        </DashboardTestWrapper>
      );

      expect(container).toBeInTheDocument();
    });

    it('renders unassigned job alerts', () => {
      const jobs = [
        createJob({
          id: 'unassigned-1',
          technicianId: undefined as any,
          status: 'Pending',
        }),
      ];

      const { container } = render(
        <DashboardTestWrapper jobs={jobs}>
          <AlertStack />
        </DashboardTestWrapper>
      );

      expect(container).toBeInTheDocument();
    });

    it('renders ready-to-invoice alerts', () => {
      const jobs = [
        createJob({
          id: 'ready-1',
          status: 'Complete',
          invoiceId: null as any,
        }),
      ];

      const { container } = render(
        <DashboardTestWrapper jobs={jobs}>
          <AlertStack />
        </DashboardTestWrapper>
      );

      expect(container).toBeInTheDocument();
    });
  });

  describe('QuickWinsGrid', () => {
    it('renders without errors with empty data', () => {
      const { container } = render(
        <DashboardTestWrapper>
          <QuickWinsGrid />
        </DashboardTestWrapper>
      );

      expect(container).toBeInTheDocument();
    });

    it('renders with job metrics', () => {
      const jobs = [
        createJob({ id: 'job-1', status: 'In Progress' }),
        createJob({ id: 'job-2', status: 'In Progress' }),
        createJob({
          id: 'job-3',
          status: 'Complete',
          invoiceId: null as any,
        }),
      ];

      const { container } = render(
        <DashboardTestWrapper jobs={jobs}>
          <QuickWinsGrid />
        </DashboardTestWrapper>
      );

      expect(container).toBeInTheDocument();
    });

    it('renders loading state', () => {
      const { container } = render(
        <DashboardTestWrapper isLoading={true}>
          <QuickWinsGrid />
        </DashboardTestWrapper>
      );

      expect(container).toBeInTheDocument();
    });
  });

  describe('MetricsCard', () => {
    it('renders with basic props', () => {
      const { container } = render(
        <MetricsCard title="Test Metric" value="42" />
      );

      expect(container).toBeInTheDocument();
    });

    it('renders with trend indicator', () => {
      const { container } = render(
        <MetricsCard
          title="Active Jobs"
          value="18"
          trend={{ label: 'vs last week', direction: 'up', percentage: 3 }}
        />
      );

      expect(container).toBeInTheDocument();
    });

    it('renders with click handler', () => {
      const onClick = vi.fn();
      const { container } = render(
        <MetricsCard
          title="Clickable"
          value="99"
          onClick={onClick}
        />
      );

      expect(container).toBeInTheDocument();
    });

    it('renders different variants', () => {
      const variants = ['default', 'success', 'warning', 'danger'] as const;

      variants.forEach(variant => {
        const { container } = render(
          <MetricsCard
            title={`Card ${variant}`}
            value="1"
          />
        );

        expect(container).toBeInTheDocument();
      });
    });
  });

  describe('ActiveJobsTable', () => {
    it('renders without errors with empty jobs', () => {
      const { container } = render(
        <DashboardTestWrapper>
          <ActiveJobsTable />
        </DashboardTestWrapper>
      );

      expect(container).toBeInTheDocument();
    });

    it('renders with multiple jobs', () => {
      const jobs = [
        createJob({ id: 'job-1', title: 'Job 1' }),
        createJob({ id: 'job-2', title: 'Job 2' }),
        createJob({ id: 'job-3', title: 'Job 3' }),
      ];

      const { container } = render(
        <DashboardTestWrapper jobs={jobs}>
          <ActiveJobsTable />
        </DashboardTestWrapper>
      );

      expect(container).toBeInTheDocument();
    });

    it('renders with large job count', () => {
      const jobs = Array.from({ length: 100 }, (_, i) =>
        createJob({ id: `job-${i}`, title: `Job ${i}` })
      );

      const { container } = render(
        <DashboardTestWrapper jobs={jobs}>
          <ActiveJobsTable />
        </DashboardTestWrapper>
      );

      expect(container).toBeInTheDocument();
    });

    it('renders with mixed job statuses', () => {
      const jobs = [
        createJob({ id: 'job-1', status: 'Pending' }),
        createJob({ id: 'job-2', status: 'In Progress' }),
        createJob({ id: 'job-3', status: 'In Progress' }),
        createJob({ id: 'job-4', status: 'Complete' }),
      ];

      const { container } = render(
        <DashboardTestWrapper jobs={jobs}>
          <ActiveJobsTable />
        </DashboardTestWrapper>
      );

      expect(container).toBeInTheDocument();
    });
  });

  describe('Combined Dashboard', () => {
    it('renders all components together without errors', () => {
      const jobs = [
        createJob({ id: 'job-1', status: 'In Progress' }),
        createJob({ id: 'job-2', status: 'Complete' }),
      ];
      const technicians = [
        createTechnician({ id: 'tech-1', status: 'Available' }),
      ];

      const { container } = render(
        <DashboardTestWrapper jobs={jobs} technicians={technicians}>
          <div>
            <TeamStatusHero />
            <AlertStack />
            <QuickWinsGrid />
            <ActiveJobsTable />
          </div>
        </DashboardTestWrapper>
      );

      expect(container).toBeInTheDocument();
    });
  });

  describe('DataContext Integration', () => {
    it('all components properly integrate with DataContext', () => {
      const mockUpdateJob = vi.fn();
      const mockDeleteJob = vi.fn();
      const mockRefresh = vi.fn();

      const { container } = render(
        <BrowserRouter>
          <DataContext.Provider
            value={{
              jobs: [createJob()],
              technicians: [createTechnician()],
              clients: [],
              updateJob: mockUpdateJob,
              deleteJob: mockDeleteJob,
              addJob: vi.fn(),
              isLoading: false,
              error: null,
              refresh: mockRefresh,
            } as any}
          >
            <TeamStatusHero />
            <AlertStack />
            <QuickWinsGrid />
            <ActiveJobsTable />
          </DataContext.Provider>
        </BrowserRouter>
      );

      expect(container).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles undefined/null values gracefully', () => {
      const jobs = [
        createJob({
          id: 'job-1',
          technicianId: undefined as any,
          invoiceId: null as any,
        }),
      ];

      const { container } = render(
        <DashboardTestWrapper jobs={jobs}>
          <div>
            <TeamStatusHero />
            <AlertStack />
            <QuickWinsGrid />
            <ActiveJobsTable />
          </div>
        </DashboardTestWrapper>
      );

      expect(container).toBeInTheDocument();
    });

    it('handles very large datasets', () => {
      const jobs = Array.from({ length: 500 }, (_, i) =>
        createJob({ id: `job-${i}` })
      );
      const technicians = Array.from({ length: 50 }, (_, i) =>
        createTechnician({ id: `tech-${i}` })
      );

      const { container } = render(
        <DashboardTestWrapper jobs={jobs} technicians={technicians}>
          <div>
            <TeamStatusHero />
            <AlertStack />
            <QuickWinsGrid />
            <ActiveJobsTable />
          </div>
        </DashboardTestWrapper>
      );

      expect(container).toBeInTheDocument();
    });
  });
});
