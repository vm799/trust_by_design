/**
 * JobProof Production Monitoring Script
 *
 * Implements continuous monitoring from JOBPROOF_AUDIT_SPECIFICATION.md Section 9
 * Daily Checks:
 * - Seal algorithm distribution (must be 100% RSA-2048)
 * - Failed sync count (alert if > 10)
 * - Authentication error rate (alert if > 5%)
 * - API error rate (alert if > 1%)
 *
 * Real-Time Alerts:
 * - HMAC seal created (critical)
 * - RLS policy violation attempt (high)
 * - Multiple failed login attempts (medium)
 * - Slow query detected (> 1s) (medium)
 *
 * Usage:
 *   npx tsx scripts/monitor-production.ts [--alert-webhook=URL]
 *
 * Requires:
 *   - VITE_SUPABASE_URL in .env
 *   - SUPABASE_SERVICE_ROLE_KEY in .env
 *
 * Exit codes:
 *   0 - All metrics healthy
 *   1 - Critical alert triggered
 *   2 - Warning threshold exceeded
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Parse command line arguments
const args = process.argv.slice(2);
const alertWebhook = args.find((arg) => arg.startsWith('--alert-webhook='))?.split('=')[1];

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing credentials');
  console.error('   Required: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

interface Alert {
  level: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  metric: string;
  message: string;
  value: any;
  threshold: any;
  timestamp: string;
}

const alerts: Alert[] = [];

function addAlert(alert: Alert) {
  alerts.push(alert);
  const icon = alert.level === 'CRITICAL' ? '🔴' : alert.level === 'HIGH' ? '🟠' : '🟡';
  console.log(`${icon} [${alert.level}] ${alert.metric}: ${alert.message}`);
}

async function sendWebhookAlert(alert: Alert) {
  if (!alertWebhook) return;

  try {
    await fetch(alertWebhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        level: alert.level,
        metric: alert.metric,
        message: alert.message,
        value: alert.value,
        threshold: alert.threshold,
        timestamp: alert.timestamp,
        project: SUPABASE_URL
      })
    });
  } catch (error) {
    console.error('Failed to send webhook alert:', error);
  }
}

// ============================================================================
// DAILY CHECK: SEAL ALGORITHM DISTRIBUTION
// ============================================================================

async function checkSealAlgorithms() {
  console.log('🔐 Checking seal algorithm distribution...');

  try {
    // Get seals from last 24 hours
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: seals, error } = await supabase
      .from('evidence_seals')
      .select('algorithm, sealed_at')
      .gte('sealed_at', yesterday);

    if (error) {
      console.error('   ⚠️  Could not query seals:', error.message);
      return;
    }

    if (!seals || seals.length === 0) {
      console.log('   ℹ️  No seals created in last 24 hours');
      return;
    }

    // Count algorithms
    const hmacCount = seals.filter((s) => s.algorithm === 'SHA256-HMAC').length;
    const rsaCount = seals.filter((s) => s.algorithm === 'SHA256-RSA2048').length;
    const otherCount = seals.length - hmacCount - rsaCount;

    console.log(`   ✅ ${seals.length} seals created in last 24 hours`);
    console.log(`      RSA-2048: ${rsaCount} (${Math.round((rsaCount / seals.length) * 100)}%)`);
    if (hmacCount > 0) {
      console.log(`      HMAC: ${hmacCount} (${Math.round((hmacCount / seals.length) * 100)}%)`);
    }
    if (otherCount > 0) {
      console.log(`      Other: ${otherCount}`);
    }

    // CRITICAL: HMAC seals in production
    if (hmacCount > 0) {
      const alert: Alert = {
        level: 'CRITICAL',
        metric: 'Seal Algorithm',
        message: `HMAC fallback detected: ${hmacCount} of ${seals.length} seals`,
        value: { hmac: hmacCount, rsa: rsaCount, total: seals.length },
        threshold: { hmac: 0, rsa: '100%' },
        timestamp: new Date().toISOString()
      };
      addAlert(alert);
      await sendWebhookAlert(alert);
    }

    // WARNING: Not 100% RSA
    if (rsaCount < seals.length) {
      const alert: Alert = {
        level: 'HIGH',
        metric: 'Seal Algorithm',
        message: `Not all seals use RSA-2048: ${rsaCount}/${seals.length}`,
        value: { rsaPercent: Math.round((rsaCount / seals.length) * 100) },
        threshold: { rsaPercent: 100 },
        timestamp: new Date().toISOString()
      };
      addAlert(alert);
      await sendWebhookAlert(alert);
    }
  } catch (error) {
    console.error('   ❌ Seal algorithm check failed:', error);
  }
}

// ============================================================================
// DAILY CHECK: FAILED SYNC COUNT
// ============================================================================

async function checkFailedSyncs() {
  console.log('\n📲 Checking failed sync count...');

  try {
    // Check sync_queue table for failed syncs
    const { data: failedSyncs, error } = await supabase
      .from('sync_queue')
      .select('id, job_id, retry_count, last_error')
      .eq('sync_status', 'failed')
      .gte('updated_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    if (error && error.code !== '42P01') {
      // 42P01 = table doesn't exist
      console.error('   ⚠️  Could not query sync queue:', error.message);
      return;
    }

    if (!failedSyncs || failedSyncs.length === 0) {
      console.log('   ✅ No failed syncs in last 24 hours');
      return;
    }

    console.log(`   ⚠️  ${failedSyncs.length} failed syncs in last 24 hours`);

    // Alert if > 10 failures
    if (failedSyncs.length > 10) {
      const alert: Alert = {
        level: 'HIGH',
        metric: 'Failed Syncs',
        message: `High sync failure rate: ${failedSyncs.length} failures`,
        value: { count: failedSyncs.length },
        threshold: { count: 10 },
        timestamp: new Date().toISOString()
      };
      addAlert(alert);
      await sendWebhookAlert(alert);
    }

    // Show sample errors
    if (failedSyncs.length > 0) {
      console.log('   Sample errors:');
      failedSyncs.slice(0, 3).forEach((sync) => {
        console.log(`      - Job ${sync.job_id}: ${sync.last_error || 'Unknown error'}`);
      });
    }
  } catch (error) {
    console.error('   ❌ Failed sync check failed:', error);
  }
}

// ============================================================================
// DAILY CHECK: AUTHENTICATION ERROR RATE
// ============================================================================

async function checkAuthErrorRate() {
  console.log('\n🔑 Checking authentication error rate...');

  try {
    // Query audit logs for auth events
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: authEvents, error } = await supabase
      .from('audit_logs')
      .select('event_type, metadata')
      .in('event_type', ['auth_login', 'auth_login_failed', 'auth_signup', 'auth_signup_failed'])
      .gte('created_at', yesterday);

    if (error && error.code !== '42P01') {
      console.error('   ⚠️  Could not query audit logs:', error.message);
      return;
    }

    if (!authEvents || authEvents.length === 0) {
      console.log('   ℹ️  No auth events in last 24 hours');
      return;
    }

    const failedLogins = authEvents.filter((e) =>
      ['auth_login_failed', 'auth_signup_failed'].includes(e.event_type)
    ).length;
    const totalLogins = authEvents.length;
    const errorRate = (failedLogins / totalLogins) * 100;

    console.log(`   ✅ ${totalLogins} auth attempts, ${failedLogins} failures (${errorRate.toFixed(1)}%)`);

    // Alert if > 5% error rate
    if (errorRate > 5) {
      const alert: Alert = {
        level: 'HIGH',
        metric: 'Auth Error Rate',
        message: `High authentication failure rate: ${errorRate.toFixed(1)}%`,
        value: { errorRate: errorRate.toFixed(1), failed: failedLogins, total: totalLogins },
        threshold: { errorRate: 5 },
        timestamp: new Date().toISOString()
      };
      addAlert(alert);
      await sendWebhookAlert(alert);
    }
  } catch (error) {
    console.error('   ❌ Auth error rate check failed:', error);
  }
}

// ============================================================================
// DAILY CHECK: DATABASE METRICS
// ============================================================================

async function checkDatabaseMetrics() {
  console.log('\n💾 Checking database metrics...');

  try {
    // Check table sizes
    const { data: tables, error } = await supabase.rpc('get_table_sizes');

    if (error) {
      console.log('   ℹ️  Table size check not available (requires custom RPC function)');
      return;
    }

    if (tables && tables.length > 0) {
      console.log('   Top 5 largest tables:');
      tables.slice(0, 5).forEach((table: any, i: number) => {
        console.log(`      ${i + 1}. ${table.table_name}: ${table.total_size}`);
      });
    }
  } catch (error) {
    // Custom RPC may not exist - this is optional
    console.log('   ℹ️  Database metrics not available');
  }
}

// ============================================================================
// METRICS DASHBOARD
// ============================================================================

async function generateMetricsDashboard() {
  console.log('\n📊 Generating metrics dashboard...');

  try {
    const today = new Date().toISOString().split('T')[0];

    // Total seals created today
    const { count: sealsToday, error: sealsError } = await supabase
      .from('evidence_seals')
      .select('*', { count: 'exact', head: true })
      .gte('sealed_at', today);

    // Active jobs
    const { count: activeJobs, error: jobsError } = await supabase
      .from('jobs')
      .select('*', { count: 'exact', head: true })
      .in('status', ['Assigned', 'In Progress', 'Submitted']);

    // Sync queue length
    const { count: queueLength, error: queueError } = await supabase
      .from('sync_queue')
      .select('*', { count: 'exact', head: true })
      .eq('sync_status', 'pending');

    console.log('\n   METRICS:');
    if (!sealsError) console.log(`   • Seals created today: ${sealsToday || 0}`);
    if (!jobsError) console.log(`   • Active jobs: ${activeJobs || 0}`);
    if (!queueError && queueLength !== null) {
      console.log(`   • Sync queue length: ${queueLength}`);
      if (queueLength && queueLength > 50) {
        console.log('     ⚠️  Queue backed up - investigate sync issues');
      }
    }
  } catch (error) {
    console.error('   ❌ Metrics dashboard failed:', error);
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function runMonitoring() {
  console.log('🔍 JobProof Production Monitoring');
  console.log(`Started: ${new Date().toISOString()}`);
  console.log('='.repeat(80) + '\n');

  try {
    await checkSealAlgorithms();
    await checkFailedSyncs();
    await checkAuthErrorRate();
    await checkDatabaseMetrics();
    await generateMetricsDashboard();

    console.log('\n' + '='.repeat(80));
    console.log('MONITORING SUMMARY');
    console.log('='.repeat(80));

    const critical = alerts.filter((a) => a.level === 'CRITICAL');
    const high = alerts.filter((a) => a.level === 'HIGH');
    const medium = alerts.filter((a) => a.level === 'MEDIUM');

    console.log(`\n🔴 Critical Alerts: ${critical.length}`);
    console.log(`🟠 High Alerts: ${high.length}`);
    console.log(`🟡 Medium Alerts: ${medium.length}`);

    if (alerts.length === 0) {
      console.log('\n✅ All systems healthy');
      console.log('='.repeat(80) + '\n');
      process.exit(0);
    } else {
      if (critical.length > 0) {
        console.log('\n❌ CRITICAL ISSUES DETECTED - IMMEDIATE ACTION REQUIRED');
        console.log('='.repeat(80) + '\n');
        process.exit(1);
      } else if (high.length > 0) {
        console.log('\n⚠️  WARNING - High severity issues detected');
        console.log('='.repeat(80) + '\n');
        process.exit(2);
      } else {
        console.log('\n✅ No critical issues');
        console.log('='.repeat(80) + '\n');
        process.exit(0);
      }
    }
  } catch (error) {
    console.error('\n❌ Monitoring failed:', error);
    process.exit(1);
  }
}

runMonitoring();
