/**
 * Unit Tests for deriveDashboardState
 *
 * Tests all 6 invariants and edge cases:
 * - INV-1: Focus is null or single entity
 * - INV-2: Queue max 5 items
 * - INV-3: No duplicate IDs across focus, queue, background
 * - INV-4: All routes start with '/'
 * - INV-5: Queue sorted by urgency descending
 * - INV-6: Idle technicians never in focus or queue
 */

import { describe, it, expect } from 'vitest';
import {
  deriveDashboardState,
  validateDashboardInvariants,
  MAX_QUEUE_SIZE,
  IDLE_THRESHOLD_MS,
  STUCK_THRESHOLD_MS,
} from '../../lib/deriveDashboardState';
import { DashboardInput, DashboardState } from '../../lib/dashboardState';
import { Job, Client, Technician } from '../../types';

// ============================================================================
// TEST HELPERS
// ============================================================================

function createTestInput(overrides: Partial<DashboardInput> = {}): DashboardInput {
  return {
    role: 'manager',
    userId: 'user-1',
    jobs: [createJob()],
    clients: [createClient()],
    technicians: [createTechnician()],
    now: Date.now(),
    ...overrides,
  };
}

function createJob(overrides: Partial<Job> = {}): Job {
  return {
    id: `job-${Math.random().toString(36).slice(2, 8)}`,
    title: 'Test Job',
    clientId: 'client-1',
    client: 'Test Client',
    techId: 'tech-1',
    technicianId: 'tech-1',
    technician: 'Test Tech',
    status: 'In Progress',
    syncStatus: 'synced',
    priority: 'normal',
    date: new Date().toISOString(),
    photos: [],
    signature: null,
    notes: '',
    address: '',
    ...overrides,
  } as Job;
}

function createClient(overrides: Partial<Client> = {}): Client {
  return {
    id: 'client-1',
    name: 'Test Client',
    email: 'test@client.com',
    ...overrides,
  } as Client;
}

function createTechnician(overrides: Partial<Technician> = {}): Technician {
  return {
    id: 'tech-1',
    name: 'Test Tech',
    email: 'tech@test.com',
    status: 'Available',
    ...overrides,
  } as Technician;
}

// ============================================================================
// INVARIANT TESTS
// ============================================================================

