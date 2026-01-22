import React from 'react';
import { useNavigate } from 'react-router-dom';

interface Props {
  onSelect: (persona: string) => void;
  disabled?: boolean;
}

/**
 * Site Supervisor Persona Card
 *
 * Target: Coordinators managing 5-20 technicians daily
 * Key needs: Crew assignment, material tracking, safety compliance
 * Mobile-first: 90% iPhone usage on construction sites
 */
const SiteSupervisorCard: React.FC<Props> = ({ onSelect, disabled = false }) => {
  const navigate = useNavigate();

  const handleSelect = () => {
    if (disabled) return;
    onSelect('site_supervisor');
    navigate('/onboarding/site_supervisor/daily_briefing');
  };

  return (
    <button
      onClick={handleSelect}
      disabled={disabled}
      className={`
        group relative p-8 rounded-3xl border-2 transition-all text-left
        ${disabled
          ? 'bg-slate-800 border-slate-700 opacity-50 cursor-not-allowed'
          : 'bg-slate-900 border-slate-700 hover:border-primary hover:bg-slate-800 cursor-pointer active:scale-95'
        }
      `}
    >
      {/* Icon */}
      <div className="mb-6 size-16 rounded-2xl bg-safety-orange/10 flex items-center justify-center group-hover:bg-safety-orange/20 transition-all">
        <span className="material-symbols-outlined text-safety-orange text-4xl">
          engineering
        </span>
      </div>

      {/* Title */}
      <h3 className="text-2xl font-black text-white uppercase tracking-tight mb-2">
        Site Supervisor
      </h3>

      {/* Subtitle */}
      <p className="text-slate-400 text-sm mb-4">
        Coordinate crews, track materials, ensure safety compliance
      </p>

      {/* Key Features */}
      <ul className="space-y-2 mb-6">
        <li className="flex items-center gap-2 text-slate-300 text-xs">
          <span className="material-symbols-outlined text-safety-orange text-sm">check_circle</span>
          Daily crew assignment
        </li>
        <li className="flex items-center gap-2 text-slate-300 text-xs">
          <span className="material-symbols-outlined text-safety-orange text-sm">check_circle</span>
          Material tracking & deliveries
        </li>
        <li className="flex items-center gap-2 text-slate-300 text-xs">
          <span className="material-symbols-outlined text-safety-orange text-sm">check_circle</span>
          Safety rounds & inspections
        </li>
        <li className="flex items-center gap-2 text-slate-300 text-xs">
          <span className="material-symbols-outlined text-safety-orange text-sm">check_circle</span>
          End-of-day reporting
        </li>
      </ul>

      {/* Use Case */}
      <div className="bg-safety-orange/5 rounded-xl p-3 border border-safety-orange/10">
        <p className="text-orange-400 text-xs font-bold mb-1">Perfect for:</p>
        <p className="text-slate-400 text-xs">
          Site managers coordinating 5-20 technicians across multiple jobs daily
        </p>
      </div>

      {/* Hover Arrow */}
      {!disabled && (
        <div className="absolute top-8 right-8 opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="material-symbols-outlined text-primary text-3xl">
            arrow_forward
          </span>
        </div>
      )}
    </button>
  );
};

export default SiteSupervisorCard;
