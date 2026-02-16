/**
 * FloatingActionPanel - Context-sensitive bottom CTA
 *
 * Fixed-position panel above BottomNav showing the PRIMARY action
 * for the current context. Moves key CTAs into the thumb zone.
 *
 * Mobile-only (lg:hidden). Does NOT modify BottomNav.
 *
 * Thumb-primary layout: Research says bottom 35% is the action zone.
 * This panel places the most urgent action within easy thumb reach.
 */

import React, { useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useData } from '../../lib/DataContext';
import { slideInBottom, transitionQuick } from '../../lib/animations';

interface ActionConfig {
  label: string;
  icon: string;
  route: string;
  color: string;
}

const FloatingActionPanel: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { jobs } = useData();

  // Determine the most urgent action based on current context
  const action = useMemo((): ActionConfig | null => {
    const path = location.pathname;

    // Don't show on form/create pages (user is already acting)
    if (path.includes('/new') || path.includes('/edit') || path.includes('/capture')) {
      return null;
    }

    // Don't show on tech portal (has its own bottom action bar)
    if (path.startsWith('/tech/job/')) {
      return null;
    }

    // Dashboard context: show most urgent action
    if (path === '/admin' || path === '/admin/') {
      const needsEvidence = jobs.filter(j => j.status === 'In Progress').length;
      const pendingReview = jobs.filter(j => j.status === 'Complete' && !j.sealedAt).length;

      if (pendingReview > 0) {
        return {
          label: `Review ${pendingReview} Job${pendingReview !== 1 ? 's' : ''}`,
          icon: 'fact_check',
          route: '/admin/jobs?filter=awaiting_seal',
          color: 'bg-amber-500 text-slate-900',
        };
      }
      if (needsEvidence > 0) {
        return {
          label: `${needsEvidence} Active Job${needsEvidence !== 1 ? 's' : ''}`,
          icon: 'play_circle',
          route: '/admin/jobs?filter=active',
          color: 'bg-primary text-white',
        };
      }
      return {
        label: 'New Job',
        icon: 'add_circle',
        route: '/admin/create',
        color: 'bg-primary text-white',
      };
    }

    // Jobs list: show create action
    if (path === '/admin/jobs') {
      return null; // Already has header action
    }

    // Contractor dashboard
    if (path === '/contractor' || path === '/contractor/') {
      const activeJob = jobs.find(j => j.status === 'In Progress');
      if (activeJob) {
        return {
          label: `Continue: ${activeJob.title || 'Active Job'}`,
          icon: 'play_circle',
          route: `/contractor/job/${activeJob.id}`,
          color: 'bg-primary text-white',
        };
      }
    }

    // Tech portal
    if (path === '/tech' || path === '/tech/') {
      const startedJob = jobs.find(j => j.status === 'In Progress');
      if (startedJob) {
        return {
          label: 'Continue Job',
          icon: 'play_circle',
          route: `/tech/job/${startedJob.id}`,
          color: 'bg-primary text-white',
        };
      }
    }

    return null;
  }, [location.pathname, jobs]);

  return (
    <AnimatePresence>
      {action && (
        <motion.div
          initial="hidden"
          animate="visible"
          exit="hidden"
          variants={slideInBottom}
          transition={transitionQuick}
          className="fixed bottom-20 left-4 right-4 z-30 lg:hidden"
        >
          <button
            onClick={() => navigate(action.route)}
            className={`
              w-full flex items-center justify-center gap-3
              ${action.color}
              rounded-2xl py-4 px-6 min-h-[56px]
              font-bold text-sm tracking-wide
              shadow-lg shadow-black/20
              active:scale-[0.98] transition-transform
            `}
          >
            <span className="material-symbols-outlined text-xl">{action.icon}</span>
            {action.label}
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default React.memo(FloatingActionPanel);
