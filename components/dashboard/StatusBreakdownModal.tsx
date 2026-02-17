/**
 * StatusBreakdownModal - Color-coded job status drill-down modal
 *
 * Shows jobs filtered by a specific status with appropriate actions.
 * Each status type has a distinct color and action:
 * - Pending: "Assign" action
 * - In Progress: "View" action
 * - Complete: "Review Evidence" action
 * - Submitted: "View Certificate" action
 *
 * UX Contract:
 * - 44px touch targets on all interactive elements
 * - Color-coded header by status
 * - Each job row has a primary action button
 * - Bottom sheet pattern on mobile
 */

import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Job, Client, Technician, JobStatus } from '../../types';
import { route, ROUTES } from '../../lib/routes';
import { isReportReady, canDeleteJob } from '../../lib/statusHelpers';
import { fadeOverlay, slideUpModal } from '../../lib/animations';

interface StatusBreakdownModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: JobStatus;
  jobs: Job[];
  clients: Client[];
  technicians: Technician[];
  onAssignJob?: (jobId: string) => void;
  onArchiveJob?: (jobId: string) => void;
  onDeleteJob?: (jobId: string) => void;
}

const STATUS_CONFIG: Record<string, {
  icon: string;
  color: string;
  bgColor: string;
  borderColor: string;
  actionLabel: string;
  actionIcon: string;
}> = {
  'Pending': {
    icon: 'schedule',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/20',
    borderColor: 'border-amber-500/30',
    actionLabel: 'Assign',
    actionIcon: 'person_add',
  },
  'Draft': {
    icon: 'edit_note',
    color: 'text-slate-400',
    bgColor: 'bg-slate-500/20',
    borderColor: 'border-slate-500/30',
    actionLabel: 'Edit',
    actionIcon: 'edit',
  },
  'In Progress': {
    icon: 'play_circle',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20',
    borderColor: 'border-blue-500/30',
    actionLabel: 'View',
    actionIcon: 'visibility',
  },
  'Complete': {
    icon: 'check_circle',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/20',
    borderColor: 'border-emerald-500/30',
    actionLabel: 'Review',
    actionIcon: 'rate_review',
  },
  'Submitted': {
    icon: 'verified',
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/20',
    borderColor: 'border-purple-500/30',
    actionLabel: 'Certificate',
    actionIcon: 'workspace_premium',
  },
  'Archived': {
    icon: 'inventory_2',
    color: 'text-slate-400',
    bgColor: 'bg-slate-500/20',
    borderColor: 'border-slate-500/30',
    actionLabel: 'View',
    actionIcon: 'visibility',
  },
  'Paused': {
    icon: 'pause_circle',
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/20',
    borderColor: 'border-orange-500/30',
    actionLabel: 'Resume',
    actionIcon: 'play_arrow',
  },
  'Cancelled': {
    icon: 'cancel',
    color: 'text-red-400',
    bgColor: 'bg-red-500/20',
    borderColor: 'border-red-500/30',
    actionLabel: 'View',
    actionIcon: 'visibility',
  },
};

const DEFAULT_CONFIG = {
  icon: 'work',
  color: 'text-slate-400',
  bgColor: 'bg-slate-500/20',
  borderColor: 'border-slate-500/30',
  actionLabel: 'View',
  actionIcon: 'visibility',
};

