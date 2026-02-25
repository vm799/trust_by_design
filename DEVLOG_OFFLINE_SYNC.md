# DEVLOG: Offline Sync Architecture
**Created:** 2026-02-25 | **Status:** ENFORCED — read before touching sync code

---

## Data Ownership Model (NEVER VIOLATE)

```
SUPABASE (bunker_jobs table)    → Job metadata: title, status, notes, technician, dates, address
DEXIE (IndexedDB jobs table)    → Client-only fields: photos[], signature, clientConfirmation, completionNotes
SUPABASE STORAGE (job-photos)   → Photo files (binary blobs)
DEXIE (IndexedDB media table)   → Photo base64 data (temporary, deleted after upload)
DEXIE (IndexedDB queue table)   → Offline action queue (UPLOAD_PHOTO, UPDATE_JOB, SEAL_JOB, etc.)
```

**bunker_jobs has NO photos column.** Server always returns `photos: []`.
Photo metadata ONLY lives in Dexie. Any write to Dexie jobs table MUST preserve existing photos.

---

## Hard Rules

### 1. NEVER bulkPut/put jobs without merging photos first

```typescript
// WRONG — destroys photo metadata
await database.jobs.bulkPut(serverJobs); // serverJobs.photos = []

// RIGHT — read existing, merge photos, then write
const existing = await database.jobs.bulkGet(ids);
const merged = serverJobs.map(sj => ({
  ...sj,
  photos: existingMap.get(sj.id)?.photos || sj.photos,
}));
await database.jobs.bulkPut(merged);
```

### 2. EVERY code path that loads jobs must merge Supabase + Dexie

There are TWO independent code paths that read from Supabase:
- `DataContext.loadFromSupabase()` → calls `db.getJobs()` → sets React state
- `sync.pullJobs()` → fetches from Supabase → writes to Dexie with `mergeJobData()`

Both MUST preserve Dexie photos. If you add a third path, it must merge too.

### 3. processUpdateJob / processCreateJob MUST clear syncStatus

After successfully pushing to Supabase, the local Dexie job's `syncStatus`
must be set to `'synced'`. Without this, `pullJobs` conflict resolution
(Rule 2: preserve local if pending+newer) keeps the stale local version
forever. The job appears permanently stuck.

### 4. handleOnline MUST bypass the sync throttle

The `online` event in App.tsx must NOT go through `performSync()` which has
a 5-minute throttle. A tech exiting a bunker after 2 minutes should sync
immediately, not wait 3 more minutes.

### 5. Seal failures MUST queue SEAL_JOB

When `invokeSealing()` fails (offline, network error), a `SEAL_JOB` action
must be queued in Dexie. Without this, if the tech closes the app, the
seal attempt is lost forever and the job sits at 'Submitted' indefinitely.

---

## The Sync Lifecycle (reference)

```
OFFLINE (bunker):
  1. EvidenceCapture saves photo base64 to Dexie media table
  2. Photo metadata added to Dexie jobs[id].photos[] (isIndexedDBRef: true)
  3. UPLOAD_PHOTO queued in Dexie queue table
  4. UPDATE_JOB queued when job metadata changes

ONLINE (reconnect):
  5. Browser fires 'online' event
  6. App.tsx handleOnline → pushQueue() fires IMMEDIATELY (no throttle)
  7. DataContext handleOnline → pushQueue() + loadFromSupabase()

PUSH QUEUE:
  8. UPLOAD_PHOTO → upload to Storage → get public URL
  9. Update Dexie: photo.url = publicURL, isIndexedDBRef = false, syncStatus = 'synced'
  10. Delete base64 from Dexie media table
  11. UPDATE_JOB → push metadata to bunker_jobs → clear Dexie syncStatus to 'synced'

AUTO-SEAL (after last photo uploads):
  12. Check: allPhotosUploaded && status === 'Submitted' && !sealedAt
  13. If true → sealEvidence() → update Dexie with sealedAt + evidenceHash
  14. If fails → queue SEAL_JOB for retry

PAGE REFRESH:
  15. loadFromSupabase → db.getJobs() → Supabase returns photos: []
  16. Read Dexie → getAllJobsLocal() → has photos with Storage URLs
  17. MERGE: server metadata + Dexie photos/signature/clientConfirmation
  18. Set React state with merged data
  19. Persist merged data back to Dexie (photos intact)
```

---

## Bugs Fixed (Feb 2026 session)

| Fix | File | Root Cause |
|-----|------|-----------|
| 44 | App.tsx | `handleOnline` went through 5-min throttle — photos waited to push |
| 45 | TechEvidenceReview.tsx | Seal failure not queued — seal lost on app close |
| 46a | sync.ts | `processUpdateJob` never cleared local syncStatus after push |
| 46b | sync.ts | `processCreateJob` same syncStatus bug |
| 46c | sync.ts | `mergeJobData` dropped synced photos (only kept pending ones) |
| 47 | DataContext.tsx + db.ts | Jobs had no Dexie fallback when Supabase unreachable |
| 48 | DataContext.tsx + db.ts | **loadFromSupabase overwrote Dexie photos with server's empty photos:[]** |

---

## Pre-Flight Checklist (before touching sync code)

```
[ ] Read this devlog first
[ ] Understand: bunker_jobs has NO photos column
[ ] Understand: photos[] ONLY lives in Dexie
[ ] Any Dexie jobs write preserves existing photos
[ ] Any Supabase→React data path merges Dexie photos
[ ] processUpdateJob/processCreateJob clear syncStatus after push
[ ] handleOnline bypasses throttle
[ ] Seal failures queue SEAL_JOB
[ ] Run: npm test -- --run && npm run build
```

---

## Testing the Full Offline Flow (UAT)

```
1. Open app, navigate to a job with photos
2. Enable airplane mode
3. Capture 3+ photos via EvidenceCapture
4. Disable airplane mode
5. Verify: sync indicator shows progress (e.g., "3/3")
6. Wait for sync to complete
7. REFRESH the page (Ctrl+R / Cmd+R)
8. Verify: photos still visible with correct thumbnails
9. Verify: photo URLs are Supabase Storage URLs (not IndexedDB refs)
10. Enable airplane mode again
11. REFRESH the page
12. Verify: photos still visible (loaded from Dexie)
13. Verify: no spinning circle (Dexie fallback works)
```
