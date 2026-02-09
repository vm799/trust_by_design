/**
 * EvidenceProgressBar Component Tests
 *
 * Tests per-job evidence status display:
 * - Photo type breakdown (before/during/after)
 * - Signature status
 * - Defensibility computation
 * - Accessibility (ARIA, touch targets)
 * - Compact vs full modes
 *
 * UX Contract: Binary states only (defensible/not defensible)
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import EvidenceProgressBar from '../../components/dashboard/EvidenceProgressBar';
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
    id: 'job-test-1',
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

// ============================================================================
// EVIDENCE PROGRESS BAR TESTS
// ============================================================================

describe('EvidenceProgressBar', () => {
  describe('Empty state', () => {
    it('renders no-evidence state when job has no photos and no signature', () => {
      const job = createTestJob();
      render(<EvidenceProgressBar job={job} />);

      expect(screen.getByText(/no evidence/i)).toBeTruthy();
    });

    it('shows 0/3 progress for completely empty job', () => {
      const job = createTestJob();
      render(<EvidenceProgressBar job={job} />);

      expect(screen.getByText('0 / 3')).toBeTruthy();
    });
  });

  describe('Photo detection', () => {
    it('detects before photo', () => {
      const job = createTestJob({
        photos: [createPhoto('before')],
      });
      render(<EvidenceProgressBar job={job} />);

      expect(screen.getByLabelText(/before photo captured/i)).toBeTruthy();
    });

    it('detects after photo', () => {
      const job = createTestJob({
        photos: [createPhoto('after')],
      });
      render(<EvidenceProgressBar job={job} />);

      expect(screen.getByLabelText(/after photo captured/i)).toBeTruthy();
    });

    it('handles case-insensitive photo types', () => {
      const job = createTestJob({
        photos: [{
          ...createPhoto('before'),
          type: 'Before' as any,
        }],
      });
      render(<EvidenceProgressBar job={job} />);

      expect(screen.getByLabelText(/before photo captured/i)).toBeTruthy();
    });

    it('shows partial progress with 1 photo', () => {
      const job = createTestJob({
        photos: [createPhoto('before')],
      });
      render(<EvidenceProgressBar job={job} />);

      expect(screen.getByText('1 / 3')).toBeTruthy();
    });

    it('shows partial progress with 2 photos', () => {
      const job = createTestJob({
        photos: [createPhoto('before'), createPhoto('after')],
      });
      render(<EvidenceProgressBar job={job} />);

      expect(screen.getByText('2 / 3')).toBeTruthy();
    });
  });

  describe('Signature detection', () => {
    it('shows signature missing when null', () => {
      const job = createTestJob({ signature: null });
      render(<EvidenceProgressBar job={job} />);

      expect(screen.getByLabelText(/signature missing/i)).toBeTruthy();
    });

    it('shows signature captured when present', () => {
      const job = createTestJob({ signature: 'sig_job123' });
      render(<EvidenceProgressBar job={job} />);

      expect(screen.getByLabelText(/signature captured/i)).toBeTruthy();
    });
  });

  describe('Defensibility', () => {
    it('marks job as NOT defensible when only some evidence exists', () => {
      const job = createTestJob({
        photos: [createPhoto('before')],
      });
      render(<EvidenceProgressBar job={job} />);

      expect(screen.getByText(/not defensible/i)).toBeTruthy();
    });

    it('shows "No evidence" when nothing captured', () => {
      const job = createTestJob();
      render(<EvidenceProgressBar job={job} />);

      expect(screen.getByText(/no evidence/i)).toBeTruthy();
    });

    it('marks job as defensible when before + after photos + signature present', () => {
      const job = createTestJob({
        photos: [createPhoto('before'), createPhoto('after')],
        signature: 'sig_job123',
      });
      render(<EvidenceProgressBar job={job} />);

      expect(screen.getByText(/defensible/i)).toBeTruthy();
      expect(screen.getByText('3 / 3')).toBeTruthy();
    });

    it('marks job as NOT defensible with only photos (no signature)', () => {
      const job = createTestJob({
        photos: [createPhoto('before'), createPhoto('after')],
      });
      render(<EvidenceProgressBar job={job} />);

      expect(screen.getByText(/not defensible/i)).toBeTruthy();
    });

    it('marks job as NOT defensible with only signature (no photos)', () => {
      const job = createTestJob({
        signature: 'sig_job123',
      });
      render(<EvidenceProgressBar job={job} />);

      expect(screen.getByText(/not defensible/i)).toBeTruthy();
    });
  });

  describe('Compact mode', () => {
    it('renders compact variant without text labels', () => {
      const job = createTestJob({
        photos: [createPhoto('before')],
        signature: 'sig_job123',
      });
      const { container } = render(<EvidenceProgressBar job={job} compact />);

      // Compact should not show the text summary
      expect(screen.queryByText(/defensible/i)).toBeNull();
      // But should still have the progress segments
      expect(container.querySelector('[data-testid="evidence-segments"]')).toBeTruthy();
    });
  });

  describe('Accessibility', () => {
    it('has accessible role and label', () => {
      const job = createTestJob();
      render(<EvidenceProgressBar job={job} />);

      expect(screen.getByRole('group', { name: /evidence progress/i })).toBeTruthy();
    });

    it('each segment has an aria-label', () => {
      const job = createTestJob({
        photos: [createPhoto('before'), createPhoto('after')],
        signature: 'sig_job123',
      });
      render(<EvidenceProgressBar job={job} />);

      expect(screen.getByLabelText(/before photo captured/i)).toBeTruthy();
      expect(screen.getByLabelText(/after photo captured/i)).toBeTruthy();
      expect(screen.getByLabelText(/signature captured/i)).toBeTruthy();
    });
  });
});
