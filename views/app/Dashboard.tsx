/**
 * Dashboard - Risk-Radar Field-First Dashboard
 *
 * A body-cam-style dashboard focused on evidence defensibility.
 * Jobs are risk containers. The app is a silent witness.
 *
 * Three states only:
 * 1. Needs Proof (red) - Missing evidence, financial/legal risk
 * 2. In Progress (amber) - Active work, time risk
 * 3. Defensible (green) - Has minimum evidence, protected
 *
 * Design principles:
 * - One primary action: "Continue Current Job"
 * - Jobs sorted by risk, not date
 * - Shield indicator for defensibility (silent, binary)
 * - Zero cognitive load, zero training required
 * - Field-first, not manager-first
 */

import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { PageContent } from '../../components/layout';
import { Card, ActionButton, EmptyState, LoadingSkeleton } from '../../components/ui';
import { useData } from '../../lib/DataContext';
import { route, ROUTES } from '../../lib/routes';
import { staggerContainer, fadeInUp } from '../../lib/animations';
import type { Job } from '../../types';

// ============================================================================
// DEFENSIBILITY LOGIC
// ============================================================================

type RiskLevel = 'needs_proof' | 'in_progress' | 'defensible';

interface JobRisk {
  job: Job;
  level: RiskLevel;
  issues: string[];
  isDefensible: boolean;
}

/**
 * Calculate if a job has minimum evidence for defensibility.
 *
 * Minimum evidence requirements:
 * - At least 1 photo
 * - Signature captured
 * - Signer name provided
 *
 * This is NOT the same as seal-ready (which requires Submitted status).
 * A job can be defensible while still in progress.
 */
const calculateJobRisk = (job: Job): JobRisk => {
  const issues: string[] = [];

  // Check photos
  const hasPhotos = job.photos && job.photos.length > 0;
  if (!hasPhotos) {
    issues.push('No photos');
  }

  // Check signature
  const hasSignature = !!job.signature;
  if (!hasSignature) {
    issues.push('No signature');
  }

  // Check signer name
  const hasSignerName = !!job.signerName && job.signerName.trim() !== '';
  if (!hasSignerName && hasSignature) {
    issues.push('Missing signer name');
  }

  // Determine risk level
  const isDefensible = hasPhotos && hasSignature && hasSignerName;

  // Already sealed = fully defensible
  if (job.sealedAt) {
    return {
      job,
      level: 'defensible',
      issues: [],
      isDefensible: true,
    };
  }

  // In progress with some evidence
  if (job.status === 'In Progress') {
    return {
      job,
      level: isDefensible ? 'defensible' : 'in_progress',
      issues,
      isDefensible,
    };
  }

  // Complete or Submitted with full evidence
  if ((job.status === 'Complete' || job.status === 'Submitted') && isDefensible) {
    return {
      job,
      level: 'defensible',
      issues: [],
      isDefensible: true,
    };
  }

  // Any job missing evidence
  if (!isDefensible) {
    return {
      job,
      level: 'needs_proof',
      issues,
      isDefensible: false,
    };
  }

  return {
    job,
    level: 'defensible',
    issues: [],
    isDefensible: true,
  };
};

/**
 * Sort jobs by risk level (highest risk first)
 * Within each level, sort by date (most recent first)
 */
const sortByRisk = (jobs: JobRisk[]): JobRisk[] => {
  const riskOrder: Record<RiskLevel, number> = {
    needs_proof: 0,
    in_progress: 1,
    defensible: 2,
  };

  return [...jobs].sort((a, b) => {
    // First sort by risk level
    const riskDiff = riskOrder[a.level] - riskOrder[b.level];
    if (riskDiff !== 0) return riskDiff;

    // Then by date (most recent first)
    return new Date(b.job.date).getTime() - new Date(a.job.date).getTime();
  });
};

// ============================================================================
// SHIELD COMPONENT
// ============================================================================

interface ShieldProps {
  isDefensible: boolean;
  size?: 'sm' | 'md';
}

/**
 * Silent shield indicator.
 * Green = defensible (minimum evidence present)
 * Grey = needs proof (financial/legal risk)
 *
 * No legal language. No explanation needed.
 * Field workers feel protection, not compliance burden.
 */
