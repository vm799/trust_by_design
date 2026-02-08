# Quick Start Guide - JobProof Test Data Generation

Get up and running in 5 minutes.

## 1. Setup Environment Variables

```bash
# Add to your .env or terminal session
export VITE_SUPABASE_URL="https://your-project.supabase.co"
export VITE_SUPABASE_ANON_KEY="your-anon-key-here"
```

## 2. Generate Test Data (Pick One)

### Option A: Via CLI (Easiest)

```bash
# Small dataset (100 jobs, ~5 seconds)
npx tsx lib/testing/generateTestData.ts --size=small

# Medium dataset (500 jobs, ~25 seconds)
npx tsx lib/testing/generateTestData.ts --size=medium --workspace=my-workspace

# Large dataset (10,000 jobs, ~5-15 minutes)
npx tsx lib/testing/generateTestData.ts --size=large --cleanup
```

### Option B: Via Shell Scripts

```bash
# Source the scripts
source lib/testing/scripts.sh

# Generate
generate_small
generate_medium
generate_large my-workspace

# Setup full staging environment
setup_staging
```

### Option C: Programmatically (In Code)

```typescript
import { generateSmallDataset, cleanupTestData } from '@/lib/testing/generateTestData';

// Generate
const result = await generateSmallDataset('my-workspace');
console.log(`Created ${result.jobsCreated} jobs in ${result.durationMs}ms`);

// Cleanup when done
await cleanupTestData('my-workspace');
```

## 3. Verify Generation

Check the output:

```
✅ Test data generation completed!
   Jobs created: 100
   Photos: 80
   Signatures: 70
   Sealed recent: 20
   Sealed archive: 20
   Active: 30
   Load test: 30
   Sync conflicts: 10
   Duration: 5.23s
```

## 4. Start Using Test Data

### In Tests

```typescript
import { generateSmallDataset } from '@/lib/testing/generateTestData';

describe('Jobs', () => {
  beforeAll(async () => {
    await generateSmallDataset('test-workspace');
  });

  it('should display jobs', async () => {
    const jobs = await fetchJobs('test-workspace');
    expect(jobs.length).toBe(100);
  });
});
```

### In Components

```typescript
import { useData } from '@/lib/DataContext';

export function JobList() {
  const { jobs } = useData();  // Gets generated test data
  return <div>{jobs.length} jobs</div>;
}
```

## Common Commands

### Quick Test

```bash
# 100 jobs, fresh workspace
npx tsx lib/testing/generateTestData.ts --size=small --workspace=quick-test
```

### Staging Setup

```bash
# Setup production-like staging environment
source lib/testing/scripts.sh
setup_staging
```

### Parallel Generation (5 workspaces)

```bash
source lib/testing/scripts.sh
generate_multi_workspace 5 small
```

### With Logging

```bash
npx tsx lib/testing/generateTestData.ts --size=medium 2>&1 | tee test-data.log
```

### Cleanup

```bash
# Delete test data for workspace
npx tsx lib/testing/generateTestData.ts --workspace=my-workspace --action=cleanup
```

## What Gets Generated

### 100 Small Dataset
- 20 sealed recent (0-179 days)
- 20 sealed archive (180+ days)
- 30 active (draft to complete)
- 30 load test (varied)
- 80 photos with metadata
- 70 signatures with hashes
- 10 sync conflict scenarios

### 500 Medium Dataset
- 100 sealed recent
- 100 sealed archive
- 150 active
- 150 load test
- 400+ photos
- 350+ signatures
- 30+ conflict scenarios

### 10,000 Large Dataset
- 2,000 sealed recent
- 2,000 sealed archive
- 3,000 active
- 3,000 load test
- 8,000+ photos
- 7,000+ signatures
- 50+ conflict scenarios

## Troubleshooting

### "Missing Supabase credentials"
```bash
# Set environment variables
export VITE_SUPABASE_URL="https://your-project.supabase.co"
export VITE_SUPABASE_ANON_KEY="your-anon-key"
```

### "Request timeout after 30s"
```bash
# Try with smaller dataset
npx tsx lib/testing/generateTestData.ts --size=small

# Or retry the operation
npx tsx lib/testing/generateTestData.ts --size=medium
```

### "Out of memory"
```bash
# Increase Node memory limit
NODE_OPTIONS=--max-old-space-size=4096 \
npx tsx lib/testing/generateTestData.ts --size=large
```

## Next Steps

1. **Read Full Documentation:** See `README.md`
2. **Learn Architecture:** See `ARCHITECTURE.md`
3. **View Examples:** See `examples.test.ts`
4. **Advanced Usage:** See `scripts.sh`

## Key Files

| File | Purpose | Usage |
|------|---------|-------|
| `generateTestData.ts` | Main generator | Import or CLI |
| `README.md` | Full documentation | Reference |
| `ARCHITECTURE.md` | Technical details | Understanding |
| `examples.test.ts` | Usage examples | Copy patterns |
| `scripts.sh` | CLI helpers | Bash functions |
| `QUICKSTART.md` | This file | Getting started |

## Typical Workflow

```bash
# 1. Setup environment
export VITE_SUPABASE_URL="https://project.supabase.co"
export VITE_SUPABASE_ANON_KEY="key"

# 2. Generate small dataset for local testing
npx tsx lib/testing/generateTestData.ts --size=small

# 3. Run tests (uses generated data via DataContext)
npm test

# 4. Cleanup when done
npx tsx lib/testing/generateTestData.ts --workspace=staging-workspace --action=cleanup
```

## Performance

| Dataset | Duration | Network | Memory |
|---------|----------|---------|--------|
| Small (100) | ~5s | 2MB | 50MB |
| Medium (500) | ~25s | 10MB | 150MB |
| Large (10K) | 5-15m | 150MB | 500MB |

## Support

For issues or questions:
1. Check `README.md` troubleshooting section
2. Review `ARCHITECTURE.md` for technical details
3. Check `examples.test.ts` for usage patterns
4. See project CLAUDE.md constitution

---

**Ready to generate?** Run: `npx tsx lib/testing/generateTestData.ts --size=small`
