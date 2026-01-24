/**
 * Landing - Legacy landing page redirect
 *
 * This is a stub that redirects to the main LandingPage component.
 * The actual landing page is at views/LandingPage.tsx
 */

import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const Landing: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    navigate('/', { replace: true });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="size-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
    </div>
  );
};

export default Landing;