const Shield: React.FC<ShieldProps> = ({ isDefensible, size = 'sm' }) => {
  const sizeClasses = size === 'md' ? 'size-8 text-xl' : 'size-6 text-base';

  return (
    <div
      className={`
        ${sizeClasses} rounded-full flex items-center justify-center flex-shrink-0
        ${isDefensible
          ? 'bg-emerald-500/20 text-emerald-400'
          : 'bg-slate-700/50 text-slate-500'
        }
      `}
      aria-label={isDefensible ? 'Protected' : 'Needs proof'}
    >
      <span className="material-symbols-outlined" style={{ fontSize: 'inherit' }}>
        {isDefensible ? 'verified_user' : 'shield'}
      </span>
    </div>
  );
};

// ============================================================================
// JOB ROW COMPONENT
// ============================================================================

interface JobRowProps {
  jobRisk: JobRisk;
  clientName?: string;
}

const JobRow: React.FC<JobRowProps> = ({ jobRisk, clientName }) => {
  const { job, level, issues, isDefensible } = jobRisk;

  // Status indicator colors
  const statusColors: Record<RiskLevel, string> = {
    needs_proof: 'border-l-red-500',
    in_progress: 'border-l-amber-500',
    defensible: 'border-l-emerald-500',
  };

  return (
    <Link to={route(ROUTES.JOB_DETAIL, { id: job.id })}>
      <motion.div variants={fadeInUp}>
        <Card
          variant="interactive"
          className={`border-l-4 ${statusColors[level]}`}
        >
          <div className="flex items-center gap-4 min-h-[56px]">
            {/* Shield indicator */}
            <Shield isDefensible={isDefensible} />

            {/* Job info */}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-white truncate">
                {job.title || `Job #${job.id.slice(0, 6)}`}
              </p>
              <p className="text-sm text-slate-400 truncate">
                {clientName || job.client || 'Unknown client'}
                {job.address && ` • ${job.address.split(',')[0]}`}
              </p>
            </div>

            {/* Issues or status */}
            <div className="flex items-center gap-2">
              {level === 'needs_proof' && issues.length > 0 && (
                <span className="text-xs text-red-400 hidden sm:block">
                  {issues[0]}
                </span>
              )}
              {level === 'in_progress' && (
                <span className="text-xs text-amber-400 hidden sm:block">
                  In progress
                </span>
              )}
              {level === 'defensible' && job.sealedAt && (
                <span className="text-xs text-emerald-400 hidden sm:block">
                  Sealed
                </span>
              )}
              <span className="material-symbols-outlined text-slate-500">
                chevron_right
              </span>
            </div>
          </div>
        </Card>
      </motion.div>
    </Link>
  );
};

// ============================================================================
// MAIN DASHBOARD
// ============================================================================

