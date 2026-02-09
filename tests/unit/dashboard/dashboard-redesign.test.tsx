/**
 * Dashboard Redesign Tests
 *
 * TDD tests covering the 5 dashboard redesign requirements:
 * 1. Progress bar whole numbers (no decimals)
 * 2. Clickable/actionable progress bars
 * 3. Technician list - categorized, mobile-first
 * 4. Job status section - color-coded, actionable modals
 * 5. Completed job actions - archive/delete first, report when evidence complete
 *
 * Covers all roles: Manager, Solo Contractor, Technician
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { DataContext } from '../../../lib/DataContext';
import { Job, Technician, Client } from '../../../types';
import { isReportReady, canDeleteJob } from '../../../lib/statusHelpers';

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
    safetyChecklist: [],
    ...overrides,
  } as Job;
}

function createTechnician(overrides: Partial<Technician> = {}): Technician {
  return {
    id: `tech-${Math.random().toString(36).slice(2, 8)}`,
    name: 'Test Technician',
    email: 'tech@test.com',
    status: 'Available',
    rating: 4,
    jobsCompleted: 10,
    ...overrides,
  } as Technician;
}

function createClient(overrides: Partial<Client> = {}): Client {
  return {
    id: 'client-1',
    name: 'Test Client',
    email: 'client@test.com',
    address: '123 Test St',
    totalJobs: 5,
    ...overrides,
  } as Client;
}

function createJobWithFullEvidence(overrides: Partial<Job> = {}): Job {
  return createJob({
    status: 'Complete',
    photos: [
      { id: 'p1', url: 'photo1.jpg', type: 'before', verified: true, syncStatus: 'synced', timestamp: new Date().toISOString() },
      { id: 'p2', url: 'photo2.jpg', type: 'after', verified: true, syncStatus: 'synced', timestamp: new Date().toISOString() },
    ] as any,
    signature: 'data:image/png;base64,abc',
    clientConfirmation: {
      signature: 'data:image/png;base64,xyz',
      timestamp: new Date().toISOString(),
      confirmed: true,
    },
    ...overrides,
  });
}

// ============================================================================
// REQUIREMENT 1: PROGRESS BAR WHOLE NUMBERS
// ============================================================================

describe('Requirement 1: Progress Bar Whole Numbers', () => {
  describe('isReportReady (statusHelpers)', () => {
    it('returns false when no evidence exists', () => {
      const job = createJob({ status: 'Complete', photos: [], signature: null });
      expect(isReportReady(job)).toBe(false);
    });

    it('returns false when only before photo exists', () => {
      const job = createJob({
        status: 'Complete',
        photos: [{ id: 'p1', url: 'photo.jpg', type: 'before', verified: true, syncStatus: 'synced', timestamp: '' }] as any,
        signature: null,
      });
      expect(isReportReady(job)).toBe(false);
    });

    it('returns false when photos exist but no signature', () => {
      const job = createJob({
        status: 'Complete',
        photos: [
          { id: 'p1', url: 'photo1.jpg', type: 'before', verified: true, syncStatus: 'synced', timestamp: '' },
          { id: 'p2', url: 'photo2.jpg', type: 'after', verified: true, syncStatus: 'synced', timestamp: '' },
        ] as any,
        signature: null,
      });
      expect(isReportReady(job)).toBe(false);
    });

    it('returns false when photos and signature exist but no client confirmation', () => {
      const job = createJob({
        status: 'Complete',
        photos: [
          { id: 'p1', url: 'photo1.jpg', type: 'before', verified: true, syncStatus: 'synced', timestamp: '' },
          { id: 'p2', url: 'photo2.jpg', type: 'after', verified: true, syncStatus: 'synced', timestamp: '' },
        ] as any,
        signature: 'data:image/png;base64,abc',
      });
      expect(isReportReady(job)).toBe(false);
    });

    it('returns true when all 4 evidence requirements are met', () => {
      const job = createJobWithFullEvidence();
      expect(isReportReady(job)).toBe(true);
    });

    it('handles case-insensitive photo types', () => {
      const job = createJobWithFullEvidence({
        photos: [
          { id: 'p1', url: 'photo1.jpg', type: 'Before', verified: true, syncStatus: 'synced', timestamp: '' },
          { id: 'p2', url: 'photo2.jpg', type: 'After', verified: true, syncStatus: 'synced', timestamp: '' },
        ] as any,
      });
      expect(isReportReady(job)).toBe(true);
    });
  });

  describe('canDeleteJob (statusHelpers)', () => {
    it('returns true for a normal job', () => {
      const job = createJob({ status: 'Complete' });
      expect(canDeleteJob(job)).toBe(true);
    });

    it('returns false when sealedAt is present', () => {
      const job = createJob({ status: 'Complete', sealedAt: new Date().toISOString() });
      expect(canDeleteJob(job)).toBe(false);
    });

    it('returns false when invoiceId is present', () => {
      const job = createJob({ status: 'Complete', invoiceId: 'inv-123' });
      expect(canDeleteJob(job)).toBe(false);
    });

    it('returns false when both sealedAt and invoiceId are present', () => {
      const job = createJob({
        status: 'Complete',
        sealedAt: new Date().toISOString(),
        invoiceId: 'inv-123',
      });
      expect(canDeleteJob(job)).toBe(false);
    });
  });
});

// ============================================================================
// REQUIREMENT 2: CLICKABLE PROGRESS BARS
// ============================================================================

describe('Requirement 2: Clickable Progress Bars', () => {
  describe('ProofGapBar clickability', () => {
    it('renders as button when onClick is provided', async () => {
      const { default: ProofGapBar } = await import('../../../components/dashboard/ProofGapBar');
      const onClick = vi.fn();
      const jobs = [createJob({ status: 'In Progress' })];

      render(<ProofGapBar jobs={jobs} onClick={onClick} />);

      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
      fireEvent.click(button);
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('does not render as button when onClick is not provided', async () => {
      const { default: ProofGapBar } = await import('../../../components/dashboard/ProofGapBar');
      const jobs = [createJob({ status: 'In Progress' })];

      render(<ProofGapBar jobs={jobs} />);

      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('shows whole number percentage in aria label', async () => {
      const { default: ProofGapBar } = await import('../../../components/dashboard/ProofGapBar');
      const jobs = [
        createJobWithFullEvidence({ id: 'job-1' }),
        createJob({ id: 'job-2', status: 'In Progress' }),
        createJob({ id: 'job-3', status: 'Pending' }),
      ];

      render(<ProofGapBar jobs={jobs} />);

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toBeInTheDocument();
      // aria-valuenow should be a whole number
      const valueNow = progressBar.getAttribute('aria-valuenow');
      expect(Number(valueNow)).toBe(Math.floor(Number(valueNow)));
    });
  });

  describe('EvidenceProgressBar clickability', () => {
    it('calls onSegmentClick when a missing segment is clicked', async () => {
      const { default: EvidenceProgressBar } = await import('../../../components/dashboard/EvidenceProgressBar');
      const onSegmentClick = vi.fn();
      const job = createJob({ status: 'In Progress', photos: [], signature: null });

      render(<EvidenceProgressBar job={job} onSegmentClick={onSegmentClick} />);

      // Find the before photo segment and click it
      const beforeSegment = screen.getByLabelText(/before photo missing/i);
      fireEvent.click(beforeSegment);
      expect(onSegmentClick).toHaveBeenCalledWith('before');
    });

    it('does not call onSegmentClick for captured segments', async () => {
      const { default: EvidenceProgressBar } = await import('../../../components/dashboard/EvidenceProgressBar');
      const onSegmentClick = vi.fn();
      const job = createJob({
        status: 'In Progress',
        photos: [
          { id: 'p1', url: 'photo1.jpg', type: 'before', verified: true, syncStatus: 'synced', timestamp: '' },
        ] as any,
        signature: null,
      });

      render(<EvidenceProgressBar job={job} onSegmentClick={onSegmentClick} />);

      const capturedSegment = screen.getByLabelText(/before photo captured/i);
      fireEvent.click(capturedSegment);
      expect(onSegmentClick).not.toHaveBeenCalled();
    });

    it('shows whole numbers for evidence count', async () => {
      const { default: EvidenceProgressBar } = await import('../../../components/dashboard/EvidenceProgressBar');
      const job = createJob({
        status: 'In Progress',
        photos: [
          { id: 'p1', url: 'photo1.jpg', type: 'before', verified: true, syncStatus: 'synced', timestamp: '' },
        ] as any,
        signature: null,
      });

      const { container } = render(<EvidenceProgressBar job={job} />);
      // The count display should show "1 / 3" (whole numbers)
      expect(container.textContent).toContain('1 / 3');
      expect(container.textContent).not.toMatch(/\d+\.\d+/); // No decimals
    });
  });
});

// ============================================================================
// REQUIREMENT 3: TECHNICIAN LIST - CATEGORIZED, MOBILE-FIRST
// ============================================================================

describe('Requirement 3: Technician Status Grid', () => {
  it('renders technicians grouped by status category', async () => {
    const { default: TechnicianStatusGrid } = await import('../../../components/dashboard/TechnicianStatusGrid');
    const summaries = [
      { id: 'tech-1', name: 'Alice', status: 'working' as const, activeJobId: 'job-1', activeJobTitle: 'Fix Roof', jobsRemaining: 2, lastActivityAt: Date.now() },
      { id: 'tech-2', name: 'Bob', status: 'idle' as const, activeJobId: null, jobsRemaining: 3, lastActivityAt: Date.now() - 3600000 },
      { id: 'tech-3', name: 'Charlie', status: 'offline' as const, activeJobId: null, jobsRemaining: 0, lastActivityAt: Date.now() - 86400000 },
    ];

    render(
      <BrowserRouter>
        <TechnicianStatusGrid summaries={summaries} onTechnicianClick={vi.fn()} />
      </BrowserRouter>
    );

    expect(screen.getByText(/working/i)).toBeInTheDocument();
    expect(screen.getByText(/idle/i)).toBeInTheDocument();
    expect(screen.getByText(/offline/i)).toBeInTheDocument();
  });

  it('hides empty categories', async () => {
    const { default: TechnicianStatusGrid } = await import('../../../components/dashboard/TechnicianStatusGrid');
    const summaries = [
      { id: 'tech-1', name: 'Alice', status: 'working' as const, activeJobId: 'job-1', activeJobTitle: 'Fix Roof', jobsRemaining: 2, lastActivityAt: Date.now() },
    ];

    render(
      <BrowserRouter>
        <TechnicianStatusGrid summaries={summaries} onTechnicianClick={vi.fn()} />
      </BrowserRouter>
    );

    expect(screen.getByText(/working/i)).toBeInTheDocument();
    expect(screen.queryByText(/^idle$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^offline$/i)).not.toBeInTheDocument();
  });

  it('calls onTechnicianClick when a pill is clicked', async () => {
    const { default: TechnicianStatusGrid } = await import('../../../components/dashboard/TechnicianStatusGrid');
    const onClick = vi.fn();
    const summaries = [
      { id: 'tech-1', name: 'Alice', status: 'working' as const, activeJobId: 'job-1', activeJobTitle: 'Fix Roof', jobsRemaining: 2, lastActivityAt: Date.now() },
    ];

    render(
      <BrowserRouter>
        <TechnicianStatusGrid summaries={summaries} onTechnicianClick={onClick} />
      </BrowserRouter>
    );

    fireEvent.click(screen.getByText('Alice'));
    expect(onClick).toHaveBeenCalledWith('tech-1');
  });

  it('has minimum 44px touch targets on all pills', async () => {
    const { default: TechnicianStatusGrid } = await import('../../../components/dashboard/TechnicianStatusGrid');
    const summaries = [
      { id: 'tech-1', name: 'Alice', status: 'working' as const, activeJobId: 'job-1', activeJobTitle: 'Fix Roof', jobsRemaining: 2, lastActivityAt: Date.now() },
    ];

    const { container } = render(
      <BrowserRouter>
        <TechnicianStatusGrid summaries={summaries} onTechnicianClick={vi.fn()} />
      </BrowserRouter>
    );

    const buttons = container.querySelectorAll('button');
    buttons.forEach(button => {
      expect(button.className).toContain('min-h-[44px]');
    });
  });

  it('shows +N more when category exceeds 3 items', async () => {
    const { default: TechnicianStatusGrid } = await import('../../../components/dashboard/TechnicianStatusGrid');
    const summaries = [
      { id: 'tech-1', name: 'Alice', status: 'working' as const, activeJobId: 'j1', activeJobTitle: 'Job 1', jobsRemaining: 1, lastActivityAt: Date.now() },
      { id: 'tech-2', name: 'Bob', status: 'working' as const, activeJobId: 'j2', activeJobTitle: 'Job 2', jobsRemaining: 2, lastActivityAt: Date.now() },
      { id: 'tech-3', name: 'Charlie', status: 'working' as const, activeJobId: 'j3', activeJobTitle: 'Job 3', jobsRemaining: 0, lastActivityAt: Date.now() },
      { id: 'tech-4', name: 'Diana', status: 'working' as const, activeJobId: 'j4', activeJobTitle: 'Job 4', jobsRemaining: 1, lastActivityAt: Date.now() },
      { id: 'tech-5', name: 'Eve', status: 'working' as const, activeJobId: 'j5', activeJobTitle: 'Job 5', jobsRemaining: 3, lastActivityAt: Date.now() },
    ];

    render(
      <BrowserRouter>
        <TechnicianStatusGrid summaries={summaries} onTechnicianClick={vi.fn()} />
      </BrowserRouter>
    );

    expect(screen.getByText(/\+2 more/i)).toBeInTheDocument();
  });
});

// ============================================================================
// REQUIREMENT 4: JOB STATUS SECTION - COLOR-CODED, ACTIONABLE
// ============================================================================

describe('Requirement 4: Status Breakdown Modal', () => {
  it('renders with jobs grouped by the specified status', async () => {
    const { default: StatusBreakdownModal } = await import('../../../components/dashboard/StatusBreakdownModal');
    const jobs = [
      createJob({ id: 'job-1', title: 'Job Alpha', status: 'In Progress' }),
      createJob({ id: 'job-2', title: 'Job Beta', status: 'In Progress' }),
    ];

    render(
      <BrowserRouter>
        <StatusBreakdownModal
          isOpen={true}
          onClose={vi.fn()}
          status="In Progress"
          jobs={jobs}
          clients={[createClient()]}
          technicians={[]}
        />
      </BrowserRouter>
    );

    expect(screen.getByText('Job Alpha')).toBeInTheDocument();
    expect(screen.getByText('Job Beta')).toBeInTheDocument();
  });

  it('calls onClose when the close button is clicked', async () => {
    const { default: StatusBreakdownModal } = await import('../../../components/dashboard/StatusBreakdownModal');
    const onClose = vi.fn();

    render(
      <BrowserRouter>
        <StatusBreakdownModal
          isOpen={true}
          onClose={onClose}
          status="Pending"
          jobs={[createJob({ status: 'Pending' })]}
          clients={[createClient()]}
          technicians={[]}
        />
      </BrowserRouter>
    );

    fireEvent.click(screen.getByLabelText(/close/i));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not render when isOpen is false', async () => {
    const { default: StatusBreakdownModal } = await import('../../../components/dashboard/StatusBreakdownModal');

    render(
      <BrowserRouter>
        <StatusBreakdownModal
          isOpen={false}
          onClose={vi.fn()}
          status="Pending"
          jobs={[createJob({ status: 'Pending' })]}
          clients={[createClient()]}
          technicians={[]}
        />
      </BrowserRouter>
    );

    expect(screen.queryByText('Pending')).not.toBeInTheDocument();
  });

  it('shows correct action button per status type', async () => {
    const { default: StatusBreakdownModal } = await import('../../../components/dashboard/StatusBreakdownModal');

    // In Progress jobs should have "View" action button
    render(
      <BrowserRouter>
        <StatusBreakdownModal
          isOpen={true}
          onClose={vi.fn()}
          status="In Progress"
          jobs={[createJob({ id: 'j-1', status: 'In Progress' })]}
          clients={[createClient()]}
          technicians={[]}
        />
      </BrowserRouter>
    );

    // Find the action button within a job card (not the footer link)
    const actionLinks = screen.getAllByText(/view/i);
    expect(actionLinks.length).toBeGreaterThan(0);
    // The primary action link should exist with the correct text
    const primaryAction = actionLinks.find(el => el.closest('a[href*="jobs"]'));
    expect(primaryAction).toBeTruthy();
  });

  it('has 44px minimum touch targets for all interactive elements', async () => {
    const { default: StatusBreakdownModal } = await import('../../../components/dashboard/StatusBreakdownModal');

    const { container } = render(
      <BrowserRouter>
        <StatusBreakdownModal
          isOpen={true}
          onClose={vi.fn()}
          status="Pending"
          jobs={[createJob({ status: 'Pending' })]}
          clients={[createClient()]}
          technicians={[]}
        />
      </BrowserRouter>
    );

    const buttons = container.querySelectorAll('button');
    buttons.forEach(button => {
      expect(button.className).toContain('min-h-[44px]');
    });
  });
});

// ============================================================================
// REQUIREMENT 5: COMPLETED JOB DISPLAY - ACTIONS FIRST, REPORT CONDITIONAL
// ============================================================================

describe('Requirement 5: Completed Job Actions', () => {
  describe('isReportReady conditions', () => {
    it('requires all four evidence items for report readiness', () => {
      // Missing client confirmation
      const jobNoConfirm = createJob({
        status: 'Complete',
        photos: [
          { id: 'p1', url: 'photo1.jpg', type: 'before', verified: true, syncStatus: 'synced', timestamp: '' },
          { id: 'p2', url: 'photo2.jpg', type: 'after', verified: true, syncStatus: 'synced', timestamp: '' },
        ] as any,
        signature: 'sig',
      });
      expect(isReportReady(jobNoConfirm)).toBe(false);

      // All present
      const jobFull = createJobWithFullEvidence();
      expect(isReportReady(jobFull)).toBe(true);
    });
  });

  describe('canDeleteJob enforcement', () => {
    it('prevents deletion of sealed jobs', () => {
      const sealedJob = createJob({ sealedAt: '2026-01-01T00:00:00Z' });
      expect(canDeleteJob(sealedJob)).toBe(false);
    });

    it('prevents deletion of invoiced jobs', () => {
      const invoicedJob = createJob({ invoiceId: 'inv-1' });
      expect(canDeleteJob(invoicedJob)).toBe(false);
    });

    it('allows deletion of normal completed jobs', () => {
      const normalJob = createJob({ status: 'Complete' });
      expect(canDeleteJob(normalJob)).toBe(true);
    });
  });
});

// ============================================================================
// WHOLE NUMBER VALIDATION (cross-cutting)
// ============================================================================

describe('Whole Number Display Validation', () => {
  it('QuickWinsGrid does not render decimals in revenue values', async () => {
    const { default: QuickWinsGrid } = await import('../../../components/dashboard/QuickWinsGrid');

    const mockJobs = [
      createJob({ id: 'j1', status: 'Complete', invoiceId: undefined }),
      createJob({ id: 'j2', status: 'Complete', invoiceId: undefined }),
      createJob({ id: 'j3', status: 'In Progress' }),
    ];

    const contextValue = {
      jobs: mockJobs,
      technicians: [],
      clients: [],
      updateJob: vi.fn(),
      deleteJob: vi.fn(),
      addJob: vi.fn(),
      isLoading: false,
      error: null,
      refresh: vi.fn(),
    };

    const { container } = render(
      <BrowserRouter>
        <DataContext.Provider value={contextValue as any}>
          <QuickWinsGrid />
        </DataContext.Provider>
      </BrowserRouter>
    );

    // Get all text content from the rendered component
    const textContent = container.textContent || '';
    // Check that dollar amounts don't have decimals like "$2.5K"
    // They should be like "$3K" or "$5K"
    const dollarAmounts = textContent.match(/\$[\d.]+K/g) || [];
    dollarAmounts.forEach(amount => {
      // Amount should not contain a decimal point between digits
      expect(amount).not.toMatch(/\$\d+\.\d+K/);
    });
  });
});
