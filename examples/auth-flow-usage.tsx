/**
 * Auth Flow Usage Examples
 * =========================
 *
 * This file demonstrates various usage patterns for the new auth flow system.
 */

import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthFlow } from '../hooks/useAuthFlow';
import { authFlowManager } from '../lib/authFlowManager';

// ============================================================================
// EXAMPLE 1: Basic Protected Route Component
// ============================================================================

export const ProtectedDashboard: React.FC = () => {
  const { isLoading, isAuthenticated, user, error } = useAuthFlow();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      // User not authenticated, redirect to login
      navigate('/auth', { replace: true });
    }
  }, [isLoading, isAuthenticated, navigate]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 text-red-700 rounded-md">
        <h3 className="font-semibold">Authentication Error</h3>
        <p>{error.message}</p>
      </div>
    );
  }

  if (!user) {
    return null; // Redirecting...
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
      <div className="bg-white rounded-lg shadow p-4">
        <p><strong>Name:</strong> {user.full_name || 'Not set'}</p>
        <p><strong>Email:</strong> {user.email}</p>
        <p><strong>Role:</strong> {user.role}</p>
        <p><strong>Workspace:</strong> {user.workspace?.name || 'No workspace'}</p>
        <p><strong>Personas:</strong> {user.personas.length > 0 ? user.personas.map(p => p.persona_type).join(', ') : 'None'}</p>
      </div>
    </div>
  );
};

// ============================================================================
// EXAMPLE 2: Landing Page with Auto-Redirect
// ============================================================================

export const SmartLandingPage: React.FC = () => {
  const { isLoading, isAuthenticated, user, needsSetup } = useAuthFlow();
  const navigate = useNavigate();

  useEffect(() => {
    // Don't redirect while loading
    if (isLoading) return;

    // Redirect authenticated users
    if (isAuthenticated) {
      if (needsSetup) {
        // User needs to complete workspace setup
        navigate('/auth/setup', { replace: true });
      } else if (user && user.workspace) {
        // User is fully set up, redirect to appropriate dashboard
        const persona = user.personas.find(p => p.is_active)?.persona_type?.toLowerCase();

        if (persona === 'technician' || persona === 'contractor') {
          navigate('/contractor', { replace: true });
        } else if (persona === 'client') {
          navigate('/client', { replace: true });
        } else {
          navigate('/admin', { replace: true });
        }
      }
    }
  }, [isLoading, isAuthenticated, user, needsSetup, navigate]);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600">
      <div className="container mx-auto px-4 py-20">
        <h1 className="text-5xl font-bold text-white text-center mb-8">
          Welcome to JobProof
        </h1>
        <div className="text-center">
          <button
            onClick={() => navigate('/auth')}
            className="bg-white text-blue-600 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100"
          >
            Get Started
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// EXAMPLE 3: OAuth Setup Completion
// ============================================================================

export const OAuthSetupComplete: React.FC = () => {
  const { refresh } = useAuthFlow();
  const navigate = useNavigate();

  const handleComplete = async () => {
    // User has just completed OAuth setup (workspace creation)
    // Refresh auth state to get updated profile
    await refresh();

    // The useAuthFlow hook will detect the complete profile
    // and trigger appropriate redirect in other components
    navigate('/admin', { replace: true });
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Setup Complete!</h2>
      <button
        onClick={handleComplete}
        className="bg-indigo-600 text-white px-6 py-2 rounded-md hover:bg-indigo-700"
      >
        Go to Dashboard
      </button>
    </div>
  );
};

// ============================================================================
// EXAMPLE 4: Manual Auth Check (Non-React)
// ============================================================================

export async function checkAuthBeforeAction(): Promise<boolean> {
  const result = await authFlowManager.initializeAuthFlow();

  if (!result.success) {
    console.error('Auth check failed:', result.error);
    return false;
  }

  if (!result.session || !result.user) {
    console.log('User not authenticated');
    return false;
  }

  if (result.needsSetup) {
    console.log('User needs to complete setup');
    return false;
  }

  // User is fully authenticated
  console.log('User authenticated:', result.user.email);
  return true;
}

// ============================================================================
// EXAMPLE 5: Role-Based Access Control
// ============================================================================

export const AdminOnlyComponent: React.FC = () => {
  const { isLoading, isAuthenticated, user } = useAuthFlow();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate('/auth', { replace: true });
      return;
    }

    if (!isLoading && user && user.role !== 'owner' && user.role !== 'admin') {
      // User is not an admin, redirect to their appropriate dashboard
      navigate('/contractor', { replace: true });
    }
  }, [isLoading, isAuthenticated, user, navigate]);

  if (isLoading) return <LoadingSpinner />;
  if (!user) return null;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-red-600 mb-4">Admin Panel</h1>
      <p>Only owners and admins can see this.</p>
    </div>
  );
};

