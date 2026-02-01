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
  developerReset,
  clearServiceWorker,
  clearIndexedDB,
  clearLocalStorage,
  clearSessionStorage,
  clearSupabaseSession,
  getBuildInfo,
  isDevMode,
  enableDevMode,
  disableDevMode,
  type DevResetResult,
} from '../lib/devReset';

interface LayerStatus {
  name: string;
  items: number | string;
  size?: string;
  details?: string[];
}

const DevReset: React.FC = () => {
  const navigate = useNavigate();
  const [isResetting, setIsResetting] = useState(false);
  const [resetResult, setResetResult] = useState<DevResetResult | null>(null);
  const [layers, setLayers] = useState<LayerStatus[]>([]);
  const [devModeEnabled, setDevModeEnabled] = useState(isDevMode());

  const buildInfo = getBuildInfo();

  // Gather stats about each persistence layer
  const gatherLayerStats = useCallback(async () => {
    const stats: LayerStatus[] = [];

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

    // 6. Supabase Auth
    const supabaseAuthKey = localStorage.getItem('supabase.auth.token');
    stats.push({
      name: 'Supabase Session',
      items: supabaseAuthKey ? 'Active' : 'None',
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
    const result = await developerReset(false); // Don't auto-reload
    setResetResult(result);
    setIsResetting(false);

    // Refresh stats
    await gatherLayerStats();
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
      case 'Supabase Session':
        await clearSupabaseSession();
        break;
    }

    setIsResetting(false);
    await gatherLayerStats();
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
              ${resetResult.success
                ? 'bg-green-900/20 border-green-800'
                : 'bg-red-900/20 border-red-800'
              }
            `}
          >
            <h3 className="font-semibold mb-2">
              {resetResult.success ? '✓ Reset Complete' : '⚠ Reset Incomplete'}
            </h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {Object.entries(resetResult.layers).map(([key, success]) => (
                <div key={key} className="flex items-center gap-2">
                  <span className={success ? 'text-green-400' : 'text-red-400'}>
                    {success ? '✓' : '✗'}
                  </span>
                  <span className="text-slate-400">{key}</span>
                </div>
              ))}
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
        <div className="flex gap-4">
          <button
            type="button"
            onClick={handleFullReset}
            disabled={isResetting}
            className="flex-1 px-6 py-3 bg-red-600 hover:bg-red-500 disabled:bg-red-800 disabled:opacity-50 rounded-xl font-semibold transition-colors"
          >
            {isResetting ? 'Resetting...' : 'Nuclear Reset (All Layers)'}
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl font-medium transition-colors"
          >
            Reload
          </button>
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
