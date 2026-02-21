/**
 * Sync Error Categorization Tests
 *
 * Validates that the sync queue distinguishes between transient errors
 * (worth retrying) and permanent errors (escalate immediately).
 *
 * BEFORE: All errors retried up to MAX_RETRIES, wasting 7 cycles on
 * permanent failures like auth expired (401), forbidden (403), or
 * validation errors (400).
 *
 * AFTER: Permanent errors are escalated immediately to the failed sync
 * queue. Only transient errors (timeout, 5xx, network) are retried.
 */

import { describe, it, expect } from 'vitest';
import { isPermanentError } from '@/lib/syncQueue';
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '../..');

const readFile = (filePath: string): string => {
  const fullPath = path.join(ROOT, filePath);
  if (!fs.existsSync(fullPath)) return '';
  return fs.readFileSync(fullPath, 'utf-8');
};

describe('Sync Error Categorization', () => {
  const syncQueueContent = readFile('lib/syncQueue.ts');

  it('should have an isPermanentError function or equivalent check', () => {
    expect(syncQueueContent).toContain('isPermanentError');
  });

  it('should treat 401 Unauthorized as a permanent error', () => {
    expect(syncQueueContent).toContain('401');
  });

  it('should treat 403 Forbidden as a permanent error', () => {
    expect(syncQueueContent).toContain('403');
  });

  it('should treat 400 Bad Request as a permanent error', () => {
    expect(syncQueueContent).toContain('400');
  });

  it('should treat 404 Not Found as a permanent error', () => {
    expect(syncQueueContent).toContain('404');
  });
});

describe('isPermanentError - runtime behavior', () => {
  it('should classify 401 auth errors as permanent', () => {
    expect(isPermanentError(new Error('Request failed with status 401'))).toBe(true);
  });

  it('should classify 403 forbidden as permanent', () => {
    expect(isPermanentError(new Error('403 Forbidden: row-level security'))).toBe(true);
  });

  it('should classify 400 validation as permanent', () => {
    expect(isPermanentError(new Error('400 Bad Request'))).toBe(true);
  });

  it('should classify 404 not found as permanent', () => {
    expect(isPermanentError(new Error('404: resource not found'))).toBe(true);
  });

  it('should classify JWT expired as permanent', () => {
    expect(isPermanentError(new Error('JWT expired'))).toBe(true);
  });

  it('should classify RLS policy errors as permanent', () => {
    expect(isPermanentError(new Error('new row violates row-level security policy'))).toBe(true);
  });

  it('should classify invalid input syntax as permanent', () => {
    expect(isPermanentError(new Error('invalid input syntax for type uuid'))).toBe(true);
  });

  it('should classify 500 server errors as transient (retryable)', () => {
    expect(isPermanentError(new Error('500 Internal Server Error'))).toBe(false);
  });

  it('should classify network errors as transient', () => {
    expect(isPermanentError(new Error('Failed to fetch'))).toBe(false);
  });

  it('should classify timeout errors as transient', () => {
    expect(isPermanentError(new Error('Request timed out'))).toBe(false);
  });

  it('should handle null/undefined gracefully', () => {
    expect(isPermanentError(null)).toBe(false);
    expect(isPermanentError(undefined)).toBe(false);
  });
});
