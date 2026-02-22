/**
 * JobRunner Status Default — Fix 30
 *
 * PAUL: Test-first phase.
 *
 * BEFORE: JobRunner.tsx (the bunker MVP "God Component") sets ALL
 * non-completed jobs to "In Progress" during sync (lines 209, 248).
 * When a new magic link is opened and syncs, the job immediately
 * appears as "In Progress" even though no work has started.
 *
 * AFTER: Uses 3-state logic matching BunkerRun.tsx:
 *   Complete if completedAt, In Progress if beforePhoto, Pending otherwise.
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

describe('JobRunner.tsx status defaults', () => {
  const content = readFile('views/bunker/JobRunner.tsx');

  it('should NOT unconditionally default to In Progress', () => {
    // The broken pattern: completedAt ? 'Complete' : 'In Progress'
    // This sets In Progress for ALL non-completed jobs, even brand new ones.
    expect(content).not.toContain("status: job.completedAt ? 'Complete' : 'In Progress'");
  });

  it('should use Pending for jobs without evidence', () => {
    // The correct pattern includes a Pending state
    expect(content).toContain("'Pending'");
  });

  it('should only set In Progress when before photo exists', () => {
    // Pattern: beforePhoto ? 'In Progress' : 'Pending'
    expect(content).toContain("beforePhoto");
    expect(content).toContain("'In Progress'");
    expect(content).toContain("'Pending'");
  });
});
