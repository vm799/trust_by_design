# DEVLOG: Offline Sync Architecture
**Created:** 2026-02-25 | **Status:** ENFORCED — read before touching sync code

---

## Data Ownership Model (Updated Fix 53)

```
SUPABASE (bunker_jobs table)    → Job metadata + photos JSONB (source of truth)
SUPABASE (bunker_jobs.photos)   → Photo metadata array: URLs, GPS, W3W, type, syncStatus
SUPABASE STORAGE (job-photos)   → Photo files (binary blobs)
DEXIE (IndexedDB jobs table)    → Local cache of server data (survives offline)
DEXIE (IndexedDB media table)   → Photo base64 data (temporary, deleted after upload)
DEXIE (IndexedDB queue table)   → Offline action queue (UPLOAD_PHOTO, UPDATE_JOB, SEAL_JOB, etc.)
```

**Fix 53: bunker_jobs NOW has a photos JSONB column.** processUploadPhoto writes
photo metadata (URLs, GPS, W3W) to Supabase after each upload. pullJobs reads
photos from server. Photos survive page refresh, browser clear, device switch.

---

## Hard Rules

### 0. NEVER use booleans in Dexie indexed fields

IndexedDB CANNOT index booleans. `false`/`true` are silently dropped from
the index. Use `0`/`1` (numbers) instead. This applies to ANY field listed
in a Dexie `.stores()` index definition.

```typescript
// WRONG — boolean is not an indexable type, query always returns 0 results
await database.queue.add({ synced: false });
await database.queue.where('synced').equals(0).toArray(); // EMPTY!

// RIGHT — number is indexable
await database.queue.add({ synced: 0 });
await database.queue.where('synced').equals(0).toArray(); // WORKS!
```

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

### 6. Push MUST complete before Pull (Fix 52)

`handleOnline` and `performSync` must `await pushQueue()` before calling
`pullJobs()`. Without this, processUploadPhoto writes new Storage URLs to
Dexie during push, but pullJobs reads stale Dexie data and overwrites via
bulkPut — reverting photos to deleted IndexedDB refs.

```typescript
// WRONG — race condition
sync.pushQueue();         // NOT awaited
sync.pullJobs(wsId);      // reads stale data, overwrites new URLs

// RIGHT — push first, then pull
await sync.pushQueue();   // photos upload, Dexie updated
sync.pullJobs(wsId);      // reads correct Dexie data
```

### 7. Photo metadata MUST persist to Supabase (Fix 53)

processUploadPhoto must write the photos[] array to bunker_jobs.photos JSONB
after each upload. Without this, server has no record of photo URLs/GPS/W3W
and every pull returns photos:[]. The merge logic is a safety net, not the
primary mechanism.

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
| 49 | db.ts + sync.ts + QuickCreateJob.tsx | **QUEUE NEVER PROCESSED: `synced: false` (boolean) not indexable by IndexedDB. Query `.equals(0)` always returned 0 results. Nothing ever synced from the Dexie queue.** |
| 50 | db.ts | **NO MIGRATION for Fix 49: existing queue items in user browsers still had `synced: false` (boolean). Fix 49 only fixed NEW records. Added Dexie v7 `.upgrade()` to convert `false→0` / `true→1` in-place.** |
| 51 | sync.ts | **pullJobs sealed branch dropped photos: when server returned sealed job, `serverJob` (photos:[]) was pushed directly to Dexie, wiping all photo metadata. Now merges local photos before writing.** |
| 52 | App.tsx | **RACE CONDITION: `pushQueue()` and `pullJobs()` fired concurrently. pullJobs could read stale Dexie data, then overwrite processUploadPhoto's new URLs via bulkPut. Push MUST complete before pull.** |
| 53 | sync.ts + migration | **ARCHITECTURAL ROOT CAUSE: Photo metadata lived ONLY in IndexedDB. Server had NO record. Every pull returned photos:[]. 7+ merge fixes needed to work around this. Now bunker_jobs has photos JSONB column. processUploadPhoto persists metadata to Supabase. pullJobs reads it from server.** |

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
