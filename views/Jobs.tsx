/**
 * Jobs - Legacy jobs view redirect
 *
 * This is a stub that redirects to the JobsList component.
 * The actual jobs view is at views/app/jobs/JobsList.tsx
 */

import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const Jobs: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    navigate('/admin/jobs', { replace: true });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="size-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
    </div>
  );
};

export default Jobs;
