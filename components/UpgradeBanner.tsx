import React from 'react';
import { Link } from 'react-router-dom';

interface Props {
  tier: 'solo' | 'team' | 'agency';
  jobsUsed: number;
  jobsLimit: number;
  usagePercent: number;
}

const UpgradeBanner: React.FC<Props> = ({
  tier,
  jobsUsed,
  jobsLimit,
  usagePercent
}) => {
  if (tier !== 'solo' || usagePercent < 60) return null;

  const isAtLimit = jobsUsed >= jobsLimit;

  return (
    <div
      className={`rounded-2xl p-4 mb-6 border ${
        isAtLimit
          ? 'bg-danger/10 border-danger/20'
          : 'bg-warning/10 border-warning/20'
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`material-symbols-outlined ${
            isAtLimit ? 'text-danger' : 'text-warning'
          } text-2xl`}
        >
          {isAtLimit ? 'block' : 'warning'}
        </span>
        <div className="flex-1">
          <h3
            className={`font-black text-sm uppercase mb-1 ${
              isAtLimit ? 'text-danger' : 'text-warning'
            }`}
          >
            {isAtLimit ? 'Job Limit Reached' : 'Approaching Limit'}
          </h3>
          <p className="text-slate-700 dark:text-slate-300 text-xs mb-3">
            {jobsUsed}/{jobsLimit} jobs used. Upgrade to Team for unlimited
            jobs.
          </p>
          <div className="bg-gray-100 dark:bg-slate-800 rounded-full h-2 mb-3 overflow-hidden">
            <div
              className={`h-full ${
                isAtLimit ? 'bg-danger' : 'bg-warning'
              }`}
              style={{ width: `${Math.min(usagePercent, 100)}%` }}
            />
          </div>
          <Link
            to="/pricing"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl font-bold text-xs uppercase"
          >
            <span className="material-symbols-outlined text-sm">upgrade</span>
            Upgrade to Team
          </Link>
        </div>
      </div>
    </div>
  );
};

export default UpgradeBanner;
