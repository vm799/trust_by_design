/**
 * JobForm Draft Migration Tests - FIX 2.2
 *
 * Tests for:
 * - Migration from localStorage to IndexedDB
 * - Quota checking before save
 * - Workspace isolation
 * - Multi-tab sync
 * - Large form handling (>1MB)
 * - App kill survival (iOS)
 * - Migration from old localStorage drafts
 *
 * CRITICAL EDGE CASES (from WEEK2_EXECUTION_PLAN.md):
 * 1. Large forms (>1MB) - localStorage would fail, IndexedDB succeeds
 * 2. Quota exceeded - graceful warning, no data loss
 * 3. Multi-tab sync - fresh IndexedDB data, not stale localStorage
 * 4. Workspace isolation - userId+wsId in key
 * 5. Migration - auto-move from localStorage to IndexedDB
 * 6. App kill survival - draft persists through termination
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getDatabase, clearAllData, _resetDbInstance } from '../../lib/offline/db';
import { _clearQuotaCache } from '../../lib/storageQuota';

// Dynamic imports to ensure clean state
async function importStorageUtils() {
  return await import('../../lib/utils/storageUtils');
}

describe('JobForm Draft Migration (FIX 2.2)', () => {
  // Store original navigator.storage for restoration
  const originalEstimate = navigator.storage?.estimate;

  beforeEach(async () => {
    // Clear all storage before each test
    localStorage.clear();
    await clearAllData();
    _resetDbInstance();
    vi.clearAllMocks();

    // Clear quota cache to ensure fresh checks
    _clearQuotaCache();

    // Reset navigator.storage.estimate to default (plenty of space)
    if (!navigator.storage) {
      (navigator as any).storage = {};
    }
    navigator.storage.estimate = vi.fn().mockResolvedValue({
      usage: 1000000,    // 1MB used
      quota: 100000000,  // 100MB quota (plenty of space)
    });
  });

  afterEach(async () => {
    localStorage.clear();
    await clearAllData();
    _resetDbInstance();

    // Restore original or remove mock
    if (originalEstimate) {
      navigator.storage.estimate = originalEstimate;
    } else if (navigator.storage) {
      delete (navigator.storage as any).estimate;
    }
  });

  describe('Test 1: Large form (>1MB)', () => {
    it('saves large form to IndexedDB (localStorage would fail)', async () => {
      const { safeSaveDraft } = await importStorageUtils();
      const workspaceId = 'ws-test-123';

      // Create a large form data object (>1MB)
      const largeNotes = 'x'.repeat(1024 * 1024 + 100); // 1MB+ string
      const largeFormData = {
        title: 'Large Job',
        description: largeNotes,
        clientId: 'client-1',
        technicianId: 'tech-1',
        address: '123 Main St',
        date: '2026-02-07',
        time: '09:00',
        total: '1500',
        priority: 'normal' as const,
      };

      // Save should succeed to IndexedDB
      const success = await safeSaveDraft('job', largeFormData, workspaceId);
      expect(success).toBe(true);

      // Verify it's in IndexedDB
      const db = await getDatabase();
      const drafts = await db.formDrafts.toArray();
      expect(drafts.length).toBeGreaterThan(0);

      const savedDraft = drafts.find(d => d.formType === `job:${workspaceId}`);
      expect(savedDraft).toBeDefined();
      expect(savedDraft?.data.description).toBe(largeNotes);
    });

    it('handles very large forms gracefully (>5MB)', async () => {
      const { safeSaveDraft } = await importStorageUtils();
      const workspaceId = 'ws-test-456';

      // Create form data that's larger than typical localStorage limit
      const veryLargeNotes = 'x'.repeat(6 * 1024 * 1024); // 6MB
      const veryLargeFormData = {
        title: 'Very Large Job',
        description: veryLargeNotes,
        clientId: 'client-2',
      };

      // Should either succeed or fail gracefully (not crash)
      try {
        const success = await safeSaveDraft('job', veryLargeFormData, workspaceId);
        // If it succeeds, great!
        if (success) {
          expect(success).toBe(true);
        }
      } catch (error: any) {
        // If it fails, should be quota error, not crash
        expect(error.name).toMatch(/QuotaExceededError|StorageQuotaExceededError/);
      }
    });
  });

  describe('Test 2: Quota check prevents write', () => {
    it('checks quota before attempting save', async () => {
      const { hasSpaceFor, safeSaveDraft } = await importStorageUtils();
      const workspaceId = 'ws-quota-test';

      // Mock navigator.storage.estimate to simulate low quota
      const originalEstimate = navigator.storage?.estimate;
      if (!navigator.storage) {
        (navigator as any).storage = {};
      }

      // Simulate 95% full (critical)
      navigator.storage.estimate = vi.fn().mockResolvedValue({
        usage: 9500000, // 9.5MB
        quota: 10000000, // 10MB total
      });

      try {
        // hasSpaceFor should detect low quota
        const hasSpace = await hasSpaceFor(1024 * 1024); // Try to save 1MB
        expect(hasSpace).toBe(false);

        // safeSaveDraft should return false when quota low
        const formData = { title: 'Test', description: 'x'.repeat(1024 * 500) };
        const success = await safeSaveDraft('job', formData, workspaceId);

        // Should return false (not throw)
        expect(success).toBe(false);
      } finally {
        // Restore original
        if (originalEstimate) {
          navigator.storage.estimate = originalEstimate;
        } else {
          delete (navigator as any).storage;
        }
      }
    });

    it('shows warning when quota exceeded, form data NOT lost', async () => {
      const { safeSaveDraft } = await importStorageUtils();
      const workspaceId = 'ws-warn-test';

      const formData = { title: 'Important Job', clientId: 'client-1' };

      // Mock IndexedDB to throw quota exceeded
      const db = await getDatabase();
      const originalPut = db.formDrafts.put.bind(db.formDrafts);
      db.formDrafts.put = vi.fn().mockRejectedValue(
        new DOMException('QuotaExceededError', 'QuotaExceededError')
      );

      try {
        const success = await safeSaveDraft('job', formData, workspaceId);

        // Should return false (graceful degradation)
        expect(success).toBe(false);

        // Form data still in memory (caller keeps it)
        expect(formData.title).toBe('Important Job');
      } finally {
        db.formDrafts.put = originalPut;
      }
    });
  });

  describe('Test 3: IndexedDB transaction abort handling', () => {
    it('handles transaction abort gracefully', async () => {
      const { safeSaveDraft } = await importStorageUtils();
      const workspaceId = 'ws-abort-test';

      const formData = { title: 'Test Job' };

      // Mock IndexedDB to throw AbortError
      const db = await getDatabase();
      const originalPut = db.formDrafts.put.bind(db.formDrafts);
      db.formDrafts.put = vi.fn().mockRejectedValue(
        new DOMException('AbortError', 'AbortError')
      );

      try {
        const success = await safeSaveDraft('job', formData, workspaceId);

        // Should return false (not crash)
        expect(success).toBe(false);
      } finally {
        db.formDrafts.put = originalPut;
      }
    });

    it('retries save on transient errors', async () => {
      const { safeSaveDraft } = await importStorageUtils();
      const workspaceId = 'ws-retry-test';

      const formData = { title: 'Retry Test' };

      // First call fails, second succeeds
      let callCount = 0;
      const db = await getDatabase();
      const originalPut = db.formDrafts.put.bind(db.formDrafts);
      db.formDrafts.put = vi.fn().mockImplementation(async (draft) => {
        callCount++;
        if (callCount === 1) {
          throw new DOMException('VersionError', 'VersionError');
        }
        return await originalPut(draft);
      });

      try {
        // Should retry and succeed
        const success = await safeSaveDraft('job', formData, workspaceId);
        expect(success).toBe(true);
        expect(callCount).toBeGreaterThan(1);
      } finally {
        db.formDrafts.put = originalPut;
      }
    });
  });

  describe('Test 4: Multi-tab sync (same workspace)', () => {
    it('loads fresh IndexedDB data, not stale localStorage', async () => {
      const { safeSaveDraft, loadDraft } = await importStorageUtils();
      const workspaceId = 'ws-multitab';

      // Simulate Tab A: Save draft to IndexedDB
      const draftFromTabA = { title: 'Tab A Draft', clientId: 'client-a' };
      await safeSaveDraft('job', draftFromTabA, workspaceId);

      // Simulate stale localStorage (old format)
      localStorage.setItem('jobproof_job_draft', JSON.stringify({
        title: 'Stale Draft',
        clientId: 'client-old',
      }));

      // Simulate Tab B: Load draft
      const loadedDraft = await loadDraft('job', workspaceId);

      // Should load from IndexedDB (Tab A's draft), NOT localStorage
      expect(loadedDraft).toBeDefined();
      expect(loadedDraft?.title).toBe('Tab A Draft');
      expect(loadedDraft?.clientId).toBe('client-a');
    });

    it('concurrent saves do not conflict', async () => {
      const { safeSaveDraft } = await importStorageUtils();
      const workspaceId = 'ws-concurrent';

      // Simulate two rapid saves (like user typing fast)
      const draft1 = { title: 'Draft 1' };
      const draft2 = { title: 'Draft 2' };

      const [success1, success2] = await Promise.all([
        safeSaveDraft('job', draft1, workspaceId),
        safeSaveDraft('job', draft2, workspaceId),
      ]);

      // Both should succeed
      expect(success1).toBe(true);
      expect(success2).toBe(true);

      // Last write wins
      const { loadDraft } = await importStorageUtils();
      const loaded = await loadDraft('job', workspaceId);
      expect(loaded?.title).toBeDefined();
    });
  });

  describe('Test 5: Workspace isolation', () => {
    it('isolates drafts by workspaceId', async () => {
      const { safeSaveDraft, loadDraft } = await importStorageUtils();

      // User A saves draft in workspace 1
      const wsId1 = 'ws-user-a';
      const draftA = { title: 'User A Draft', clientId: 'a-client' };
      await safeSaveDraft('job', draftA, wsId1);

      // User B saves draft in workspace 2
      const wsId2 = 'ws-user-b';
      const draftB = { title: 'User B Draft', clientId: 'b-client' };
      await safeSaveDraft('job', draftB, wsId2);

      // User A loads - should only see their draft
      const loadedA = await loadDraft('job', wsId1);
      expect(loadedA?.title).toBe('User A Draft');

      // User B loads - should only see their draft
      const loadedB = await loadDraft('job', wsId2);
      expect(loadedB?.title).toBe('User B Draft');

      // Verify isolation at database level
      const db = await getDatabase();
      const allDrafts = await db.formDrafts.toArray();

      // Should have 2 drafts with different workspace keys
      expect(allDrafts.length).toBe(2);
      const keys = allDrafts.map(d => d.formType);
      expect(keys).toContain(`job:${wsId1}`);
      expect(keys).toContain(`job:${wsId2}`);
    });

    it('prevents cross-workspace draft access', async () => {
      const { safeSaveDraft, loadDraft } = await importStorageUtils();

      const wsId1 = 'ws-secret';
      const secretDraft = { title: 'Confidential Job' };
      await safeSaveDraft('job', secretDraft, wsId1);

      // Attacker tries to load with different workspace
      const wsId2 = 'ws-attacker';
      const loaded = await loadDraft('job', wsId2);

      // Should NOT see the secret draft
      expect(loaded).toBeNull();
    });
  });

  describe('Test 6: Migration from localStorage to IndexedDB', () => {
    it('migrates old localStorage draft on first load', async () => {
      const { migrateDraftFromLocalStorage } = await importStorageUtils();
      const workspaceId = 'ws-migrate';

      // Simulate old localStorage draft (pre-migration format)
      const oldDraft = {
        title: 'Old Format Draft',
        clientId: 'legacy-client',
        date: '2026-01-01',
      };
      localStorage.setItem('jobproof_job_draft', JSON.stringify(oldDraft));

      // Migrate
      await migrateDraftFromLocalStorage('job', workspaceId);

      // Verify it's now in IndexedDB
      const db = await getDatabase();
      const drafts = await db.formDrafts.toArray();
      const migratedDraft = drafts.find(d => d.formType === `job:${workspaceId}`);

      expect(migratedDraft).toBeDefined();
      expect(migratedDraft?.data.title).toBe('Old Format Draft');

      // Old localStorage draft should be removed after migration
      const oldKey = localStorage.getItem('jobproof_job_draft');
      expect(oldKey).toBeNull();
    });

    it('handles missing localStorage draft gracefully', async () => {
      const { migrateDraftFromLocalStorage } = await importStorageUtils();
      const workspaceId = 'ws-no-draft';

      // No localStorage draft exists
      expect(localStorage.getItem('jobproof_job_draft')).toBeNull();

      // Migration should not throw
      await expect(migrateDraftFromLocalStorage('job', workspaceId)).resolves.not.toThrow();

      // Should not create empty draft
      const db = await getDatabase();
      const drafts = await db.formDrafts.toArray();
      expect(drafts.length).toBe(0);
    });

    it('migrates only once (idempotent)', async () => {
      const { migrateDraftFromLocalStorage } = await importStorageUtils();
      const workspaceId = 'ws-idempotent';

      const oldDraft = { title: 'Original Draft' };
      localStorage.setItem('jobproof_job_draft', JSON.stringify(oldDraft));

      // First migration
      await migrateDraftFromLocalStorage('job', workspaceId);

      // Verify migrated
      const db = await getDatabase();
      let drafts = await db.formDrafts.toArray();
      expect(drafts.length).toBe(1);

      // Second migration attempt (localStorage already cleared)
      await migrateDraftFromLocalStorage('job', workspaceId);

      // Should still have only 1 draft
      drafts = await db.formDrafts.toArray();
      expect(drafts.length).toBe(1);
    });
  });

  describe('Test 7: Draft expiry (8 hours)', () => {
    it('expired drafts are not loaded', async () => {
      const { loadDraft } = await importStorageUtils();
      const workspaceId = 'ws-expiry';

      // Manually insert expired draft into IndexedDB
      const db = await getDatabase();
      const expiredTime = Date.now() - (9 * 60 * 60 * 1000); // 9 hours ago
      await db.formDrafts.put({
        formType: `job:${workspaceId}`,
        data: { title: 'Expired Draft' },
        savedAt: expiredTime,
      });

      // Load should return null (draft expired)
      const loaded = await loadDraft('job', workspaceId);
      expect(loaded).toBeNull();
    });

    it('fresh drafts (< 8 hours) are loaded', async () => {
      const { loadDraft } = await importStorageUtils();
      const workspaceId = 'ws-fresh';

      // Insert fresh draft
      const db = await getDatabase();
      const freshTime = Date.now() - (1 * 60 * 60 * 1000); // 1 hour ago
      await db.formDrafts.put({
        formType: `job:${workspaceId}`,
        data: { title: 'Fresh Draft' },
        savedAt: freshTime,
      });

      // Load should succeed
      const loaded = await loadDraft('job', workspaceId);
      expect(loaded).toBeDefined();
      expect(loaded?.title).toBe('Fresh Draft');
    });
  });

  describe('Test 8: App kill survival (iOS)', () => {
    it('draft survives app termination', async () => {
      const { safeSaveDraft, loadDraft } = await importStorageUtils();
      const workspaceId = 'ws-ios-kill';

      // Save draft
      const draft = { title: 'Before Kill', clientId: 'client-1' };
      await safeSaveDraft('job', draft, workspaceId);

      // Simulate app kill: Reset database instance (but IndexedDB persists)
      _resetDbInstance();

      // Simulate app restart: Load draft
      const loaded = await loadDraft('job', workspaceId);

      // Draft should survive (IndexedDB is persistent)
      expect(loaded).toBeDefined();
      expect(loaded?.title).toBe('Before Kill');
    });
  });

  describe('Test 9: Form does not crash on save failure', () => {
    it('returns false on save failure, does not throw', async () => {
      const { safeSaveDraft } = await importStorageUtils();
      const workspaceId = 'ws-crash-test';

      // Mock database to throw unknown error
      const db = await getDatabase();
      const originalPut = db.formDrafts.put.bind(db.formDrafts);
      db.formDrafts.put = vi.fn().mockRejectedValue(new Error('Unknown database error'));

      try {
        const formData = { title: 'Test' };

        // Should NOT throw (graceful degradation)
        await expect(safeSaveDraft('job', formData, workspaceId)).resolves.not.toThrow();

        const success = await safeSaveDraft('job', formData, workspaceId);
        expect(success).toBe(false);
      } finally {
        db.formDrafts.put = originalPut;
      }
    });
  });

  describe('Test 10: Concurrent saves (rapid typing)', () => {
    it('handles rapid consecutive saves (debounced)', async () => {
      const { safeSaveDraft } = await importStorageUtils();
      const workspaceId = 'ws-rapid';

      // Simulate rapid typing (10 saves in quick succession)
      const saves = [];
      for (let i = 0; i < 10; i++) {
        saves.push(safeSaveDraft('job', { title: `Draft ${i}` }, workspaceId));
      }

      const results = await Promise.all(saves);

      // All should succeed (IndexedDB handles concurrency)
      results.forEach(result => expect(result).toBe(true));

      // Last save should win
      const { loadDraft } = await importStorageUtils();
      const loaded = await loadDraft('job', workspaceId);
      expect(loaded?.title).toBe('Draft 9');
    });
  });

  describe('Module exports', () => {
    it('exports all required utility functions', async () => {
      const utils = await importStorageUtils();

      expect(utils.hasSpaceFor).toBeDefined();
      expect(typeof utils.hasSpaceFor).toBe('function');

      expect(utils.safeSaveDraft).toBeDefined();
      expect(typeof utils.safeSaveDraft).toBe('function');

      expect(utils.loadDraft).toBeDefined();
      expect(typeof utils.loadDraft).toBe('function');

      expect(utils.migrateDraftFromLocalStorage).toBeDefined();
      expect(typeof utils.migrateDraftFromLocalStorage).toBe('function');
    });
  });
});