const Dashboard: React.FC = () => {
  const { jobs, clients, isLoading } = useData();

  // Calculate risk for all active jobs (exclude Archived, Cancelled)
  const jobsWithRisk = useMemo(() => {
    const activeJobs = jobs.filter(
      j => j.status !== 'Archived' && j.status !== 'Cancelled'
    );
    const withRisk = activeJobs.map(calculateJobRisk);
    return sortByRisk(withRisk);
  }, [jobs]);

  // Find the current/next job to continue
  const currentJob = useMemo(() => {
    // Priority: In Progress jobs first, then needs proof
    const inProgress = jobsWithRisk.find(jr => jr.job.status === 'In Progress');
    if (inProgress) return inProgress;

    // Then any job needing proof (highest risk)
    const needsProof = jobsWithRisk.find(jr => jr.level === 'needs_proof');
    if (needsProof) return needsProof;

    // Then any non-sealed job
    return jobsWithRisk.find(jr => !jr.job.sealedAt) || null;
  }, [jobsWithRisk]);

  // Get client name for a job
  const getClientName = (clientId: string) => {
    return clients.find(c => c.id === clientId)?.name;
  };

  // Count jobs by risk level
  const riskCounts = useMemo(() => {
    return {
      needsProof: jobsWithRisk.filter(jr => jr.level === 'needs_proof').length,
      inProgress: jobsWithRisk.filter(jr => jr.level === 'in_progress').length,
      defensible: jobsWithRisk.filter(jr => jr.level === 'defensible').length,
    };
  }, [jobsWithRisk]);

  if (isLoading) {
    return (
      <div>
        <div className="px-4 lg:px-8 py-8">
          <LoadingSkeleton variant="card" count={3} />
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Primary Action Area */}
      <div className="px-4 lg:px-8 py-8 border-b border-white/5">
        {currentJob ? (
          <div className="max-w-2xl">
            {/* Current job status */}
            <div className="flex items-center gap-3 mb-4">
              <Shield isDefensible={currentJob.isDefensible} size="md" />
              <div>
                <p className="text-sm text-slate-400">
                  {currentJob.job.status === 'In Progress' ? 'Continue working on' : 'Next up'}
                </p>
                <p className="text-lg font-semibold text-white">
                  {currentJob.job.title || `Job #${currentJob.job.id.slice(0, 6)}`}
                </p>
              </div>
            </div>

            {/* Issues warning (if any) */}
            {currentJob.issues.length > 0 && (
              <div className="flex items-center gap-2 mb-4 text-sm text-slate-400">
                <span className="material-symbols-outlined text-lg text-amber-400">
                  info
                </span>
                <span>Needs: {currentJob.issues.join(', ')}</span>
              </div>
            )}

            {/* Primary CTA - One action only */}
            <ActionButton
              variant="primary"
              size="lg"
              icon={currentJob.job.status === 'In Progress' ? 'play_arrow' : 'arrow_forward'}
              to={route(ROUTES.JOB_DETAIL, { id: currentJob.job.id })}
              className="w-full sm:w-auto min-h-[56px] text-lg"
            >
              {currentJob.job.status === 'In Progress' ? 'Continue Job' : 'Start Job'}
            </ActionButton>
          </div>
        ) : (
          <div className="max-w-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="size-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <span className="material-symbols-outlined text-xl text-emerald-400">
                  check_circle
                </span>
              </div>
              <p className="text-lg font-semibold text-white">All caught up</p>
            </div>
            <ActionButton
              variant="secondary"
              size="lg"
              icon="add"
              to={ROUTES.JOB_NEW}
              className="min-h-[56px]"
            >
              Create New Job
            </ActionButton>
          </div>
        )}
      </div>

      <PageContent>
        {/* Risk Summary - Minimal, no charts */}
        {jobsWithRisk.length > 0 && (
          <div className="flex items-center gap-6 mb-6 text-sm">
            {riskCounts.needsProof > 0 && (
              <div className="flex items-center gap-2">
                <div className="size-3 rounded-full bg-red-500" />
                <span className="text-slate-400">
                  {riskCounts.needsProof} need{riskCounts.needsProof === 1 ? 's' : ''} proof
                </span>
              </div>
            )}
            {riskCounts.inProgress > 0 && (
              <div className="flex items-center gap-2">
                <div className="size-3 rounded-full bg-amber-500" />
                <span className="text-slate-400">
                  {riskCounts.inProgress} in progress
                </span>
              </div>
            )}
            {riskCounts.defensible > 0 && (
              <div className="flex items-center gap-2">
                <div className="size-3 rounded-full bg-emerald-500" />
                <span className="text-slate-400">
                  {riskCounts.defensible} protected
                </span>
              </div>
            )}
          </div>
        )}

        {/* Job List - Sorted by risk */}
        {jobsWithRisk.length === 0 ? (
          <EmptyState
            icon="work"
            title="No active jobs"
            description="Create your first job to start capturing evidence."
            action={{ label: 'Create Job', to: ROUTES.JOB_NEW, icon: 'add' }}
          />
        ) : (
          <motion.div
            className="space-y-3"
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
          >
            {jobsWithRisk.slice(0, 10).map(jobRisk => (
              <JobRow
                key={jobRisk.job.id}
                jobRisk={jobRisk}
                clientName={getClientName(jobRisk.job.clientId)}
              />
            ))}

            {/* View all link if more jobs */}
            {jobsWithRisk.length > 10 && (
              <Link
                to={ROUTES.JOBS}
                className="block text-center py-4 text-sm text-primary hover:text-primary/80"
              >
                View all {jobsWithRisk.length} jobs
              </Link>
            )}
          </motion.div>
        )}
      </PageContent>
    </div>
  );
};

export default Dashboard;
