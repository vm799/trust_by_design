# JobProof Audit Scripts

This directory contains automated audit and monitoring scripts that implement the procedures defined in [JOBPROOF_AUDIT_SPECIFICATION.md](../JOBPROOF_AUDIT_SPECIFICATION.md).

## Overview

These scripts provide automated security auditing, performance monitoring, and continuous production monitoring for the JobProof system.

| Script | Purpose | Spec Section | Frequency |
|--------|---------|--------------|-----------|
| `run-security-audit.ts` | Security & RLS policy verification | 2.2, 2.3, 3.1, 3.2 | Pre-deployment, Weekly |
| `monitor-production.ts` | Continuous production monitoring | 9.1, 9.2 | Daily (cron) |
| `audit-performance.ts` | Performance & database optimization | 6.1, 6.2 | Monthly |
| `verify-deployment.ts` | Deployment verification | N/A | Post-deployment |

---

## Prerequisites

### Required

1. **Node.js 18+** and **npm** installed
2. **tsx** for running TypeScript files directly:
   ```bash
   npm install -g tsx
   # Or use via npx: npx tsx script.ts
   ```

3. **Environment Variables** in `.env`:
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

### Optional (for admin checks)

4. **Service Role Key** for database-level audits:
   ```env
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

   ⚠️  **WARNING**: Service role key bypasses RLS. Never commit this to git or expose in client code.

---

## Scripts

### 1. Security Audit (`run-security-audit.ts`)

Comprehensive security audit covering RLS policies, cryptographic sealing, data integrity, and signature validation.

#### Usage

```bash
# Run security audit
npm run audit:security

# Verbose mode (show all details)
npm run audit:security:verbose

# Or directly
npx tsx scripts/run-security-audit.ts [--verbose]
```

#### What it Checks

**Section 2.2: RLS Policies**
- ✅ RLS enabled on all tables
- ✅ Workspace isolation enforced
- ✅ Anonymous access blocked

**Section 2.3: Cryptographic Sealing**
- ✅ Algorithm distribution (must be 100% RSA-2048)
- ❌ HMAC fallback detection (critical if found)
- ✅ Timestamp integrity (no backdated seals)

**Section 3.1: Data Integrity**
- ✅ GPS coordinate range validation (-90 to 90, -180 to 180)
- ✅ GPS accuracy threshold (< 50m for 95% of photos)

**Section 3.2: Signatures**
- ✅ Signature format validation (PNG base64)
- ✅ Signer name requirement

#### Exit Codes

- `0` - All checks passed
- `1` - **Critical findings** (blocks deployment)
- `2` - **High severity** findings (deployment not recommended)
- `3` - **Medium severity** findings (deployment approved with cautions)

#### Example Output

```
🔍 JobProof Security Audit
Based on: JOBPROOF_AUDIT_SPECIFICATION.md
================================================================================

🔒 Auditing Row-Level Security Policies...

✅ [INFO] RLS Policy Check: RLS enabled on all tables
✅ [INFO] Workspace Isolation: Workspace isolation enforced

🔐 Auditing Cryptographic Sealing...

✅ [INFO] Algorithm Distribution Check: All 42 seals use RSA-2048
✅ [INFO] Timestamp Integrity Check: All seal timestamps are valid

📊 Auditing Data Integrity...

✅ [INFO] GPS Coordinate Validation: All GPS coordinates are within valid ranges
✅ [INFO] GPS Accuracy Check: 2.3% of photos have accuracy > 50m

================================================================================
DEPLOYMENT DECISION:
================================================================================

✅ DEPLOYMENT APPROVED
   All security checks passed.
```

---

### 2. Production Monitoring (`monitor-production.ts`)

Continuous monitoring script for production health metrics and real-time alerts.

#### Usage

```bash
# Run monitoring checks
npm run audit:monitor

