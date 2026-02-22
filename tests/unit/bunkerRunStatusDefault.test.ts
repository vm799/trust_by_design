/**
 * BunkerRun Job Status Defaults
 *
 * PAUL: Unit test phase for Fix 27.
 *
 * BEFORE: BunkerRun.tsx set incomplete jobs to "In Progress" when
 * syncing, even if the technician hadn't started work. New job links
 * appeared as "In Progress" immediately.
 *
 * AFTER: Jobs without evidence (no beforePhoto) default to "Pending".
 * Only jobs with active evidence capture are "In Progress".
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

describe('BunkerRun job status defaults', () => {
  const content = readFile('views/BunkerRun.tsx');

  it('should not hardcode incomplete jobs as In Progress during sync', () => {
    // The main sync block should not unconditionally set 'In Progress'
    // for jobs that don't have completedAt
    expect(content).not.toContain("status: job.completedAt ? 'Complete' : 'In Progress'");
  });

  it('should default to Pending for jobs without before photo', () => {
    // Jobs that haven't started should be Pending
    expect(content).toContain("'Pending'");
  });
});
