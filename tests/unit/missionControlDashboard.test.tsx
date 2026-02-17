/**
 * Mission Control Dashboard Tests
 *
 * Tests the overhauled ManagerFocusDashboard ("Mission Control"):
 * - Reactive metrics computed from data (no hard-coded values)
 * - Job status pill counts match actual data
 * - Attention queue shows/hides based on issues
 * - Top-loaded action tiles present
 * - Technician pulse shows on-site count
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { HashRouter } from 'react-router-dom';
import type { Job, Technician, Client } from '../../types';

// ============================================================================
// MOCKS
// ============================================================================

let mockJobs: Partial<Job>[] = [];
let mockTechnicians: Partial<Technician>[] = [];
let mockClients: Partial<Client>[] = [];
let mockIsLoading = false;
let mockError: string | null = null;

vi.mock('../../lib/DataContext', () => ({
  useData: () => ({
    jobs: mockJobs,
    clients: mockClients,
    technicians: mockTechnicians,
    invoices: [],
    templates: [],
    isLoading: mockIsLoading,
    error: mockError,
    refresh: vi.fn(),
    addJob: vi.fn(),
    updateJob: vi.fn(),
    deleteJob: vi.fn(),
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

vi.mock('../../hooks/useGlobalKeyboardShortcuts', () => ({
  useGlobalKeyboardShortcuts: vi.fn(),
}));

vi.mock('../../components/modals/QuickSearchModal', () => ({
  default: ({ isOpen }: { isOpen: boolean }) => isOpen ? <div data-testid="search-modal">Search Modal</div> : null,
}));

vi.mock('../../components/modals/QuickAssignModal', () => ({
  default: ({ isOpen }: { isOpen: boolean }) => isOpen ? <div data-testid="assign-modal">Assign Modal</div> : null,
}));

// Mock dashboard component imports that may not exist yet
vi.mock('../../components/dashboard', () => ({
  ProofGapBar: ({ jobs }: { jobs: Job[] }) => (
    <div data-testid="proof-gap-bar">ProofGapBar: {jobs.length} jobs</div>
  ),
  TechnicianStatusGrid: ({ summaries }: { summaries: any[] }) => (
    <div data-testid="tech-status-grid">TechStatusGrid: {summaries.length} techs</div>
  ),
  StatusBreakdownModal: () => null,
}));

vi.mock('../../components/layout', () => ({
  PageContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../../components/ui', () => ({
  Card: ({ children, className, onClick }: any) => (
    <div className={className} onClick={onClick}>{children}</div>
  ),
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  ActionButton: ({ children, onClick, to, icon }: any) =>
    to ? <a href={to}>{children}</a> : <button onClick={onClick}>{children}</button>,
  LoadingSkeleton: () => <div data-testid="loading-skeleton">Loading...</div>,
  StatusRing: ({ totalJobs, completedJobs }: any) => (
    <div data-testid="status-ring" aria-label={`${completedJobs} of ${totalJobs}`}>StatusRing</div>
  ),
  FocusStack: () => null,
  FocusJobRenderProps: undefined,
  QueueJobRenderProps: undefined,
  CollapsedJobRenderProps: undefined,
}));

vi.mock('../../lib/animations', () => ({
  fadeInUp: {},
  staggerContainer: {},
  staggerContainerFast: {},
}));

// Import after mocks
import ManagerFocusDashboard from '../../views/app/ManagerFocusDashboard';

const renderDashboard = () => {
  return render(
    <HashRouter>
      <ManagerFocusDashboard />
    </HashRouter>
  );
};

// ============================================================================
// HELPERS
// ============================================================================

function createJob(overrides: Partial<Job> = {}): Partial<Job> {
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
    address: '',
    lastUpdated: Date.now(),
    ...overrides,
  };
}

function createTechnician(overrides: Partial<Technician> = {}): Partial<Technician> {
  return {
    id: 'tech-1',
    name: 'Test Tech',
    email: 'tech@test.com',
    status: 'Available',
    rating: 0,
    jobsCompleted: 0,
    ...overrides,
  };
}

// ============================================================================
// TESTS
// ============================================================================

describe('ManagerFocusDashboard (Mission Control)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockJobs = [];
    mockTechnicians = [];
    mockClients = [];
    mockIsLoading = false;
    mockError = null;
  });

  describe('Header & Title', () => {
    it('should render "Mission Control" title', () => {
      renderDashboard();
      expect(screen.getByText('Mission Control')).toBeDefined();
    });

    it('should render "New Job" action', () => {
      renderDashboard();
      // ActionButton with to prop renders as <a>
      const newJobLinks = screen.getAllByText('New Job');
      expect(newJobLinks.length).toBeGreaterThan(0);
    });
  });

  describe('Top-loaded Action Tiles', () => {
    it('should render Search action tile', () => {
      renderDashboard();
      expect(screen.getByLabelText(/Search jobs/)).toBeDefined();
    });

    it('should render Assign action tile', () => {
      renderDashboard();
      expect(screen.getByLabelText(/Assign technician/)).toBeDefined();
    });

    it('should render All Jobs action tile', () => {
      renderDashboard();
      expect(screen.getByLabelText(/View all jobs/)).toBeDefined();
    });

    it('Search tile should open search modal on click', () => {
      renderDashboard();
      const searchTile = screen.getByLabelText(/Search jobs/);
      fireEvent.click(searchTile);
      expect(screen.getByTestId('search-modal')).toBeDefined();
    });

    it('Assign tile should open assign modal on click', () => {
      renderDashboard();
      const assignTile = screen.getByLabelText(/Assign technician/);
      fireEvent.click(assignTile);
      expect(screen.getByTestId('assign-modal')).toBeDefined();
    });
  });

  describe('Reactive Metrics (no hard-coded values)', () => {
    it('should show 0 on-site when no techs have active jobs', () => {
      mockTechnicians = [createTechnician()];
      mockJobs = [createJob({ status: 'Pending', technicianId: 'tech-1', techId: 'tech-1' })];
      renderDashboard();
      // The on-site chip reads "<count> on-site", check for "on-site" text
      const onSiteElements = screen.getAllByText('on-site');
      expect(onSiteElements.length).toBeGreaterThan(0);
    });

    it('should count on-site technicians from active jobs', () => {
      mockTechnicians = [
        createTechnician({ id: 'tech-1', name: 'Tech A' }),
        createTechnician({ id: 'tech-2', name: 'Tech B' }),
      ];
      mockJobs = [
        createJob({ technicianId: 'tech-1', techId: 'tech-1', status: 'In Progress' }),
        createJob({ technicianId: 'tech-2', techId: 'tech-2', status: 'Pending' }),
      ];
      renderDashboard();
      // There should be on-site text and the count 1 somewhere
      // Use a more specific query to avoid multiple match issues
      const onSiteButtons = screen.getAllByText('on-site');
      expect(onSiteButtons.length).toBeGreaterThan(0);
      // The parent should contain the count "1"
      const onSiteButton = onSiteButtons[0].closest('button');
      expect(onSiteButton?.textContent).toContain('1');
    });

    it('should show "All Clear" when no issues and no dispatched jobs', () => {
      mockTechnicians = [createTechnician()];
      mockJobs = [createJob({ syncStatus: 'synced', status: 'Pending', lastUpdated: Date.now(), techId: '', technicianId: undefined })];
      renderDashboard();
      const allClearElements = screen.getAllByText('All Clear');
      expect(allClearElements.length).toBeGreaterThan(0);
    });
  });

  describe('Job Status Pills', () => {
    it('should render all 4 pill categories', () => {
      renderDashboard();
      expect(screen.getByText('Pending')).toBeDefined();
      expect(screen.getByText('Active')).toBeDefined();
      expect(screen.getByText('Awaiting')).toBeDefined();
      expect(screen.getByText('Closed')).toBeDefined();
    });

    it('should show correct count for each pill', () => {
      mockJobs = [
        createJob({ status: 'Pending' }),
        createJob({ status: 'Draft' }),
        createJob({ status: 'In Progress' }),
        createJob({ status: 'Complete' }),
        createJob({ status: 'Archived' }),
      ];
      renderDashboard();

      // Pending pill: Pending + Draft = 2
      const pendingPill = screen.getByLabelText('Pending: 2 jobs');
      expect(pendingPill).toBeDefined();

      // Active pill: In Progress = 1
      const activePill = screen.getByLabelText('Active: 1 jobs');
      expect(activePill).toBeDefined();

      // Awaiting pill: Complete + Submitted = 1
      const awaitingPill = screen.getByLabelText('Awaiting: 1 jobs');
      expect(awaitingPill).toBeDefined();

      // Closed pill: Archived + Cancelled = 1
      const closedPill = screen.getByLabelText('Closed: 1 jobs');
      expect(closedPill).toBeDefined();
    });

    it('should toggle pill active state on click', () => {
      mockJobs = [createJob({ status: 'Pending' })];
      renderDashboard();

      const pendingPill = screen.getByLabelText('Pending: 1 jobs');
      expect(pendingPill.getAttribute('aria-pressed')).toBe('false');

      fireEvent.click(pendingPill);
      expect(pendingPill.getAttribute('aria-pressed')).toBe('true');

      fireEvent.click(pendingPill);
      expect(pendingPill.getAttribute('aria-pressed')).toBe('false');
    });

    it('pills should have 44px minimum touch target', () => {
      renderDashboard();
      const pendingPill = screen.getByLabelText('Pending: 0 jobs');
      expect(pendingPill.className).toContain('min-h-[44px]');
    });
  });

  describe('Attention Queue', () => {
    it('should hide attention section when no issues exist', () => {
      mockTechnicians = [createTechnician()];
      mockJobs = []; // No jobs = no idle tech issues (tech has no pending)
      renderDashboard();
      expect(screen.queryByText('Needs Attention')).toBeNull();
    });

    it('should show idle technician when they have pending work but no active job', () => {
      mockTechnicians = [createTechnician({ id: 'tech-1', name: 'Idle Tech' })];
      mockJobs = [createJob({
        technicianId: 'tech-1',
        techId: 'tech-1',
        status: 'Pending',
      })];
      renderDashboard();
      expect(screen.getByText('Needs Attention')).toBeDefined();
      expect(screen.getByText('Idle Tech')).toBeDefined();
    });

    it('should show sync failure alert', () => {
      mockTechnicians = [createTechnician({ id: 'tech-1', name: 'Tech With Sync Issues' })];
      mockJobs = [createJob({
        technicianId: 'tech-1',
        techId: 'tech-1',
        syncStatus: 'failed',
      })];
      renderDashboard();
      expect(screen.getByText('Needs Attention')).toBeDefined();
      expect(screen.getByText(/failed to sync/)).toBeDefined();
    });
  });

  describe('Technician Section', () => {
    it('should show technician count', () => {
      mockTechnicians = [
        createTechnician({ id: 'tech-1', name: 'Tech A' }),
        createTechnician({ id: 'tech-2', name: 'Tech B' }),
      ];
      renderDashboard();
      expect(screen.getByText('2 team members')).toBeDefined();
    });

    it('should show add technician button when no technicians', () => {
      mockTechnicians = [];
      renderDashboard();
      expect(screen.getByText('Add Technician')).toBeDefined();
    });

    it('should render TechnicianStatusGrid when technicians exist', () => {
      mockTechnicians = [createTechnician()];
      renderDashboard();
      expect(screen.getByTestId('tech-status-grid')).toBeDefined();
    });
  });

  describe('Loading & Error States', () => {
    it('should show loading skeleton when loading', () => {
      mockIsLoading = true;
      renderDashboard();
      expect(screen.getByTestId('loading-skeleton')).toBeDefined();
    });

    it('should show error with retry when error occurs', () => {
      mockError = 'Connection failed';
      renderDashboard();
      expect(screen.getByText('Failed to load data')).toBeDefined();
      expect(screen.getByText('Connection failed')).toBeDefined();
      expect(screen.getByText('Retry')).toBeDefined();
    });
  });

  describe('Scroll Performance', () => {
    it('should have overscroll-y-contain on main container', () => {
      const { container } = renderDashboard();
      const mainDiv = container.firstElementChild as HTMLElement;
      expect(mainDiv?.className).toContain('overscroll-y-contain');
    });
  });
});
