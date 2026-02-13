/**
 * TechnicianStatusGrid - Mobile-first categorized technician display
 *
 * Replaces the flat technician list with compact, categorized pills
 * grouped by status: Working (green), Idle (amber), Offline (gray).
 *
 * Each pill is tappable to drill down into technician details.
 * Empty categories are hidden. Categories with >3 items show "+N more".
 *
 * UX Contract:
 * - 44px touch targets on all pills
 * - Horizontal scroll on mobile per category
 * - Color-coded by status
 * - Actionable: every pill opens drill-down
 */

import React, { useMemo, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { TechnicianSummary } from '../../types';
import { fadeInUp, staggerContainerFast } from '../../lib/animations';

interface TechnicianStatusGridProps {
  summaries: TechnicianSummary[];
  onTechnicianClick: (techId: string) => void;
  className?: string;
}

interface StatusCategory {
  key: 'working' | 'idle' | 'offline';
  label: string;
  icon: string;
  color: {
    bg: string;
    text: string;
    pill: string;
    pillHover: string;
    dot: string;
    count: string;
  };
}

const CATEGORIES: StatusCategory[] = [
  {
    key: 'working',
    label: 'Working',
    icon: 'engineering',
    color: {
      bg: 'bg-emerald-500/10',
      text: 'text-emerald-400',
      pill: 'bg-emerald-500/15 border-emerald-500/30',
      pillHover: 'hover:bg-emerald-500/25',
      dot: 'bg-emerald-500',
      count: 'text-emerald-300',
    },
  },
  {
    key: 'idle',
    label: 'Idle',
    icon: 'hourglass_empty',
    color: {
      bg: 'bg-amber-500/10',
      text: 'text-amber-400',
      pill: 'bg-amber-500/15 border-amber-500/30',
      pillHover: 'hover:bg-amber-500/25',
      dot: 'bg-amber-500',
      count: 'text-amber-300',
    },
  },
  {
    key: 'offline',
    label: 'Offline',
    icon: 'wifi_off',
    color: {
      bg: 'bg-slate-500/10',
      text: 'text-slate-400',
      pill: 'bg-slate-500/15 border-slate-500/30',
      pillHover: 'hover:bg-slate-500/25',
      dot: 'bg-slate-500',
      count: 'text-slate-400',
    },
  },
];

const MAX_VISIBLE_PILLS = 3;

const TechnicianStatusGrid: React.FC<TechnicianStatusGridProps> = ({
  summaries,
  onTechnicianClick,
  className = '',
}) => {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const groups: Record<string, TechnicianSummary[]> = {
      working: [],
      idle: [],
      offline: [],
    };

    summaries.forEach(summary => {
      if (groups[summary.status]) {
        groups[summary.status].push(summary);
      }
    });

    return groups;
  }, [summaries]);

  const handleExpand = useCallback((categoryKey: string) => {
    setExpandedCategory(prev => prev === categoryKey ? null : categoryKey);
  }, []);

  const nonEmptyCategories = CATEGORIES.filter(cat => grouped[cat.key].length > 0);

  if (nonEmptyCategories.length === 0) {
    return null;
  }

  return (
    <motion.div
      variants={staggerContainerFast}
      initial="hidden"
      animate="visible"
      className={`space-y-3 ${className}`}
    >
      {nonEmptyCategories.map(category => {
        const techs = grouped[category.key];
        const isExpanded = expandedCategory === category.key;
        const visibleTechs = isExpanded ? techs : techs.slice(0, MAX_VISIBLE_PILLS);
        const overflowCount = techs.length - MAX_VISIBLE_PILLS;

        return (
          <motion.div key={category.key} variants={fadeInUp}>
            {/* Category header */}
            <div className="flex items-center gap-2 mb-2">
              <span className={`size-2 rounded-full ${category.color.dot}`} />
              <span className={`text-xs font-bold uppercase tracking-wider ${category.color.text}`}>
                {category.label}
              </span>
              <span className={`text-xs font-bold ${category.color.count}`}>
                ({techs.length})
              </span>
            </div>

            {/* Pills - horizontal wrap layout */}
            <div className="flex flex-wrap gap-2">
              {visibleTechs.map(tech => (
                <button
                  key={tech.id}
                  onClick={() => onTechnicianClick(tech.id)}
                  className={`
                    flex items-center gap-2 px-3 py-2 rounded-xl border
                    ${category.color.pill} ${category.color.pillHover}
                    transition-colors min-h-[44px]
                    focus:outline-none focus:ring-2 focus:ring-primary
                  `}
                  aria-label={`${tech.name} - ${category.label}${tech.activeJobTitle ? `: ${tech.activeJobTitle}` : ''}`}
                >
                  <span className={`size-2 rounded-full ${category.color.dot} shrink-0`} />
                  <span className="text-sm font-medium text-white truncate max-w-[120px]">
                    {tech.name}
                  </span>
                  {category.key === 'working' && tech.activeJobTitle && (
                    <span className="text-xs text-slate-400 truncate max-w-[80px] hidden sm:inline">
                      {tech.activeJobTitle}
                    </span>
                  )}
                  {category.key === 'idle' && tech.jobsRemaining > 0 && (
                    <span className="text-xs text-amber-400/80">
                      {tech.jobsRemaining} pending
                    </span>
                  )}
                  <span className="material-symbols-outlined text-xs text-slate-400 shrink-0">
                    chevron_right
                  </span>
                </button>
              ))}

              {/* +N more pill */}
              {!isExpanded && overflowCount > 0 && (
                <button
                  onClick={() => handleExpand(category.key)}
                  className={`
                    flex items-center gap-1 px-3 py-2 rounded-xl border border-dashed
                    ${category.color.pill} ${category.color.pillHover}
                    transition-colors min-h-[44px]
                    focus:outline-none focus:ring-2 focus:ring-primary
                  `}
                  aria-label={`Show ${overflowCount} more ${category.label.toLowerCase()} technicians`}
                >
                  <span className={`text-sm font-medium ${category.color.text}`}>
                    +{overflowCount} more
                  </span>
                </button>
              )}

              {/* Collapse button when expanded */}
              {isExpanded && overflowCount > 0 && (
                <button
                  onClick={() => handleExpand(category.key)}
                  className={`
                    flex items-center gap-1 px-3 py-2 rounded-xl border border-dashed
                    ${category.color.pill} ${category.color.pillHover}
                    transition-colors min-h-[44px]
                    focus:outline-none focus:ring-2 focus:ring-primary
                  `}
                  aria-label="Show less"
                >
                  <span className={`text-sm font-medium ${category.color.text}`}>
                    Show less
                  </span>
                </button>
              )}
            </div>
          </motion.div>
        );
      })}
    </motion.div>
  );
};

export default React.memo(TechnicianStatusGrid);
