# WEEK 3: ARCHIVE STRATEGY + COMPLIANCE MOAT POSITIONING
**Execution Plan | Test-First Methodology | Parallel Swarm (2-3 agents)**

**Target Completion:** 14-16 hours wall-clock time | ~520 tokens | +35 new tests
**Current Status:** Week 1-2 complete (722 tests), ready to launch Week 3

---

## 🎯 WEEK 3 OVERVIEW

### Strategic Goals
1. **Archive Strategy** - Auto-retire sealed jobs >180 days old (storage optimization)
2. **Audit Trail Export** - Generate tamper-proof CSV/JSON reports with SHA-256 hashes
3. **Conflict History UI** - Surface sync conflicts to users (transparency + debuggability)

### Why This Moat?
- **Compliance**: 180-day retention policies (construction/engineering standards)
- **Scale**: Archive keeps IndexedDB <5GB even with 10K+ jobs
- **Trust**: Users see audit trails = transparency = adoption
- **Debuggability**: Sync conflicts visible = support load reduction

### Business Impact
- ✅ Enables 10K+ jobs per workspace (vs 1K+ limit without archive)
- ✅ Meets compliance requirements (construction industry, ISO 9001)
- ✅ Reduces support tickets (users see what happened)
- ✅ Competitive moat (vs Firebase: no archive; vs Supabase: no conflict UI)

---

## 📋 FIX 3.1: AUTO-ARCHIVE SEALED JOBS >180 DAYS

### Specification

**Problem:**
Sealed jobs accumulate indefinitely. 10K jobs @ 50KB each = 500MB+ in IndexedDB.
Users can't query historical data efficiently. No distinction between "active" and "archived".

**Solution:**
Auto-archive sealed jobs when `sealedAt + 180 days < now()`. Move to `status='Archived'`.
Sync to Supabase. Still queryable but marked as historical.

**Implementation Details:**

#### 1. Database Schema (Dexie + Supabase)
```typescript
// Already exists, just verify:
interface Job {
  id: string;
  status: JobStatus; // Add 'Archived' to enum
  sealedAt?: string;
  archivedAt?: string; // NEW: timestamp when auto-archived
  isArchived: boolean; // NEW: quick filter flag
}

// Supabase schema (migrations/archive_jobs.sql)
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;
CREATE INDEX idx_jobs_archived_at ON jobs(archived_at);
CREATE INDEX idx_jobs_is_archived ON jobs(is_archived, workspace_id);
```

#### 2. Archive Logic (lib/offline/archive.ts - NEW)
```typescript
export async function scheduleArchive(db: Dexie) {
  // Run daily at 2 AM
  const now = new Date();
  const cutoffDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);

  // Find sealed jobs older than 180 days
  const jobsToArchive = await db.jobs
    .where('sealedAt')
    .below(cutoffDate.toISOString())
    .filter(job => job.status === 'Sealed' || job.status === 'Submitted')
    .toArray();

  // Update locally
  for (const job of jobsToArchive) {
    await db.jobs.update(job.id, {
      status: 'Archived',
      isArchived: true,
      archivedAt: now.toISOString(),
    });
  }

  // Queue for sync
  for (const job of jobsToArchive) {
    await queueSync({
      type: 'update_job',
      jobId: job.id,
      changes: { status: 'Archived', isArchived: true, archivedAt: now.toISOString() },
    });
  }
}

// Call on app startup + schedule daily
```

#### 3. UI Updates
```typescript
// views/app/jobs/JobsList.tsx
// Add 'Archived' filter tab
// Show archived jobs in separate section or lighter styling
// Mark as "Archived 180+ days" in lifecycle badge

// views/app/jobs/JobDetail.tsx
// Show "Archived on {date}" banner if status === 'Archived'
// Prevent editing archived jobs
```

### Test Specifications (4-5 tests)

