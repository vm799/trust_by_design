/**
 * Sync Job Error Propagation Tests
 *
 * Validates that syncJobToSupabase propagates errors to callers instead
 * of swallowing them, enabling isPermanentError classification.
 *
 * BEFORE: syncJobToSupabase caught all errors internally and returned false.
 * The retry loop's try/catch never received the error object, making
 * isPermanentError(syncError) dead code — it was always null.
 *
 * AFTER: syncJobToSupabase re-throws errors after logging. The retry loop
 * catches them and classifies via isPermanentError. Permanent errors
 * (401/403/404/RLS) are escalated immediately instead of wasting 7 retries.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '../..');

const readFile = (filePath: string): string => {
  const fullPath = path.join(ROOT, filePath);
  if (!fs.existsSync(fullPath)) return '';
  return fs.readFileSync(fullPath, 'utf-8');
};

describe('syncJobToSupabase error propagation', () => {
  const syncQueueContent = readFile('lib/syncQueue.ts');

  it('should re-throw errors after logging in catch block', () => {
    // The catch block in syncJobToSupabase must re-throw so callers
    // can classify the error with isPermanentError.
    // Find the section between 'Sync failed' error log and the end of syncJobToSupabase
    const syncFailedIdx = syncQueueContent.indexOf('Sync failed:');
    const catchSection = syncQueueContent.slice(syncFailedIdx, syncFailedIdx + 800);
    expect(catchSection).toContain('throw error');
  });

  it('should have try/catch in retryFailedSyncs that captures the thrown error', () => {
    const retrySection = syncQueueContent.slice(
      syncQueueContent.indexOf('retryFailedSyncs'),
      syncQueueContent.indexOf('addToSyncQueue')
    );
    expect(retrySection).toContain('catch (err)');
    expect(retrySection).toContain('syncError');
    expect(retrySection).toContain('isPermanentError');
  });

  it('should log conflict telemetry before re-throwing', () => {
    // Conflict telemetry should still be logged before the error is re-thrown
    const syncFailedIdx = syncQueueContent.indexOf('Sync failed:');
    const catchSection = syncQueueContent.slice(syncFailedIdx, syncFailedIdx + 800);
    expect(catchSection).toContain('logConflict');
  });
});
