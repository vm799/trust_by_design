/**
 * JobProof Security Audit Script
 *
 * Implements automated security audit procedures from JOBPROOF_AUDIT_SPECIFICATION.md
 * Sections covered:
 * - 2.2: Authorization Audit (RLS Policies)
 * - 2.3: Cryptographic Sealing Audit
 * - 3.1: Evidence Bundle Verification
 * - 3.2: GPS Accuracy Validation
 *
 * Usage:
 *   npx tsx scripts/run-security-audit.ts [--verbose]
 *
 * Requires:
 *   - VITE_SUPABASE_URL in .env
 *   - VITE_SUPABASE_ANON_KEY in .env
 *   - Supabase service role key for admin checks
 *
 * Exit codes:
 *   0 - All checks passed
 *   1 - Critical findings detected
 *   2 - High severity findings detected
 *   3 - Medium severity findings detected
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const verbose = process.argv.includes('--verbose');

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing Supabase credentials in .env');
  console.error('   Required: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const adminClient = SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
  : null;

type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

interface AuditFinding {
  id: string;
  section: string;
  title: string;
  severity: Severity;
  status: 'PASS' | 'FAIL' | 'WARNING' | 'INFO';
  message: string;
  details?: string;
  recommendation?: string;
  evidence?: any;
}

const findings: AuditFinding[] = [];
let checkCount = 0;

function addFinding(finding: AuditFinding) {
  findings.push(finding);
  checkCount++;

  if (verbose) {
    const icon = finding.status === 'PASS' ? '✅' : finding.status === 'FAIL' ? '❌' : '⚠️';
    console.log(`${icon} [${finding.severity}] ${finding.title}`);
    if (finding.details) {
      console.log(`   ${finding.details}`);
    }
  }
}

// ============================================================================
// SECTION 2.2: RLS POLICY VERIFICATION
// ============================================================================

async function auditRLSPolicies() {
  console.log('\n🔒 Auditing Row-Level Security Policies...\n');

  // Check 2.2.1: Verify RLS is enabled on all tables
  if (adminClient) {
    const { data: tables, error } = await adminClient.rpc('get_tables_without_rls', {});

    if (error) {
      addFinding({
        id: 'RLS-001',
        section: '2.2.1',
        title: 'RLS Policy Check',
        severity: 'MEDIUM',
        status: 'WARNING',
        message: 'Could not verify RLS policies',
        details: error.message,
        recommendation: 'Verify RLS manually in Supabase Dashboard'
      });
    } else if (tables && tables.length > 0) {
      addFinding({
        id: 'RLS-001',
        section: '2.2.1',
        title: 'RLS Policy Check',
        severity: 'CRITICAL',
        status: 'FAIL',
        message: `${tables.length} tables do not have RLS enabled`,
        evidence: tables,
        recommendation: 'Enable RLS on all tables immediately'
      });
    } else {
      addFinding({
        id: 'RLS-001',
        section: '2.2.1',
        title: 'RLS Policy Check',
        severity: 'INFO',
        status: 'PASS',
        message: 'RLS enabled on all tables'
      });
    }
  }

  // Check 2.2.2: Test workspace isolation
  try {
    // Attempt to access data without authentication
    const { data, error } = await supabase
      .from('jobs')
      .select('id')
      .limit(1);

    // Should fail with RLS error
    if (error && (error.code === 'PGRST301' || error.message?.includes('JWT'))) {
      addFinding({
        id: 'RLS-002',
        section: '2.2.1',
        title: 'Workspace Isolation',
        severity: 'INFO',
        status: 'PASS',
        message: 'Workspace isolation enforced - anonymous access blocked'
      });
    } else if (data && data.length > 0) {
      addFinding({
        id: 'RLS-002',
        section: '2.2.1',
        title: 'Workspace Isolation',
        severity: 'CRITICAL',
        status: 'FAIL',
        message: 'Anonymous users can access job data',
        evidence: { rowCount: data.length },
        recommendation: 'Review and fix RLS policies on jobs table immediately'
      });
    } else {
      addFinding({
        id: 'RLS-002',
        section: '2.2.1',
        title: 'Workspace Isolation',
        severity: 'INFO',
        status: 'PASS',
        message: 'Workspace isolation enforced'
      });
    }
  } catch (error) {
    addFinding({
      id: 'RLS-002',
      section: '2.2.1',
      title: 'Workspace Isolation',
      severity: 'MEDIUM',
      status: 'WARNING',
      message: 'Could not verify workspace isolation',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// ============================================================================
// SECTION 2.3: CRYPTOGRAPHIC SEALING AUDIT
// ============================================================================

async function auditCryptographicSealing() {
  console.log('\n🔐 Auditing Cryptographic Sealing...\n');

  if (!adminClient) {
    addFinding({
      id: 'SEAL-000',
      section: '2.3',
      title: 'Cryptographic Audit Prerequisites',
      severity: 'HIGH',
      status: 'WARNING',
      message: 'Service role key not provided - skipping seal audit',
      recommendation: 'Set SUPABASE_SERVICE_ROLE_KEY to run complete audit'
    });
    return;
  }

  // Check 2.3.1: Algorithm Distribution Check
  try {
    const { data: seals, error } = await adminClient
      .from('evidence_seals')
      .select('algorithm, sealed_at')
      .gte('sealed_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .order('sealed_at', { ascending: false });

    if (error) {
      addFinding({
        id: 'SEAL-001',
        section: '2.3.1',
        title: 'Algorithm Distribution Check',
        severity: 'HIGH',
        status: 'WARNING',
        message: 'Could not query evidence seals',
        details: error.message
      });
    } else if (!seals || seals.length === 0) {
      addFinding({
        id: 'SEAL-001',
        section: '2.3.1',
        title: 'Algorithm Distribution Check',
        severity: 'INFO',
        status: 'INFO',
        message: 'No seals found in last 30 days',
        details: 'No production seals to audit yet'
      });
    } else {
      // Count algorithm usage
      const algorithmCounts = seals.reduce((acc, seal) => {
        acc[seal.algorithm] = (acc[seal.algorithm] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const hmacCount = algorithmCounts['SHA256-HMAC'] || 0;
      const rsaCount = algorithmCounts['SHA256-RSA2048'] || 0;
      const totalCount = seals.length;

      if (hmacCount > 0) {
        addFinding({
          id: 'SEAL-001',
          section: '2.3.1',
          title: 'Algorithm Distribution Check',
          severity: 'CRITICAL',
          status: 'FAIL',
          message: `HMAC fallback detected: ${hmacCount} of ${totalCount} seals (${Math.round((hmacCount / totalCount) * 100)}%)`,
          evidence: algorithmCounts,
          recommendation: 'Deploy RSA-2048 keys to production immediately. HMAC is not production-grade.'
        });
      } else if (rsaCount === totalCount) {
        addFinding({
          id: 'SEAL-001',
          section: '2.3.1',
          title: 'Algorithm Distribution Check',
          severity: 'INFO',
          status: 'PASS',
          message: `All ${totalCount} seals use RSA-2048`,
          details: '100% production-grade cryptography'
        });
      } else {
        addFinding({
          id: 'SEAL-001',
          section: '2.3.1',
          title: 'Algorithm Distribution Check',
          severity: 'HIGH',
          status: 'WARNING',
          message: `Unexpected algorithms detected`,
          evidence: algorithmCounts,
          recommendation: 'Review seal algorithm distribution'
        });
      }
    }
  } catch (error) {
    addFinding({
      id: 'SEAL-001',
      section: '2.3.1',
      title: 'Algorithm Distribution Check',
      severity: 'HIGH',
      status: 'WARNING',
      message: 'Seal audit failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }

  // Check 2.3.2: Timestamp Integrity
  try {
    const { data: backdatedSeals, error } = await adminClient
      .from('jobs')
      .select('id, created_at, sealed_at')
      .not('sealed_at', 'is', null)
      .filter('sealed_at', 'lt', 'created_at');

    if (error) {
      addFinding({
        id: 'SEAL-002',
        section: '2.3.2',
        title: 'Timestamp Integrity Check',
        severity: 'MEDIUM',
        status: 'WARNING',
        message: 'Could not verify seal timestamps',
        details: error.message
      });
    } else if (backdatedSeals && backdatedSeals.length > 0) {
      addFinding({
        id: 'SEAL-002',
        section: '2.3.2',
        title: 'Timestamp Integrity Check',
        severity: 'CRITICAL',
        status: 'FAIL',
        message: `${backdatedSeals.length} seals have timestamps before job creation`,
        evidence: backdatedSeals,
        recommendation: 'Investigate backdated seals - possible tampering'
      });
    } else {
      addFinding({
        id: 'SEAL-002',
        section: '2.3.2',
        title: 'Timestamp Integrity Check',
        severity: 'INFO',
        status: 'PASS',
        message: 'All seal timestamps are valid'
      });
    }
  } catch (error) {
    addFinding({
      id: 'SEAL-002',
      section: '2.3.2',
      title: 'Timestamp Integrity Check',
      severity: 'MEDIUM',
      status: 'WARNING',
      message: 'Timestamp check failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// ============================================================================
// SECTION 3.1: DATA INTEGRITY AUDIT
// ============================================================================

async function auditDataIntegrity() {
  console.log('\n📊 Auditing Data Integrity...\n');

  if (!adminClient) {
    addFinding({
      id: 'DATA-000',
      section: '3.1',
      title: 'Data Integrity Prerequisites',
      severity: 'MEDIUM',
      status: 'WARNING',
      message: 'Service role key not provided - skipping data integrity checks',
      recommendation: 'Set SUPABASE_SERVICE_ROLE_KEY for complete audit'
    });
    return;
  }

  // Check 3.1.2: GPS Coordinate Range Validation
  try {
    const { data: invalidCoords, error } = await adminClient
      .from('photos')
      .select('id, metadata')
      .not('metadata', 'is', null);

    if (error) {
      addFinding({
        id: 'DATA-001',
        section: '3.1.2',
        title: 'GPS Coordinate Validation',
        severity: 'MEDIUM',
        status: 'WARNING',
        message: 'Could not validate GPS coordinates',
        details: error.message
      });
    } else if (invalidCoords) {
      const invalid = invalidCoords.filter((photo: any) => {
        const lat = photo.metadata?.gps_lat;
        const lng = photo.metadata?.gps_lng;
        if (lat === undefined || lng === undefined) return false;
        return lat < -90 || lat > 90 || lng < -180 || lng > 180;
      });

      if (invalid.length > 0) {
        addFinding({
          id: 'DATA-001',
          section: '3.1.2',
          title: 'GPS Coordinate Validation',
          severity: 'HIGH',
          status: 'FAIL',
          message: `${invalid.length} photos have invalid GPS coordinates`,
          evidence: invalid.map((p: any) => ({
            id: p.id,
            lat: p.metadata?.gps_lat,
            lng: p.metadata?.gps_lng
          })),
          recommendation: 'Review photo capture logic and validate coordinates'
        });
      } else {
        addFinding({
          id: 'DATA-001',
          section: '3.1.2',
          title: 'GPS Coordinate Validation',
          severity: 'INFO',
          status: 'PASS',
          message: 'All GPS coordinates are within valid ranges'
        });
      }
    }
  } catch (error) {
    addFinding({
      id: 'DATA-001',
      section: '3.1.2',
      title: 'GPS Coordinate Validation',
      severity: 'MEDIUM',
      status: 'WARNING',
      message: 'GPS validation failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }

  // Check 3.1.3: GPS Accuracy Threshold
  try {
    const { data: photos, error } = await adminClient
      .from('photos')
      .select('id, gps_accuracy')
      .not('gps_accuracy', 'is', null);

    if (error) {
      addFinding({
        id: 'DATA-002',
        section: '3.1.2',
        title: 'GPS Accuracy Check',
        severity: 'LOW',
        status: 'WARNING',
        message: 'Could not check GPS accuracy',
        details: error.message
      });
    } else if (photos && photos.length > 0) {
      const lowAccuracy = photos.filter((p: any) => p.gps_accuracy > 50);
      const percentage = (lowAccuracy.length / photos.length) * 100;

      if (percentage > 5) {
        addFinding({
          id: 'DATA-002',
          section: '3.1.2',
          title: 'GPS Accuracy Check',
          severity: 'MEDIUM',
          status: 'WARNING',
          message: `${percentage.toFixed(1)}% of photos have accuracy > 50m (expected < 5%)`,
          evidence: { total: photos.length, lowAccuracy: lowAccuracy.length },
          recommendation: 'Review GPS capture settings and device permissions'
        });
      } else {
        addFinding({
          id: 'DATA-002',
          section: '3.1.2',
          title: 'GPS Accuracy Check',
          severity: 'INFO',
          status: 'PASS',
          message: `${percentage.toFixed(1)}% of photos have accuracy > 50m (within threshold)`
        });
      }
    } else {
      addFinding({
        id: 'DATA-002',
        section: '3.1.2',
        title: 'GPS Accuracy Check',
        severity: 'INFO',
        status: 'INFO',
        message: 'No photos with GPS data to audit'
      });
    }
  } catch (error) {
    addFinding({
      id: 'DATA-002',
      section: '3.1.2',
      title: 'GPS Accuracy Check',
      severity: 'LOW',
      status: 'WARNING',
      message: 'Accuracy check failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// ============================================================================
// SECTION 3.2: SIGNATURE VALIDATION
// ============================================================================

async function auditSignatures() {
  console.log('\n✍️  Auditing Signatures...\n');

  if (!adminClient) {
    return;
  }

  // Check 3.2.1: Non-Empty Signature Validation
  try {
    const { data: signatures, error } = await adminClient
      .from('signatures')
      .select('id, signature, signer_name')
      .limit(1000);

    if (error) {
      addFinding({
        id: 'SIG-001',
        section: '3.2.1',
        title: 'Signature Format Validation',
        severity: 'MEDIUM',
        status: 'WARNING',
        message: 'Could not validate signatures',
        details: error.message
      });
    } else if (signatures && signatures.length > 0) {
      const invalid = signatures.filter((s: any) => {
        // Check format: data:image/png;base64,...
        if (!s.signature || !s.signature.startsWith('data:image/png;base64,')) {
          return true;
        }
        // Check signer name
        if (!s.signer_name || s.signer_name.trim().length === 0) {
          return true;
        }
        return false;
      });

      if (invalid.length > 0) {
        addFinding({
          id: 'SIG-001',
          section: '3.2.1',
          title: 'Signature Format Validation',
          severity: 'HIGH',
          status: 'FAIL',
          message: `${invalid.length} of ${signatures.length} signatures are invalid`,
          evidence: invalid.map((s: any) => s.id),
          recommendation: 'Review signature capture and validation logic'
        });
      } else {
        addFinding({
          id: 'SIG-001',
          section: '3.2.1',
          title: 'Signature Format Validation',
          severity: 'INFO',
          status: 'PASS',
          message: `All ${signatures.length} signatures are valid`
        });
      }
    } else {
      addFinding({
        id: 'SIG-001',
        section: '3.2.1',
        title: 'Signature Format Validation',
        severity: 'INFO',
        status: 'INFO',
        message: 'No signatures to audit'
      });
    }
  } catch (error) {
    addFinding({
      id: 'SIG-001',
      section: '3.2.1',
      title: 'Signature Format Validation',
      severity: 'MEDIUM',
      status: 'WARNING',
      message: 'Signature validation failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// ============================================================================
// REPORT GENERATION
// ============================================================================

function generateReport() {
  console.log('\n' + '='.repeat(80));
  console.log('JOBPROOF SECURITY AUDIT REPORT');
  console.log('='.repeat(80));
  console.log(`\nDate: ${new Date().toISOString()}`);
  console.log(`Checks Performed: ${checkCount}`);
  console.log(`Project: ${SUPABASE_URL}\n`);

  // Count findings by severity and status
  const critical = findings.filter((f) => f.severity === 'CRITICAL' && f.status === 'FAIL');
  const high = findings.filter((f) => f.severity === 'HIGH' && (f.status === 'FAIL' || f.status === 'WARNING'));
  const medium = findings.filter((f) => f.severity === 'MEDIUM' && (f.status === 'FAIL' || f.status === 'WARNING'));
  const pass = findings.filter((f) => f.status === 'PASS');

  console.log('SUMMARY:');
  console.log(`  ✅ Passed: ${pass.length}`);
  console.log(`  🔴 Critical: ${critical.length}`);
  console.log(`  🟠 High: ${high.length}`);
  console.log(`  🟡 Medium: ${medium.length}\n`);

  // Critical Findings
  if (critical.length > 0) {
    console.log('🔴 CRITICAL FINDINGS (Must Fix Before Production):');
    console.log('='.repeat(80));
    critical.forEach((f) => {
      console.log(`\n[${f.id}] ${f.title}`);
      console.log(`Section: ${f.section} | Severity: ${f.severity}`);
      console.log(`Finding: ${f.message}`);
      if (f.details) console.log(`Details: ${f.details}`);
      if (f.recommendation) console.log(`Recommendation: ${f.recommendation}`);
      if (f.evidence && verbose) {
        console.log(`Evidence: ${JSON.stringify(f.evidence, null, 2)}`);
      }
    });
    console.log('\n' + '='.repeat(80));
  }

  // High Findings
  if (high.length > 0) {
    console.log('\n🟠 HIGH SEVERITY FINDINGS (Should Fix Before Production):');
    console.log('='.repeat(80));
    high.forEach((f) => {
      console.log(`\n[${f.id}] ${f.title}`);
      console.log(`Section: ${f.section} | Severity: ${f.severity}`);
      console.log(`Finding: ${f.message}`);
      if (f.recommendation) console.log(`Recommendation: ${f.recommendation}`);
    });
    console.log('\n' + '='.repeat(80));
  }

  // Medium Findings
  if (medium.length > 0 && verbose) {
    console.log('\n🟡 MEDIUM SEVERITY FINDINGS:');
    console.log('='.repeat(80));
    medium.forEach((f) => {
      console.log(`\n[${f.id}] ${f.title}: ${f.message}`);
      if (f.recommendation) console.log(`  → ${f.recommendation}`);
    });
    console.log('\n' + '='.repeat(80));
  }

  // Deployment Decision
  console.log('\n' + '='.repeat(80));
  console.log('DEPLOYMENT DECISION:');
  console.log('='.repeat(80) + '\n');

  if (critical.length > 0) {
    console.log('❌ DEPLOYMENT BLOCKED');
    console.log(`   ${critical.length} critical security issues must be resolved.\n`);
    return 1;
  } else if (high.length > 0) {
    console.log('⚠️  DEPLOYMENT NOT RECOMMENDED');
    console.log(`   ${high.length} high severity issues should be resolved.\n`);
    return 2;
  } else if (medium.length > 0) {
    console.log('✅ DEPLOYMENT APPROVED (with cautions)');
    console.log(`   ${medium.length} medium severity issues noted.\n`);
    return 3;
  } else {
    console.log('✅ DEPLOYMENT APPROVED');
    console.log('   All security checks passed.\n');
    return 0;
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function runAudit() {
  console.log('🔍 JobProof Security Audit');
  console.log('Based on: JOBPROOF_AUDIT_SPECIFICATION.md');
  console.log('='.repeat(80));

  try {
    await auditRLSPolicies();
    await auditCryptographicSealing();
    await auditDataIntegrity();
    await auditSignatures();

    const exitCode = generateReport();
    process.exit(exitCode);
  } catch (error) {
    console.error('\n❌ Audit failed with error:', error);
    process.exit(1);
  }
}

runAudit();
