/**
 * JobActionMenu Component Tests
 *
 * Tests that contextual job actions are correctly computed
 * based on job lifecycle stage, seal state, and invoice state.
 */
import { describe, it, expect, vi } from 'vitest';
import { getJobActions } from '../../../components/ui/JobActionMenu';
import type { JobAction, JobActionConfig } from '../../../components/ui/JobActionMenu';
import type { Job } from '../../../types';

// Helper to create a mock job
function createMockJob(overrides: Partial<Job> = {}): Job {
  return {
    id: 'test-job-1',
    title: 'Test HVAC Repair',
    client: 'Test Client',
    clientId: 'client-1',
    technician: '',
    techId: '',
    status: 'Pending',
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

// Helper to extract action names
function actionNames(actions: JobActionConfig[]): JobAction[] {
  return actions.map(a => a.action);
}

describe('JobActionMenu - getJobActions', () => {
  // ========================================================================
  // DRAFT STAGE (no technician assigned)
  // ========================================================================
  describe('Draft stage (no technician)', () => {
    it('shows assign, edit, delete for draft job', () => {
      const job = createMockJob({ techId: '', technicianId: undefined });
      const actions = getJobActions(job);
      expect(actionNames(actions)).toContain('assign');
      expect(actionNames(actions)).toContain('edit');
      expect(actionNames(actions)).toContain('delete');
    });

    it('assign is primary action', () => {
      const job = createMockJob({ techId: '', technicianId: undefined });
      const actions = getJobActions(job);
      const assignAction = actions.find(a => a.action === 'assign');
      expect(assignAction?.variant).toBe('primary');
    });

    it('compact mode only shows assign', () => {
      const job = createMockJob({ techId: '', technicianId: undefined });
      const actions = getJobActions(job, true);
      expect(actionNames(actions)).toEqual(['assign']);
    });
  });

  // ========================================================================
  // DISPATCHED STAGE (technician assigned, no magic link)
  // ========================================================================
  describe('Dispatched stage (tech assigned, no link)', () => {
    it('shows send, reassign, edit, delete', () => {
      const job = createMockJob({ techId: 'tech-1', technician: 'John' });
      const actions = getJobActions(job);
      expect(actionNames(actions)).toContain('send');
      expect(actionNames(actions)).toContain('reassign');
      expect(actionNames(actions)).toContain('edit');
      expect(actionNames(actions)).toContain('delete');
    });

    it('send is primary action', () => {
      const job = createMockJob({ techId: 'tech-1' });
      const actions = getJobActions(job);
      const sendAction = actions.find(a => a.action === 'send');
      expect(sendAction?.variant).toBe('primary');
    });
  });

  // ========================================================================
  // SENT STAGE (magic link exists, not expired)
  // ========================================================================
  describe('Sent stage (magic link exists)', () => {
    it('shows remind, chase, reassign, delete when link is active', () => {
      const job = createMockJob({
        techId: 'tech-1',
        magicLinkUrl: 'https://example.com/link',
        magicLinkCreatedAt: new Date().toISOString(),
      });
      const actions = getJobActions(job);
      expect(actionNames(actions)).toContain('remind');
      expect(actionNames(actions)).toContain('chase');
      expect(actionNames(actions)).toContain('reassign');
    });

    it('shows resend (send) when link is expired', () => {
      const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
      const job = createMockJob({
        techId: 'tech-1',
        magicLinkUrl: 'https://example.com/link',
        magicLinkCreatedAt: eightDaysAgo,
      });
      const actions = getJobActions(job);
      const sendAction = actions.find(a => a.action === 'send');
      expect(sendAction).toBeDefined();
      expect(sendAction?.variant).toBe('warning');
      expect(sendAction?.label).toBe('Resend');
    });

    it('compact mode shows only remind or resend', () => {
      const job = createMockJob({
        techId: 'tech-1',
        magicLinkUrl: 'https://example.com/link',
        magicLinkCreatedAt: new Date().toISOString(),
      });
      const actions = getJobActions(job, true);
      expect(actions.length).toBe(1);
      expect(actionNames(actions)).toContain('remind');
    });
  });

  // ========================================================================
  // ACTIVE STAGE (In Progress)
  // ========================================================================
  describe('Active stage (In Progress)', () => {
    it('shows reassign and edit for active job', () => {
      const job = createMockJob({
        status: 'In Progress',
        techId: 'tech-1',
        magicLinkUrl: 'https://example.com/link',
        magicLinkCreatedAt: new Date().toISOString(),
      });
      const actions = getJobActions(job);
      expect(actionNames(actions)).toContain('reassign');
      expect(actionNames(actions)).toContain('edit');
    });

    it('shows chase for stuck job (>2 hours)', () => {
      const threeHoursAgo = Date.now() - 3 * 60 * 60 * 1000;
      const job = createMockJob({
        status: 'In Progress',
        techId: 'tech-1',
        lastUpdated: threeHoursAgo,
        magicLinkUrl: 'https://example.com/link',
        magicLinkCreatedAt: new Date().toISOString(),
      });
      const actions = getJobActions(job);
      expect(actionNames(actions)).toContain('chase');
    });

    it('no chase for recently updated job', () => {
      const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
      const job = createMockJob({
        status: 'In Progress',
        techId: 'tech-1',
        lastUpdated: tenMinutesAgo,
        magicLinkUrl: 'https://example.com/link',
        magicLinkCreatedAt: new Date().toISOString(),
      });
      const actions = getJobActions(job);
      expect(actionNames(actions)).not.toContain('chase');
    });
  });

  // ========================================================================
  // REVIEW STAGE (Complete/Submitted)
  // ========================================================================
  describe('Review stage (Complete/Submitted)', () => {
    it('shows review_seal and edit for Complete jobs', () => {
      const job = createMockJob({ status: 'Complete' });
      const actions = getJobActions(job);
      expect(actionNames(actions)).toContain('review_seal');
      expect(actionNames(actions)).toContain('edit');
    });

    it('shows review_seal for Submitted jobs', () => {
      const job = createMockJob({ status: 'Submitted' });
      const actions = getJobActions(job);
      expect(actionNames(actions)).toContain('review_seal');
    });

    it('review_seal is primary action', () => {
      const job = createMockJob({ status: 'Complete' });
      const actions = getJobActions(job);
      const reviewAction = actions.find(a => a.action === 'review_seal');
      expect(reviewAction?.variant).toBe('primary');
    });
  });

  // ========================================================================
  // SEALED STAGE
  // ========================================================================
  describe('Sealed stage', () => {
    it('shows invoice and report for sealed job', () => {
      const job = createMockJob({
        status: 'Submitted',
        sealedAt: new Date().toISOString(),
      });
      const actions = getJobActions(job);
      expect(actionNames(actions)).toContain('invoice');
      expect(actionNames(actions)).toContain('view_report');
    });

    it('does not show delete for sealed job', () => {
      const job = createMockJob({
        status: 'Submitted',
        sealedAt: new Date().toISOString(),
      });
      const actions = getJobActions(job);
      expect(actionNames(actions)).not.toContain('delete');
    });

    it('does not show edit for sealed job', () => {
      const job = createMockJob({
        status: 'Submitted',
        sealedAt: new Date().toISOString(),
      });
      const actions = getJobActions(job);
      expect(actionNames(actions)).not.toContain('edit');
    });
  });

  // ========================================================================
  // INVOICED STAGE
  // ========================================================================
  describe('Invoiced stage', () => {
    it('shows only view_report for invoiced job', () => {
      const job = createMockJob({
        status: 'Submitted',
        sealedAt: new Date().toISOString(),
        invoiceId: 'invoice-1',
      });
      const actions = getJobActions(job);
      expect(actionNames(actions)).toEqual(['view_report']);
    });

    it('does not show delete for invoiced job', () => {
      const job = createMockJob({
        status: 'Submitted',
        sealedAt: new Date().toISOString(),
        invoiceId: 'invoice-1',
      });
      const actions = getJobActions(job);
      expect(actionNames(actions)).not.toContain('delete');
    });
  });

  // ========================================================================
  // ARCHIVED STAGE
  // ========================================================================
  describe('Archived stage', () => {
    it('shows only view_report for archived job', () => {
      const job = createMockJob({ status: 'Archived' });
      const actions = getJobActions(job);
      expect(actionNames(actions)).toEqual(['view_report']);
    });
  });
});
