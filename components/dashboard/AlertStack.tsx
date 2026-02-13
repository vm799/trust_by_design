/**
 * AlertStack Component
 *
 * Displays urgent attention items in priority order.
 * ONLY shows if alerts exist (empty state = no rendering).
 *
 * Alert types:
 * - Red: Overdue jobs (CRITICAL)
 * - Amber: Unassigned jobs (ATTENTION)
 * - Blue: Ready to invoice (ACTION)
 *
 * Each alert is clickable and navigates to relevant view.
 * Uses real DataContext data (no mock data).
 *
 * Affordances:
 * - Color-coded by severity
 * - Clickable with full-width button
 * - Icon + count + CTA arrow
 */

import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useData } from '../../lib/DataContext';
import { useNavigate } from 'react-router-dom';
import { fadeOverlay, slideInRightSmall, hoverScaleShift, transitionQuick } from '../../lib/animations';

interface Alert {
  type: 'overdue' | 'unassigned' | 'ready_invoice';
  count: number;
  label: string;
  color: 'red' | 'amber' | 'blue';
  icon: string;
  cta: string;
  onAction?: () => void;
}

interface AlertStackProps {
  onAlertClick?: (alertType: string) => void;
}

const AlertStack: React.FC<AlertStackProps> = React.memo(({ onAlertClick }) => {
  const { jobs } = useData();
  const navigate = useNavigate();

  // Calculate alerts from real data
  const alerts = useMemo(() => {
    const alertList: Alert[] = [];

    // Check for overdue jobs
    const overdueJobs = jobs.filter(
      j => new Date(j.date) < new Date() &&
           !['Complete', 'Submitted', 'Archived'].includes(j.status)
    ).length;

    if (overdueJobs > 0) {
      alertList.push({
        type: 'overdue',
        count: overdueJobs,
        label: `${overdueJobs} Overdue Job${overdueJobs !== 1 ? 's' : ''}`,
        color: 'red',
        icon: 'schedule',
        cta: 'View Overdue →',
        onAction: () => {
          onAlertClick?.('overdue');
          navigate('/admin?filter=overdue');
        },
      });
    }

    // Check for unassigned jobs
    const unassignedJobs = jobs.filter(
      j => !j.technicianId &&
           ['Dispatched', 'In Progress'].includes(j.status)
    ).length;

    if (unassignedJobs > 0) {
      alertList.push({
        type: 'unassigned',
        count: unassignedJobs,
        label: `${unassignedJobs} Unassigned Job${unassignedJobs !== 1 ? 's' : ''}`,
        color: 'amber',
        icon: 'person_off',
        cta: 'Assign Technician →',
        onAction: () => {
          onAlertClick?.('unassigned');
          navigate('/admin/technicians');
        },
      });
    }

    // Check for ready-to-invoice jobs
    const readyToInvoice = jobs.filter(
      j => j.status === 'Complete' && !j.invoiceId
    ).length;

    if (readyToInvoice > 0) {
      alertList.push({
        type: 'ready_invoice',
        count: readyToInvoice,
        label: `${readyToInvoice} Ready to Invoice`,
        color: 'blue',
        icon: 'receipt_long',
        cta: 'Create Invoice →',
        onAction: () => {
          onAlertClick?.('ready_invoice');
          navigate('/admin/invoices?create=true');
        },
      });
    }

    return alertList;
  }, [jobs, onAlertClick, navigate]);

  // Don't render if no alerts (empty state is silent)
  if (alerts.length === 0) {
    return null;
  }

  const colorConfig = {
    red: {
      bg: 'bg-red-50 dark:bg-red-950',
      border: 'border-red-200 dark:border-red-800',
      hover: 'hover:bg-red-100 dark:hover:bg-red-900',
      text: 'text-red-900 dark:text-red-100',
      icon: 'text-red-600 dark:text-red-400',
      badge: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200',
    },
    amber: {
      bg: 'bg-amber-50 dark:bg-amber-950',
      border: 'border-amber-200 dark:border-amber-800',
      hover: 'hover:bg-amber-100 dark:hover:bg-amber-900',
      text: 'text-amber-900 dark:text-amber-100',
      icon: 'text-amber-600 dark:text-amber-400',
      badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200',
    },
    blue: {
      bg: 'bg-blue-50 dark:bg-blue-950',
      border: 'border-blue-200 dark:border-blue-800',
      hover: 'hover:bg-blue-100 dark:hover:bg-blue-900',
      text: 'text-blue-900 dark:text-blue-100',
      icon: 'text-blue-600 dark:text-blue-400',
      badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200',
    },
  };

  return (
    <div role="alert" aria-live="polite" aria-atomic="true">
      <AnimatePresence>
        <motion.div
          className="space-y-3 mb-6"
          initial={fadeOverlay.hidden}
          animate={fadeOverlay.visible}
          exit={fadeOverlay.exit}
          transition={{ staggerChildren: 0.1 }}
        >
        {alerts.map((alert, index) => {
          const colors = colorConfig[alert.color];

          return (
            <motion.button
              key={alert.type}
              initial={slideInRightSmall.initial}
              animate={slideInRightSmall.animate}
              exit={slideInRightSmall.exit}
              transition={{ ...transitionQuick, delay: index * 0.05 }}
              whileHover={hoverScaleShift}
              onClick={alert.onAction}
            className={`
              w-full p-4 rounded-lg border-2
              ${colors.bg} ${colors.border} ${colors.hover}
              transition-all duration-200 cursor-pointer
              hover:shadow-md hover:-translate-y-0.5
              flex items-center justify-between
              group
            `}
            aria-label={alert.label}
          >
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <span className={`material-symbols-outlined text-2xl flex-shrink-0 ${colors.icon}`}>
                {alert.icon}
              </span>
              <div className="text-left min-w-0 flex-1">
                <p className={`font-semibold ${colors.text}`}>
                  {alert.label}
                </p>
                <p className={`text-xs ${colors.text} opacity-70`}>
                  {alert.cta.split(' →')[0]}
                </p>
              </div>
            </div>

            {/* Count Badge */}
            <span className={`
              ${colors.badge}
              px-3 py-1 rounded-full text-sm font-bold
              ml-4 flex-shrink-0
            `}>
              {alert.count}
            </span>

              {/* Arrow indicator */}
              <span className={`
                material-symbols-outlined text-lg flex-shrink-0 ml-2
                ${colors.icon}
                group-hover:translate-x-1 transition-transform
              `}>
                chevron_right
              </span>
            </motion.button>
          );
        })}
        </motion.div>
      </AnimatePresence>
    </div>
  );
});

AlertStack.displayName = 'AlertStack';

export default AlertStack;
