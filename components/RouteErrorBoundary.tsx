/**
 * RouteErrorBoundary - Route-level error isolation
 *
 * REMEDIATION ITEM 3: Prevents single route failure from crashing entire app
 *
 * Features:
 * - Catches errors within a specific route
 * - Shows friendly error UI with retry and navigation options
 * - Logs errors for debugging
 * - Supports custom fallback routes
 */

import React, { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Route to navigate to on "Go Back" (default: /admin) */
  fallbackRoute?: string;
  /** Name of the section for error message (default: "this page") */
  sectionName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

class RouteErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo });
    console.error('[RouteErrorBoundary] Route error:', {
      name: error.name,
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleGoBack = () => {
    const { fallbackRoute = '/admin' } = this.props;
    // Use hash router navigation
    window.location.hash = fallbackRoute;
    // Reset error state after navigation
    setTimeout(() => {
      this.setState({ hasError: false, error: null, errorInfo: null });
    }, 100);
  };

  isChunkLoadError(): boolean {
    const { error } = this.state;
    if (!error) return false;
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
      const { sectionName = 'this page' } = this.props;
      const isNetworkError = this.isChunkLoadError();

      return (
        <div className="min-h-[60vh] flex items-center justify-center p-6">
          <div className="max-w-md bg-slate-900/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-8 text-center">
            {/* Icon */}
            <div className={`size-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
              isNetworkError ? 'bg-amber-500/10' : 'bg-danger/10'
            }`}>
              <span className={`material-symbols-outlined text-3xl ${
                isNetworkError ? 'text-amber-400' : 'text-danger'
              }`}>
                {isNetworkError ? 'wifi_off' : 'error_outline'}
              </span>
            </div>

            {/* Title */}
            <h2 className="text-xl font-bold text-white mb-2">
              {isNetworkError ? 'Connection Issue' : 'Something went wrong'}
            </h2>

            {/* Description */}
            <p className="text-slate-400 text-sm mb-6">
              {isNetworkError
                ? `Failed to load ${sectionName}. Check your connection and try again.`
                : `We couldn't load ${sectionName}. This error has been logged.`}
            </p>

            {/* Error details (dev only) */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="bg-slate-800/50 rounded-xl p-3 mb-4 text-left overflow-auto max-h-32">
                <p className="text-xs font-mono text-red-400">
                  {this.state.error.name}: {this.state.error.message}
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={this.handleGoBack}
                className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-medium text-sm transition-colors"
              >
                Go Back
              </button>
              <button
                onClick={this.handleRetry}
                className="flex-1 py-3 bg-primary hover:bg-primary/90 text-white rounded-xl font-medium text-sm transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default RouteErrorBoundary;

/**
 * Higher-order component for wrapping route elements
 */
export function withRouteErrorBoundary(
  Component: React.ComponentType<any>,
  options?: { fallbackRoute?: string; sectionName?: string }
) {
  return function WrappedWithErrorBoundary(props: any) {
    return (
      <RouteErrorBoundary
        fallbackRoute={options?.fallbackRoute}
        sectionName={options?.sectionName}
      >
        <Component {...props} />
      </RouteErrorBoundary>
    );
  };
}
