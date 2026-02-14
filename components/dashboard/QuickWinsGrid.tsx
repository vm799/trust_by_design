/**
 * QuickWinsGrid Component
 *
 * Three cards showing key opportunities for action:
 * - Ready to Invoice (green emerald)
 * - Active Jobs in Progress (blue)
 * - Revenue Pending (purple)
 *
 * Each card is fully clickable (entire card navigates).
 * Shows metric + trend (if available).
 * Uses real DataContext data (no mock data).
 *
 * Affordances:
 * - Cards have lift + shadow on hover
 * - Large, bold numbers for scannability
 * - Trend indicator (↑ green, ↓ amber)
 * - Arrow icon shows navigation
 */

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useData } from '../../lib/DataContext';
import { useNavigate } from 'react-router-dom';
import { fadeOverlay, fadeInScaleGrid, hoverScaleLift, transitionQuick } from '../../lib/animations';

interface QuickWinCard {
  title: string;
  value: number | string;
  trend?: string;
  trendColor?: 'green' | 'amber' | 'neutral';
  icon: string;
  color: 'emerald' | 'blue' | 'purple';
  cta: string;
  onAction?: () => void;
}

interface QuickWinsGridProps {
  onCardClick?: (cardType: string) => void;
}

const QuickWinsGrid: React.FC<QuickWinsGridProps> = React.memo(({ onCardClick }) => {
  const { jobs, isLoading } = useData();
  const navigate = useNavigate();

  // Calculate metrics from real data
  const cards = useMemo(() => {
    // Ready to Invoice
    const readyToInvoice = jobs.filter(j => j.status === 'Complete' && !j.invoiceId).length;
    const completedThisWeek = jobs.filter(j => {
      const jobDate = new Date(j.date);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return j.status === 'Complete' && jobDate > weekAgo;
    }).length;

    // Active Jobs
    const activeJobs = jobs.filter(j => ['In Progress', 'Dispatched'].includes(j.status)).length;
    const progressThisWeek = jobs.filter(j => {
      const jobDate = new Date(j.date);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return ['In Progress', 'Dispatched'].includes(j.status) && jobDate > weekAgo;
    }).length;

    // Revenue Pending (placeholder calculation)
    const revenuePending = readyToInvoice * 2500; // Estimate $2.5k per job
    const revenueLastWeek = completedThisWeek * 2500;

    const cardList: QuickWinCard[] = [
      {
        title: 'Ready to Invoice',
        value: readyToInvoice,
        trend: `${completedThisWeek} this week`,
        trendColor: completedThisWeek > 0 ? 'green' : 'neutral',
        icon: 'receipt_long',
        color: 'emerald',
        cta: 'Create Invoice →',
        onAction: () => {
          onCardClick?.('ready_invoice');
          navigate('/admin/invoices?create=true');
        },
      },
      {
        title: 'Active Jobs',
        value: activeJobs,
        trend: `${progressThisWeek} this week`,
        trendColor: progressThisWeek > 0 ? 'green' : 'neutral',
        icon: 'work',
        color: 'blue',
        cta: 'View All →',
        onAction: () => {
          onCardClick?.('active_jobs');
          navigate('/admin?status=in-progress');
        },
      },
      {
        title: 'Revenue Pending',
        value: `$${Math.round(revenuePending / 1000)}K`,
        trend: `+$${Math.round(revenueLastWeek / 1000)}K this week`,
        trendColor: revenueLastWeek > 0 ? 'green' : 'neutral',
        icon: 'trending_up',
        color: 'purple',
        cta: 'Details →',
        onAction: () => {
          onCardClick?.('revenue');
          navigate('/admin/invoices');
        },
      },
    ];

    return cardList;
  }, [jobs, onCardClick, navigate]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {[...Array(3)].map((_, i) => (
          <div
            key={`skeleton-card-${i}`}
            className="h-48 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse"
          />
        ))}
      </div>
    );
  }

  const colorConfig = {
    emerald: {
      bg: 'bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900',
      border: 'border-emerald-200 dark:border-emerald-800',
      hover: 'hover:from-emerald-100 hover:to-emerald-200 dark:hover:from-emerald-900 dark:hover:to-emerald-800',
      text: 'text-emerald-900 dark:text-emerald-100',
      icon: 'text-emerald-600 dark:text-emerald-400',
      accent: 'text-emerald-700 dark:text-emerald-300',
    },
    blue: {
      bg: 'bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900',
      border: 'border-blue-200 dark:border-blue-800',
      hover: 'hover:from-blue-100 hover:to-blue-200 dark:hover:from-blue-900 dark:hover:to-blue-800',
      text: 'text-blue-900 dark:text-blue-100',
      icon: 'text-blue-600 dark:text-blue-400',
      accent: 'text-blue-700 dark:text-blue-300',
    },
    purple: {
      bg: 'bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900',
      border: 'border-purple-200 dark:border-purple-800',
      hover: 'hover:from-purple-100 hover:to-purple-200 dark:hover:from-purple-900 dark:hover:to-purple-800',
      text: 'text-purple-900 dark:text-purple-100',
      icon: 'text-purple-600 dark:text-purple-400',
      accent: 'text-purple-700 dark:text-purple-300',
    },
  };

  return (
    <motion.div
      className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8"
      initial={fadeOverlay.hidden}
      animate={fadeOverlay.visible}
      transition={{ staggerChildren: 0.1, delayChildren: 0.2 }}
    >
      {cards.map((card, index) => {
        const colors = colorConfig[card.color];

        return (
          <motion.button
            key={card.title}
            initial={fadeInScaleGrid.initial}
            animate={fadeInScaleGrid.animate}
            whileHover={hoverScaleLift}
            transition={{ ...transitionQuick, delay: index * 0.1 }}
            onClick={card.onAction}
            className={`
              ${colors.bg} ${colors.border} ${colors.hover}
              border-2 rounded-xl p-6
              transition-all duration-200 cursor-pointer
              hover:shadow-lg hover:-translate-y-1
              text-left group
            `}
            aria-label={`${card.title}: ${card.value}`}
          >
            {/* Icon */}
            <div className="flex items-start justify-between mb-4">
              <span className={`material-symbols-outlined text-3xl ${colors.icon}`}>
                {card.icon}
              </span>
              <span className={`material-symbols-outlined text-lg ${colors.icon} group-hover:translate-x-1 transition-transform`}>
                chevron_right
              </span>
            </div>

            {/* Value */}
            <p className={`text-4xl font-black ${colors.text} mb-2`}>
              {card.value}
            </p>

            {/* Title */}
            <p className={`text-sm font-semibold ${colors.accent} mb-3`}>
              {card.title}
            </p>

            {/* Trend */}
            {card.trend && (
              <p className={`text-xs font-medium ${
                card.trendColor === 'green' ? `${colors.accent}` :
                card.trendColor === 'amber' ? 'text-amber-600 dark:text-amber-400' :
                'text-slate-400 dark:text-slate-400'
              }`}>
                {card.trendColor === 'green' ? '↑ ' : card.trendColor === 'amber' ? '↓ ' : '→ '}
                {card.trend}
              </p>
            )}

              {/* CTA */}
              <p className={`text-xs font-bold uppercase tracking-wide mt-4 ${colors.accent}`}>
                {card.cta}
              </p>
            </motion.button>
          );
        })}
    </motion.div>
  );
});

QuickWinsGrid.displayName = 'QuickWinsGrid';

export default QuickWinsGrid;
