/**
 * ReadyToInvoiceSection - Shows jobs ready for invoicing
 *
 * Displays jobs that are:
 * - Status: Complete or Submitted
 * - Evidence: Synced to cloud
 * - Not yet invoiced (no invoiceId)
 *
 * Uses getJobsReadyForInvoicing from statusHelpers for derived state.
 *
 * @see /lib/statusHelpers.ts
 */

import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useData } from '../../lib/DataContext';
import { getJobsReadyForInvoicing, deriveEvidenceStatus } from '../../lib/statusHelpers';
import { fadeInUp, staggerContainer } from '../../lib/animations';
import { Job } from '../../types';

interface JobItemProps {
  job: Job;
  onClick: () => void;
}

const JobItem: React.FC<JobItemProps> = ({ job, onClick }) => {
  const evidenceStatus = useMemo(() => deriveEvidenceStatus(job), [job]);

  return (
    <button
      onClick={onClick}
      className="
        w-full flex items-center gap-4 p-4 rounded-xl
        bg-slate-50 dark:bg-slate-800/50
        hover:bg-slate-100 dark:hover:bg-slate-800
        transition-colors text-left min-h-[56px]
      "
    >
      {/* Status indicator */}
      <div className="size-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
        <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400">
          receipt_long
        </span>
      </div>

      {/* Job info */}
      <div className="flex-1 min-w-0">
        <p className="font-bold text-slate-900 dark:text-white truncate">
          {job.title || job.id}
        </p>
        <p className="text-sm text-slate-500 truncate">
          {job.clientName || 'No client'} • {evidenceStatus.photoCount} photo{evidenceStatus.photoCount !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Arrow */}
      <span className="material-symbols-outlined text-slate-400 flex-shrink-0">
        chevron_right
      </span>
    </button>
  );
};

const ReadyToInvoiceSection: React.FC = () => {
  const navigate = useNavigate();
  const { jobs } = useData();

  // Get jobs ready for invoicing using statusHelpers
  const readyJobs = useMemo(() => {
    return getJobsReadyForInvoicing(jobs);
  }, [jobs]);

  // Don't render if no jobs ready
  if (readyJobs.length === 0) {
    return null;
  }

  // Calculate total value (if jobs have pricing)
  const totalValue = readyJobs.reduce((sum, job) => {
    const price = typeof job.price === 'number' ? job.price : 0;
    return sum + price;
  }, 0);

  return (
    <motion.div
      variants={fadeInUp}
      className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
            <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400">
              payments
            </span>
          </div>
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white">
              Ready to Invoice
            </h3>
            <p className="text-sm text-slate-500">
              {readyJobs.length} job{readyJobs.length !== 1 ? 's' : ''}
              {totalValue > 0 && ` • $${totalValue.toLocaleString()}`}
            </p>
          </div>
        </div>

        {/* Quick action */}
        <button
          onClick={() => navigate('/admin/invoices')}
          className="
            px-4 py-2 rounded-xl text-sm font-bold
            bg-emerald-500 text-white
            hover:bg-emerald-600 transition-colors
            min-h-[44px]
          "
        >
          Create Invoice
        </button>
      </div>

      {/* Job list */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="p-2 space-y-2 max-h-[300px] overflow-y-auto"
      >
        {readyJobs.slice(0, 5).map((job) => (
          <motion.div key={job.id} variants={fadeInUp}>
            <JobItem
              job={job}
              onClick={() => navigate(`/admin/jobs/${job.id}`)}
            />
          </motion.div>
        ))}

        {readyJobs.length > 5 && (
          <button
            onClick={() => navigate('/admin/jobs?filter=ready_to_invoice')}
            className="
              w-full py-3 text-sm font-bold text-primary
              hover:bg-slate-50 dark:hover:bg-slate-800
              rounded-xl transition-colors min-h-[44px]
            "
          >
            View all {readyJobs.length} jobs
          </button>
        )}
      </motion.div>
    </motion.div>
  );
};

export default React.memo(ReadyToInvoiceSection);
