import React, { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  cachedPlan: string | null;
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
    } catch {}
    return { hasError: true, error, cachedPlan };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error for debugging
    console.error('[ErrorBoundary] Caught error:', error.name, error.message);
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
            {!isNetworkError && this.state.cachedPlan && (
              <div className="bg-slate-800 rounded-xl p-3 mb-4">
                <p className="text-slate-300 text-xs">
                  <span className="text-primary font-bold">Plan:</span>{' '}
                  {this.state.cachedPlan}
                </p>
              </div>
            )}
            <button
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-primary text-white rounded-xl font-bold text-sm uppercase"
            >
              {isNetworkError ? 'Retry' : 'Reload'}
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