```typescript
describe('Fix 3.1: Auto-Archive Sealed Jobs', () => {
  describe('Threshold Logic', () => {
    it('should archive sealed jobs older than 180 days', () => {
      const now = new Date();
      const seledAt181DaysAgo = new Date(now.getTime() - 181 * 24 * 60 * 60 * 1000);
      const job = { status: 'Sealed', sealedAt: seledAt181DaysAgo.toISOString() };

      // After archive
      expect(job.status).toBe('Archived');
      expect(job.archivedAt).toBeTruthy();
      expect(job.isArchived).toBe(true);
    });

    it('should NOT archive sealed jobs under 180 days', () => {
      const now = new Date();
      const sealed179DaysAgo = new Date(now.getTime() - 179 * 24 * 60 * 60 * 1000);
      const job = { status: 'Sealed', sealedAt: sealed179DaysAgo.toISOString() };

      // Should still be sealed
      expect(job.status).toBe('Sealed');
      expect(job.archivedAt).toBeUndefined();
    });
  });

  describe('Sync Integration', () => {
    it('should queue archived jobs for sync', () => {
      // Archive job locally
      // Verify sync queue contains update_job for that job
      // Verify status change is 'Archived'
    });
  });

  describe('Data Integrity', () => {
    it('should preserve evidence (photos, signature) when archiving', () => {
      // Archive job with photos
      // Verify photos still exist in IndexedDB
      // Verify photos still sync to Supabase
    });

    it('should not delete archived jobs, only mark as archived', () => {
      // Archive job
      // Query with isArchived=true
      // Should still find it
    });
  });
});
```

### Files to Create/Modify
- **CREATE**: `lib/offline/archive.ts` (180-line file with schedule logic)
- **MODIFY**: `lib/DataContext.tsx` (add scheduleArchive on app startup)
- **MODIFY**: `lib/offline/db.ts` (verify schema has archivedAt, isArchived)
- **MODIFY**: `views/app/jobs/JobsList.tsx` (add 'Archived' filter tab)
- **MODIFY**: `views/app/jobs/JobDetail.tsx` (show archived banner)
- **CREATE**: `tests/unit/archive.test.ts` (4-5 comprehensive tests)

### Estimated Effort
- Implementation: 3-4 hours
- Testing: 2-3 hours
- Total: 5-7 hours (1 agent, parallel-safe)

---

## 📋 FIX 3.2: AUDIT TRAIL EXPORT (CSV/JSON with Hashes)

### Specification

**Problem:**
Users need proof that job data hasn't been tampered with. No way to export audit trail.
Compliance auditors want CSV with timestamps. No way to verify sealing signatures.

**Solution:**
Export CSV or JSON with:
- All job fields (title, status, technician, evidence count, etc.)
- Sealing timestamp + signature hash (SHA-256)
- Sync history (when synced, status)
- Integrity check: "Hash matches = not tampered"

**Implementation Details:**

#### 1. Export Format (lib/utils/auditExport.ts - NEW)
```typescript
interface AuditRecord {
  jobId: string;
  jobTitle: string;
  clientName: string;
  status: JobStatus;
  sealedAt?: string;
  sealHashVerified: boolean;
  sealHashSHA256: string;
  photoCount: number;
  lastSyncedAt?: string;
  syncStatus: string;
  createdAt: string;
  updatedAt: string;
}

export function generateAuditTrail(jobs: Job[]): AuditRecord[] {
  return jobs.map(job => ({
    jobId: job.id,
    jobTitle: job.title,
    clientName: job.client,
    status: job.status,
    sealedAt: job.sealedAt,
    sealHashVerified: verifySealSignature(job), // calls lib/sealing.ts
    sealHashSHA256: calculateSHA256(job.sealSignature || ''),
    photoCount: job.photos.length,
    lastSyncedAt: job.updatedAt,
    syncStatus: job.syncStatus,
    createdAt: job.date,
    updatedAt: job.updatedAt,
  }));
}

export function exportAsCSV(records: AuditRecord[]): string {
  const headers = ['Job ID', 'Title', 'Client', 'Status', 'Sealed At', 'Seal Verified', 'Seal Hash', 'Photos', 'Last Synced', 'Sync Status'];
  const rows = records.map(r => [
    r.jobId,
    r.jobTitle,
    r.clientName,
    r.status,
    r.sealedAt || '',
    r.sealHashVerified ? 'Yes' : 'No',
    r.sealHashSHA256,
    r.photoCount,
    r.lastSyncedAt || '',
    r.syncStatus,
  ]);
  return [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
}

export function exportAsJSON(records: AuditRecord[]): string {
  return JSON.stringify(records, null, 2);
}
```

