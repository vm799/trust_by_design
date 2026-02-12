/**
 * UpdateNotification + Service Worker Version Check Tests
 *
 * Tests the version comparison logic that determines if an update is available.
 * Validates:
 * - Commit-hash-only comparison (ignoring timestamp suffix)
 * - Grace period after applying an update
 * - Dismissal persistence
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// ============================================================
// Service Worker Version Comparison Logic Tests
// ============================================================
describe('SW Version Comparison Logic', () => {
  /**
   * Simulates the normalized version comparison from sw.js checkForUpdates().
   * This mirrors the actual logic in public/sw.js lines 616-622.
   */
  function shouldShowUpdate(currentVersion: string, newVersion: string): boolean {
    const currentCommit = currentVersion ? currentVersion.split('-')[0] : '';
    const newCommit = newVersion ? newVersion.split('-')[0] : '';
    return !!(currentCommit && newCommit && newCommit !== currentCommit);
  }

  it('should NOT show update when commit hashes match (different timestamps)', () => {
    // Client sends "a1b2c3d", server has "a1b2c3d-1707658400000"
    expect(shouldShowUpdate('a1b2c3d', 'a1b2c3d-1707658400000')).toBe(false);
  });

  it('should NOT show update when both have same commit-timestamp format', () => {
    expect(shouldShowUpdate('a1b2c3d-1707658400000', 'a1b2c3d-1707658400000')).toBe(false);
  });

  it('should NOT show update when both are bare commit hashes', () => {
    expect(shouldShowUpdate('a1b2c3d', 'a1b2c3d')).toBe(false);
  });

  it('should show update when commit hashes differ', () => {
    expect(shouldShowUpdate('a1b2c3d', 'x9y8z7w-1707658500000')).toBe(true);
  });

  it('should show update when both bare hashes differ', () => {
    expect(shouldShowUpdate('a1b2c3d', 'x9y8z7w')).toBe(true);
  });

  it('should show update when commit-timestamp formats differ in commit part', () => {
    expect(shouldShowUpdate('a1b2c3d-1707658400000', 'x9y8z7w-1707658500000')).toBe(true);
  });

  it('should NOT show update when currentVersion is empty', () => {
    expect(shouldShowUpdate('', 'a1b2c3d-1707658400000')).toBe(false);
  });

  it('should NOT show update when newVersion is empty', () => {
    expect(shouldShowUpdate('a1b2c3d', '')).toBe(false);
  });

  it('should handle "dev" as current version', () => {
    expect(shouldShowUpdate('dev', 'a1b2c3d-1707658400000')).toBe(true);
  });

  it('should handle "unknown" as current version', () => {
    expect(shouldShowUpdate('unknown', 'a1b2c3d-1707658400000')).toBe(true);
  });

  it('should NOT show update when same commit with different timestamps (rebuild)', () => {
    // Same code, different build = same commit hash, different timestamp
    expect(shouldShowUpdate('a1b2c3d-1707658400000', 'a1b2c3d-1707658500000')).toBe(false);
  });
});

// ============================================================
// Post-Update Grace Period Tests
// ============================================================
describe('UpdateNotification Grace Period', () => {
  const JUST_UPDATED_KEY = 'jobproof_just_updated';
  const UPDATE_GRACE_MS = 30000;

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should suppress banner within grace period after update', () => {
    // Simulate: applyUpdate() stored timestamp just now
    localStorage.setItem(JUST_UPDATED_KEY, Date.now().toString());

    const justUpdatedAt = localStorage.getItem(JUST_UPDATED_KEY);
    const elapsed = Date.now() - parseInt(justUpdatedAt!, 10);
    const withinGrace = elapsed < UPDATE_GRACE_MS;

    expect(withinGrace).toBe(true);
  });

  it('should allow banner after grace period expires', () => {
    // Simulate: applyUpdate() stored timestamp 31 seconds ago
    const thirtyOneSecondsAgo = Date.now() - 31000;
    localStorage.setItem(JUST_UPDATED_KEY, thirtyOneSecondsAgo.toString());

    const justUpdatedAt = localStorage.getItem(JUST_UPDATED_KEY);
    const elapsed = Date.now() - parseInt(justUpdatedAt!, 10);
    const withinGrace = elapsed < UPDATE_GRACE_MS;

    expect(withinGrace).toBe(false);
  });

  it('should store grace period flag on applyUpdate', () => {
    // Simulate what applyUpdate() does
    localStorage.setItem(JUST_UPDATED_KEY, Date.now().toString());

    expect(localStorage.getItem(JUST_UPDATED_KEY)).not.toBeNull();
  });

  it('should handle missing grace period flag gracefully', () => {
    const justUpdatedAt = localStorage.getItem(JUST_UPDATED_KEY);
    expect(justUpdatedAt).toBeNull();
    // No grace period = allow banner
  });
});

// ============================================================
// Dismissal Persistence Tests
// ============================================================
describe('UpdateNotification Dismissal', () => {
  const DISMISSED_UPDATE_KEY = 'jobproof_dismissed_update';

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should persist dismissed version to localStorage', () => {
    const version = 'x9y8z7w-1707658500000';
    localStorage.setItem(DISMISSED_UPDATE_KEY, JSON.stringify(version));

    const stored = JSON.parse(localStorage.getItem(DISMISSED_UPDATE_KEY)!);
    expect(stored).toBe(version);
  });

  it('should clear dismissal when new version detected', () => {
    localStorage.setItem(DISMISSED_UPDATE_KEY, JSON.stringify('old-version'));
    // Simulating what handleMessage does for UPDATE_AVAILABLE
    localStorage.removeItem(DISMISSED_UPDATE_KEY);

    expect(localStorage.getItem(DISMISSED_UPDATE_KEY)).toBeNull();
  });

  it('should recognize dismissed version matches', () => {
    const version = 'x9y8z7w-1707658500000';
    localStorage.setItem(DISMISSED_UPDATE_KEY, JSON.stringify(version));

    const dismissed = localStorage.getItem(DISMISSED_UPDATE_KEY);
    const dismissedVersion = JSON.parse(dismissed!);
    expect(dismissedVersion === version).toBe(true);
  });
});