// ============================================================================
// EXAMPLE 6: Auth State Listener
// ============================================================================

export const AuthStateLogger: React.FC = () => {
  useEffect(() => {
    const unsubscribe = authFlowManager.onAuthFlowChange((result) => {
      console.log('Auth state changed:', {
        authenticated: !!result.session && !!result.user,
        email: result.user?.email,
        workspace: result.user?.workspace?.name,
        needsSetup: result.needsSetup,
        error: result.error,
      });
    });

    return () => unsubscribe();
  }, []);

  return null; // This component just logs auth changes
};

// ============================================================================
// EXAMPLE 7: Conditional Rendering Based on Auth State
// ============================================================================

export const ConditionalFeature: React.FC = () => {
  const { isAuthenticated, user } = useAuthFlow();

  // Show different content based on auth state
  if (!isAuthenticated) {
    return (
      <div className="bg-gray-100 p-4 rounded-md">
        <p>Sign in to unlock this feature</p>
        <button className="mt-2 bg-blue-600 text-white px-4 py-2 rounded">
          Sign In
        </button>
      </div>
    );
  }

  if (user?.workspace?.subscription_tier === 'free') {
    return (
      <div className="bg-yellow-100 p-4 rounded-md">
        <p>Upgrade to Pro to unlock this feature</p>
        <button className="mt-2 bg-yellow-600 text-white px-4 py-2 rounded">
          Upgrade Now
        </button>
      </div>
    );
  }

  return (
    <div className="bg-green-100 p-4 rounded-md">
      <p>Premium feature content here</p>
    </div>
  );
};

// ============================================================================
// EXAMPLE 8: User Profile Display
// ============================================================================

export const UserProfileCard: React.FC = () => {
  const { isLoading, user } = useAuthFlow();

  if (isLoading) {
    return <div className="animate-pulse bg-gray-200 h-24 rounded-md"></div>;
  }

  if (!user) {
    return (
      <div className="bg-gray-100 p-4 rounded-md">
        <p className="text-gray-600">Not signed in</p>
      </div>
    );
  }

  return (
    <div className="bg-white shadow rounded-lg p-4">
      <div className="flex items-center space-x-4">
        <div className="w-12 h-12 bg-indigo-600 rounded-full flex items-center justify-center text-white font-bold">
          {user.full_name?.charAt(0) || user.email.charAt(0).toUpperCase()}
        </div>
        <div>
          <h3 className="font-semibold">{user.full_name || user.email}</h3>
          <p className="text-sm text-gray-600">{user.email}</p>
          <p className="text-xs text-gray-500">{user.role} • {user.workspace?.name}</p>
        </div>
      </div>

      {user.personas.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {user.personas.map((persona) => (
            <span
              key={persona.id}
              className={`px-2 py-1 text-xs rounded-full ${
                persona.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {persona.persona_type}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// UTILITY COMPONENTS
// ============================================================================

const LoadingSpinner: React.FC = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-indigo-600"></div>
  </div>
);