# With webhook alerts
npx tsx scripts/monitor-production.ts --alert-webhook=https://your-webhook.com/alerts
```

#### What it Monitors

**Daily Checks**
- 🔐 Seal algorithm distribution (alerts if HMAC detected)
- 📲 Failed sync count (alerts if > 10)
- 🔑 Authentication error rate (alerts if > 5%)
- 💾 Database metrics

**Metrics Dashboard**
- Total seals created today
- Active jobs count
- Sync queue length

#### Alert Levels

| Level | Condition | Action |
|-------|-----------|--------|
| 🔴 **CRITICAL** | HMAC seal created | Immediate investigation required |
| 🟠 **HIGH** | Failed syncs > 10 | Review sync infrastructure |
| 🟡 **MEDIUM** | Auth error rate > 5% | Monitor authentication system |

#### Webhook Integration

Configure webhook URL to receive JSON alerts:

```bash
npm run audit:monitor -- --alert-webhook=https://your-webhook.com/alerts
```

Alert payload:
```json
{
  "level": "CRITICAL",
  "metric": "Seal Algorithm",
  "message": "HMAC fallback detected: 3 of 10 seals",
  "value": {"hmac": 3, "rsa": 7, "total": 10},
  "threshold": {"hmac": 0, "rsa": "100%"},
  "timestamp": "2026-01-22T10:30:00.000Z",
  "project": "https://xxx.supabase.co"
}
```

#### Automated Monitoring (Cron)

Set up daily monitoring with cron:

```bash
# Edit crontab
crontab -e

# Add daily check at 8 AM
0 8 * * * cd /path/to/trust_by_design && npm run audit:monitor >> /var/log/jobproof-monitor.log 2>&1
```

---

### 3. Performance Audit (`audit-performance.ts`)

Database and API performance testing.

#### Usage

```bash
# Run performance audit
npm run audit:performance

# Or directly
npx tsx scripts/audit-performance.ts
```

#### What it Tests

**Query Performance**
- ⚡ Fetch active jobs (threshold: 100ms)
- ⚡ Fetch job with photos (threshold: 150ms)
- ⚡ Fetch sealed jobs (threshold: 150ms)
- ⚡ Count jobs by status (threshold: 50ms)
- ⚡ Recent audit logs (threshold: 100ms)

**Database Analysis**
- 📇 Index verification
- 💾 Table size analysis
- 📊 Row counts

**Load Testing**
- 🔥 Simulated concurrent requests
- 📈 Response time percentiles (p50, p95, p99)

#### Thresholds

| Metric | Target | Warning | Critical |
|--------|--------|---------|----------|
| p50 response time | < 50ms | < 100ms | > 100ms |
| p95 response time | < 100ms | < 200ms | > 200ms |
| p99 response time | < 200ms | < 500ms | > 500ms |
| Query execution | < 100ms | < 200ms | > 200ms |

#### Example Output

```
⚡ JobProof Performance Audit
Based on: JOBPROOF_AUDIT_SPECIFICATION.md Section 6
================================================================================

⚡ Testing Query Performance...

✅ Fetch active jobs: 45ms
✅ Fetch job with photos: 82ms
✅ Fetch sealed jobs: 91ms
✅ Count jobs by status: 23ms
✅ Recent audit logs: 67ms

🔥 Running Simulated Load Test...

Response Time Percentiles:
   p50 (median): 42ms
   p95: 78ms
   p99: 95ms
   average: 51ms

✅ p95 response time is good (< 100ms)

================================================================================
SUMMARY:
  ✅ Passed: 6
  ❌ Failed: 0
  ⚠️  Warnings: 0
```

---

### 4. Deployment Verification (`verify-deployment.ts`)

Verifies that all infrastructure components are deployed correctly.

#### Usage

```bash
# Run deployment verification
npm run verify:deployment

# Or directly
npx tsx scripts/verify-deployment.ts
```

#### What it Verifies

**Database Tables** (Phases C.1-C.5)
- ✅ workspaces, users, jobs, clients, technicians
- ✅ job_access_tokens, evidence_seals, audit_logs

**RPC Functions**
- ✅ create_workspace_with_owner
- ✅ generate_job_access_token
- ✅ log_audit_event, get_audit_logs

**Edge Functions**
- ✅ seal-evidence
- ✅ verify-evidence

**Security**
- ✅ RLS policies enabled

---

## CI/CD Integration

### GitHub Actions

Create `.github/workflows/audit.yml`:

```yaml
name: Security Audit

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 8 * * 1' # Weekly on Monday at 8 AM