const StatusBreakdownModal: React.FC<StatusBreakdownModalProps> = ({
  isOpen,
  onClose,
  status,
  jobs,
  clients,
  technicians,
  onAssignJob,
  onArchiveJob,
  onDeleteJob,
}) => {
  const config = STATUS_CONFIG[status] || DEFAULT_CONFIG;

  const filteredJobs = useMemo(() =>
    jobs.filter(j => j.status === status),
    [jobs, status]
  );

  const getClient = (job: Job): Client | undefined =>
    clients.find(c => c.id === job.clientId);

  const getTechnician = (job: Job): Technician | undefined =>
    technicians.find(t => t.id === job.technicianId || t.id === job.techId);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={fadeOverlay.hidden}
          animate={fadeOverlay.visible}
          exit={fadeOverlay.exit}
          className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={slideUpModal.hidden}
            animate={slideUpModal.visible}
            exit={slideUpModal.exit}
            className="bg-slate-50 dark:bg-slate-900 rounded-2xl w-full max-w-lg max-h-[80vh] overflow-hidden border border-slate-200 dark:border-white/10"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className={`flex items-center justify-between p-4 border-b ${config.borderColor}`}>
              <div className="flex items-center gap-3">
                <div className={`size-10 rounded-xl ${config.bgColor} flex items-center justify-center`}>
                  <span className={`material-symbols-outlined ${config.color}`}>{config.icon}</span>
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white">{status}</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {filteredJobs.length} job{filteredJobs.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="size-10 rounded-xl bg-gray-100 dark:bg-slate-800 flex items-center justify-center min-h-[44px] min-w-[44px] hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
                aria-label="Close"
              >
                <span className="material-symbols-outlined text-slate-500 dark:text-slate-400">close</span>
              </button>
            </div>

            {/* Job list */}
            <div className="p-4 overflow-y-auto max-h-[60vh] space-y-2">
              {filteredJobs.length === 0 ? (
                <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                  <span className="material-symbols-outlined text-3xl mb-2">inbox</span>
                  <p className="text-sm">No {status.toLowerCase()} jobs</p>
                </div>
              ) : (
                filteredJobs.map(job => {
                  const client = getClient(job);
                  const tech = getTechnician(job);
                  const reportReady = isReportReady(job);
                  const deletable = canDeleteJob(job);

                  return (
                    <div
                      key={job.id}
                      className={`rounded-xl border ${config.borderColor} bg-gray-100 dark:bg-slate-800 p-3`}
                    >
                      {/* Job info */}
                      <div className="flex items-start gap-3 mb-3">
                        <div className={`size-8 rounded-lg ${config.bgColor} flex items-center justify-center shrink-0 mt-0.5`}>
                          <span className={`material-symbols-outlined text-sm ${config.color}`}>
                            {config.icon}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-900 dark:text-white truncate">
                            {job.title || `Job #${job.id.slice(0, 6)}`}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                            {client?.name || 'Unknown client'}
                            {tech ? ` • ${tech.name}` : ''}
                          </p>
                        </div>
                      </div>

                      {/* Actions row */}
                      <div className="flex items-center gap-2">
                        {/* Primary action - always visible */}
                        <Link
                          to={route(ROUTES.JOB_DETAIL, { id: job.id })}
                          className={`
                            flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg
                            ${config.bgColor} ${config.color}
                            text-xs font-bold transition-colors min-h-[44px]
                            hover:opacity-80
                          `}
                        >
                          <span className="material-symbols-outlined text-sm">{config.actionIcon}</span>
                          {config.actionLabel}
                        </Link>

                        {/* Assign button for Pending jobs */}
                        {status === 'Pending' && onAssignJob && (
                          <button
                            onClick={() => onAssignJob(job.id)}
                            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-primary/20 text-primary text-xs font-bold min-h-[44px] hover:bg-primary/30 transition-colors"
                          >
                            <span className="material-symbols-outlined text-sm">person_add</span>
                            Assign
                          </button>
                        )}

                        {/* Archive button for Complete jobs */}
                        {(status === 'Complete' || status === 'Submitted') && onArchiveJob && (
                          <button
                            onClick={() => onArchiveJob(job.id)}
                            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-gray-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold min-h-[44px] hover:bg-gray-300 dark:hover:bg-slate-600 transition-colors"
                          >
                            <span className="material-symbols-outlined text-sm">inventory_2</span>
                            Archive
                          </button>
                        )}

                        {/* Delete button (only when allowed) */}
                        {(status === 'Complete' || status === 'Submitted') && deletable && onDeleteJob && (
                          <button
                            onClick={() => onDeleteJob(job.id)}
                            className="flex items-center justify-center px-2 py-2 rounded-lg bg-red-500/10 text-red-400 min-h-[44px] min-w-[44px] hover:bg-red-500/20 transition-colors"
                            aria-label="Delete job"
                          >
                            <span className="material-symbols-outlined text-sm">delete</span>
                          </button>
                        )}

                        {/* Report indicator (only when evidence complete) */}
                        {(status === 'Complete' || status === 'Submitted') && reportReady && (
                          <Link
                            to={route(ROUTES.JOB_DETAIL, { id: job.id })}
                            className="flex items-center justify-center px-2 py-2 rounded-lg bg-emerald-500/10 text-emerald-400 min-h-[44px] min-w-[44px] hover:bg-emerald-500/20 transition-colors"
                            aria-label="View report"
                          >
                            <span className="material-symbols-outlined text-sm">description</span>
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer with "View All" */}
            {filteredJobs.length > 0 && (
              <div className="p-4 border-t border-white/15">
                <Link
                  to={`${ROUTES.JOBS}?status=${encodeURIComponent(status.toLowerCase())}`}
                  className="block w-full text-center py-3 rounded-xl bg-slate-800 text-slate-300 text-sm font-medium min-h-[44px] hover:bg-slate-700 transition-colors"
                >
                  View all {status.toLowerCase()} jobs
                </Link>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default React.memo(StatusBreakdownModal);
