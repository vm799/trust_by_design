/**
 * Tech Route Auth Guard Tests
 * ============================
 *
 * Verifies that /tech/* routes require authentication to prevent the
 * crash→fallback→landing page chain that occurs when unauthenticated
 * users hit tech portal routes directly.
 *
 * Also verifies the loading spinner has a safety timeout to prevent
 * infinite blank pages on refresh.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const APP_PATH = join(__dirname, '../../App.tsx');
const appSource = readFileSync(APP_PATH, 'utf-8');

describe('Tech Route Auth Guards', () => {
  it('/tech route requires authentication', () => {
    // Must redirect unauthenticated users to /auth instead of rendering
    // public route that crashes without DataContext data
    expect(appSource).toMatch(/path="\/tech"\s+element=\{\s*\n?\s*isAuthenticated\s*\?/);
  });

  it('/tech/job/:jobId route requires authentication', () => {
    expect(appSource).toMatch(/path="\/tech\/job\/:jobId"\s+element=\{\s*\n?\s*isAuthenticated\s*\?/);
  });

  it('/tech/job/:jobId/capture route requires authentication', () => {
    expect(appSource).toMatch(/path="\/tech\/job\/:jobId\/capture"\s+element=\{\s*\n?\s*isAuthenticated\s*\?/);
  });

  it('/tech/job/:jobId/review route requires authentication', () => {
    expect(appSource).toMatch(/path="\/tech\/job\/:jobId\/review"\s+element=\{\s*\n?\s*isAuthenticated\s*\?/);
  });

  it('unauthenticated users are redirected to /auth', () => {
    // All tech routes should redirect to /auth when not authenticated
    // This preserves navigation intent (captured at App mount) through the auth flow
    const techRouteSection = appSource.substring(
      appSource.indexOf('Tech Portal Routes'),
      appSource.indexOf('Phase 15: Field Proof System')
    );
    const authRedirectCount = (techRouteSection.match(/Navigate to="\/auth"/g) || []).length;
    expect(authRedirectCount).toBeGreaterThanOrEqual(4);
  });
});

describe('Loading Spinner Safety Timeout', () => {
  it('has a safety timeout to prevent infinite spinner on refresh', () => {
    expect(appSource).toContain('loadingTimedOut');
    expect(appSource).toContain('setTimeout');
  });

  it('timeout value is reasonable (not too short, not too long)', () => {
    // 8 seconds is enough for auth restore + profile load
    // but not so long that user thinks app is broken
    expect(appSource).toMatch(/setTimeout\(\(\)\s*=>\s*setLoadingTimedOut\(true\),\s*8000\)/);
  });

  it('clears timeout on unmount to prevent memory leak', () => {
    expect(appSource).toContain('clearTimeout');
  });
});