jobs:
  security-audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm install

      - name: Run security audit
        env:
          VITE_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SERVICE_ROLE_KEY }}
        run: npm run audit:security

      - name: Block deployment on critical findings
        if: failure()
        run: |
          echo "::error::Critical security findings detected - deployment blocked"
          exit 1
```

### Vercel Pre-Deploy Hook

In `vercel.json`:

```json
{
  "buildCommand": "npm run audit:security && npm run build",
  "framework": "vite"
}
```

---

## Best Practices

### 1. Pre-Deployment Checklist

Run before every production deployment:

```bash
# Full audit suite
npm run audit:all

# Verify deployment readiness
npm run verify:deployment

# Type check
npm run type-check

# Run tests
npm test
npm run test:e2e
```

### 2. Continuous Monitoring

Set up daily monitoring:

```bash
# Create monitoring script
cat > /usr/local/bin/jobproof-monitor.sh << 'EOF'
#!/bin/bash
cd /path/to/trust_by_design
npm run audit:monitor -- --alert-webhook=https://your-webhook.com/alerts
EOF

chmod +x /usr/local/bin/jobproof-monitor.sh

# Add to crontab (daily at 8 AM)
echo "0 8 * * * /usr/local/bin/jobproof-monitor.sh" | crontab -
```

### 3. Performance Baselines

Run performance audit monthly and track trends:

```bash
# Run and save results
npm run audit:performance > audit-reports/performance-$(date +%Y-%m).txt
```

### 4. Security Response

If critical findings detected:

1. **HMAC Seal Detected**
   ```bash
   # Immediately deploy RSA-2048 keys
   supabase secrets set SEAL_PRIVATE_KEY="$(cat seal_private_key_base64.txt)"
   supabase secrets set SEAL_PUBLIC_KEY="$(cat seal_public_key_base64.txt)"
   supabase functions deploy seal-evidence
   ```

2. **RLS Violation**
   ```bash
   # Review and fix RLS policies
   supabase db diff
   # Fix policies in migration
   supabase db push
   ```

3. **High Sync Failure Rate**
   ```sql
   -- Investigate failed syncs
   SELECT job_id, retry_count, last_error
   FROM sync_queue
   WHERE sync_status = 'failed'
   ORDER BY updated_at DESC
   LIMIT 50;
   ```

---

## Troubleshooting

### "Missing Supabase credentials"

Ensure `.env` file exists with:
```env
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJxxx...
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...  # Optional for admin checks
```

### "tsx: command not found"

Install tsx globally:
```bash
npm install -g tsx
```

Or use npx:
```bash
npx tsx scripts/run-security-audit.ts
```

### "Could not query table"

Service role key may be missing or RLS policies preventing access. Ensure `SUPABASE_SERVICE_ROLE_KEY` is set for admin-level checks.

### False Positives

Some checks may show warnings if:
- Tables are empty (no data to audit)
- Custom RPC functions not deployed
- Running against local development environment

---

## Related Documentation

- [JOBPROOF_AUDIT_SPECIFICATION.md](../JOBPROOF_AUDIT_SPECIFICATION.md) - Complete audit framework
- [SECURITY_AUDIT_TRACK3_REPORT.md](../SECURITY_AUDIT_TRACK3_REPORT.md) - Security assessment
- [BACKEND_AUDIT.md](../BACKEND_AUDIT.md) - Backend security analysis
- [DEPLOYMENT_GUIDE.md](../DEPLOYMENT_GUIDE.md) - Production deployment steps

---

## Support

For issues or questions about audit scripts:
1. Check the [troubleshooting section](#troubleshooting) above
2. Review the [JOBPROOF_AUDIT_SPECIFICATION.md](../JOBPROOF_AUDIT_SPECIFICATION.md)
3. Open an issue on GitHub

---

**Last Updated**: 2026-01-22
**Maintained by**: JobProof Security Team
