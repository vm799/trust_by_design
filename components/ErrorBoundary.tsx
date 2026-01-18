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
    console.error('ErrorBoundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
          <div className="max-w-md bg-slate-900 border border-danger/20 rounded-3xl p-8 text-center">
            <div className="bg-danger/10 size-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-danger text-3xl">
                error
              </span>
            </div>
            <h2 className="text-2xl font-black text-white uppercase mb-2">
              Error
            </h2>
            <p className="text-slate-400 text-sm mb-4">
              Using cached data
            </p>
            {this.state.cachedPlan && (
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
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
