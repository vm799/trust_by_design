/**
 * Dashboard Action Bar Tests
 *
 * PAUL: Unit test phase for Fix 21.
 *
 * BEFORE: Dashboard header had 5 conditional status chips (on-site, awaiting,
 * links opened, needs link, issues) that looked like "a block of random words
 * and icons". Job status pills were buried below Quick Actions. Mobile had a
 * separate duplicate pulse section. No clear action bar for filtering jobs.
 *
 * AFTER: Clean header with just StatusRing + title + New Job. Job status pills
 * elevated to a dedicated filter bar right after header. Compact status summary
 * inline with the filter bar. No duplicate mobile pulse section.
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

describe('Dashboard action bar cleanup', () => {
  const dashContent = readFile('views/app/ManagerFocusDashboard.tsx');

  it('should NOT have scattered desktop status chips in header', () => {
    // The messy "block of random words and icons" should be gone
    expect(dashContent).not.toContain('Desktop status chips');
  });

  it('should NOT have a separate mobile technician pulse section', () => {
    // Duplicate mobile section should be removed
    expect(dashContent).not.toContain('MOBILE TECHNICIAN PULSE');
  });

  it('should have job filter bar before quick actions', () => {
    // Filter bar should come BEFORE quick actions in the layout
    const filterBarIdx = dashContent.indexOf('JOB FILTER BAR');
    const quickActionsIdx = dashContent.indexOf('Quick Actions');
    expect(filterBarIdx).toBeGreaterThan(-1);
    expect(filterBarIdx).toBeLessThan(quickActionsIdx);
  });

  it('should have a compact status summary with on-site count', () => {
    // The on-site count should still be present but in a compact inline form
    expect(dashContent).toContain('on-site');
    expect(dashContent).toContain('onSiteTechs');
  });

  it('should still have JOB_PILLS config for filter functionality', () => {
    expect(dashContent).toContain('JOB_PILLS');
    expect(dashContent).toContain('activePillFilter');
  });

  it('should maintain the filtered job list when a pill is active', () => {
    expect(dashContent).toContain('filteredJobs');
  });
});
