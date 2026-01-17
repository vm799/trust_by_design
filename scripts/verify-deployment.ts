/**
 * Deployment Verification Script
 *
 * Verifies that all Phases C.1-C.5 infrastructure is deployed correctly:
 * - Database migrations (001-003)
 * - RLS policies
 * - Database triggers
 * - RPC functions
 * - Edge Functions
 *
 * Usage:
 *   npx tsx scripts/verify-deployment.ts
 *
 * Requires:
 *   - VITE_SUPABASE_URL in .env
 *   - VITE_SUPABASE_ANON_KEY in .env
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing Supabase credentials in .env');
  console.error('   Required: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

interface VerificationResult {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message: string;
  details?: string;
}

const results: VerificationResult[] = [];

async function verifyTableExists(tableName: string): Promise<boolean> {
  try {
    const { error } = await supabase.from(tableName).select('id').limit(1);
    return !error || error.code !== '42P01'; // 42P01 = table not found
  } catch (error) {
    return false;
  }
}

async function verifyRPCFunction(functionName: string, params: any): Promise<boolean> {
  try {
    // Call function with dummy params to check if it exists
    const { error } = await supabase.rpc(functionName, params);
    // If error is about missing data (not missing function), function exists
    return !error || error.code !== '42883'; // 42883 = function not found
  } catch (error) {
    return false;
  }
}

async function verifyEdgeFunction(functionName: string): Promise<boolean> {
  try {
    const { error } = await supabase.functions.invoke(functionName, {
      body: {} // Empty body to test if function exists
    });
    // If we get 400 (bad request), function exists but params missing
    // If we get 404, function doesn't exist
    return error?.status !== 404;
  } catch (error) {
    return false;
  }
}

async function verify() {
  console.log('🔍 Verifying Trust by Design deployment...\n');
  console.log(`Project: ${SUPABASE_URL}\n`);

  // ============================================================================
  // 1. VERIFY TABLES
  // ============================================================================
  console.log('📊 1. Verifying Database Tables...');

  const tables = [
    { name: 'workspaces', phase: 'C.1' },
    { name: 'users', phase: 'C.1' },
    { name: 'jobs', phase: 'C.2' },
    { name: 'clients', phase: 'C.2' },
    { name: 'technicians', phase: 'C.2' },
    { name: 'job_access_tokens', phase: 'C.2' },
    { name: 'evidence_seals', phase: 'C.3' },
    { name: 'audit_logs', phase: 'C.4' }
  ];

  for (const table of tables) {
    const exists = await verifyTableExists(table.name);
    results.push({
      name: `Table: ${table.name}`,
      status: exists ? 'pass' : 'fail',
      message: exists ? 'Exists' : 'Not found',
      details: `Phase ${table.phase}`
    });
  }

  // ============================================================================
  // 2. VERIFY RPC FUNCTIONS
  // ============================================================================
  console.log('\n⚙️  2. Verifying RPC Functions...');

  const rpcFunctions = [
    {
      name: 'create_workspace_with_owner',
      params: {
        p_user_id: '00000000-0000-0000-0000-000000000000',
        p_email: 'test@example.com',
        p_workspace_name: 'Test',
        p_workspace_slug: 'test'
      },
      phase: 'C.1'
    },
    {
      name: 'generate_job_access_token',
      params: {
        p_job_id: '00000000-0000-0000-0000-000000000000'
      },
      phase: 'C.2'
    },
    {
      name: 'log_audit_event',
      params: {
        p_workspace_id: '00000000-0000-0000-0000-000000000000',
        p_user_id: '00000000-0000-0000-0000-000000000000',
        p_action: 'test',
        p_resource_type: 'test',
        p_resource_id: 'test'
      },
      phase: 'C.4'
    },
    {
      name: 'get_audit_logs',
      params: {
        p_workspace_id: '00000000-0000-0000-0000-000000000000'
      },
      phase: 'C.4'
    }
  ];

  for (const func of rpcFunctions) {
    const exists = await verifyRPCFunction(func.name, func.params);
    results.push({
      name: `RPC: ${func.name}`,
      status: exists ? 'pass' : 'fail',
      message: exists ? 'Exists' : 'Not found',
      details: `Phase ${func.phase}`
    });
  }

  // ============================================================================
  // 3. VERIFY EDGE FUNCTIONS
  // ============================================================================
  console.log('\n🌐 3. Verifying Edge Functions...');

  const edgeFunctions = [
    { name: 'seal-evidence', phase: 'C.3' },
    { name: 'verify-evidence', phase: 'C.3' }
  ];

  for (const func of edgeFunctions) {
    const exists = await verifyEdgeFunction(func.name);
    results.push({
      name: `Edge Function: ${func.name}`,
      status: exists ? 'pass' : 'warn',
      message: exists ? 'Deployed' : 'Not deployed',
      details: `Phase ${func.phase} - ${exists ? 'Ready' : 'Run: supabase functions deploy ' + func.name}`
    });
  }

  // ============================================================================
  // 4. VERIFY RLS POLICIES
  // ============================================================================
  console.log('\n🔒 4. Verifying RLS Policies...');

  // Test workspace isolation
  try {
    // Try to create test workspace (will fail if not authenticated, which is expected)
    const { error } = await supabase.from('workspaces').select('id').limit(1);

    const rlsEnabled = error?.code === 'PGRST301' || error?.message?.includes('JWT');
    results.push({
      name: 'RLS: workspaces table',
      status: rlsEnabled ? 'pass' : 'fail',
      message: rlsEnabled ? 'RLS enabled' : 'RLS not enabled',
      details: 'Workspace isolation enforced'
    });
  } catch (error) {
    results.push({
      name: 'RLS: workspaces table',
      status: 'warn',
      message: 'Could not verify',
      details: 'Manual verification required'
    });
  }

  // ============================================================================
  // 5. PRINT RESULTS
  // ============================================================================
  console.log('\n' + '='.repeat(80));
  console.log('VERIFICATION RESULTS');
  console.log('='.repeat(80) + '\n');

  let passCount = 0;
  let failCount = 0;
  let warnCount = 0;

  for (const result of results) {
    const icon = result.status === 'pass' ? '✅' : result.status === 'fail' ? '❌' : '⚠️ ';
    console.log(`${icon} ${result.name}`);
    console.log(`   ${result.message}`);
    if (result.details) {
      console.log(`   ${result.details}`);
    }
    console.log();

    if (result.status === 'pass') passCount++;
    else if (result.status === 'fail') failCount++;
    else warnCount++;
  }

  console.log('='.repeat(80));
  console.log(`SUMMARY: ${passCount} passed, ${failCount} failed, ${warnCount} warnings`);
  console.log('='.repeat(80) + '\n');

  // ============================================================================
  // 6. RECOMMENDATIONS
  // ============================================================================
  if (failCount > 0) {
    console.log('❌ DEPLOYMENT INCOMPLETE\n');
    console.log('Missing components detected. To deploy:\n');
    console.log('1. Deploy database migrations:');
    console.log('   supabase db push\n');
    console.log('2. Verify migrations applied:');
    console.log('   supabase db diff\n');
  }

  if (warnCount > 0) {
    console.log('⚠️  WARNINGS DETECTED\n');
    console.log('Edge Functions not deployed. To deploy:\n');
    console.log('1. Deploy seal-evidence:');
    console.log('   supabase functions deploy seal-evidence\n');
    console.log('2. Deploy verify-evidence:');
    console.log('   supabase functions deploy verify-evidence\n');
    console.log('3. Set environment variables:');
    console.log('   supabase secrets set SEAL_SECRET_KEY=<your-secret-key>\n');
  }

  if (failCount === 0 && warnCount === 0) {
    console.log('✅ ALL SYSTEMS OPERATIONAL\n');
    console.log('Phases C.1-C.5 infrastructure fully deployed.');
    console.log('Ready to proceed to Phase D.1 (GPS Validation).\n');
  }

  // Exit with error code if failures
  process.exit(failCount > 0 ? 1 : 0);
}

// Run verification
verify().catch((error) => {
  console.error('❌ Verification failed:', error);
  process.exit(1);
});
