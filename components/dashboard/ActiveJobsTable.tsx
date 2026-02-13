/**
 * ActiveJobsTable Component
 *
 * Displays jobs in a smart table/card format.
 * - Search by job ID or client name
 * - Filter by status (All | Overdue | In Progress | Ready to Invoice)
 * - Cards show priority color (red=overdue, blue=in progress, green=ready)
 * - Inline quick actions (View, Assign, etc)
 * - Uses real DataContext data (no mock data)
 *
 * Affordances:
 * - Color-coded by status
 * - Each card is clickable
 * - Action buttons with clear icons
 * - Search updates results in real-time
 * - Overdue items sort to top
 */

import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useData } from '../../lib/DataContext';
import { useNavigate } from 'react-router-dom';
import type { Job } from '../../types';
import { fadeOverlay, fadeInUpSmall, hoverScaleShiftSmall, transitionFast } from '../../lib/animations';

type JobFilter = 'all' | 'overdue' | 'in-progress' | 'ready-invoice';

interface ActiveJobsTableProps {
  onJobSelect?: (job: Job) => void;
  maxRows?: number;
  showViewAll?: boolean;
}

const ActiveJobsTable: React.FC<ActiveJobsTableProps> = React.memo(({
  onJobSelect,
  maxRows = 8,
  showViewAll = true,
}) => {
  const { jobs, clients, technicians, isLoading } = useData();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<JobFilter>('all');

  // Filter and sort jobs from real data
  const filteredJobs = useMemo(() => {
    let filtered = [...jobs];

    // Apply status filter
    if (filter === 'overdue') {
      filtered = filtered.filter(j =>
        new Date(j.date) < new Date() &&
        !['Complete', 'Submitted', 'Archived'].includes(j.status)
      );
    } else if (filter === 'in-progress') {
      filtered = filtered.filter(j =>
        ['In Progress', 'Dispatched'].includes(j.status)
      );
    } else if (filter === 'ready-invoice') {
      filtered = filtered.filter(j =>
        j.status === 'Complete' && !j.invoiceId
      );
    }

    // Apply search
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(j =>
        j.id.toLowerCase().includes(term) ||
        j.id?.toLowerCase().includes(term) ||
        clients.find(c => c.id === j.clientId)?.name.toLowerCase().includes(term)
      );
    }

    // Sort: overdue first, then by date
    filtered.sort((a, b) => {
      const aOverdue = new Date(a.date) < new Date();
      const bOverdue = new Date(b.date) < new Date();
      if (aOverdue && !bOverdue) return -1;
      if (!aOverdue && bOverdue) return 1;
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });

    return filtered;
  }, [jobs, clients, filter, searchTerm]);

  const getJobStatus = (job: Job) => {
    const dueDate = new Date(job.date);
    const now = new Date();
    if (dueDate < now && !['Complete', 'Submitted', 'Archived'].includes(job.status)) {
      return 'overdue';
    }
    return job.status.toLowerCase().replace(' ', '-');
  };

  const getStatusColor = (job: Job) => {
    const status = getJobStatus(job);
    const config = {
      overdue: {
        bg: 'bg-red-50 dark:bg-red-950',
        border: 'border-red-200 dark:border-red-800',
        text: 'text-red-900 dark:text-red-100',
        badge: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200',
        icon: '⚠️',
      },
      'in-progress': {
        bg: 'bg-blue-50 dark:bg-blue-950',
        border: 'border-blue-200 dark:border-blue-800',
        text: 'text-blue-900 dark:text-blue-100',
        badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200',
        icon: '⏳',
      },
      complete: {
        bg: 'bg-emerald-50 dark:bg-emerald-950',
        border: 'border-emerald-200 dark:border-emerald-800',
        text: 'text-emerald-900 dark:text-emerald-100',
        badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200',
        icon: '✓',
      },
      default: {
        bg: 'bg-slate-50 dark:bg-slate-800',
        border: 'border-slate-200 dark:border-slate-700',
        text: 'text-slate-900 dark:text-slate-100',
        badge: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
        icon: '→',
      },
    };

    return config[status as keyof typeof config] || config.default;
  };

  const displayJobs = filteredJobs.slice(0, maxRows);

  return (
    <div className="mb-8">
      {/* Filter & Search Bar */}
      <div className="mb-6 space-y-3">
        <div className="flex gap-2 flex-wrap">
          {(['all', 'overdue', 'in-progress', 'ready-invoice'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              aria-current={filter === f ? 'page' : undefined}
              className={`
                px-4 py-2 rounded-lg text-sm font-semibold
                transition-all duration-200
                ${filter === f
                  ? 'bg-primary text-white ring-2 ring-primary ring-offset-2 dark:ring-offset-slate-900'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }
              `}
            >
              {f === 'all' && 'All'}
              {f === 'overdue' && 'Overdue'}
              {f === 'in-progress' && 'In Progress'}
              {f === 'ready-invoice' && 'Ready'}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            search
          </span>
          <input
            type="text"
            placeholder="Search by job ID or client..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            aria-label="Search jobs by ID or client name"
            className={`
              w-full pl-10 pr-4 py-3 rounded-lg min-h-[44px]
              border border-slate-200 dark:border-slate-700
              bg-white dark:bg-slate-800
              text-slate-900 dark:text-white
              placeholder-slate-400 dark:placeholder-slate-500
              focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent
              transition-all duration-200
            `}
          />
        </div>
      </div>

      {/* Jobs List */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={`skeleton-job-${i}`} className="h-24 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : filteredJobs.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 dark:bg-slate-800 rounded-lg">
          <p className="text-slate-500 dark:text-slate-400 font-medium">
            No jobs found
          </p>
          <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
            Try adjusting your search or filters
          </p>
        </div>
      ) : (
        <AnimatePresence>
          <motion.div
            className="space-y-3"
            initial={fadeOverlay.hidden}
            animate={fadeOverlay.visible}
            exit={fadeOverlay.exit}
            transition={{ staggerChildren: 0.05 }}
          >
            {displayJobs.map((job, index) => {
              const statusColor = getStatusColor(job);
              const clientName = clients.find(c => c.id === job.clientId)?.name || 'Unknown Client';
              const techName = technicians.find(t => t.id === job.technicianId)?.name || 'Unassigned';

              return (
                <motion.button
                  key={job.id}
                  initial={fadeInUpSmall.initial}
                  animate={fadeInUpSmall.animate}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ ...transitionFast, delay: index * 0.05 }}
                  whileHover={hoverScaleShiftSmall}
                  onClick={() => {
                    onJobSelect?.(job);
                    navigate(`/admin/jobs/${job.id}`);
                  }}
                className={`
                  w-full p-4 rounded-lg border-2 text-left
                  ${statusColor.bg} ${statusColor.border}
                  hover:shadow-md hover:-translate-y-0.5
                  transition-all duration-200 cursor-pointer
                  group
                `}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {/* Job ID & Status */}
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">{statusColor.icon}</span>
                      <p className={`font-mono text-sm font-bold ${statusColor.text}`}>
                        {job.id}
                      </p>
                      <span className={`px-2 py-1 rounded text-xs font-bold ${statusColor.badge}`}>
                        {job.status}
                      </span>
                    </div>

                    {/* Client & Tech */}
                    <p className={`text-sm font-semibold ${statusColor.text} mb-1`}>
                      {clientName}
                    </p>
                    <p className={`text-xs ${statusColor.text} opacity-70`}>
                      Assigned: {techName}
                    </p>

                    {/* Due Date */}
                    {getJobStatus(job) === 'overdue' && (
                      <p className="text-xs text-red-600 dark:text-red-400 font-bold mt-1">
                        Due: {new Date(job.date).toLocaleDateString()} (OVERDUE)
                      </p>
                    )}
                  </div>

                    {/* Arrow */}
                    <span className="material-symbols-outlined flex-shrink-0 text-slate-400 group-hover:translate-x-1 transition-transform">
                      chevron_right
                    </span>
                  </div>
                </motion.button>
              );
            })}
          </motion.div>
        </AnimatePresence>
      )}

      {/* View All Button */}
      {showViewAll && filteredJobs.length > maxRows && (
        <button
          onClick={() => navigate('/admin/jobs')}
          className="w-full mt-4 py-3 text-center font-semibold text-primary hover:text-primary-hover transition-colors"
        >
          View all {filteredJobs.length} jobs →
        </button>
      )}
    </div>
  );
});

ActiveJobsTable.displayName = 'ActiveJobsTable';

export default ActiveJobsTable;