#### 2. UI Component (components/AuditExportModal.tsx - NEW)
```typescript
// Modal triggered from settings or job list
// Options:
// - Export all jobs
// - Export by status (sealed only, active, archived, etc.)
// - Export by date range
// - Format: CSV or JSON
// - Download as file: audit-trail-{date}.csv or .json

// Button placement:
// - Admin Dashboard > Jobs > "Export Audit Trail" button
// - Keyboard shortcut: Alt+E for export
```

### Test Specifications (6-7 tests)

```typescript
describe('Fix 3.2: Audit Trail Export', () => {
  describe('CSV Export', () => {
    it('should generate valid CSV with headers', () => {
      const records = [{ jobId: '1', status: 'Sealed', ... }];
      const csv = exportAsCSV(records);
      expect(csv).toMatch(/^"Job ID"/);
      expect(csv).toContain('job-1');
    });

    it('should escape quotes in CSV fields', () => {
      const records = [{ jobTitle: 'Job "Special"', ... }];
      const csv = exportAsCSV(records);
      expect(csv).toContain('"Job \\"Special\\""');
    });
  });

  describe('JSON Export', () => {
    it('should generate valid JSON', () => {
      const records = [{ jobId: '1', status: 'Sealed', ... }];
      const json = exportAsJSON(records);
      const parsed = JSON.parse(json);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].jobId).toBe('1');
    });
  });

  describe('Seal Verification', () => {
    it('should verify seal signatures and include hash', () => {
      const job = { sealSignature: 'signed-data', ... };
      const record = createAuditRecord(job);
      expect(record.sealHashVerified).toBe(true | false);
      expect(record.sealHashSHA256).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('Filtering', () => {
    it('should export only sealed jobs when filtered', () => {
      const jobs = [
        { status: 'Sealed', ... },
        { status: 'Draft', ... },
      ];
      const records = generateAuditTrail(jobs.filter(j => j.status === 'Sealed'));
      expect(records).toHaveLength(1);
      expect(records[0].status).toBe('Sealed');
    });
  });
});
```

### Files to Create/Modify
- **CREATE**: `lib/utils/auditExport.ts` (200+ lines export logic)
- **CREATE**: `components/AuditExportModal.tsx` (150+ lines UI)
- **MODIFY**: `views/app/AdminDashboard.tsx` (add export button)
- **CREATE**: `tests/unit/auditExport.test.ts` (6-7 tests)

### Estimated Effort
- Implementation: 4-5 hours
- Testing: 2-3 hours
- Total: 6-8 hours (1 agent, can run **parallel with Fix 3.1**)

---

## 📋 FIX 3.3: CONFLICT HISTORY UI (Depends on 3.1)

### Specification

**Problem:**
When sync fails, jobs get out of sync between device + Supabase. Users don't know why.
No visibility into what conflicted. Support has to debug via logs.

**Solution:**
Show sync conflicts in a dedicated UI:
- "This job was last synced as: {version A}"
- "Server has: {version B}"
- "Differences: status changed, technician reassigned"
- "Resolution options: Use mine | Use server | Manual merge"

**Implementation Details:**

#### 1. Conflict Detection (lib/offline/sync.ts - MODIFY)
```typescript
interface SyncConflict {
  jobId: string;
  local: Job;
  remote: Job;
  conflictFields: string[]; // e.g., ['status', 'technician']
  detectedAt: string;
  resolved: boolean;
  resolution: 'local' | 'remote' | 'manual' | null;
}

export async function detectConflicts(
  localJob: Job,
  remoteJob: Job
): Promise<SyncConflict | null> {
  const conflicts = [];

  // Compare each field
  if (localJob.status !== remoteJob.status) conflicts.push('status');
  if (localJob.technicianId !== remoteJob.technicianId) conflicts.push('technician');
  if (localJob.signature !== remoteJob.signature) conflicts.push('signature');
  if (localJob.photos.length !== remoteJob.photos.length) conflicts.push('photos');

  if (conflicts.length === 0) return null;

  return {
    jobId: localJob.id,
    local: localJob,
    remote: remoteJob,
    conflictFields: conflicts,
    detectedAt: new Date().toISOString(),
    resolved: false,
    resolution: null,
  };
}
```

