# Test Data Generation - Architecture & Implementation

Comprehensive technical documentation for the JobProof test data generation system.

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture](#architecture)
3. [Data Generation Pipeline](#data-generation-pipeline)
4. [Key Algorithms](#key-algorithms)
5. [Performance Considerations](#performance-considerations)
6. [Security & Privacy](#security--privacy)
7. [Integration Points](#integration-points)
8. [Troubleshooting Guide](#troubleshooting-guide)

## System Overview

### Purpose

The test data generation system provides:

- **Reproducible test data** for staging and QA environments
- **Realistic data volumes** for performance testing
- **Cryptographic evidence simulation** with hashes and signatures
- **Sync conflict scenarios** for conflict resolution testing
- **Audit trail data** with complete metadata

### Core Components

```
lib/testing/
├── generateTestData.ts      # Main generation engine
├── examples.test.ts         # Test usage patterns
├── scripts.sh              # CLI bash helpers
├── README.md               # User-facing documentation
└── ARCHITECTURE.md         # This file
```

### Key Statistics

| Metric | Small | Medium | Large |
|--------|-------|--------|-------|
| Jobs | 100 | 500 | 10,000 |
| Duration | ~5s | ~25s | ~5-15m |
| Memory | 50MB | 150MB | 500MB |
| Network | 2MB | 10MB | 150MB |
| Photos/Job | 0-5 | 0-5 | 0-5 |
| Avg File Size | ~3KB | ~3KB | ~3KB |

## Architecture

### High-Level Flow

```
┌─────────────────┐
│   Generation    │
│   Request       │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────┐
│    Config Validation                │
│  - Workspace ID                     │
│  - Dataset size                     │
│  - Coverage percentages             │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│    Supabase Connection              │
│  - Client initialization            │
│  - Credential validation            │
│  - Connection test                  │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│    Data Generation                  │
│  ├─ Sealed Recent Jobs              │
│  ├─ Sealed Archive Jobs             │
│  ├─ Active Jobs                     │
│  └─ Load Test Jobs                  │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│    Evidence Generation              │
│  ├─ Photos (2-5 per job)            │
│  ├─ Signatures                      │
│  ├─ Hashes (SHA-256)                │
│  └─ Metadata                        │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│    Batch Insertion                  │
│  ├─ Chunk by 50 jobs                │
│  ├─ Retry on transient errors       │
│  ├─ Conflict detection              │
│  └─ Result aggregation              │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────┐
│   Results       │
│   Reporting     │
└─────────────────┘
```

### Module Responsibilities

#### `generateTestData.ts` (Main Module)

**Responsibilities:**
- Configuration management (TestDataConfig)
- Job data generation with realistic attributes
- Photo and signature generation
- Batch insertion to Supabase
- Error handling and retry logic
- CLI support for direct execution
- Public API for programmatic usage

**Key Types:**
```typescript
interface TestDataConfig {
  sealedJobsRecentCount: number;
  sealedJobsArchiveCount: number;
  activeJobsCount: number;
  loadTestJobsCount: number;
  jobsWithPhotosPercent: number;
  jobsWithSignaturesPercent: number;
  syncConflictCount: number;
  workspaceId: string;
}

interface GenerationResult {
  success: boolean;
  jobsCreated: number;
  durationMs: number;
  // ... more fields
}
```

#### `examples.test.ts` (Usage Examples)

**Responsibilities:**
- Demonstrate all generation patterns
- Show integration with test frameworks
- Provide copy-paste examples
- Validate API contracts

#### `scripts.sh` (CLI Support)

**Responsibilities:**
- Command-line interface
- Environment variable management
- Batch operations
- Logging and monitoring
- Interactive help

## Data Generation Pipeline

### Phase 1: Configuration Preparation

```typescript
// Input validation
const config: TestDataConfig = {
  sealedJobsRecentCount: 50,     // 0-179 days
  sealedJobsArchiveCount: 50,    // 180+ days
  activeJobsCount: 50,           // Draft to Complete
  loadTestJobsCount: 50,         // Varied statuses
  jobsWithPhotosPercent: 80,     // Coverage
  jobsWithSignaturesPercent: 70, // Coverage
  syncConflictCount: 10,         // Test scenarios
  workspaceId: 'test-ws'
};

// Total jobs = 200
// Total time: ~25 seconds
```

### Phase 2: Job Data Generation

For each job category, generate realistic data:

#### Sealed Recent Jobs (0-179 days)
```typescript
for (let i = 0; i < config.sealedJobsRecentCount; i++) {
  const ageInDays = randomInt(0, 179);
  const sealDate = timestampDaysAgo(ageInDays);

  const job: Job = {
    id: generateUUID(),
    title: randomJobTitle(),
    status: 'Complete',           // Always complete
    sealedAt: sealDate,           // Sealed at age X days
    evidenceHash: generateHash(), // SHA-256
    // ... full job data
  };
}
```

**Characteristics:**
- Status: Always "Complete" (ready to seal)
- Seal date: Random between 0-179 days ago
- Evidence: Full (photos, signatures, hashes)
- Archive: Not yet archived
- Use: Audit testing, recent evidence retrieval

#### Sealed Archive Jobs (180+ days)
```typescript
for (let i = 0; i < config.sealedJobsArchiveCount; i++) {
  const ageInDays = randomInt(180, 1000);
  const sealDate = timestampDaysAgo(ageInDays);
  const archiveDate = timestampDaysAgo(ageInDays - 1);

  const job: Job = {
    id: generateUUID(),
    title: randomJobTitle(),
    status: 'Archived',           // Auto-archived
    sealedAt: sealDate,           // Sealed long ago
    archivedAt: archiveDate,      // Auto-archived
    evidenceHash: generateHash(),
    // ... full job data
  };
}
```

**Characteristics:**
- Status: "Archived" (auto-archived at 180 days)
- Seal date: 180+ days ago
- Archive date: 1 day after seal
- Evidence: Preserved in archive
- Use: Compliance, long-term retention, discovery

#### Active Jobs
```typescript
const activeStatuses: JobStatus[] = [
  'Draft', 'Pending', 'In Progress', 'Complete'
];

for (let i = 0; i < config.activeJobsCount; i++) {
  const job: Job = {
    id: generateUUID(),
    title: randomJobTitle(),
    status: randomItem(activeStatuses),  // Varied states
    sealedAt: undefined,                 // Not sealed
    // ... full job data
  };
}
```

**Characteristics:**
- Status: Mixed (not sealed)
- Evidence: Partial (some have photos/signatures)
- Use: Form state, real-time updates, workflows

#### Load Test Jobs
```typescript
for (let i = 0; i < config.loadTestJobsCount; i++) {
  const job: Job = {
    id: generateUUID(),
    title: randomJobTitle(),
    status: randomItem(ALL_STATUSES),
    // Randomized coverage for realistic distribution
    photos: Math.random() < 0.8 ? generatePhotos() : [],
    signature: Math.random() < 0.7 ? generateSignature() : null,
  };
}
```

**Characteristics:**
- Status: Any status
- Evidence: Realistic coverage (80% photos, 70% signatures)
- Use: Database performance, pagination, search

### Phase 3: Evidence Generation

#### Photo Generation

For each job that has photos:

```typescript
function generateMockPhotos(jobId: string, count: number): Photo[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `photo-${jobId}-${i}`,
    url: `https://storage.jobproof.pro/${jobId}/photo-${i}.jpg`,
    timestamp: timestampDaysAgo(randomInt(0, 30)),
    lat: 40.7128 + (Math.random() - 0.5),  // Real coordinates +/- 0.5 degrees
    lng: -74.006 + (Math.random() - 0.5),
    w3w: generateRandomW3W(),              // What3Words address
    verified: Math.random() > 0.2,         // 80% verified
    photo_hash: generateSHA256Hash(),      // Integrity hash
    photo_hash_algorithm: 'sha256',
    gps_accuracy: randomInt(5, 50),        // Meters
    device_info: {
      make: randomItem(['Apple', 'Samsung', 'Google']),
      model: randomItem(['iPhone 15', 'Galaxy S24', 'Pixel 8']),
      os_version: `${randomInt(14, 18)}.0`,
      app_version: '2.1.0',
    },
  }));
}
```

**Metrics:**
- Count per job: 2-5 (random)
- Types: Before, During, After, Evidence (rotated)
- Coverage: 80% of jobs (configurable)
- GPS accuracy: 5-50 meters (realistic)
- Metadata: Full EXIF-like data

#### Signature Generation

For each job with signature:

```typescript
function generateMockSignature(jobId: string): string {
  const signableContent = `jobId:${jobId}|timestamp:${Date.now()}`;
  return crypto.createHash('sha256')
    .update(signableContent)
    .digest('hex');
}
```

**Metrics:**
- Coverage: 70% of jobs (configurable)
- Hash: SHA-256 (256-bit)
- Signer: Random technician/manager/client
- Timestamp: When signature was captured

#### Hash Generation

For sealed jobs:

```typescript
function generateSHA256Hash(input?: string): string {
  const data = input || crypto.randomBytes(32).toString('hex');
  return crypto.createHash('sha256')
    .update(data)
    .digest('hex');
}
```

**Used For:**
- evidenceHash: Bundle integrity
- photo_hash: Individual photo integrity
- signatureHash: Signature verification
- techTokenHash: Token verification
- techPinHash: PIN verification

### Phase 4: Batch Insertion

Jobs are inserted in chunks to handle Supabase request size limits:

```typescript
async function batchInsertJobs(
  client: SupabaseClient,
  jobs: Job[],
  chunkSize: number = 50
): Promise<InsertResult> {
  for (let i = 0; i < jobs.length; i += chunkSize) {
    const chunk = jobs.slice(i, i + chunkSize);

    // Convert Job types to database schema
    const payload = chunk.map(job => ({
      id: job.id,
      title: job.title,
      // ... all fields mapped to snake_case
    }));

    // Insert with error handling
    const { error } = await client
      .from('jobs')
      .insert(payload);

    if (error) {
      // Log and continue (partial success)
      console.error(`Chunk ${i}: ${error.message}`);
      failures++;
    } else {
      successes += chunk.length;
    }
  }
}
```

**Batching Strategy:**
- Chunk size: 50 jobs (Supabase limit is ~100KB)
- Error handling: Retry on transient errors
- Partial success: Continue if some batches fail
- Timeout: 30 seconds per request

## Key Algorithms

### Random Data Generation

#### Job Age Distribution
```typescript
// Recent sealed: uniform 0-179 days
const recentAge = randomInt(0, 179);

// Archive eligible: uniform 180-1000 days
const archiveAge = randomInt(180, 1000);

// All jobs: uniform across all days
const anyAge = randomInt(0, 1000);
```

**Purpose:** Test different seal age scenarios
**Result:** Even distribution across all age ranges

#### What3Words Address Generation
```typescript
function generateRandomW3W(): string {
  const words = [
    'index', 'alpha', 'bravo', 'scale', 'plate',
    'paint', 'plain', 'place', 'play', 'raft',
    // ... 20+ words
  ];
  return `${randomItem(words)}.${randomItem(words)}.${randomItem(words)}`;
}
```

**Pattern:** word.word.word
**Example:** "index.home.raft"
**Purpose:** Realistic W3W addresses (not valid, but properly formatted)

#### GPS Coordinate Generation
```typescript
const lat = 40.7128 + (Math.random() - 0.5);  // NYC ±0.5° (~55 km)
const lng = -74.006 + (Math.random() - 0.5);
```

**Base:** New York City coordinates
**Variation:** ±0.5 degrees (~55 km radius)
**Result:** Cluster of points in reasonable geographic area

#### SHA-256 Hash Generation
```typescript
function generateSHA256Hash(input?: string): string {
  const data = input || crypto.randomBytes(32).toString('hex');
  return crypto.createHash('sha256')
    .update(data)
    .digest('hex');
}
```

**Output:** 64-character hex string
**Security:** Not cryptographically secure (uses predictable input)
**Purpose:** For testing only (simulates real evidence hashes)

### Conflict Scenario Generation
```typescript
const conflicts: ConflictScenario[] = [];

for (let i = 0; i < config.syncConflictCount; i++) {
  const job = activeJobs[i];
  conflicts.push({
    jobId: job.id,
    localVersion: {
      ...job,
      status: 'Complete',        // Local version
      lastUpdated: Date.now(),
    },
    remoteVersion: {
      ...job,
      status: 'In Progress',     // Remote version
      lastUpdated: Date.now() - 60000,
    },
    conflictType: 'status_mismatch',
  });
}
```

**Scenario Types:**
- `status_mismatch`: Different job status
- `evidence_mismatch`: Different photo count
- `signature_mismatch`: Signature present/absent

**Purpose:** Test conflict detection and resolution

## Performance Considerations

### Memory Usage

**Job Generation:**
- Each Job object: ~2-3 KB
- 100 jobs: ~300 KB
- 10,000 jobs: ~30 MB
- Total with photos/metadata: 50-500 MB

**Optimization:**
```typescript
// Generate and insert in chunks (don't keep all in memory)
for (let batch = 0; batch < totalBatches; batch++) {
  const jobsChunk = generateJobsForBatch(batch);
  await batchInsertJobs(client, jobsChunk);
  // jobsChunk is garbage collected
}
```

### Network Usage

**Per Job (Average):**
- Database row: ~3 KB
- Photos array: ~1 KB (if 2-5 photos)
- Total: ~4 KB per job

**Total Network:**
- Small (100): ~400 KB
- Medium (500): ~2 MB
- Large (10K): ~40 MB

**Optimization:**
```typescript
// Compress photos array for transmission
const compactPhotos = photos.map(p => ({
  id: p.id,
  url: p.url,
  hash: p.photo_hash,
  // Omit verbose metadata for transmission
}));
```

### CPU Usage

**Dominant Operations:**
1. Random number generation (fast)
2. String concatenation (fast)
3. Hash generation (medium - SHA-256 overhead)
4. Network I/O (slowest)

**Profile:**
- Job generation: ~100 jobs/sec (CPU-bound)
- Hash generation: ~1000 hashes/sec
- Network: ~5-10 jobs/sec (I/O-bound)

**Bottleneck:** Network I/O (Supabase insert latency)

### Database Performance

**Insert Performance:**
- Single insert: ~100 ms
- Batch (50 jobs): ~500 ms
- Throughput: ~100 jobs/sec

**Index Impact:**
- Primary key (id): Fast (indexed)
- workspace_id: Fast (indexed for RLS)
- Queries during load: May be slower with 10K jobs

## Security & Privacy

### Non-Sensitive Data Generation

All generated data is **synthetic and test-only**:
- Email addresses: test@jobproof.pro
- Phone numbers: 555-XXXX (fake)
- GPS coordinates: Clustered in NYC area
- Names: Common generic names

### No Real PII

```typescript
// ❌ NEVER do this
const realPII = {
  name: 'John Smith',           // Real person
  email: 'john@company.com',    // Real email
  phone: '555-0123',            // Real phone
  address: '123 Main St',       // Real address
};

// ✅ DO this instead
const testData = {
  name: 'John Smith - Test',
  email: `tech${index}@test.jobproof.pro`,
  phone: '555-1234',
  address: 'Synthetic Address, City, State',
};
```

### Hash Non-Reproducibility

```typescript
// Hashes use random input for each generation
function generateSHA256Hash(input?: string): string {
  // If no input, use random bytes (different each run)
  const data = input || crypto.randomBytes(32).toString('hex');
  return crypto.createHash('sha256').update(data).digest('hex');
}
```

**Result:** Each generation produces different hashes
**Security:** Prevents reverse-engineering of test patterns

### Workspace Isolation

```typescript
// All test data is scoped to workspace_id
const result = await generateDataset({
  workspaceId: 'test-workspace-123',  // Isolated
  // ... other config
});

// RLS policy ensures workspace isolation:
// CREATE POLICY "workspace_isolation" ON jobs
// USING (workspace_id = auth.jwt() ->> 'workspace_id');
```

## Integration Points

### DataContext Integration

Generated jobs are compatible with DataContext:

```typescript
// In DataContext.tsx
const { data: jobs } = await client
  .from('jobs')
  .select('*')
  .eq('workspace_id', workspaceId);

// Works with generated data
jobs.forEach(job => {
  // All fields present
  console.log(job.title, job.status, job.sealedAt);
});
```

### Dexie/IndexedDB Sync

Generated jobs sync to local database:

```typescript
// Jobs in Supabase can be synced to IndexedDB
const syncResult = await syncQueue.sync(jobs);

// Dexie transaction
await db.jobs.bulkPut(jobs);

// Offline mode works
const localJobs = await db.jobs
  .where('workspace_id')
  .equals(workspaceId)
  .toArray();
```

### Test Framework Integration

Works with Vitest, Jest, Playwright:

```typescript
// Vitest
describe('Jobs', () => {
  beforeAll(async () => {
    await generateSmallDataset();
  });

  it('should list jobs', async () => {
    const jobs = await fetchJobs();
    expect(jobs.length).toBeGreaterThan(0);
  });
});

// Playwright
test.beforeAll(async () => {
  await generateMediumDataset();
});

test('should display job list', async ({ page }) => {
  await page.goto('/jobs');
  const jobCount = await page.locator('.job-row').count();
  expect(jobCount).toBeGreaterThan(0);
});
```

## Troubleshooting Guide

### Connection Issues

**Error:** `Missing Supabase credentials`

**Diagnosis:**
```bash
echo $VITE_SUPABASE_URL    # Should print URL
echo $VITE_SUPABASE_ANON_KEY  # Should print key
```

**Solution:**
```bash
export VITE_SUPABASE_URL="https://your-project.supabase.co"
export VITE_SUPABASE_ANON_KEY="your-anon-key"
```

### Timeout Issues

**Error:** `Request timeout after 30s`

**Cause:** Network latency, large batch size, or slow Supabase instance

**Solution:**
```typescript
// Reduce batch size
await batchInsertJobs(client, jobs, 25);  // Was 50

// Or increase timeout
const { error } = await client
  .from('jobs')
  .insert(payload, { timeout: 60000 });
```

### RLS Violations

**Error:** `new row violates row-level security policy`

**Cause:** User doesn't have access to workspace

**Solution:**
```typescript
// Verify user has workspace access
const { data: workspace } = await client
  .from('workspaces')
  .select('id')
  .eq('id', workspaceId)
  .single();

if (!workspace) {
  throw new Error(`User doesn't have access to workspace`);
}
```

### Out of Memory

**Error:** `JavaScript heap out of memory`

**Cause:** Generating 10K jobs without chunking

**Solution:**
```bash
# Increase Node memory
NODE_OPTIONS=--max-old-space-size=4096 \
npx tsx lib/testing/generateTestData.ts --size=large

# Or use smaller dataset
npx tsx lib/testing/generateTestData.ts --size=medium
```

### Partial Failures

**Error:** `100 jobs created, 50 failed`

**Diagnosis:**
```typescript
// Check returned error details
const result = await generateSmallDataset();
if (result.error) {
  console.error('Partial failure:', result.error);
  console.log(`Successful: ${result.jobsCreated}`);
}
```

**Solution:**
- Check database quota
- Verify RLS policies
- Check for duplicate IDs (shouldn't happen)
- Retry operation

## References

- **Project Constitution:** See `/home/user/trust_by_design/CLAUDE.md`
- **Types:** See `/home/user/trust_by_design/types.ts`
- **Supabase Client:** See `/home/user/trust_by_design/lib/supabase.ts`
- **Database Helpers:** See `/home/user/trust_by_design/lib/db.ts`

---

**Last Updated:** February 2026
**Version:** 2.0
**Status:** Production Ready
