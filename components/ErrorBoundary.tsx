import React, { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  cachedPlan: string | null;
}

/**
 * Clear all persistence layers and reload
 * Removes: localStorage, sessionStorage, service worker caches, IndexedDB
 */
async function clearAllAndReload(): Promise<void> {
  // 1. Clear localStorage
  try {
    const keys = Object.keys(localStorage);
    for (const key of keys) {
      if (key.startsWith('jobproof_') || key.startsWith('supabase.') || key.startsWith('sb-')) {
        localStorage.removeItem(key);
      }
    }
  } catch { /* ignore */ }

  // 2. Clear sessionStorage
  try {
    sessionStorage.clear();
  } catch { /* ignore */ }

  // 3. Unregister service workers and clear caches
  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(r => r.unregister()));
    }
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
    }
  } catch { /* ignore */ }

  // 4. Clear IndexedDB
  try {
    const dbs = await indexedDB.databases();
    for (const db of dbs) {
      if (db.name) indexedDB.deleteDatabase(db.name);
    }
  } catch { /* ignore */ }

  // 5. Hard reload (bypass cache)
  window.location.href = window.location.pathname;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, cachedPlan: null };
  }

  static getDerivedStateFromError(error: Error): State {
    let cachedPlan = 'Solo';
    try {
      const cached = localStorage.getItem('jobproof_subscription_v1');
      if (cached) {
        const { data } = JSON.parse(cached);
        cachedPlan =
          data.tier.charAt(0).toUpperCase() + data.tier.slice(1);
      }
    } catch {
      // Error parsing cached data - use default plan
    }
    return { hasError: true, error, cachedPlan };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error for debugging - include component stack for diagnosis
    console.error('[ErrorBoundary] Caught error:', error.name, error.message);
    console.error('[ErrorBoundary] Stack:', error.stack);
    console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);
  }

  isChunkLoadError(): boolean {
    const error = this.state.error;
    if (!error) return false;
    // Check for common chunk load error patterns
    return (
      error.name === 'ChunkLoadError' ||
      error.message.includes('Loading chunk') ||
      error.message.includes('Failed to fetch') ||
      error.message.includes('Load failed') ||
      error.message.includes('dynamically imported module')
    );
  }

  render() {
    if (this.state.hasError) {
      const isNetworkError = this.isChunkLoadError();
      const error = this.state.error;

      return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
          <div className="max-w-md bg-slate-900 border border-danger/20 rounded-3xl p-8 text-center">
            <div className="bg-danger/10 size-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-danger text-3xl">
                {isNetworkError ? 'wifi_off' : 'error'}
              </span>
            </div>
            <h2 className="text-2xl font-black text-white uppercase mb-2">
              {isNetworkError ? 'Connection Issue' : 'Error'}
            </h2>
            <p className="text-slate-400 text-sm mb-4">
              {isNetworkError
                ? 'Failed to load app resources. Check your internet connection.'
                : 'Something went wrong. Using cached data.'}
            </p>
            {/* Show error details for diagnosis */}
            {error && (
              <div className="bg-slate-800 rounded-xl p-3 mb-4 text-left">
                <p className="text-red-400 text-xs font-mono break-all">
                  {error.name}: {error.message}
                </p>
                {error.stack && (
                  <details className="mt-2">
                    <summary className="text-slate-500 text-[10px] cursor-pointer">Stack trace</summary>
                    <pre className="text-slate-500 text-[10px] mt-1 whitespace-pre-wrap break-all max-h-32 overflow-auto">
                      {error.stack}
                    </pre>
                  </details>
                )}
              </div>
            )}
            {!isNetworkError && this.state.cachedPlan && (
              <div className="bg-slate-800 rounded-xl p-3 mb-4">
                <p className="text-slate-300 text-xs">
                  <span className="text-primary font-bold">Plan:</span>{' '}
                  {this.state.cachedPlan}
                </p>
              </div>
            )}
            <div className="space-y-3">
              <button
                onClick={() => window.location.reload()}
                className="w-full min-h-[44px] py-3 bg-primary text-white rounded-xl font-bold text-sm uppercase"
              >
                {isNetworkError ? 'Retry' : 'Reload'}
              </button>
              <button
                onClick={() => clearAllAndReload()}
                className="w-full min-h-[44px] py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-bold text-sm uppercase transition-colors"
              >
                Clear Cache & Reload
              </button>
              <button
                onClick={() => {
                  // Sign out and clear everything
                  try {
                    const keys = Object.keys(localStorage);
                    for (const key of keys) {
                      if (key.startsWith('sb-') || key.startsWith('supabase.')) {
                        localStorage.removeItem(key);
                      }
                    }
                  } catch { /* ignore */ }
                  window.location.href = window.location.pathname + '#/auth';
                  window.location.reload();
                }}
                className="w-full min-h-[44px] py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-xs uppercase transition-colors"
              >
                Sign Out & Reset
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