#### 2. Conflict Storage (lib/offline/db.ts - MODIFY)
```typescript
export const db = new Dexie('jobproof');
db.version(x).stores({
  // ... existing tables
  syncConflicts: '++id, jobId, resolvedAt', // NEW table
});

interface SyncConflictRecord {
  id?: number;
  jobId: string;
  local: Job;
  remote: Job;
  conflictFields: string[];
  detectedAt: string;
  resolvedAt?: string;
  resolution: 'local' | 'remote' | 'manual' | null;
}
```

#### 3. UI Component (components/SyncConflictResolver.tsx - NEW)
```typescript
// Modal/drawer showing:
// - Job title + ID
// - "Local version (this device)"
// - "Server version"
// - Side-by-side comparison of conflicting fields
// - Action buttons: "Use Mine" | "Use Server's" | "Manual Edit"
// - Timestamp of conflict detection

export function SyncConflictResolver({
  conflict,
  onResolve, // (resolution: 'local' | 'remote' | 'manual') => void
}) {
  return (
    <div className="space-y-4">
      <h3>{conflict.jobId}: {conflict.local.title}</h3>

      {conflict.conflictFields.map(field => (
        <div key={field} className="p-4 bg-warning/10 rounded-lg">
          <div className="text-xs uppercase font-bold text-warning">{field}</div>
          <div className="grid grid-cols-2 gap-4 mt-2">
            <div>
              <div className="text-[10px] text-slate-400">This Device</div>
              <div className="font-mono text-sm">{conflict.local[field]}</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400">Server</div>
              <div className="font-mono text-sm">{conflict.remote[field]}</div>
            </div>
          </div>
        </div>
      ))}

      <div className="flex gap-2">
        <button onClick={() => onResolve('local')} className="flex-1 btn-primary">
          Use Mine (this device)
        </button>
        <button onClick={() => onResolve('remote')} className="flex-1 btn-secondary">
          Use Server
        </button>
      </div>
    </div>
  );
}
```

#### 4. Integration (views/app/jobs/JobDetail.tsx - MODIFY)
```typescript
// Add conflict banner if unresolved conflict exists:
if (unresolvedConflict) {
  return (
    <div className="p-4 bg-danger/10 border border-danger rounded-lg">
      <h3 className="font-bold text-danger">Sync Conflict Detected</h3>
      <SyncConflictResolver
        conflict={unresolvedConflict}
        onResolve={handleResolveConflict}
      />
    </div>
  );
}
```

### Test Specifications (5-6 tests)

```typescript
describe('Fix 3.3: Conflict History UI', () => {
  describe('Conflict Detection', () => {
    it('should detect status change conflicts', () => {
      const local = { status: 'Sealed', ... };
      const remote = { status: 'In Progress', ... };
      const conflict = detectConflicts(local, remote);

      expect(conflict).toBeTruthy();
      expect(conflict.conflictFields).toContain('status');
    });

    it('should not detect conflict when identical', () => {
      const local = { status: 'Sealed', technicianId: 'tech1', ... };
      const remote = { status: 'Sealed', technicianId: 'tech1', ... };
      const conflict = detectConflicts(local, remote);

      expect(conflict).toBeNull();
    });
  });

  describe('Conflict Resolution', () => {
    it('should resolve conflict with local version', () => {
      const conflict = { resolution: null, ... };
      conflict.resolution = 'local';

      expect(conflict.resolved).toBe(true);
      expect(conflict.resolution).toBe('local');
    });
  });

  describe('UI Rendering', () => {
    it('should render conflict resolver modal', () => {
      const { screen } = render(
        <SyncConflictResolver conflict={mockConflict} onResolve={jest.fn()} />
      );

      expect(screen.getByText(/Use Mine/)).toBeInTheDocument();
      expect(screen.getByText(/Use Server/)).toBeInTheDocument();
    });
  });
});
```

