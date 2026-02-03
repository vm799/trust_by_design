
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ThemeProvider } from './lib/theme';
import ErrorBoundary from './components/ErrorBoundary';
import { validateAndLog } from './lib/envValidation';
import { TestingControlPlane, type TestingControlPlaneType } from './lib/testingControlPlane';
import './src/styles/theme.css';

// Validate environment configuration at startup
validateAndLog(false); // Don't throw on errors, just log warnings

// Expose Testing Control Plane in dev mode for Playwright/console access
// SECURITY: Only exposed when import.meta.env.DEV is true
if (import.meta.env.DEV) {
  // TypeScript declaration for window augmentation
  declare global {
    interface Window {
      __JOBPROOF_TEST__: TestingControlPlaneType;
      __resetApp__: () => Promise<void>;
    }
  }

  window.__JOBPROOF_TEST__ = TestingControlPlane;
  window.__resetApp__ = async () => {
    const result = await TestingControlPlane.resetAll();
    console.log('[DEV] Reset result:', result);
    if (result.success) {
      window.location.reload();
    }
  };

  console.log('[DEV] Testing Control Plane available at window.__JOBPROOF_TEST__');
  console.log('[DEV] Quick reset: await window.__resetApp__()');
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
