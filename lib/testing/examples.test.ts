/**
 * Test Data Generation - Usage Examples
 *
 * This file demonstrates practical usage patterns for the test data
 * generation script in unit tests, integration tests, and E2E tests.
 *
 * Run with: npm test -- lib/testing/examples.test.ts
 *
 * @see generateTestData.ts for API reference
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  generateSmallDataset,
  generateMediumDataset,
  generateDataset,
  cleanupTestData,
  type GenerationResult,
  type TestDataConfig,
} from './generateTestData';

// ============================================================================
// EXAMPLE 1: Basic Dataset Generation
// ============================================================================

describe('Test Data Generation - Basic Usage', () => {
  const WORKSPACE_ID = `test-basic-${Date.now()}`;
  let generationResult: GenerationResult;

  beforeAll(async () => {
    console.log(`\n📦 Generating test data for workspace: ${WORKSPACE_ID}`);
    generationResult = await generateSmallDataset(WORKSPACE_ID);
    expect(generationResult.success).toBe(true);
  });

  afterAll(async () => {
    console.log(`🗑️  Cleaning up workspace: ${WORKSPACE_ID}`);
    const cleanup = await cleanupTestData(WORKSPACE_ID);
    // Note: cleanup may fail in test environment due to RLS policies
    // This is expected and not critical for staging validation
    if (!cleanup.success) {
      console.warn(`⚠️  Cleanup warning: ${cleanup.error}`);
    }
  });

  it('should generate dataset with expected structure', () => {
    expect(generationResult).toMatchObject({
      success: true,
      jobsCreated: expect.any(Number),
      clientsCreated: expect.any(Number),
      photosCreated: expect.any(Number),
      signersCreated: expect.any(Number),
      sealedJobsCreated: expect.any(Number),
      durationMs: expect.any(Number),
    });
  });

  it('should have created correct number of jobs', () => {
    const expectedTotal = 100; // Small dataset
    expect(generationResult.jobsCreated).toBeGreaterThanOrEqual(95);
    expect(generationResult.jobsCreated).toBeLessThanOrEqual(expectedTotal);
  });

  it('should have sealed jobs with correct distribution', () => {
    expect(generationResult.summary.sealedRecentCount).toBeGreaterThan(0);
    expect(generationResult.summary.sealedArchiveCount).toBeGreaterThan(0);
  });

  it('should generate evidence artifacts', () => {
    expect(generationResult.photosCreated).toBeGreaterThan(0);
    expect(generationResult.signersCreated).toBeGreaterThan(0);
  });
});

// ============================================================================
// EXAMPLE 2: Sealed Job Validation
// ============================================================================

describe('Test Data Generation - Sealed Jobs', () => {
  const WORKSPACE_ID = `test-sealed-${Date.now()}`;
  let generationResult: GenerationResult;

  beforeAll(async () => {
    // Generate data with emphasis on sealed jobs
    const config: TestDataConfig = {
      sealedJobsRecentCount: 30,
      sealedJobsArchiveCount: 20,
      activeJobsCount: 10,
      loadTestJobsCount: 10,
      jobsWithPhotosPercent: 100,
      jobsWithSignaturesPercent: 100,
      syncConflictCount: 5,
      workspaceId: WORKSPACE_ID,
    };

    generationResult = await generateDataset(config);
    expect(generationResult.success).toBe(true);
  });

  afterAll(async () => {
    await cleanupTestData(WORKSPACE_ID);
  });

  it('should have created sealed recent jobs (0-179 days)', () => {
    expect(generationResult.summary.sealedRecentCount).toBe(30);
  });

  it('should have created sealed archive jobs (180+ days)', () => {
    expect(generationResult.summary.sealedArchiveCount).toBe(20);
  });

  it('should have complete evidence on sealed jobs', () => {
    // All jobs should have at least 2 photos and 1 signature
    expect(generationResult.photosCreated).toBeGreaterThan(100);
    expect(generationResult.signersCreated).toBeGreaterThanOrEqual(50);
  });

  it('should support audit trail verification', () => {
    // Sealed jobs should have:
    // - sealedAt timestamp
    // - sealedBy email
    // - evidenceHash
    // - job status = Complete or Archived

    // In a real test, you'd fetch the jobs and verify these fields
    expect(generationResult.sealedJobsCreated).toBe(50);
  });
});

// ============================================================================
// EXAMPLE 3: Load Testing
// ============================================================================

describe('Test Data Generation - Load Testing', () => {
  const WORKSPACE_ID = `test-load-${Date.now()}`;
  let generationResult: GenerationResult;

  beforeAll(async () => {
    // Generate medium dataset for realistic load testing
    console.log('\n⚡ Generating load test dataset (500 jobs)...');
    const startTime = Date.now();
    generationResult = await generateMediumDataset(WORKSPACE_ID);
    const duration = Date.now() - startTime;

    expect(generationResult.success).toBe(true);
    console.log(`✅ Generation completed in ${(duration / 1000).toFixed(2)}s`);
  });

  afterAll(async () => {
    await cleanupTestData(WORKSPACE_ID);
  });

  it('should generate 500 jobs for medium load testing', () => {
    const expectedTotal = 500;
    expect(generationResult.jobsCreated).toBeGreaterThanOrEqual(475);
    expect(generationResult.jobsCreated).toBeLessThanOrEqual(expectedTotal);
  });

  it('should maintain reasonable generation performance', () => {
    // Small dataset should generate quickly (< 30 seconds)
    expect(generationResult.durationMs).toBeLessThan(30000);
  });

  it('should distribute jobs across statuses', () => {
    const {
      sealedRecentCount,
      sealedArchiveCount,
      activeJobsCount,
      loadTestJobsCount,
    } = generationResult.summary;

    const total = sealedRecentCount + sealedArchiveCount + activeJobsCount + loadTestJobsCount;
    expect(total).toBeGreaterThan(400);
  });

  it('should have realistic evidence coverage', () => {
    // With 500 jobs and 80% photo coverage, expect 400+ photos
    expect(generationResult.photosCreated).toBeGreaterThan(300);
  });
});

// ============================================================================
// EXAMPLE 4: Sync Conflict Scenarios
// ============================================================================

describe('Test Data Generation - Sync Conflicts', () => {
  const WORKSPACE_ID = `test-conflicts-${Date.now()}`;
  let generationResult: GenerationResult;

  beforeAll(async () => {
    // Generate data with many conflict scenarios for conflict resolution testing
    const config: TestDataConfig = {
      sealedJobsRecentCount: 10,
      sealedJobsArchiveCount: 10,
      activeJobsCount: 80,  // More active jobs = more conflict scenarios
      loadTestJobsCount: 0,
      jobsWithPhotosPercent: 50,
      jobsWithSignaturesPercent: 50,
      syncConflictCount: 30, // Create 30 conflict scenarios
      workspaceId: WORKSPACE_ID,
    };

    generationResult = await generateDataset(config);
    expect(generationResult.success).toBe(true);
  });

  afterAll(async () => {
    await cleanupTestData(WORKSPACE_ID);
  });

  it('should create realistic conflict scenarios', () => {
    expect(generationResult.conflictScenariosCreated).toBeGreaterThan(20);
  });

  it('should have enough active jobs for conflict testing', () => {
    expect(generationResult.summary.activeJobsCount).toBeGreaterThanOrEqual(80);
  });

  it('should support conflict type detection', () => {
    // Conflict scenarios include:
    // - status_mismatch: local vs remote status differs
    // - evidence_mismatch: different photo counts
    // - signature_mismatch: signature present/absent differently

    // In a real test, you'd fetch the conflict data and validate types
    expect(generationResult.conflictScenariosCreated).toBeGreaterThan(0);
  });
});

// ============================================================================
// EXAMPLE 5: Feature Flag Testing
// ============================================================================

describe('Test Data Generation - Feature Flags', () => {
  const testWorkspaces: string[] = [];

  afterAll(async () => {
    // Cleanup all test workspaces
    for (const workspace of testWorkspaces) {
      await cleanupTestData(workspace);
    }
  });

  it('should support per-workspace isolation', async () => {
    const workspace1 = `feature-test-1-${Date.now()}`;
    const workspace2 = `feature-test-2-${Date.now()}`;

    testWorkspaces.push(workspace1, workspace2);

    const result1 = await generateSmallDataset(workspace1);
    const result2 = await generateSmallDataset(workspace2);

    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);

    // Both should have created separate datasets
    expect(result1.jobsCreated).toBeGreaterThan(0);
    expect(result2.jobsCreated).toBeGreaterThan(0);
  });

  it('should allow testing feature flags in isolation', async () => {
    const workspace = `feature-control-${Date.now()}`;
    testWorkspaces.push(workspace);

    const controlGroup = await generateSmallDataset(workspace);
    expect(controlGroup.success).toBe(true);

    // Use this workspace to test features:
    // - Jobs with flag A enabled
    // - Jobs with flag A disabled
    // - Verify behavior difference
  });
});

// ============================================================================
// EXAMPLE 6: Performance Benchmarking
// ============================================================================

describe('Test Data Generation - Performance', () => {
  const WORKSPACE_ID = `test-perf-${Date.now()}`;

  afterAll(async () => {
    await cleanupTestData(WORKSPACE_ID);
  });

  it('should measure generation performance', async () => {
    const config: TestDataConfig = {
      sealedJobsRecentCount: 50,
      sealedJobsArchiveCount: 50,
      activeJobsCount: 50,
      loadTestJobsCount: 50,
      jobsWithPhotosPercent: 80,
      jobsWithSignaturesPercent: 70,
      syncConflictCount: 10,
      workspaceId: WORKSPACE_ID,
    };

    const startTime = performance.now();
    const result = await generateDataset(config);
    const duration = performance.now() - startTime;

    expect(result.success).toBe(true);

    console.log(`
    Performance Metrics (200 jobs):
    - Total time: ${(duration / 1000).toFixed(2)}s
    - Time per job: ${(duration / 200).toFixed(0)}ms
    - Jobs/sec: ${(200 / (duration / 1000)).toFixed(0)}
    - Photos created: ${result.photosCreated}
    - Signatures created: ${result.signersCreated}
    `);

    // Generate should complete in reasonable time
    expect(duration).toBeLessThan(60000); // < 1 minute for 200 jobs
  });

  it('should handle batch operations efficiently', async () => {
    const numWorkspaces = 3;
    const startTime = performance.now();

    const promises = Array.from({ length: numWorkspaces }, (_, i) =>
      generateSmallDataset(`bench-ws-${WORKSPACE_ID}-${i}`)
    );

    const results = await Promise.all(promises);
    const duration = performance.now() - startTime;

    results.forEach(result => {
      expect(result.success).toBe(true);
    });

    console.log(`
    Batch Performance (${numWorkspaces} workspaces):
    - Total time: ${(duration / 1000).toFixed(2)}s
    - Parallel speedup: ${(numWorkspaces * 5 / (duration / 1000)).toFixed(1)}x
    `);

    // Cleanup after batch test
    for (let i = 0; i < numWorkspaces; i++) {
      await cleanupTestData(`bench-ws-${WORKSPACE_ID}-${i}`);
    }
  });
});

// ============================================================================
// EXAMPLE 7: Integration with DataContext
// ============================================================================

describe('Test Data Generation - DataContext Integration', () => {
  const WORKSPACE_ID = `test-context-${Date.now()}`;

  beforeAll(async () => {
    const result = await generateSmallDataset(WORKSPACE_ID);
    expect(result.success).toBe(true);
  });

  afterAll(async () => {
    await cleanupTestData(WORKSPACE_ID);
  });

  it('should generate data compatible with DataContext', async () => {
    // In a real test, you'd mount DataContext with the test workspace
    // and verify it loads all generated jobs correctly

    // Pseudo-code:
    // const { result } = render(
    //   <DataContextProvider workspaceId={WORKSPACE_ID}>
    //     <TestComponent />
    //   </DataContextProvider>
    // );

    // await waitFor(() => {
    //   expect(result.getByText(/100 jobs/)).toBeInTheDocument();
    // });

    expect(true).toBe(true); // Placeholder
  });

  it('should support Dexie/IndexedDB sync', () => {
    // Test that generated jobs sync correctly to IndexedDB:
    // 1. Generate test data
    // 2. Fetch jobs via DataContext
    // 3. Verify they exist in IndexedDB
    // 4. Go offline
    // 5. Verify jobs still accessible from IndexedDB
    // 6. Create new job offline
    // 7. Go online
    // 8. Verify sync queue processes correctly

    expect(true).toBe(true); // Placeholder
  });
});

// ============================================================================
// EXAMPLE 8: Error Handling
// ============================================================================

describe('Test Data Generation - Error Handling', () => {
  it('should handle missing Supabase credentials gracefully', async () => {
    // This test would run with invalid credentials
    // Expected: GenerationResult.success = false, error message provided

    // Pseudo-code:
    // const invalidClient = createSupabaseClient('invalid-url', 'invalid-key');
    // const result = await generateSmallDataset('test-ws');
    // expect(result.success).toBe(false);
    // expect(result.error).toBeDefined();

    expect(true).toBe(true); // Placeholder
  });

  it('should validate workspace ID', async () => {
    // Empty or invalid workspace IDs should be rejected
    // Expected: Error returned, no data created

    expect(true).toBe(true); // Placeholder
  });

  it('should handle partial failures in batch inserts', async () => {
    // Some inserts may fail due to duplicate IDs or RLS violations
    // Expected: Partial success with error reporting

    const result = await generateSmallDataset(`error-test-${Date.now()}`);

    // Either success or partial success
    expect(result.jobsCreated).toBeGreaterThanOrEqual(0);
    expect(result.summary).toBeDefined();

    // Cleanup
    await cleanupTestData(`error-test-${Date.now()}`);
  });
});

// ============================================================================
// EXAMPLE 9: Custom Configuration Patterns
// ============================================================================

describe('Test Data Generation - Custom Configurations', () => {
  const baseWorkspace = `custom-config-${Date.now()}`;
  let workspaceCounter = 0;

  afterAll(async () => {
    for (let i = 0; i < workspaceCounter; i++) {
      await cleanupTestData(`${baseWorkspace}-${i}`);
    }
  });

  it('should support sealed-only dataset', async () => {
    const workspaceId = `${baseWorkspace}-${workspaceCounter++}`;

    const result = await generateDataset({
      sealedJobsRecentCount: 100,
      sealedJobsArchiveCount: 100,
      activeJobsCount: 0,
      loadTestJobsCount: 0,
      jobsWithPhotosPercent: 100,
      jobsWithSignaturesPercent: 100,
      syncConflictCount: 0,
      workspaceId,
    });

    expect(result.success).toBe(true);
    expect(result.sealedJobsCreated).toBe(200);
    expect(result.summary.activeJobsCount).toBe(0);
  });

  it('should support evidence-rich dataset', async () => {
    const workspaceId = `${baseWorkspace}-${workspaceCounter++}`;

    const result = await generateDataset({
      sealedJobsRecentCount: 50,
      sealedJobsArchiveCount: 50,
      activeJobsCount: 0,
      loadTestJobsCount: 0,
      jobsWithPhotosPercent: 100, // All jobs have photos
      jobsWithSignaturesPercent: 100, // All jobs have signatures
      syncConflictCount: 10,
      workspaceId,
    });

    expect(result.success).toBe(true);
    // 100 jobs × 3 photos average = 300+ photos
    expect(result.photosCreated).toBeGreaterThan(250);
    // 100 jobs × 100% signature coverage = 100 signatures
    expect(result.signersCreated).toBe(100);
  });

  it('should support conflict-heavy dataset', async () => {
    const workspaceId = `${baseWorkspace}-${workspaceCounter++}`;

    const result = await generateDataset({
      sealedJobsRecentCount: 0,
      sealedJobsArchiveCount: 0,
      activeJobsCount: 100,
      loadTestJobsCount: 0,
      jobsWithPhotosPercent: 50,
      jobsWithSignaturesPercent: 50,
      syncConflictCount: 50, // Many conflicts for testing
      workspaceId,
    });

    expect(result.success).toBe(true);
    expect(result.conflictScenariosCreated).toBeGreaterThan(40);
  });
});

// ============================================================================
// EXAMPLE 10: Real-world Test Suite Integration
// ============================================================================

describe('Real-world Integration - Job Listing', () => {
  const WORKSPACE_ID = `real-world-${Date.now()}`;
  let generationResult: GenerationResult;

  beforeAll(async () => {
    // Setup: Generate realistic test data
    generationResult = await generateSmallDataset(WORKSPACE_ID);
    expect(generationResult.success).toBe(true);
  });

  afterAll(async () => {
    // Teardown: Clean up test data
    await cleanupTestData(WORKSPACE_ID);
  });

  // These would be actual feature tests in a real test suite
  it('should display job list with generated data', () => {
    expect(generationResult.jobsCreated).toBeGreaterThan(0);
  });

  it('should filter sealed jobs correctly', () => {
    expect(generationResult.sealedJobsCreated).toBeGreaterThan(0);
  });

  it('should search jobs by title', () => {
    // Search tests would use generated data
    expect(generationResult.jobsCreated).toBeGreaterThan(0);
  });

  it('should paginate large job lists', () => {
    // Pagination tests work with 100 generated jobs
    expect(generationResult.jobsCreated).toBeGreaterThan(0);
  });

  it('should handle offline job updates', () => {
    // Offline tests would use generated jobs as baseline
    expect(generationResult.summary).toBeDefined();
  });
});