### Files to Create/Modify
- **MODIFY**: `lib/offline/sync.ts` (add conflict detection logic)
- **MODIFY**: `lib/offline/db.ts` (add syncConflicts table)
- **CREATE**: `components/SyncConflictResolver.tsx` (120+ lines UI)
- **MODIFY**: `views/app/jobs/JobDetail.tsx` (add conflict banner)
- **CREATE**: `tests/unit/syncConflicts.test.ts` (5-6 tests)

### Estimated Effort
- Implementation: 4-5 hours (depends on Fix 3.1)
- Testing: 2-3 hours
- Total: 6-8 hours (1 agent, **sequential after 3.1**)

---

## 🎯 PARALLEL EXECUTION STRATEGY

### Timeline
```
T+0h:     Launch Agent 1 (Fix 3.1: Archive)
          Launch Agent 2 (Fix 3.2: Audit Export) — parallel, no dependency

T+4h:     Fix 3.1 & 3.2 complete
          All tests should pass (710 → 715 tests)

T+4h:     Launch Agent 3 (Fix 3.3: Conflict UI) — depends on 3.1 changes

T+8h:     Fix 3.3 complete
          All tests should pass (715 → 720+ tests)

T+8h:     Full integration test
          npm test -- --run
          npm run build

T+9h:     Commit + push + ready for merge
```

### Agent Team Composition
- **Agent 1 (Archive)**: Dexie/IndexedDB expert + Supabase sync
- **Agent 2 (Audit Export)**: CSV/JSON format + crypto hashing (SHA-256)
- **Agent 3 (Conflict UI)**: React UI + state management

### Success Criteria
✅ 720+ tests passing (35 new tests)
✅ Build succeeds (<12s)
✅ Type-check passes (0 errors)
✅ All P1 issues from code audit documented for Week 4
✅ Clean commit history (3 atomic commits, one per fix)
✅ Memory <150MB at 1K jobs (archive helps)
✅ Performance 60fps at 500+ jobs

---

## 📊 CUMULATIVE PROGRESS AFTER WEEK 3

```
Week 1 (P0 Bugs):             40% ███░░░░░░░░░░░░░░░
Week 2 (Memory + Forms):      40% ███░░░░░░░░░░░░░░░
Week 3 (Archive + Audit):     20% ██░░░░░░░░░░░░░░░░
                              ───────────────────────
TOTAL PROGRESS:               80% ████████░░░░░░░░░░░░

Tests:     722 → 755 (goal)
Features:  6 → 9 fixes
Storage:   <150MB @ 1K jobs
Compliance: ✅ 180-day archive + audit trail
```

---

## 🏁 DECISION: PROCEED OR PAUSE?

### Option A: Launch Week 3 Now ✅ Recommended
- Momentum maintained (team knows patterns)
- Archive strategy closes 10K job limit
- Audit trail differentiates from competitors
- 80% progress toward 100/100 readiness

### Option B: Deploy Weeks 1-2 First
- Real-world validation in staging
- Get customer feedback
- Start Week 3 next sprint

### Option C: Run 35-Test Plan (Validation)
- Cross-device sync tests
- Airplane mode → restart scenarios
- Storage quota edge cases
- Then proceed with Week 3

---

## 🚀 RECOMMENDATION

**→ LAUNCH WEEK 3 NOW**

**Rationale:**
1. Week 1-2 already validated by 722 tests + code audit
2. Archive strategy is critical inflection point (enables 10K+ jobs)
3. Audit trail + conflict UI close competitive moat
4. Team is in rhythm; switching context introduces risk
5. One more week = 80% complete toward 100/100

**Then:** After Week 3, deploy to staging for real-world testing before Week 4-6.

---

**Branch:** `claude/test-job-deletion-memory-6pnTt`
**Next Commit Target:** Week 3 completion (35 new tests, 3 fixes)
**Estimated Completion:** February 10-11, 2026
**Status:** READY TO EXECUTE