describe('deriveDashboardState', () => {
  describe('Invariant Validation', () => {
    it('INV-1: focus is null or single entity', () => {
      const input = createTestInput();
      const state = deriveDashboardState(input);

      // Focus should be null or an object
      expect(state.focus === null || typeof state.focus === 'object').toBe(true);

      // If focus exists, it should have required fields
      if (state.focus) {
        expect(state.focus.id).toBeDefined();
        expect(state.focus.type).toBeDefined();
        expect(state.focus.title).toBeDefined();
        expect(state.focus.actionRoute).toBeDefined();
      }

      // Validate invariants
      const validation = validateDashboardInvariants(state);
      expect(validation.errors.filter(e => e.includes('INV-1'))).toHaveLength(0);
    });

    it('INV-2: queue has max 5 items', () => {
      // Create input with many jobs
      const jobs = Array.from({ length: 20 }, (_, i) =>
        createJob({
          id: `job-${i}`,
          techId: `tech-${i % 5}`,
          technicianId: `tech-${i % 5}`,
        })
      );
      const technicians = Array.from({ length: 10 }, (_, i) =>
        createTechnician({ id: `tech-${i}`, name: `Tech ${i}` })
      );

      const input = createTestInput({ jobs, technicians });
      const state = deriveDashboardState(input);

      expect(state.queue.length).toBeLessThanOrEqual(MAX_QUEUE_SIZE);
      expect(state.queue.length).toBeLessThanOrEqual(5);

      const validation = validateDashboardInvariants(state);
      expect(validation.errors.filter(e => e.includes('INV-2'))).toHaveLength(0);
    });

    it('INV-3: no duplicate IDs across focus, queue, background', () => {
      const input = createTestInput({
        jobs: [
          createJob({ id: 'job-1', status: 'In Progress', priority: 'urgent' }),
          createJob({ id: 'job-2', status: 'Pending' }),
          createJob({ id: 'job-3', status: 'Complete' }),
        ],
        technicians: [
          createTechnician({ id: 'tech-1', name: 'Tech 1' }),
          createTechnician({ id: 'tech-2', name: 'Tech 2' }),
        ],
      });

      const state = deriveDashboardState(input);

      // Collect all IDs
      const ids: string[] = [];
      if (state.focus) ids.push(state.focus.id);
      state.queue.forEach(q => ids.push(q.id));
      // Background uses different prefix (bg-) so shouldn't collide with focus/queue

      // Check for duplicates in focus + queue
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);

      const validation = validateDashboardInvariants(state);
      expect(validation.errors.filter(e => e.includes('INV-3'))).toHaveLength(0);
    });

    it('INV-4: all routes start with /', () => {
      const input = createTestInput();
      const state = deriveDashboardState(input);

      // Check focus route
      if (state.focus) {
        expect(state.focus.actionRoute.startsWith('/')).toBe(true);
      }

      // Check queue routes
      state.queue.forEach(q => {
        expect(q.route.startsWith('/')).toBe(true);
      });

      // Check background routes
      state.background.forEach(section => {
        section.items.forEach(item => {
          if (item.route) {
            expect(item.route.startsWith('/')).toBe(true);
          }
        });
      });

      const validation = validateDashboardInvariants(state);
      expect(validation.errors.filter(e => e.includes('INV-4'))).toHaveLength(0);
    });

    it('INV-5: queue sorted by urgency descending', () => {
      const jobs = [
        createJob({ id: 'job-1', priority: 'normal', techId: 'tech-1' }),
        createJob({ id: 'job-2', priority: 'urgent', techId: 'tech-2' }),
        createJob({ id: 'job-3', priority: 'normal', techId: 'tech-3' }),
      ];
      const technicians = [
        createTechnician({ id: 'tech-1', name: 'Tech 1' }),
        createTechnician({ id: 'tech-2', name: 'Tech 2' }),
        createTechnician({ id: 'tech-3', name: 'Tech 3' }),
      ];

      const input = createTestInput({ jobs, technicians });
      const state = deriveDashboardState(input);

      // Check queue is sorted by urgency descending
      for (let i = 1; i < state.queue.length; i++) {
        expect(state.queue[i].urgency).toBeLessThanOrEqual(state.queue[i - 1].urgency);
      }

      const validation = validateDashboardInvariants(state);
      expect(validation.errors.filter(e => e.includes('INV-5'))).toHaveLength(0);
    });

    it('INV-6: idle technicians never in focus or queue', () => {
      const now = Date.now();
      const oldTime = now - IDLE_THRESHOLD_MS - 1000; // Past idle threshold

      const input = createTestInput({
        jobs: [], // No jobs = all techs idle
        technicians: [
          createTechnician({ id: 'idle-tech-1', name: 'Idle Tech 1' }),
          createTechnician({ id: 'idle-tech-2', name: 'Idle Tech 2' }),
        ],
        now,
      });

      const state = deriveDashboardState(input);

      // Focus should NOT contain idle technician
      if (state.focus && state.focus.type === 'technician') {
        expect(state.focus.reason.toLowerCase()).not.toContain('idle');
        expect(state.focus.reason.toLowerCase()).not.toContain('no active');
      }

      // Queue should NOT contain idle technicians
      state.queue.forEach(q => {
        if (q.type === 'technician') {
          expect((q.subtitle || '').toLowerCase()).not.toBe('no active jobs');
        }
      });

      // Idle technicians SHOULD be in background
      const idleSection = state.background.find(s => s.id === 'idle-technicians');
      expect(idleSection).toBeDefined();
      expect(idleSection?.items.length).toBe(2);

      const validation = validateDashboardInvariants(state);
      expect(validation.errors.filter(e => e.includes('INV-6'))).toHaveLength(0);
    });
  });

  // ============================================================================
  // EDGE CASES
  // ============================================================================

  describe('Edge Cases', () => {
    it('handles zero jobs gracefully', () => {
      const input = createTestInput({
        jobs: [],
        technicians: [createTechnician()],
      });

      const state = deriveDashboardState(input);

      expect(state.meta.totalJobs).toBe(0);
      // With no jobs, technician is idle, so goes to background
      expect(state.queue).toHaveLength(0);

      // Invariants should still pass
      const validation = validateDashboardInvariants(state);
      expect(validation.valid).toBe(true);
    });

    it('handles zero technicians gracefully', () => {
      const input = createTestInput({
        jobs: [createJob()],
        technicians: [],
      });

      const state = deriveDashboardState(input);

      expect(state.meta.totalTechnicians).toBe(0);

      // Invariants should still pass
      const validation = validateDashboardInvariants(state);
      expect(validation.valid).toBe(true);
    });

    it('handles all jobs urgent', () => {
      const jobs = Array.from({ length: 10 }, (_, i) =>
        createJob({
          id: `urgent-${i}`,
          priority: 'urgent',
          techId: `tech-${i % 3}`,
          technicianId: `tech-${i % 3}`,
        })
      );
      const technicians = [
        createTechnician({ id: 'tech-0' }),
        createTechnician({ id: 'tech-1' }),
        createTechnician({ id: 'tech-2' }),
      ];

      const input = createTestInput({ jobs, technicians });
      const state = deriveDashboardState(input);

      // Focus should be critical (urgent)
      if (state.focus) {
        expect(state.focus.severity).toBe('critical');
      }

      // All queue items with urgent jobs should have max urgency
      const urgentQueueItems = state.queue.filter(q => q.type === 'job');
      urgentQueueItems.forEach(q => {
        expect(q.urgency).toBe(100);
      });

      const validation = validateDashboardInvariants(state);
      expect(validation.valid).toBe(true);
    });

    it('handles all technicians idle', () => {
      const technicians = Array.from({ length: 5 }, (_, i) =>
        createTechnician({ id: `tech-${i}`, name: `Tech ${i}` })
      );

      const input = createTestInput({
        technicians,
        jobs: [], // No jobs = all idle
      });

      const state = deriveDashboardState(input);

      // No focus (no active work)
      expect(state.focus).toBeNull();

      // No queue items (idle techs excluded by INV-6)
      expect(state.queue).toHaveLength(0);

      // All technicians should be in background idle section
      const idleSection = state.background.find(s => s.id === 'idle-technicians');
      expect(idleSection).toBeDefined();
      expect(idleSection?.items.length).toBe(5);
      expect(idleSection?.collapsedByDefault).toBe(true);

      const validation = validateDashboardInvariants(state);
      expect(validation.valid).toBe(true);
    });

    it('handles sync failures with priority escalation', () => {
      const jobs = [
        createJob({ id: 'failed-job', syncStatus: 'failed', techId: 'tech-1' }),
        createJob({ id: 'ok-job', syncStatus: 'synced', techId: 'tech-2' }),
      ];
      const technicians = [
        createTechnician({ id: 'tech-1' }),
        createTechnician({ id: 'tech-2' }),
      ];

      const input = createTestInput({ jobs, technicians });
      const state = deriveDashboardState(input);

      expect(state.meta.syncFailed).toBe(1);
      expect(state.meta.syncPending).toBe(0);

      // Sync failure should increase attention score
      // The tech with failed sync should appear first or in focus
      const validation = validateDashboardInvariants(state);
      expect(validation.valid).toBe(true);
    });

    it('handles stuck job detection', () => {
      const now = Date.now();
      const stuckTime = now - STUCK_THRESHOLD_MS - 1000; // Past stuck threshold

      const jobs = [
        createJob({
          id: 'stuck-job',
          status: 'In Progress',
          lastUpdated: stuckTime,
          photos: [], // No photos = no progress
          techId: 'tech-1',
        }),
      ];

      const input = createTestInput({
        jobs,
        technicians: [createTechnician({ id: 'tech-1', name: 'Stuck Tech' })],
        now,
      });

      const state = deriveDashboardState(input);

      // Stuck technician should be in focus with critical severity
      expect(state.focus).not.toBeNull();
      expect(state.focus?.severity).toBe('critical');
      expect(state.focus?.reason).toContain('2+ hours');

      const validation = validateDashboardInvariants(state);
      expect(validation.valid).toBe(true);
    });

    it('handles mixed sync statuses', () => {
      const jobs = [
        createJob({ id: 'job-1', syncStatus: 'synced' }),
        createJob({ id: 'job-2', syncStatus: 'pending' }),
        createJob({ id: 'job-3', syncStatus: 'failed' }),
      ];

      const input = createTestInput({ jobs });
      const state = deriveDashboardState(input);

      expect(state.meta.syncPending).toBe(1);
      expect(state.meta.syncFailed).toBe(1);

      const validation = validateDashboardInvariants(state);
      expect(validation.valid).toBe(true);
    });
  });

  // ============================================================================
  // ROLE-SPECIFIC TESTS
  // ============================================================================

  describe('Role-specific derivation', () => {
    describe('Manager role', () => {
      it('sees all technicians and jobs', () => {
        const jobs = [
          createJob({ id: 'job-1', techId: 'tech-1' }),
          createJob({ id: 'job-2', techId: 'tech-2' }),
        ];
        const technicians = [
          createTechnician({ id: 'tech-1' }),
          createTechnician({ id: 'tech-2' }),
        ];

        const state = deriveDashboardState(createTestInput({
          role: 'manager',
          jobs,
          technicians,
        }));

        expect(state.meta.totalTechnicians).toBe(2);
        expect(state.meta.totalJobs).toBe(2);
      });

      it('shows idle technicians in background section', () => {
        const state = deriveDashboardState(createTestInput({
          role: 'manager',
          jobs: [],
          technicians: [createTechnician()],
        }));

        const idleSection = state.background.find(s => s.id === 'idle-technicians');
        expect(idleSection).toBeDefined();
        expect(idleSection?.collapsedByDefault).toBe(true);
      });
    });

    describe('Technician role', () => {
      it('sees only their own jobs', () => {
        const jobs = [
          createJob({ id: 'my-job', techId: 'tech-1', technicianId: 'tech-1' }),
          createJob({ id: 'other-job', techId: 'tech-2', technicianId: 'tech-2' }),
        ];

        const state = deriveDashboardState(createTestInput({
          role: 'technician',
          userId: 'tech-1',
          jobs,
        }));

        expect(state.meta.totalJobs).toBe(1);
      });

      it('shows in-progress job in focus', () => {
        const jobs = [
          createJob({
            id: 'in-progress-job',
            status: 'In Progress',
            techId: 'tech-1',
            technicianId: 'tech-1',
          }),
        ];

        const state = deriveDashboardState(createTestInput({
          role: 'technician',
          userId: 'tech-1',
          jobs,
        }));

        expect(state.focus).not.toBeNull();
        expect(state.focus?.type).toBe('job');
        expect(state.focus?.reason).toContain('Progress');
      });

      it('shows ready-to-submit status when evidence complete', () => {
        const jobs = [
          createJob({
            id: 'ready-job',
            status: 'In Progress',
            techId: 'tech-1',
            technicianId: 'tech-1',
            photos: [{ id: 'photo-1', url: 'test.jpg' }] as any,
            signature: 'data:image/png;base64,xxx',
          }),
        ];

        const state = deriveDashboardState(createTestInput({
          role: 'technician',
          userId: 'tech-1',
          jobs,
        }));

        expect(state.focus).not.toBeNull();
        expect(state.focus?.reason).toContain('Ready to submit');
        expect(state.focus?.severity).toBe('info');
      });
    });

    describe('Solo contractor role', () => {
      it('behaves like technician for job visibility', () => {
        const jobs = [
          createJob({ id: 'my-job', techId: 'solo-1', technicianId: 'solo-1' }),
          createJob({ id: 'other-job', techId: 'other', technicianId: 'other' }),
        ];

        const state = deriveDashboardState(createTestInput({
          role: 'solo_contractor',
          userId: 'solo-1',
          jobs,
        }));

        expect(state.meta.totalJobs).toBe(1);
      });
    });

    describe('Client role', () => {
      it('sees only jobs for their client ID', () => {
        const jobs = [
          createJob({ id: 'my-job', clientId: 'client-1' }),
          createJob({ id: 'other-job', clientId: 'client-2' }),
        ];

        const state = deriveDashboardState(createTestInput({
          role: 'client',
          userId: 'client-1',
          jobs,
        }));

        expect(state.meta.totalJobs).toBe(1);
      });

      it('has no focus or queue (observer role)', () => {
        const state = deriveDashboardState(createTestInput({
          role: 'client',
          userId: 'client-1',
          jobs: [createJob({ clientId: 'client-1' })],
        }));

        expect(state.focus).toBeNull();
        expect(state.queue).toHaveLength(0);
      });

      it('shows jobs in background section', () => {
        const state = deriveDashboardState(createTestInput({
          role: 'client',
          userId: 'client-1',
          jobs: [createJob({ clientId: 'client-1' })],
        }));

        const jobsSection = state.background.find(s => s.id === 'my-jobs');
        expect(jobsSection).toBeDefined();
        expect(jobsSection?.collapsedByDefault).toBe(false); // Clients see their jobs expanded
      });
    });
  });

  // ============================================================================
  // OFFLINE BEHAVIOR
  // ============================================================================

  describe('Offline behavior', () => {
    it('sets isOffline flag when offline', () => {
      const state = deriveDashboardState(createTestInput({
        isOffline: true,
      }));

      expect(state.meta.isOffline).toBe(true);
    });

    it('sets isStale when offline for more than 5 minutes', () => {
      const now = Date.now();
      const state = deriveDashboardState(createTestInput({
        isOffline: true,
        lastSyncAt: now - 6 * 60 * 1000, // 6 minutes ago
        now,
      }));

      expect(state.meta.isOffline).toBe(true);
      expect(state.meta.isStale).toBe(true);
    });

    it('is not stale when offline for less than 5 minutes', () => {
      const now = Date.now();
      const state = deriveDashboardState(createTestInput({
        isOffline: true,
        lastSyncAt: now - 3 * 60 * 1000, // 3 minutes ago
        now,
      }));

      expect(state.meta.isOffline).toBe(true);
      expect(state.meta.isStale).toBe(false);
    });
  });

  // ============================================================================
  // VALIDATION FUNCTION TESTS
  // ============================================================================

  describe('validateDashboardInvariants', () => {
    it('returns valid for correct state', () => {
      const state = deriveDashboardState(createTestInput());
      const validation = validateDashboardInvariants(state);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('detects queue overflow (INV-2)', () => {
      const state: DashboardState = {
        focus: null,
        queue: Array.from({ length: 10 }, (_, i) => ({
          id: `item-${i}`,
          type: 'job',
          title: `Job ${i}`,
          urgency: 50,
          route: `/jobs/${i}`,
        })),
        background: [],
        meta: {
          totalJobs: 10,
          totalTechnicians: 0,
          syncPending: 0,
          syncFailed: 0,
          lastUpdated: Date.now(),
          isOffline: false,
          isStale: false,
        },
      };

      const validation = validateDashboardInvariants(state);

      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.includes('INV-2'))).toBe(true);
    });

    it('detects invalid routes (INV-4)', () => {
      const state: DashboardState = {
        focus: {
          id: 'focus-1',
          type: 'job',
          title: 'Test',
          reason: 'Test',
          severity: 'info',
          actionLabel: 'Go',
          actionRoute: 'invalid-route', // Missing leading /
        },
        queue: [],
        background: [],
        meta: {
          totalJobs: 1,
          totalTechnicians: 0,
          syncPending: 0,
          syncFailed: 0,
          lastUpdated: Date.now(),
          isOffline: false,
          isStale: false,
        },
      };

      const validation = validateDashboardInvariants(state);

      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.includes('INV-4'))).toBe(true);
    });

    it('detects unsorted queue (INV-5)', () => {
      const state: DashboardState = {
        focus: null,
        queue: [
          { id: 'item-1', type: 'job', title: 'Low', urgency: 10, route: '/jobs/1' },
          { id: 'item-2', type: 'job', title: 'High', urgency: 100, route: '/jobs/2' },
        ],
        background: [],
        meta: {
          totalJobs: 2,
          totalTechnicians: 0,
          syncPending: 0,
          syncFailed: 0,
          lastUpdated: Date.now(),
          isOffline: false,
          isStale: false,
        },
      };

      const validation = validateDashboardInvariants(state);

      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.includes('INV-5'))).toBe(true);
    });
  });
});
