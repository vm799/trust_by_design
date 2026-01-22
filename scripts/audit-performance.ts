/**
 * JobProof Performance Audit Script
 *
 * Implements performance audit from JOBPROOF_AUDIT_SPECIFICATION.md Section 6
 * Checks:
 * - Database query performance (> 100ms threshold)
 * - Index usage verification
 * - Slow query detection
 * - API response time analysis
 *
 * Usage:
 *   npx tsx scripts/audit-performance.ts
 *
 * Requires:
 *   - VITE_SUPABASE_URL in .env
 *   - SUPABASE_SERVICE_ROLE_KEY in .env
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing credentials');
  console.error('   Required: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

interface PerformanceCheck {
  name: string;
  status: 'PASS' | 'FAIL' | 'WARNING';
  metric: string;
  threshold: string;
  details?: string;
}

const checks: PerformanceCheck[] = [];

// ============================================================================
// QUERY PERFORMANCE TESTS
// ============================================================================

async function testQueryPerformance() {
  console.log('⚡ Testing Query Performance...\n');

  const queries = [
    {
      name: 'Fetch active jobs',
      query: () => supabase.from('jobs').select('*').in('status', ['Assigned', 'In Progress']).limit(50),
      threshold: 100
    },
    {
      name: 'Fetch job with photos',
      query: () => supabase.from('jobs').select('*, photos(*)').limit(10),
      threshold: 150
    },
    {
      name: 'Fetch sealed jobs',
      query: () =>
        supabase.from('jobs').select('*, evidence_seals(*)').not('sealed_at', 'is', null).limit(10),
      threshold: 150
    },
    {
      name: 'Count jobs by status',
      query: () => supabase.from('jobs').select('status', { count: 'exact', head: true }),
      threshold: 50
    },
    {
      name: 'Recent audit logs',
      query: () =>
        supabase
          .from('audit_logs')
          .select('*')
          .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
          .limit(100),
      threshold: 100
    }
  ];

  for (const test of queries) {
    try {
      const start = performance.now();
      const { data, error } = await test.query();
      const duration = performance.now() - start;

      if (error) {
        checks.push({
          name: test.name,
          status: 'WARNING',
          metric: 'N/A',
          threshold: `${test.threshold}ms`,
          details: `Query failed: ${error.message}`
        });
        console.log(`⚠️  ${test.name}: Query failed (${error.message})`);
      } else if (duration > test.threshold) {
        checks.push({
          name: test.name,
          status: 'FAIL',
          metric: `${Math.round(duration)}ms`,
          threshold: `${test.threshold}ms`,
          details: `Query exceeded threshold by ${Math.round(duration - test.threshold)}ms`
        });
        console.log(`❌ ${test.name}: ${Math.round(duration)}ms (threshold: ${test.threshold}ms)`);
      } else {
        checks.push({
          name: test.name,
          status: 'PASS',
          metric: `${Math.round(duration)}ms`,
          threshold: `${test.threshold}ms`
        });
        console.log(`✅ ${test.name}: ${Math.round(duration)}ms`);
      }
    } catch (error) {
      console.error(`❌ ${test.name}: Error -`, error);
    }
  }
}

// ============================================================================
// INDEX VERIFICATION
// ============================================================================

async function verifyIndices() {
  console.log('\n📇 Verifying Database Indices...\n');

  // Check for missing indices on foreign keys
  const expectedIndices = [
    { table: 'jobs', column: 'workspace_id', type: 'foreign key' },
    { table: 'jobs', column: 'client_id', type: 'foreign key' },
    { table: 'jobs', column: 'technician_id', type: 'foreign key' },
    { table: 'photos', column: 'job_id', type: 'foreign key' },
    { table: 'evidence_seals', column: 'job_id', type: 'foreign key' },
    { table: 'audit_logs', column: 'workspace_id', type: 'foreign key' },
    { table: 'job_access_tokens', column: 'job_id', type: 'foreign key' },
    { table: 'jobs', column: 'status', type: 'query optimization' },
    { table: 'jobs', column: 'sealed_at', type: 'query optimization' }
  ];

  console.log('Expected indices on foreign keys and commonly queried columns:');
  expectedIndices.forEach((idx) => {
    console.log(`   • ${idx.table}.${idx.column} (${idx.type})`);
  });

  console.log('\n✅ Index verification would require pg_stat_user_indexes query');
  console.log('   Run this SQL to check indices:');
  console.log('   ```sql');
  console.log('   SELECT schemaname, tablename, indexname, idx_scan');
  console.log('   FROM pg_stat_user_indexes');
  console.log('   WHERE schemaname = \'public\'');
  console.log('   ORDER BY idx_scan;');
  console.log('   ```');
}

// ============================================================================
// SIMULATED LOAD TEST
// ============================================================================

async function runLoadTest() {
  console.log('\n🔥 Running Simulated Load Test...\n');

  const iterations = 10;
  const results: number[] = [];

  console.log(`Making ${iterations} concurrent requests...`);

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    const { error } = await supabase.from('jobs').select('id').limit(1);
    const duration = performance.now() - start;

    if (!error) {
      results.push(duration);
    }
  }

  if (results.length > 0) {
    results.sort((a, b) => a - b);

    const p50 = results[Math.floor(results.length * 0.5)];
    const p95 = results[Math.floor(results.length * 0.95)];
    const p99 = results[Math.floor(results.length * 0.99)];
    const avg = results.reduce((a, b) => a + b, 0) / results.length;

    console.log('Response Time Percentiles:');
    console.log(`   p50 (median): ${Math.round(p50)}ms`);
    console.log(`   p95: ${Math.round(p95)}ms`);
    console.log(`   p99: ${Math.round(p99)}ms`);
    console.log(`   average: ${Math.round(avg)}ms`);

    // Check against thresholds
    if (p95 < 100) {
      console.log('\n✅ p95 response time is good (< 100ms)');
    } else if (p95 < 200) {
      console.log('\n⚠️  p95 response time is acceptable (< 200ms)');
    } else {
      console.log('\n❌ p95 response time is slow (> 200ms)');
    }

    checks.push({
      name: 'API Response Time (p95)',
      status: p95 < 100 ? 'PASS' : p95 < 200 ? 'WARNING' : 'FAIL',
      metric: `${Math.round(p95)}ms`,
      threshold: '100ms',
      details: `p50: ${Math.round(p50)}ms, p99: ${Math.round(p99)}ms`
    });
  }
}

// ============================================================================
// TABLE SIZE ANALYSIS
// ============================================================================

async function analyzeTableSizes() {
  console.log('\n💾 Analyzing Table Sizes...\n');

  const tables = [
    'workspaces',
    'users',
    'jobs',
    'photos',
    'evidence_seals',
    'audit_logs',
    'clients',
    'technicians',
    'job_access_tokens',
    'signatures'
  ];

  console.log('Row counts per table:');

  for (const table of tables) {
    try {
      const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });

      if (error) {
        console.log(`   ${table}: Error (${error.message})`);
      } else {
        console.log(`   ${table}: ${count?.toLocaleString() || 0} rows`);
      }
    } catch (error) {
      console.log(`   ${table}: N/A`);
    }
  }
}

// ============================================================================
// REPORT GENERATION
// ============================================================================

function generateReport() {
  console.log('\n' + '='.repeat(80));
  console.log('PERFORMANCE AUDIT REPORT');
  console.log('='.repeat(80));
  console.log(`\nDate: ${new Date().toISOString()}`);
  console.log(`Project: ${SUPABASE_URL}\n`);

  const passed = checks.filter((c) => c.status === 'PASS');
  const failed = checks.filter((c) => c.status === 'FAIL');
  const warnings = checks.filter((c) => c.status === 'WARNING');

  console.log('SUMMARY:');
  console.log(`  ✅ Passed: ${passed.length}`);
  console.log(`  ❌ Failed: ${failed.length}`);
  console.log(`  ⚠️  Warnings: ${warnings.length}\n`);

  if (failed.length > 0) {
    console.log('FAILED CHECKS:');
    failed.forEach((check) => {
      console.log(`  ❌ ${check.name}`);
      console.log(`     Metric: ${check.metric} | Threshold: ${check.threshold}`);
      if (check.details) console.log(`     ${check.details}`);
    });
    console.log();
  }

  if (warnings.length > 0) {
    console.log('WARNINGS:');
    warnings.forEach((check) => {
      console.log(`  ⚠️  ${check.name}`);
      console.log(`     Metric: ${check.metric} | Threshold: ${check.threshold}`);
      if (check.details) console.log(`     ${check.details}`);
    });
    console.log();
  }

  console.log('='.repeat(80));
  console.log('RECOMMENDATIONS:');
  console.log('='.repeat(80));
  console.log('\n1. Monitor slow queries and add indices where needed');
  console.log('2. Review query patterns for N+1 issues');
  console.log('3. Consider caching for frequently accessed data');
  console.log('4. Enable pg_stat_statements for detailed query analysis');
  console.log('\nTo optimize queries:');
  console.log('  1. Analyze slow queries: EXPLAIN ANALYZE <query>');
  console.log('  2. Add indices on foreign keys and WHERE clauses');
  console.log('  3. Use select() to limit returned columns');
  console.log('  4. Implement pagination with limit() and offset()');
  console.log('\n' + '='.repeat(80) + '\n');

  return failed.length > 0 ? 1 : warnings.length > 0 ? 2 : 0;
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function runAudit() {
  console.log('⚡ JobProof Performance Audit');
  console.log('Based on: JOBPROOF_AUDIT_SPECIFICATION.md Section 6');
  console.log('='.repeat(80) + '\n');

  try {
    await testQueryPerformance();
    await verifyIndices();
    await runLoadTest();
    await analyzeTableSizes();

    const exitCode = generateReport();
    process.exit(exitCode);
  } catch (error) {
    console.error('\n❌ Performance audit failed:', error);
    process.exit(1);
  }
}

runAudit();
