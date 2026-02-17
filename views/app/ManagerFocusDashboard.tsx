/**
 * ManagerFocusDashboard - Mission Control Center
 *
 * UX Contract: FOCUS / QUEUE / BACKGROUND (strict)
 * - ACTION TILES: Search, Assign, All Jobs — top-loaded immediately after header
 * - PROOF GAP BAR: "Are we defensible?" at a glance (~10%)
 * - JOB STATUS PILLS: Color-coded filter pills (Pending, Active, Awaiting, Closed)
 * - TECHNICIAN PULSE: Dynamic "X On-Site" — reactive, not hard-coded
 * - ATTENTION QUEUE: Only exceptions appear (idle, stuck, sync failed) (~30%)
 * - TECHNICIAN ROWS: Shows counts, not job lists (~40%)
 *
 * Primary questions: "Who's blocked?" / "Are we defensible?" / "Is crew on track?"
 */

import React, { useMemo, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { PageContent } from '../../components/layout';
import { Card, ActionButton, LoadingSkeleton, StatusRing, FocusStack, FocusJobRenderProps, QueueJobRenderProps, CollapsedJobRenderProps } from '../../components/ui';
import { ProofGapBar, TechnicianStatusGrid, StatusBreakdownModal } from '../../components/dashboard';
import { useData } from '../../lib/DataContext';
import { route, ROUTES } from '../../lib/routes';
import { Job, Client, Technician, TechnicianSummary, AttentionItem, JobStatus } from '../../types';
import { fadeInUp, staggerContainer } from '../../lib/animations';
import { useGlobalKeyboardShortcuts } from '../../hooks/useGlobalKeyboardShortcuts';
import QuickSearchModal from '../../components/modals/QuickSearchModal';
import QuickAssignModal from '../../components/modals/QuickAssignModal';

// ============================================================================
// JOB STATUS PILL CONFIG
// ============================================================================

interface JobPillConfig {
  key: string;
  label: string;
  icon: string;
  statuses: JobStatus[];
  color: {
    bg: string;
    border: string;
    text: string;
    activeBg: string;
    activeBorder: string;
    dot: string;
  };
}

const JOB_PILLS: JobPillConfig[] = [
  {
    key: 'pending',
    label: 'Pending',
    icon: 'schedule',
    statuses: ['Pending', 'Draft'],
    color: {
      bg: 'bg-blue-500/20',
      border: 'border-blue-500/20',
      text: 'text-blue-400',
      activeBg: 'bg-blue-500/25',
      activeBorder: 'border-blue-500/50',
      dot: 'bg-blue-500',
    },
  },
  {
    key: 'active',
    label: 'Active',
    icon: 'play_circle',
    statuses: ['In Progress'],
    color: {
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/20',
      text: 'text-amber-400',
      activeBg: 'bg-amber-500/25',
      activeBorder: 'border-amber-500/50',
      dot: 'bg-amber-500',
    },
  },
  {
    key: 'awaiting',
    label: 'Awaiting',
    icon: 'hourglass_top',
    statuses: ['Complete', 'Submitted'],
    color: {
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/20',
      text: 'text-amber-400',
      activeBg: 'bg-amber-500/25',
      activeBorder: 'border-amber-500/50',
      dot: 'bg-amber-500',
    },
  },
  {
    key: 'closed',
    label: 'Closed',
    icon: 'check_circle',
    statuses: ['Archived', 'Cancelled'],
    color: {
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20',
      text: 'text-emerald-400',
      activeBg: 'bg-emerald-500/25',
      activeBorder: 'border-emerald-500/50',
      dot: 'bg-emerald-500',
    },
  },
];

// ============================================================================
// ATTENTION DETECTION
// ============================================================================

const STUCK_THRESHOLD_MS = 2 * 60 * 60 * 1000; // 2 hours on same job

function generateAttentionItems(
  technicians: Technician[],
  jobs: Job[],
  now: number
): AttentionItem[] {
  const items: AttentionItem[] = [];

  technicians.forEach(tech => {
    const techJobs = jobs.filter(j =>
      j.technicianId === tech.id || j.techId === tech.id
    );

    const activeJob = techJobs.find(j => j.status === 'In Progress');
    const pendingJobs = techJobs.filter(j =>
      j.status !== 'Complete' &&
      j.status !== 'Submitted' &&
      j.status !== 'Archived' &&
      j.status !== 'Cancelled'
    );

    // Check for idle technician (no in-progress job, but has pending work)
    if (!activeJob && pendingJobs.length > 0) {
      items.push({
        id: `idle-${tech.id}`,
        type: 'idle_technician',
        technicianId: tech.id,
        technicianName: tech.name,
        message: `${pendingJobs.length} job${pendingJobs.length !== 1 ? 's' : ''} pending`,
        severity: 'warning',
        timestamp: now,
      });
    }

    // Check for stuck job (In Progress for too long)
    if (activeJob) {
      const jobAge = now - (activeJob.lastUpdated || 0);
      if (jobAge > STUCK_THRESHOLD_MS) {
        items.push({
          id: `stuck-${activeJob.id}`,
          type: 'stuck_job',
          technicianId: tech.id,
          technicianName: tech.name,
          jobId: activeJob.id,
          jobTitle: activeJob.title || `Job #${activeJob.id.slice(0, 6)}`,
          message: `In progress for ${Math.round(jobAge / (60 * 60 * 1000))}h`,
          severity: 'warning',
          timestamp: now,
        });
      }
    }

    // Check for sync failures
    const failedJobs = techJobs.filter(j => j.syncStatus === 'failed');
    if (failedJobs.length > 0) {
      items.push({
        id: `sync-${tech.id}`,
        type: 'sync_failed',
        technicianId: tech.id,
        technicianName: tech.name,
        message: `${failedJobs.length} job${failedJobs.length !== 1 ? 's' : ''} failed to sync`,
        severity: 'critical',
        timestamp: now,
      });
    }
  });

  // Check for urgent jobs without assignment
  const urgentUnassigned = jobs.filter(j =>
    j.priority === 'urgent' &&
    !j.technicianId &&
    !j.techId &&
    j.status !== 'Complete' &&
    j.status !== 'Submitted'
  );

  urgentUnassigned.forEach(job => {
    items.push({
      id: `urgent-${job.id}`,
      type: 'urgent_job',
      jobId: job.id,
      jobTitle: job.title || `Job #${job.id.slice(0, 6)}`,
      message: 'Urgent job needs assignment',
      severity: 'critical',
      timestamp: now,
    });
  });

  // Sort by severity (critical first), then by timestamp (newest first)
  return items.sort((a, b) => {
    if (a.severity === 'critical' && b.severity !== 'critical') return -1;
    if (b.severity === 'critical' && a.severity !== 'critical') return 1;
    return b.timestamp - a.timestamp;
  });
}

function createTechnicianSummaries(
  technicians: Technician[],
  jobs: Job[],
): TechnicianSummary[] {
  return technicians.map(tech => {
    const techJobs = jobs.filter(j =>
      j.technicianId === tech.id || j.techId === tech.id
    );

    const activeJob = techJobs.find(j => j.status === 'In Progress');
    const pendingJobs = techJobs.filter(j =>
      j.status !== 'Complete' &&
      j.status !== 'Submitted' &&
      j.status !== 'Archived' &&
      j.status !== 'Cancelled' &&
      j.id !== activeJob?.id
    );

    let status: 'working' | 'idle' | 'offline' = 'idle';
    if (activeJob) {
      status = 'working';
    }

    return {
      id: tech.id,
      name: tech.name,
      activeJobId: activeJob?.id || null,
      activeJobTitle: activeJob?.title || (activeJob ? `Job #${activeJob.id.slice(0, 6)}` : undefined),
      jobsRemaining: pendingJobs.length,
      lastActivityAt: activeJob?.lastUpdated || 0,
      status,
    };
  });
}

// ============================================================================
// TECHNICIAN DRILL-DOWN COMPONENT
// ============================================================================

interface TechnicianDrillDownProps {
  technician: Technician;
  jobs: Job[];
  clients: Client[];
  onClose: () => void;
}

const TechnicianDrillDown: React.FC<TechnicianDrillDownProps> = ({
  technician,
  jobs,
  clients,
  onClose,
}) => {
  const techJobs = useMemo(() =>
    jobs.filter(j => j.technicianId === technician.id || j.techId === technician.id),
    [jobs, technician.id]
  );

  const focusJobId = useMemo(() => {
    const activeJob = techJobs.find(j => j.status === 'In Progress');
    return activeJob?.id || null;
  }, [techJobs]);

  const sortQueueJobs = useCallback((queueJobs: Job[]) => {
    return [...queueJobs].sort((a, b) => {
      const aDate = new Date(a.date).getTime();
      const bDate = new Date(b.date).getTime();
      if (aDate !== bDate) return aDate - bDate;
      return (b.lastUpdated || 0) - (a.lastUpdated || 0);
    });
  }, []);

  const renderFocusJob = useCallback(({ job, client }: FocusJobRenderProps) => (
    <Link to={route(ROUTES.JOB_DETAIL, { id: job.id })}>
      <Card className="bg-primary/5 dark:bg-primary/20 border-primary/30">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-primary/20 flex items-center justify-center">
            <span className="material-symbols-outlined text-primary">play_arrow</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-primary">Active</p>
            <p className="font-medium text-slate-900 dark:text-white truncate">
              {job.title || `Job #${job.id.slice(0, 6)}`}
            </p>
            <p className="text-sm text-slate-400 truncate">{client?.name}</p>
          </div>
        </div>
      </Card>
    </Link>
  ), []);

  const renderQueueJob = useCallback(({ job, client, position }: QueueJobRenderProps) => (
    <Link to={route(ROUTES.JOB_DETAIL, { id: job.id })}>
      <Card variant="interactive" padding="sm">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-slate-400">{position}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
              {job.title || `Job #${job.id.slice(0, 6)}`}
            </p>
            <p className="text-xs text-slate-400 truncate">{client?.name}</p>
          </div>
        </div>
      </Card>
    </Link>
  ), []);

  const renderCollapsedJob = useCallback(({ job, client }: CollapsedJobRenderProps) => (
    <Link
      to={route(ROUTES.JOB_DETAIL, { id: job.id })}
      className="block py-1.5 px-2 text-sm text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
    >
      {job.title || `Job #${job.id.slice(0, 6)}`}
      <span className="mx-1.5 opacity-50">•</span>
      {client?.name || 'Unknown'}
    </Link>
  ), []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`${technician.name} job details`}
      onClick={onClose}
      onKeyDown={(e) => { if (e.key === 'Escape') { onClose(); } }}
      tabIndex={0}
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        className="bg-white dark:bg-slate-800 border border-white/20 rounded-2xl w-full max-w-lg max-h-[80vh] overflow-hidden"
        role="presentation"
        onClick={e => e.stopPropagation()}
        onKeyDown={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-white/20">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-primary/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-primary">engineering</span>
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white">{technician.name}</h3>
              <p className="text-sm text-slate-400">{techJobs.length} total jobs</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="size-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center min-h-[44px]"
          >
            <span className="material-symbols-outlined text-slate-400">close</span>
          </button>
        </div>

        {/* Content - Focus Stack */}
        <div className="p-4 overflow-y-auto max-h-[60vh]" style={{ WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}>
          <FocusStack
            jobs={techJobs}
            clients={clients}
            focusJobId={focusJobId}
            renderFocusJob={renderFocusJob}
            renderQueueJob={renderQueueJob}
            renderCollapsedJob={renderCollapsedJob}
            onContinueFocusJob={() => {}}
            maxQueueSize={3}
            sortQueue={sortQueueJobs}
            emptyState={
              <div className="text-center py-8 text-slate-400">
                <span className="material-symbols-outlined text-3xl mb-2">work_off</span>
                <p>No active jobs</p>
              </div>
            }
          />
        </div>
      </motion.div>
    </motion.div>
  );
};

// ============================================================================
// ON-SITE TECHNICIAN PULSE MODAL
// ============================================================================

interface TechPulseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSiteTechs: Array<{ tech: Technician; activeJob: Job; isOvertime: boolean }>;
}

const TechPulseModal: React.FC<TechPulseModalProps> = ({ isOpen, onClose, onSiteTechs }) => {
  if (!isOpen) return null;
  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="On-site technicians"
      onClick={onClose}
      onKeyDown={(e) => { if (e.key === 'Escape') { onClose(); } }}
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
      tabIndex={0}
    >
      <div
        className="bg-white dark:bg-slate-800 border border-white/20 rounded-2xl w-full max-w-md max-h-[80vh] overflow-hidden"
        role="presentation"
        onClick={e => e.stopPropagation()}
        onKeyDown={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-white/20">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-emerald-400">location_on</span>
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white">On-Site Technicians</h3>
              <p className="text-sm text-slate-400">{onSiteTechs.length} currently working</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="size-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center min-h-[44px]"
          >
            <span className="material-symbols-outlined text-slate-400">close</span>
          </button>
        </div>
        <div className="p-4 overflow-y-auto max-h-[60vh] space-y-2" style={{ WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}>
          {onSiteTechs.map(({ tech, activeJob, isOvertime }) => (
            <div
              key={tech.id}
              className={`flex items-center gap-3 p-3 rounded-xl border-2 ${
                isOvertime
                  ? 'border-amber-500/30 bg-amber-500/5'
                  : 'border-slate-200 dark:border-white/20 bg-slate-50 dark:bg-slate-800'
              }`}
            >
              <div className="size-10 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-emerald-400">engineering</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-900 dark:text-white truncate">{tech.name}</p>
                <p className="text-xs text-slate-400 truncate">
                  {activeJob.title || `Job #${activeJob.id.slice(0, 6)}`}
                </p>
                {isOvertime && (
                  <p className="text-xs text-amber-400 font-medium mt-0.5">
                    <span className="material-symbols-outlined text-xs align-middle mr-0.5">warning</span>
                    Exceeding estimated time
                  </p>
                )}
              </div>
              {tech.phone && (
                <a
                  href={`tel:${tech.phone}`}
                  className="size-10 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0 min-h-[44px] hover:bg-emerald-500/30 transition-colors"
                  aria-label={`Call ${tech.name}`}
                >
                  <span className="material-symbols-outlined text-emerald-400">call</span>
                </a>
              )}
            </div>
          ))}
          {onSiteTechs.length === 0 && (
            <div className="text-center py-8 text-slate-400">
              <span className="material-symbols-outlined text-3xl mb-2">person_off</span>
              <p className="text-sm">No technicians currently on-site</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const ManagerFocusDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { jobs, clients, technicians, updateJob, deleteJob, isLoading, error, refresh } = useData();
  const [selectedTechnician, setSelectedTechnician] = useState<Technician | null>(null);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedJobForAssign, setSelectedJobForAssign] = useState<Job | null>(null);
  const [statusModalStatus, setStatusModalStatus] = useState<JobStatus | null>(null);
  const [activePillFilter, setActivePillFilter] = useState<string | null>(null);
  const [isTechPulseOpen, setIsTechPulseOpen] = useState(false);

  useGlobalKeyboardShortcuts({
    onSearch: () => setIsSearchModalOpen(true),
    onAssign: () => {
      setSelectedJobForAssign(null);
      setIsAssignModalOpen(true);
    },
    disabled: false,
  });

  const now = Date.now();

  // Generate attention items and technician summaries
  const { attentionItems, technicianSummaries } = useMemo(() => {
    return {
      attentionItems: generateAttentionItems(technicians, jobs, now),
      technicianSummaries: createTechnicianSummaries(technicians, jobs),
    };
  }, [technicians, jobs, now]);

  // Reactive metrics - all computed from data, no hard-coded values
  const metrics = useMemo(() => {
    const onSiteTechs = technicians.filter(tech => {
      const techJobs = jobs.filter(j =>
        (j.technicianId === tech.id || j.techId === tech.id) && j.status === 'In Progress'
      );
      return techJobs.length > 0;
    }).length;

    const failedSyncs = jobs.filter(j => j.syncStatus === 'failed').length;
    const overdueJobs = jobs.filter(j => {
      if (j.status !== 'In Progress') return false;
      const age = now - (j.lastUpdated || 0);
      return age > STUCK_THRESHOLD_MS;
    }).length;

    const hasIssues = failedSyncs > 0 || overdueJobs > 0;

    const completedJobs = jobs.filter(j =>
      ['Complete', 'Submitted', 'Archived'].includes(j.status)
    ).length;
    const activeJobs = jobs.filter(j => j.status === 'In Progress').length;
    const pendingJobs = jobs.filter(j =>
      ['Pending', 'Draft'].includes(j.status)
    ).length;

    // Dispatched: jobs with a magic link sent but tech hasn't started work yet
    const dispatchedJobs = jobs.filter(j =>
      j.magicLinkUrl && ['Pending', 'Draft'].includes(j.status)
    ).length;

    // Needs link: jobs with a technician assigned but no link generated yet
    const needsLink = jobs.filter(j =>
      (j.technicianId || j.techId) && !j.magicLinkUrl && ['Pending', 'Draft'].includes(j.status)
    ).length;

    return { onSiteTechs, failedSyncs, overdueJobs, hasIssues, completedJobs, activeJobs, pendingJobs, dispatchedJobs, needsLink };
  }, [technicians, jobs, now]);

  // On-site technicians with job details for pulse modal
  const onSiteTechDetails = useMemo(() => {
    return technicians
      .map(tech => {
        const activeJob = jobs.find(j =>
          (j.technicianId === tech.id || j.techId === tech.id) && j.status === 'In Progress'
        );
        if (!activeJob) return null;
        const age = now - (activeJob.lastUpdated || 0);
        const isOvertime = age > STUCK_THRESHOLD_MS * 0.6; // 20% over estimated (using 60% of 2hr = ~72min as proxy)
        return { tech, activeJob, isOvertime };
      })
      .filter(Boolean) as Array<{ tech: Technician; activeJob: Job; isOvertime: boolean }>;
  }, [technicians, jobs, now]);

  // Job counts per pill category
  const pillCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    JOB_PILLS.forEach(pill => {
      counts[pill.key] = jobs.filter(j => pill.statuses.includes(j.status)).length;
    });
    return counts;
  }, [jobs]);

  // Filtered jobs when a pill is active
  const filteredJobs = useMemo(() => {
    if (!activePillFilter) return null;
    const pill = JOB_PILLS.find(p => p.key === activePillFilter);
    if (!pill) return null;
    return jobs.filter(j => pill.statuses.includes(j.status));
  }, [jobs, activePillFilter]);

  // Loading state
  if (isLoading) {
    return (
      <div className="px-4 lg:px-8 py-8">
        <LoadingSkeleton variant="card" count={3} />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <PageContent>
        <Card className="text-center py-8">
          <span className="material-symbols-outlined text-4xl text-red-400 mb-4">error</span>
          <p className="text-white font-medium mb-2">Failed to load data</p>
          <p className="text-slate-400 text-sm mb-4">{error}</p>
          <ActionButton variant="secondary" onClick={refresh} icon="refresh">
            Retry
          </ActionButton>
        </Card>
      </PageContent>
    );
  }

  return (
    <div className="overscroll-y-contain" style={{ WebkitOverflowScrolling: 'touch' }}>
      {/* Header with clickable status chips */}
      <div className="px-4 lg:px-8 py-4 border-b border-slate-200 dark:border-white/15 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <StatusRing
            totalJobs={jobs.length}
            completedJobs={metrics.completedJobs}
            activeJobs={metrics.activeJobs}
            pendingJobs={metrics.pendingJobs}
            className="hidden sm:inline-flex"
          />
          <h1 className="text-lg font-bold text-white">Mission Control</h1>
          {/* Desktop status chips */}
          <div className="hidden sm:flex items-center gap-2 text-xs">
            <button
              onClick={() => setIsTechPulseOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 transition-colors min-h-[32px]"
            >
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-bold">{metrics.onSiteTechs}</span> on-site
            </button>
            {metrics.dispatchedJobs > 0 && (
              <span className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-500/15 text-blue-400">
                <span className="material-symbols-outlined text-xs">send</span>
                <span className="font-bold">{metrics.dispatchedJobs}</span> dispatched
              </span>
            )}
            {metrics.needsLink > 0 && (
              <span className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/15 text-amber-400">
                <span className="material-symbols-outlined text-xs">link</span>
                <span className="font-bold">{metrics.needsLink}</span> need{metrics.needsLink !== 1 ? '' : 's'} link
              </span>
            )}
            {metrics.hasIssues ? (
              <span className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-500/15 text-red-400">
                <span className="material-symbols-outlined text-xs">warning</span>
                <span className="font-bold">{metrics.failedSyncs + metrics.overdueJobs}</span> issue{metrics.failedSyncs + metrics.overdueJobs !== 1 ? 's' : ''}
              </span>
            ) : metrics.dispatchedJobs === 0 && metrics.needsLink === 0 && (
              <span className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400/80">
                <span className="material-symbols-outlined text-xs">check_circle</span>
                All Clear
              </span>
            )}
          </div>
        </div>
        <ActionButton variant="primary" icon="add" to={ROUTES.JOB_CREATE}>
          New Job
        </ActionButton>
      </div>

      <PageContent>
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="space-y-6"
        >
          {/* TOP-LOADED ACTION TILES — Search, Assign, All Jobs */}
          <motion.section variants={fadeInUp}>
            <h2 className="text-sm font-semibold text-slate-600 dark:text-slate-300 tracking-wide mb-3">Quick Actions</h2>
            <div className="grid grid-cols-4 gap-3">
              <button
                onClick={() => setIsSearchModalOpen(true)}
                className="min-h-[56px] px-3 py-2 bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white text-sm font-semibold rounded-xl border-2 border-slate-600 hover:border-slate-600 transition-all flex flex-col items-center justify-center gap-1 focus:outline-none focus:ring-2 focus:ring-primary"
                aria-label="Search jobs (Ctrl+K)"
              >
                <span className="material-symbols-outlined text-lg text-slate-400">search</span>
                <span className="text-xs">Search</span>
              </button>
              <button
                onClick={() => {
                  setSelectedJobForAssign(null);
                  setIsAssignModalOpen(true);
                }}
                className="min-h-[56px] px-3 py-2 bg-primary/20 hover:bg-primary/30 text-primary text-sm font-semibold rounded-xl border-2 border-primary/30 hover:border-primary/50 transition-all flex flex-col items-center justify-center gap-1 focus:outline-none focus:ring-2 focus:ring-primary"
                aria-label="Assign technician (Ctrl+A)"
              >
                <span className="material-symbols-outlined text-lg">person_add</span>
                <span className="text-xs">Assign</span>
              </button>
              <Link
                to={ROUTES.JOBS}
                className="min-h-[56px] px-3 py-2 bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white text-sm font-semibold rounded-xl border-2 border-slate-600 hover:border-slate-600 transition-all flex flex-col items-center justify-center gap-1 focus:outline-none focus:ring-2 focus:ring-primary"
                aria-label="View all jobs"
              >
                <span className="material-symbols-outlined text-lg text-slate-400">list_alt</span>
                <span className="text-xs">All Jobs</span>
              </Link>
              <Link
                to={ROUTES.JOB_CREATE}
                className="min-h-[56px] px-3 py-2 bg-primary/15 hover:bg-primary/25 text-primary text-sm font-semibold rounded-xl border-2 border-primary/30 hover:border-primary/50 transition-all flex flex-col items-center justify-center gap-1 focus:outline-none focus:ring-2 focus:ring-primary sm:hidden"
                aria-label="Create new job"
              >
                <span className="material-symbols-outlined text-lg">add_circle</span>
                <span className="text-xs">New Job</span>
              </Link>
            </div>
          </motion.section>

          {/* PROOF GAP BAR - "Are we defensible?" */}
          <motion.section variants={fadeInUp}>
            <ProofGapBar
              jobs={jobs}
              onClick={() => navigate(`${ROUTES.JOBS}?filter=needs_proof`)}
            />
          </motion.section>

          {/* JOB STATUS PILLS - Color-coded filter system */}
          <motion.section variants={fadeInUp}>
            <div className="border-b border-slate-200 dark:border-white/15 pb-4 mb-6">
              <h2 className="text-sm font-semibold text-slate-600 dark:text-slate-300 tracking-wide">Job Status</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {JOB_PILLS.map(pill => {
                const count = pillCounts[pill.key] || 0;
                const isActive = activePillFilter === pill.key;
                return (
                  <button
                    key={pill.key}
                    onClick={() => setActivePillFilter(isActive ? null : pill.key)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 transition-all min-h-[44px] focus:outline-none focus:ring-2 focus:ring-primary ${
                      isActive
                        ? `${pill.color.activeBg} ${pill.color.activeBorder} ${pill.color.text}`
                        : `${pill.color.bg} ${pill.color.border} ${pill.color.text} hover:${pill.color.activeBg}`
                    }`}
                    aria-pressed={isActive}
                    aria-label={`${pill.label}: ${count} jobs`}
                  >
                    <span className={`size-2 rounded-full ${pill.color.dot}`} />
                    <span className="text-sm font-bold tabular-nums">{count}</span>
                    <span className="text-sm">{pill.label}</span>
                    <span className={`material-symbols-outlined text-xs ${pill.color.text}`}>{pill.icon}</span>
                  </button>
                );
              })}
            </div>

            {/* Filtered job list when a pill is active */}
            <AnimatePresence>
              {filteredJobs && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-3 overflow-hidden"
                >
                  <div
                    className="space-y-1 max-h-[300px] overflow-y-auto rounded-xl"
                    style={{ WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain', willChange: 'transform' }}
                  >
                    {filteredJobs.slice(0, 10).map(job => {
                      const client = clients.find(c => c.id === job.clientId);
                      return (
                        <Link
                          key={job.id}
                          to={route(ROUTES.JOB_DETAIL, { id: job.id })}
                          className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700/50 border border-slate-200 dark:border-white/15 transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                              {job.title || `Job #${job.id.slice(0, 6)}`}
                            </p>
                            <p className="text-xs text-slate-400 truncate">
                              {client?.name || 'No client'} · {job.status}
                            </p>
                          </div>
                          <span className="material-symbols-outlined text-slate-400 shrink-0 text-sm">chevron_right</span>
                        </Link>
                      );
                    })}
                    {filteredJobs.length > 10 && (
                      <Link
                        to={ROUTES.JOBS}
                        className="block text-center py-2 text-sm text-primary hover:text-primary/80 transition-colors"
                      >
                        View all {filteredJobs.length} jobs
                      </Link>
                    )}
                    {filteredJobs.length === 0 && (
                      <div className="text-center py-4 text-slate-400 text-sm">
                        No jobs in this category
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.section>

          {/* MOBILE TECHNICIAN PULSE — Visible only on small screens */}
          <motion.section variants={fadeInUp} className="sm:hidden">
            <div className={`grid gap-2 ${metrics.dispatchedJobs > 0 ? 'grid-cols-3' : 'grid-cols-2'}`}>
              <button
                onClick={() => setIsTechPulseOpen(true)}
                className="flex flex-col items-center gap-1 p-3 rounded-xl bg-emerald-500/10 border-2 border-emerald-500/20 min-h-[56px]"
              >
                <span className="text-lg font-bold text-emerald-400">{metrics.onSiteTechs}</span>
                <span className="text-xs text-emerald-400/80">On-Site</span>
              </button>
              {metrics.dispatchedJobs > 0 && (
                <div className="flex flex-col items-center gap-1 p-3 rounded-xl bg-blue-500/10 border-2 border-blue-500/20 min-h-[56px]">
                  <span className="text-lg font-bold text-blue-400">{metrics.dispatchedJobs}</span>
                  <span className="text-xs text-blue-400/80">Dispatched</span>
                </div>
              )}
              {metrics.hasIssues ? (
                <div className="flex flex-col items-center gap-1 p-3 rounded-xl bg-red-500/10 border-2 border-red-500/20 min-h-[56px]">
                  <span className="text-lg font-bold text-red-400">{metrics.failedSyncs + metrics.overdueJobs}</span>
                  <span className="text-xs text-red-400/80">Issues</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1 p-3 rounded-xl bg-emerald-500/10 border-2 border-emerald-500/20 min-h-[56px]">
                  <span className="material-symbols-outlined text-lg text-emerald-400">check_circle</span>
                  <span className="text-xs text-emerald-400/80">All Clear</span>
                </div>
              )}
            </div>
          </motion.section>

          {/* ATTENTION QUEUE - Critical exceptions only — hidden when no issues */}
          {attentionItems.length > 0 && (
            <motion.section variants={fadeInUp}>
              <div className="flex items-center gap-3 mb-4 border-b border-slate-200 dark:border-white/15 pb-4">
                <div className="size-8 rounded-xl bg-red-500/20 flex items-center justify-center">
                  <span className="material-symbols-outlined text-red-400">priority_high</span>
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-slate-600 dark:text-slate-300 tracking-wide">Needs Attention</h2>
                  <p className="text-xs text-slate-300">
                    {attentionItems.length} item{attentionItems.length !== 1 ? 's' : ''} requiring action
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                {attentionItems.slice(0, 5).map(item => (
                  <Card
                    key={item.id}
                    variant="interactive"
                    className={item.severity === 'critical' ? 'border-red-500/30' : 'border-amber-500/30'}
                    onClick={() => {
                      if (item.technicianId) {
                        const tech = technicians.find(t => t.id === item.technicianId);
                        if (tech) setSelectedTechnician(tech);
                      }
                    }}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`size-10 rounded-xl flex items-center justify-center shrink-0 ${
                        item.severity === 'critical'
                          ? 'bg-red-500/20 text-red-400'
                          : 'bg-amber-500/20 text-amber-400'
                      }`}>
                        <span className="material-symbols-outlined text-lg">
                          {item.type === 'idle_technician' ? 'person_off' :
                           item.type === 'stuck_job' ? 'schedule' :
                           item.type === 'sync_failed' ? 'sync_problem' :
                           item.type === 'urgent_job' ? 'bolt' : 'warning'}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-900 dark:text-white truncate">
                          {item.technicianName || item.jobTitle}
                        </p>
                        <p className="text-sm text-slate-400 truncate">{item.message}</p>
                      </div>
                      <span className="material-symbols-outlined text-slate-400 shrink-0">chevron_right</span>
                    </div>
                  </Card>
                ))}
              </div>
            </motion.section>
          )}

          {/* TECHNICIAN STATUS GRID - Categorized, mobile-first */}
          <motion.section variants={fadeInUp}>
            <div className="flex items-center gap-3 mb-4 border-b border-slate-200 dark:border-white/15 pb-4">
              <div className="size-8 rounded-xl bg-primary/20 flex items-center justify-center">
                <span className="material-symbols-outlined text-primary">group</span>
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-600 dark:text-slate-300 tracking-wide">Technicians</h2>
                <p className="text-xs text-slate-300">
                  {technicians.length} team member{technicians.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>

            {technicians.length === 0 ? (
              <Card className="text-center py-8">
                <span className="material-symbols-outlined text-3xl text-slate-400 mb-2">group_off</span>
                <p className="text-slate-400 text-sm mb-4">No technicians yet</p>
                <ActionButton variant="secondary" to={ROUTES.TECHNICIAN_NEW} icon="person_add">
                  Add Technician
                </ActionButton>
              </Card>
            ) : (
              <TechnicianStatusGrid
                summaries={technicianSummaries}
                onTechnicianClick={(techId) => {
                  const tech = technicians.find(t => t.id === techId);
                  if (tech) setSelectedTechnician(tech);
                }}
              />
            )}
          </motion.section>

          {/* READY STATE — Only shown when no attention items and techs exist */}
          {attentionItems.length === 0 && technicians.length > 0 && (
            <motion.section variants={fadeInUp}>
              <Card className="text-center py-6">
                <div className="size-12 rounded-2xl bg-emerald-500/20 flex items-center justify-center mx-auto mb-3">
                  <span className="material-symbols-outlined text-2xl text-emerald-400">check_circle</span>
                </div>
                <h3 className="text-base font-bold text-white mb-1">Ready for Dispatch</h3>
                <p className="text-slate-400 text-sm">
                  {metrics.onSiteTechs > 0
                    ? `${metrics.onSiteTechs} technician${metrics.onSiteTechs !== 1 ? 's' : ''} on-site. No issues detected.`
                    : 'All technicians available. No issues detected.'
                  }
                </p>
              </Card>
            </motion.section>
          )}
        </motion.div>
      </PageContent>

      {/* Modals */}
      <QuickSearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
      />
      <QuickAssignModal
        isOpen={isAssignModalOpen}
        jobId={selectedJobForAssign?.id}
        onClose={() => {
          setIsAssignModalOpen(false);
          setSelectedJobForAssign(null);
        }}
        onSuccess={() => {
          refresh();
        }}
      />

      {/* Status Breakdown Modal - color-coded drill-down per status */}
      <StatusBreakdownModal
        isOpen={!!statusModalStatus}
        onClose={() => setStatusModalStatus(null)}
        status={statusModalStatus || 'Pending'}
        jobs={jobs}
        clients={clients}
        technicians={technicians}
        onAssignJob={(jobId) => {
          setStatusModalStatus(null);
          const job = jobs.find(j => j.id === jobId);
          if (job) setSelectedJobForAssign(job);
          setIsAssignModalOpen(true);
        }}
        onArchiveJob={(jobId) => {
          const job = jobs.find(j => j.id === jobId);
          if (job) {
            updateJob({ ...job, status: 'Archived', archivedAt: new Date().toISOString(), isArchived: true });
          }
        }}
        onDeleteJob={(jobId) => {
          deleteJob(jobId);
        }}
      />

      {/* Technician Pulse Modal */}
      <TechPulseModal
        isOpen={isTechPulseOpen}
        onClose={() => setIsTechPulseOpen(false)}
        onSiteTechs={onSiteTechDetails}
      />

      {/* Technician Drill-Down Modal */}
      <AnimatePresence>
        {selectedTechnician && (
          <TechnicianDrillDown
            technician={selectedTechnician}
            jobs={jobs}
            clients={clients}
            onClose={() => setSelectedTechnician(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default ManagerFocusDashboard;
