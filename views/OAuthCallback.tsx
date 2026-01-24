/**
 * OAuthCallback - OAuth callback handler
 *
 * Handles OAuth provider redirects and completes authentication flow.
 * This is a stub component - OAuth flow is handled by Supabase Auth.
 */

import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const OAuthCallback: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Supabase handles OAuth callback automatically
    // This page just shows loading while redirect happens
    const timer = setTimeout(() => {
      navigate('/admin', { replace: true });
    }, 2000);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="size-16 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
        <p className="text-slate-400 text-sm font-black uppercase tracking-widest">
          Completing sign in...
        </p>
      </div>
    </div>
  );
};

export default OAuthCallback;
