/**
 * Developer Reset View
 *
 * Full-page reset interface for developers.
 * Access via: /#/dev/reset
 *
 * Shows current state of all persistence layers and allows targeted or full reset.
 * NOT for end users - this is a developer tool.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  clearServiceWorker,
  clearIndexedDB,
  clearLocalStorage,
  clearSessionStorage,
  clearCookies,
  clearSupabaseSession,
  getBuildInfo,
  getStorageDiagnostics,
  isDevMode,
  enableDevMode,
  disableDevMode,
} from '../lib/devReset';
import {
  TestingControlPlane,
  type ResetResult,
  type LayerStatus,
} from '../lib/testingControlPlane';

interface LayerDisplayStatus {
  name: string;
  items: number | string;
  size?: string;
  details?: string[];
}

const DevReset: React.FC = () => {
  const navigate = useNavigate();
  const [isResetting, setIsResetting] = useState(false);
  const [resetResult, setResetResult] = useState<ResetResult | null>(null);
  const [layers, setLayers] = useState<LayerDisplayStatus[]>([]);
  const [controlPlaneStatus, setControlPlaneStatus] = useState<LayerStatus | null>(null);
  const [devModeEnabled, setDevModeEnabled] = useState(isDevMode());

  const buildInfo = getBuildInfo();

  // Gather stats about each persistence layer using TestingControlPlane
  const gatherLayerStats = useCallback(async () => {
    const stats: LayerDisplayStatus[] = [];

    // Use TestingControlPlane for comprehensive status if available
    try {
      if (TestingControlPlane.isTestingAllowed()) {
        const cpStatus = await TestingControlPlane.getLayerStatus();
        setControlPlaneStatus(cpStatus);

        // Service Worker
        stats.push({
          name: 'Service Worker',
          items: cpStatus.serviceWorker.active ? 'Active' : 'Inactive',
          details: cpStatus.serviceWorker.active
            ? [`Version: ${cpStatus.serviceWorker.version || 'unknown'}`, `Scope: ${cpStatus.serviceWorker.scope}`]
            : undefined,
        });

        // Caches
        stats.push({
          name: 'Cache Storage',
          items: `${cpStatus.caches.count} caches`,
          details: cpStatus.caches.names.length > 0 ? cpStatus.caches.names : undefined,
        });

        // IndexedDB
        const tableDetails = Object.entries(cpStatus.indexedDB.tables)
          .map(([table, count]) => `${table}: ${count} rows`);
        stats.push({
          name: 'IndexedDB',
          items: `${cpStatus.indexedDB.databaseCount} databases`,
          details: tableDetails.length > 0 ? tableDetails : undefined,
        });

        // LocalStorage
        stats.push({
          name: 'LocalStorage',
          items: `${cpStatus.localStorage.jobproofKeyCount} app keys (${cpStatus.localStorage.keyCount} total)`,
          details: cpStatus.localStorage.keys.filter(k =>
            k.startsWith('jobproof_') || k.startsWith('sb-') || k.startsWith('supabase.')
          ).slice(0, 10),
        });

        // SessionStorage
        stats.push({
          name: 'SessionStorage',
          items: `${cpStatus.sessionStorage.keyCount} keys`,
          details: cpStatus.sessionStorage.keys.length > 0 ? cpStatus.sessionStorage.keys : undefined,
        });

        // Cookies
        const cookies = document.cookie.split(';').filter(c => c.trim());
        stats.push({
          name: 'Cookies',
          items: `${cookies.length} cookies`,
          details: cookies.length > 0 ? cookies.map(c => c.trim().split('=')[0]) : undefined,
        });

        // Supabase Auth
        stats.push({
          name: 'Supabase Session',
          items: cpStatus.supabaseAuth.hasSession ? 'Active' : 'None',
          details: cpStatus.supabaseAuth.hasSession
            ? [`User: ${cpStatus.supabaseAuth.userId || 'unknown'}`]
            : undefined,
        });

        setLayers(stats);
        return;
      }
    } catch (error) {
      console.warn('[DevReset] TestingControlPlane not available, using fallback:', error);
    }

    // Fallback: manual stats gathering
    // 1. Service Worker
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      stats.push({
        name: 'Service Worker',
        items: reg?.active ? 'Active' : 'Inactive',
        details: reg ? [`Scope: ${reg.scope}`, `State: ${reg.active?.state || 'none'}`] : undefined,
      });
    } else {
      stats.push({ name: 'Service Worker', items: 'Not supported' });
    }

    // 2. Cache API
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      stats.push({
        name: 'Cache Storage',
        items: `${cacheNames.length} caches`,
        details: cacheNames.length > 0 ? cacheNames : undefined,
      });
    }

    // 3. IndexedDB
    if (indexedDB.databases) {
      const dbs = await indexedDB.databases();
      stats.push({
        name: 'IndexedDB',
        items: `${dbs.length} databases`,
        details: dbs.map(db => `${db.name} (v${db.version})`),
      });
    } else {
      stats.push({ name: 'IndexedDB', items: 'Unknown (API not available)' });
    }

    // 4. LocalStorage
    const localStorageKeys = Object.keys(localStorage).filter(
      k => k.startsWith('jobproof_') || k.startsWith('supabase.')
    );
    stats.push({
      name: 'LocalStorage',
      items: `${localStorageKeys.length} keys`,
      details: localStorageKeys.length > 0 ? localStorageKeys : undefined,
    });

    // 5. SessionStorage
    const sessionStorageKeys = Object.keys(sessionStorage);
    stats.push({
      name: 'SessionStorage',
      items: `${sessionStorageKeys.length} keys`,
      details: sessionStorageKeys.length > 0 ? sessionStorageKeys : undefined,
    });

    // 6. Cookies
    const cookies = document.cookie.split(';').filter(c => c.trim());
    stats.push({
      name: 'Cookies',
      items: `${cookies.length} cookies`,
      details: cookies.length > 0 ? cookies.map(c => c.trim().split('=')[0]) : undefined,
    });

    // 7. Supabase Auth
    const supabaseKeys = Object.keys(localStorage).filter(
      k => k.startsWith('sb-') || k.startsWith('supabase.')
    );
    stats.push({
      name: 'Supabase Session',
      items: supabaseKeys.length > 0 ? 'Active' : 'None',
      details: supabaseKeys.length > 0 ? supabaseKeys : undefined,
    });

    setLayers(stats);
  }, []);

  useEffect(() => {
    gatherLayerStats();
  }, [gatherLayerStats]);

  const handleFullReset = async () => {
    if (!confirm('This will clear ALL data and reload the app. Continue?')) {
      return;
    }

    setIsResetting(true);

    try {
      // Use TestingControlPlane for atomic reset with verification
      const result = await TestingControlPlane.resetAll(false); // Don't auto-reload
      setResetResult(result);

      // Refresh stats to show clean state
      await gatherLayerStats();
    } catch (error) {
      console.error('[DevReset] Reset failed:', error);
      setResetResult({
        success: false,
        layers: {
          serviceWorker: { cleared: false, unregistered: false, error: 'Failed' },
          indexedDB: { deleted: false, wasBlocked: false, error: 'Failed' },
          localStorage: { cleared: false, keyCount: 0, error: 'Failed' },
          sessionStorage: { cleared: false, error: 'Failed' },
          cookies: { cleared: false, error: 'Failed' },
          supabaseAuth: { signedOut: false, error: 'Failed' },
        },
        durationMs: 0,
        errors: [error instanceof Error ? error.message : String(error)],
        verified: false,
      });
    } finally {
      setIsResetting(false);
    }
  };

  /**
   * Auth-Only Reset: Clears auth state while preserving offline data
   *
   * Clears:
   * - Supabase session (logout)
   * - Auth-related localStorage (user profile, onboarding flag)
   * - SessionStorage (navigation intent)
   *
   * Preserves:
   * - IndexedDB (offline jobs, photos, drafts)
   * - Service Worker cache (offline capability)
   * - Cookies (non-auth)
   */
  const handleAuthOnlyReset = async () => {
    if (!confirm('This will log you out but preserve offline data. Continue?')) {
      return;
    }

    setIsResetting(true);

    // 1. Clear Supabase session first
    await clearSupabaseSession();

    // 2. Clear only auth-related localStorage keys
    const authPrefixes = ['jobproof_user', 'jobproof_onboarding', 'sb-', 'supabase.'];
    const keysToRemove = Object.keys(localStorage).filter(key =>
      authPrefixes.some(prefix => key.startsWith(prefix))
    );
    keysToRemove.forEach(key => {
      console.log('[DevReset] Auth-only: removing', key);
      localStorage.removeItem(key);
    });

    // 3. Clear sessionStorage (navigation intent, etc.)
    clearSessionStorage();

    // 4. DO NOT clear IndexedDB - preserves offline jobs/photos
    // 5. DO NOT clear Service Worker - preserves offline capability

    setIsResetting(false);
    await gatherLayerStats();

    // Navigate to auth page
    navigate('/#/auth');
    window.location.reload();
  };

  const handleLayerReset = async (layerName: string) => {
    setIsResetting(true);

    switch (layerName) {
      case 'Service Worker':
      case 'Cache Storage':
        await clearServiceWorker();
        break;
      case 'IndexedDB':
        await clearIndexedDB();
        break;
      case 'LocalStorage':
        clearLocalStorage(true);
        break;
      case 'SessionStorage':
        clearSessionStorage();
        break;
      case 'Cookies':
        clearCookies();
        break;
      case 'Supabase Session':
        await clearSupabaseSession();
        break;
    }

    setIsResetting(false);
    await gatherLayerStats();
  };

  const handleShowDiagnostics = async () => {
    const diag = await getStorageDiagnostics();
    console.log('='.repeat(60));
    console.log('[DevReset] Storage Diagnostics:');
    console.log(JSON.stringify(diag, null, 2));
    console.log('='.repeat(60));
    alert(`Storage Diagnostics logged to console.\n\nSummary:\n- localStorage: ${diag.localStorage.count} keys\n- sessionStorage: ${diag.sessionStorage.count} keys\n- IndexedDB: ${diag.indexedDB.count} databases\n- Caches: ${diag.caches.count} caches\n- Service Worker: ${diag.serviceWorker.active ? 'Active' : 'Inactive'}\n- Cookies: ${diag.cookies.count}`);
  };

  const toggleDevMode = () => {
    if (devModeEnabled) {
      disableDevMode();
      setDevModeEnabled(false);
    } else {
      enableDevMode();
      setDevModeEnabled(true);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Developer Reset</h1>
            <p className="text-slate-400 text-sm mt-1">
              Clear persistence layers for testing
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm"
          >
            Back
          </button>
        </div>

        {/* Build Info */}
        <div className="bg-slate-900 rounded-xl p-4 mb-6 border border-slate-800">
          <h2 className="text-sm font-semibold text-slate-400 mb-3">Build Info</h2>
          <div className="grid grid-cols-2 gap-2 text-sm font-mono">
            <span className="text-slate-500">Commit:</span>
            <span className="text-slate-300">{buildInfo.commit}</span>
            <span className="text-slate-500">Schema:</span>
            <span className="text-slate-300">v{buildInfo.schemaVersion}</span>
            <span className="text-slate-500">SW Version:</span>
            <span className="text-slate-300">{buildInfo.swVersion}</span>
            <span className="text-slate-500">Built:</span>
            <span className="text-slate-300">
              {new Date(buildInfo.buildTime).toLocaleString()}
            </span>
            <span className="text-slate-500">Mode:</span>
            <span className="text-slate-300">
              {import.meta.env.DEV ? 'Development' : 'Production'}
            </span>
          </div>
        </div>

        {/* Dev Mode Toggle */}
        <div className="bg-slate-900 rounded-xl p-4 mb-6 border border-slate-800">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-300">Dev Mode</h2>
              <p className="text-xs text-slate-500 mt-1">
                Shows build badge on all pages
              </p>
            </div>
            <button
              type="button"
              onClick={toggleDevMode}
              className={`
                relative w-12 h-6 rounded-full transition-colors
                ${devModeEnabled ? 'bg-green-600' : 'bg-slate-700'}
              `}
            >
              <span
                className={`
                  absolute top-1 w-4 h-4 bg-white rounded-full transition-transform
                  ${devModeEnabled ? 'left-7' : 'left-1'}
                `}
              />
            </button>
          </div>
        </div>

        {/* Persistence Layers */}
        <div className="bg-slate-900 rounded-xl p-4 mb-6 border border-slate-800">
          <h2 className="text-sm font-semibold text-slate-400 mb-4">
            Persistence Layers
          </h2>
          <div className="space-y-3">
            {layers.map((layer) => (
              <div
                key={layer.name}
                className="flex items-start justify-between p-3 bg-slate-800/50 rounded-lg"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-200">{layer.name}</span>
                    <span className="text-xs px-2 py-0.5 bg-slate-700 rounded text-slate-400">
                      {layer.items}
                    </span>
                  </div>
                  {layer.details && layer.details.length > 0 && (
                    <ul className="mt-2 text-xs text-slate-500 space-y-0.5">
                      {layer.details.slice(0, 5).map((detail, i) => (
                        <li key={i} className="font-mono truncate">
                          {detail}
                        </li>
                      ))}
                      {layer.details.length > 5 && (
                        <li className="text-slate-600">
                          ...and {layer.details.length - 5} more
                        </li>
                      )}
                    </ul>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleLayerReset(layer.name)}
                  disabled={isResetting}
                  className="px-3 py-1.5 bg-red-900/30 hover:bg-red-900/50 text-red-300 rounded text-xs font-medium disabled:opacity-50"
                >
                  Clear
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Reset Result */}
        {resetResult && (
          <div
            className={`
              rounded-xl p-4 mb-6 border
              ${resetResult.success && resetResult.verified
                ? 'bg-green-900/20 border-green-800'
                : resetResult.success
                ? 'bg-yellow-900/20 border-yellow-800'
                : 'bg-red-900/20 border-red-800'
              }
            `}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">
                {resetResult.success && resetResult.verified
                  ? '✓ Reset Complete & Verified'
                  : resetResult.success
                  ? '⚠ Reset Complete (Unverified)'
                  : '✗ Reset Failed'}
              </h3>
              <span className="text-xs text-slate-500 font-mono">
                {resetResult.durationMs}ms
              </span>
            </div>

            {/* Verification Badge */}
            <div className={`
              inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-3
              ${resetResult.verified
                ? 'bg-green-900/50 text-green-300'
                : 'bg-yellow-900/50 text-yellow-300'
              }
            `}>
              {resetResult.verified ? '✓ Clean State Verified' : '⚠ State Not Fully Clean'}
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm">
              {Object.entries(resetResult.layers).map(([key, layerResult]) => {
                const isSuccess = typeof layerResult === 'object'
                  ? ('cleared' in layerResult && layerResult.cleared) || ('deleted' in layerResult && layerResult.deleted) || ('signedOut' in layerResult && layerResult.signedOut)
                  : layerResult;
                return (
                  <div key={key} className="flex items-center gap-2">
                    <span className={isSuccess ? 'text-green-400' : 'text-red-400'}>
                      {isSuccess ? '✓' : '✗'}
                    </span>
                    <span className="text-slate-400">{key}</span>
                    {typeof layerResult === 'object' && layerResult.error && (
                      <span className="text-xs text-red-400">({layerResult.error})</span>
                    )}
                  </div>
                );
              })}
            </div>
            {resetResult.errors.length > 0 && (
              <div className="mt-3 text-sm text-red-400">
                <p className="font-medium">Errors:</p>
                <ul className="list-disc list-inside">
                  {resetResult.errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3">
          {/* Primary Actions Row */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleAuthOnlyReset}
              disabled={isResetting}
              className="flex-1 px-6 py-3 bg-amber-600 hover:bg-amber-500 disabled:bg-amber-800 disabled:opacity-50 rounded-xl font-semibold transition-colors"
            >
              {isResetting ? 'Resetting...' : 'Auth Reset (Keep Offline Data)'}
            </button>
            <button
              type="button"
              onClick={handleFullReset}
              disabled={isResetting}
              className="flex-1 px-6 py-3 bg-red-600 hover:bg-red-500 disabled:bg-red-800 disabled:opacity-50 rounded-xl font-semibold transition-colors"
            >
              {isResetting ? 'Resetting...' : 'Nuclear Reset (All Layers)'}
            </button>
          </div>
          {/* Secondary Actions Row */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleShowDiagnostics}
              className="flex-1 px-6 py-3 bg-blue-800 hover:bg-blue-700 rounded-xl font-medium transition-colors"
            >
              Diagnostics
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="flex-1 px-6 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl font-medium transition-colors"
            >
              Reload
            </button>
          </div>
        </div>

        {/* Help Text */}
        <div className="mt-8 p-4 bg-slate-900/50 rounded-xl border border-slate-800">
          <h3 className="font-semibold text-slate-300 mb-2">Why am I seeing old data?</h3>
          <div className="text-sm text-slate-400 space-y-2">
            <p>
              JobProof is an offline-first app with 5 independent persistence layers.
              Each layer survives differently:
            </p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>
                <strong>Service Worker</strong> - Caches JS/CSS bundles. May serve old code.
              </li>
              <li>
                <strong>Cache Storage</strong> - Network responses. Survives page reload.
              </li>
              <li>
                <strong>IndexedDB</strong> - Jobs, photos, clients. Survives logout.
              </li>
              <li>
                <strong>LocalStorage</strong> - User profile, sync queues. Survives incognito (sometimes).
              </li>
              <li>
                <strong>Cookies</strong> - Auth tokens, session identifiers.
              </li>
              <li>
                <strong>Supabase Session</strong> - Auth tokens. Auto-refreshes.
              </li>
            </ul>
            <p className="text-slate-500 mt-3">
              Use &quot;Nuclear Reset&quot; to clear all layers and start fresh.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DevReset;
