/**
 * ProofGapBar Component Tests
 *
 * Tests aggregate evidence health across all jobs:
 * - Defensibility calculation (before + after photos + signature)
 * - Progress bar rendering
 * - Color coding (green/amber/red)
 * - Accessibility
 * - Empty states
 *
 * UX Contract: "Counts Must Equal Drill-Down" - number shown must match items
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProofGapBar from '../../components/dashboard/ProofGapBar';
import { Job, Photo } from '../../types';

// ============================================================================
// TEST UTILITIES
// ============================================================================

function createPhoto(type: 'before' | 'during' | 'after'): Photo {
  return {
    id: `photo-${type}-${Math.random().toString(36).slice(2, 8)}`,
    url: `https://example.com/${type}.jpg`,
    timestamp: new Date().toISOString(),
    verified: true,
    syncStatus: 'synced',
    type,
  };
}

function createTestJob(overrides: Partial<Job> = {}): Job {
  return {
    id: `job-${Math.random().toString(36).slice(2, 8)}`,
    title: 'Test Job',
    client: 'Test Client',
    clientId: 'client-1',
    technician: 'Test Tech',
    techId: 'tech-1',
    status: 'In Progress',
    date: new Date().toISOString(),
    address: '123 Test St',
    notes: '',
    photos: [],
    signature: null,
    safetyChecklist: [],
    syncStatus: 'synced',
    lastUpdated: Date.now(),
    ...overrides,
  } as Job;
}

function defensibleJob(id: string): Job {
  return createTestJob({
    id,
    photos: [createPhoto('before'), createPhoto('after')],
    signature: 'sig_123',
    status: 'Complete',
  });
}

function notDefensibleJob(id: string): Job {
  return createTestJob({
    id,
    photos: [],
    signature: null,
    status: 'In Progress',
  });
}

// ============================================================================
// PROOF GAP BAR TESTS
// ============================================================================

describe('ProofGapBar', () => {
  describe('Calculation', () => {
    it('shows 0/0 when no active jobs', () => {
      render(<ProofGapBar jobs={[]} />);

      expect(screen.getByText(/no active jobs/i)).toBeTruthy();
    });

    it('shows correct count when all jobs are defensible', () => {
      const jobs = [defensibleJob('j1'), defensibleJob('j2'), defensibleJob('j3')];
      render(<ProofGapBar jobs={jobs} />);

      expect(screen.getByText('3 / 3')).toBeTruthy();
      expect(screen.getByText(/defensible/i)).toBeTruthy();
    });

    it('shows correct count when some jobs are not defensible', () => {
      const jobs = [defensibleJob('j1'), notDefensibleJob('j2'), notDefensibleJob('j3')];
      render(<ProofGapBar jobs={jobs} />);

      expect(screen.getByText('1 / 3')).toBeTruthy();
    });

    it('shows correct count when no jobs are defensible', () => {
      const jobs = [notDefensibleJob('j1'), notDefensibleJob('j2')];
      render(<ProofGapBar jobs={jobs} />);

      expect(screen.getByText('0 / 2')).toBeTruthy();
    });

    it('excludes archived and cancelled jobs from count', () => {
      const jobs = [
        defensibleJob('j1'),
        notDefensibleJob('j2'),
        createTestJob({ id: 'j3', status: 'Archived' }),
        createTestJob({ id: 'j4', status: 'Cancelled' }),
      ];
      render(<ProofGapBar jobs={jobs} />);

      // Only j1 and j2 should be counted (active jobs)
      expect(screen.getByText('1 / 2')).toBeTruthy();
    });
  });

  describe('Color coding', () => {
    it('shows green when 80%+ defensible', () => {
      const jobs = [
        defensibleJob('j1'), defensibleJob('j2'), defensibleJob('j3'),
        defensibleJob('j4'), notDefensibleJob('j5'),
      ];
      const { container } = render(<ProofGapBar jobs={jobs} />);

      // 4/5 = 80% → green
      expect(container.querySelector('[data-status="good"]')).toBeTruthy();
    });

    it('shows amber when 50-79% defensible', () => {
      const jobs = [
        defensibleJob('j1'), defensibleJob('j2'),
        notDefensibleJob('j3'), notDefensibleJob('j4'),
      ];
      const { container } = render(<ProofGapBar jobs={jobs} />);

      // 2/4 = 50% → amber
      expect(container.querySelector('[data-status="warning"]')).toBeTruthy();
    });

    it('shows red when <50% defensible', () => {
      const jobs = [
        defensibleJob('j1'),
        notDefensibleJob('j2'), notDefensibleJob('j3'), notDefensibleJob('j4'),
      ];
      const { container } = render(<ProofGapBar jobs={jobs} />);

      // 1/4 = 25% → red
      expect(container.querySelector('[data-status="danger"]')).toBeTruthy();
    });
  });

  describe('Click handler', () => {
    it('calls onClick when clicked', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      const jobs = [defensibleJob('j1'), notDefensibleJob('j2')];

      render(<ProofGapBar jobs={jobs} onClick={onClick} />);

      const bar = screen.getByRole('button');
      await user.click(bar);

      expect(onClick).toHaveBeenCalledOnce();
    });

    it('does not render as button when no onClick', () => {
      const jobs = [defensibleJob('j1')];
      render(<ProofGapBar jobs={jobs} />);

      expect(screen.queryByRole('button')).toBeNull();
    });
  });

  describe('Accessibility', () => {
    it('has accessible description', () => {
      const jobs = [defensibleJob('j1'), notDefensibleJob('j2')];
      render(<ProofGapBar jobs={jobs} />);

      expect(screen.getByLabelText(/evidence compliance/i)).toBeTruthy();
    });

    it('progress bar has correct aria attributes', () => {
      const jobs = [defensibleJob('j1'), notDefensibleJob('j2')];
      render(<ProofGapBar jobs={jobs} />);

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar.getAttribute('aria-valuenow')).toBe('1');
      expect(progressBar.getAttribute('aria-valuemax')).toBe('2');
    });
  });
});
