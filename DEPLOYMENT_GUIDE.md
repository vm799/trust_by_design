# DEPLOYMENT GUIDE - EMERGENCY FIX
**Trust by Design - JobProof**
**CRITICAL: Application Non-Functional Until Supabase Configured**
**Last Updated:** 2026-01-21

---

## 🚨 EMERGENCY STATUS - READ THIS FIRST

### Current State: NON-FUNCTIONAL
**Root Cause:** No `.env` file with Supabase credentials configured

**Impact:**
- ❌ Magic Links DON'T WORK for all personas
- ❌ Authentication completely broken
- ❌ No database persistence (mock mode only)
- ❌ Photo capture and sealing unavailable
- ❌ Core MLP flow CANNOT BE TESTED

### Immediate Action Required (15 minutes)

**DO THIS NOW to restore functionality:**

1. **Configure Supabase Credentials** (5 min)
   - A `.env` file has been created at `/home/user/trust_by_design/.env`
   - You MUST replace placeholders with real credentials:
     - Get credentials from: https://supabase.com/dashboard → Your Project → Settings → API
     - Replace `YOUR_PROJECT_REF` and `YOUR_ANON_KEY_HERE` in the `.env` file
     - Restart dev server: `npm run dev`

2. **Configure Auth Redirect URLs** (3 min)
   - Go to: Supabase Dashboard → Authentication → URL Configuration
   - Add redirect URL: `http://localhost:5173` (and production URLs if deploying)
   - **WHY:** Magic links will fail with 400 error without this

3. **Run Database Migrations** (5 min)
   ```bash
   supabase link --project-ref YOUR_PROJECT_REF
   supabase db push
   ```
   - **WHY:** Creates all required tables, RLS policies, and triggers

4. **Verify It Works** (2 min)
   - Open `http://localhost:5173` in browser
   - Check console: Should say "Supabase client initialized"
   - Try signing up: Should receive confirmation email
   - Magic links should work

### What Was Fixed

✅ **Created `.env` file** with template and instructions
✅ **Identified root causes** of magic link failure
✅ **Added comprehensive deployment checklist** (see below)
⚠️ **You must complete setup steps above** to restore functionality

---

## QUICK START: Get Running in 15 Minutes

### Prerequisites Check
- [ ] Supabase account created at https://supabase.com
- [ ] Supabase CLI installed: `npm install -g supabase`
- [ ] OpenSSL installed (for key generation)

### Step-by-Step Setup

#### 1. Create Supabase Project (2 min)
- Go to https://supabase.com/dashboard
- Click "New Project"
- Name: `jobproof-production`
- Database Password: Save this securely!
- Region: Choose closest to users
- Click "Create new project" (wait ~2 min)

#### 2. Configure .env File (3 min)
- Open `/home/user/trust_by_design/.env`
- Replace these values with credentials from Supabase Dashboard → Settings → API:
  ```env
  VITE_SUPABASE_URL=https://YOUR_ACTUAL_PROJECT_REF.supabase.co
  VITE_SUPABASE_ANON_KEY=eyJhbGc... (your actual anon key)
  ```
- Save and close file

#### 3. Configure Auth Redirect URLs (2 min)
- Supabase Dashboard → Authentication → URL Configuration
- Add these URLs (one per line):
  ```
  http://localhost:5173
  http://localhost:5173/
  http://localhost:5173/#/admin
  http://localhost:5173/#/contractor
  ```
- Click "Save"

#### 4. Run Migrations (5 min)
```bash
cd /home/user/trust_by_design
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```
- When prompted, enter database password from Step 1

#### 5. Restart Dev Server (1 min)
```bash
npm run dev
```
- Open http://localhost:5173
- Check browser console for "Supabase client initialized" ✅

#### 6. Test Full Flow (2 min)
1. Sign up: manager@test.com / password123 / "Test Company"
2. Create client: "Acme Corp"
3. Create technician: "John Doe"
4. Create job: Assign to Acme/John
5. Copy magic link from success modal
6. Open magic link in incognito browser
7. ✅ Should see Technician Portal (NOT login prompt)

**If Step 7 fails:** Check Section "Troubleshooting Magic Links" below.

---

## Troubleshooting Magic Links

### Issue: Magic link returns 400 error
**Symptom:** After clicking magic link in email, browser shows 400 Bad Request

**Solution:**
1. Go to Supabase Dashboard → Authentication → URL Configuration
2. Verify your app URL is in "Redirect URLs" list
3. Wait 30 seconds for changes to propagate
4. Generate new magic link and test again

### Issue: Magic link shows login page instead of job
**Symptom:** Clicking magic link redirects to `/auth` login page

**Root Causes:**
1. Token expired (default: 7 days) - Generate new magic link
2. Token not in database - Check RPC function `generate_job_access_token` logs
3. RLS policy blocking token access - Run SQL:
   ```sql
   SELECT * FROM job_access_tokens WHERE token = 'YOUR_TOKEN_HERE';
   ```
   If empty, token wasn't created. Check Supabase logs.

### Issue: "Invalid or expired link" error
**Symptom:** TechnicianPortal shows error banner

**Solution:**
1. Check token expiration:
   ```sql
   SELECT token, expires_at, revoked_at
   FROM job_access_tokens
   WHERE token = 'YOUR_TOKEN_HERE';
   ```
2. If `expires_at < NOW()`, generate new magic link
3. If `revoked_at` is not NULL, token was revoked - check audit logs

### Issue: "Supabase not configured" in console
**Symptom:** Browser console shows "Running in offline-only mode"

**Solution:**
1. Check `.env` file exists: `ls -la .env`
2. Check values are filled (not `YOUR_...` placeholders)
3. Restart dev server: `npm run dev`
4. Clear browser cache and hard refresh (Ctrl+Shift+R)

---

## OVERVIEW (Original Guide Follows)

This guide walks through deploying the Trust by Design backend infrastructure to Supabase. After completing these steps, all Phases C.1-C.5 functionality will be operational.

**Prerequisites:**
- Supabase CLI installed (`npm install -g supabase`)
- Supabase project created (https://app.supabase.com)
- Git repository cloned locally

**Estimated Time:** 30 minutes

---

## STEP 1: ENVIRONMENT SETUP

### 1.1 Install Supabase CLI

```bash
npm install -g supabase
```

### 1.2 Login to Supabase

```bash
supabase login
```

This will open your browser for authentication.

### 1.3 Link to Your Project

```bash
supabase link --project-ref <your-project-ref>
```

Find your project ref in Supabase Dashboard → Project Settings → General.

### 1.4 Configure Environment Variables

Create `.env` file in project root:

```bash
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
```

Find these values in Supabase Dashboard → Project Settings → API.

---

## STEP 2: DEPLOY DATABASE MIGRATIONS

### 2.1 Review Migrations

Three migrations will be deployed:

```bash
supabase/migrations/001_auth_and_workspaces.sql  # Phase C.1-C.2
supabase/migrations/002_evidence_sealing.sql     # Phase C.3
supabase/migrations/003_audit_trail.sql          # Phase C.4
```

### 2.2 Push Migrations to Supabase

```bash
supabase db push
```

This will:
- Create all tables (workspaces, users, jobs, clients, technicians, job_access_tokens, evidence_seals, audit_logs)
- Enable Row Level Security (RLS)
- Create RLS policies
- Create database triggers
- Create RPC functions

### 2.3 Verify Migrations Applied

```bash
supabase db diff
```

Should show: `No schema changes detected.`

---

## STEP 3: DEPLOY EDGE FUNCTIONS

### 3.1 Deploy seal-evidence Function

```bash
supabase functions deploy seal-evidence
```

This deploys the cryptographic sealing function (Phase C.3).

### 3.2 Deploy verify-evidence Function

```bash
supabase functions deploy verify-evidence
```

This deploys the evidence verification function (Phase C.3).

### 3.3 Verify Functions Deployed

```bash
supabase functions list
```

Should show:
```
seal-evidence
verify-evidence
```

---

## STEP 4: CONFIGURE SECRETS

### 4.1 Set SEAL_SECRET_KEY

**For Development/Testing (HMAC-SHA256):**

```bash
supabase secrets set SEAL_SECRET_KEY="$(openssl rand -hex 32)"
```

This generates a random 256-bit key for HMAC signing.

**For Production (RSA-2048):**

See "Production Upgrades" section below.

### 4.2 Verify Secrets Set

```bash
supabase secrets list
```

Should show:
```
SEAL_SECRET_KEY
```

---

## STEP 5: VERIFY DEPLOYMENT

### 5.1 Run Verification Script

```bash
npx tsx scripts/verify-deployment.ts
```

This will check:
- ✅ All tables exist
- ✅ All RPC functions exist
- ✅ Edge Functions deployed
- ✅ RLS policies enabled

### 5.2 Expected Output

```
✅ Table: workspaces - Exists (Phase C.1)
✅ Table: users - Exists (Phase C.1)
✅ Table: jobs - Exists (Phase C.2)
✅ Table: clients - Exists (Phase C.2)
✅ Table: technicians - Exists (Phase C.2)
✅ Table: job_access_tokens - Exists (Phase C.2)
✅ Table: evidence_seals - Exists (Phase C.3)
✅ Table: audit_logs - Exists (Phase C.4)
✅ RPC: create_workspace_with_owner - Exists (Phase C.1)
✅ RPC: generate_job_access_token - Exists (Phase C.2)
✅ RPC: log_audit_event - Exists (Phase C.4)
✅ RPC: get_audit_logs - Exists (Phase C.4)
✅ Edge Function: seal-evidence - Deployed (Phase C.3)
✅ Edge Function: verify-evidence - Deployed (Phase C.3)
✅ RLS: workspaces table - RLS enabled

SUMMARY: 15 passed, 0 failed, 0 warnings
✅ ALL SYSTEMS OPERATIONAL
```

---

## STEP 6: TEST END-TO-END

### 6.1 Test Authentication (Phase C.1)

```bash
npm run dev
```

Navigate to `http://localhost:5173` and:

1. Click "Sign Up"
2. Enter email, password, workspace name
3. Check email for confirmation link
4. Confirm email and sign in
5. Verify redirect to admin dashboard

**Expected Result:** User created in `users` table, workspace created in `workspaces` table.

### 6.2 Test Job Creation & Magic Links (Phase C.2)

1. Sign in to admin dashboard
2. Create new job
3. View magic link URL
4. Open magic link in incognito window
5. Verify technician can view job

**Expected Result:** Job created in `jobs` table, token created in `job_access_tokens` table.

### 6.3 Test Evidence Sealing (Phase C.3)

1. Create job with photos and signature
2. Click "Seal Evidence" button
3. Verify seal badge appears
4. Try to edit sealed job (should fail)
5. Click "Verify Seal" (should show "Valid")

**Expected Result:** Seal created in `evidence_seals` table, `jobs.sealed_at` populated, update attempts blocked.

### 6.4 Test Audit Trail (Phase C.4)

1. Create job
2. Update job
3. Seal job
4. Check browser console for audit logs

**Expected Result:** Audit logs created in `audit_logs` table for each operation.

---

## STEP 7: PRODUCTION UPGRADES

### 7.1 Upgrade to RSA-2048 Signing

**Current State:** HMAC-SHA256 placeholder (Phase C.3)
**Production Requirement:** RSA-2048 cryptographic signing

**Steps:**

1. **Generate RSA keypair:**

```bash
# Generate private key
openssl genrsa -out seal_private.pem 2048

# Generate public key
openssl rsa -in seal_private.pem -pubout -out seal_public.pem
```

2. **Store private key in Supabase Vault:**

```bash
# Convert to base64
PRIVATE_KEY_BASE64=$(cat seal_private.pem | base64 -w 0)

# Store in Supabase secret
supabase secrets set SEAL_PRIVATE_KEY="$PRIVATE_KEY_BASE64"
```

3. **Update seal-evidence Edge Function:**

Replace HMAC signing (line 190) with RSA signing:

```typescript
// supabase/functions/seal-evidence/index.ts

// Import private key from secret
const privateKeyPem = atob(Deno.env.get('SEAL_PRIVATE_KEY') || '');

// Import key for signing
const privateKey = await crypto.subtle.importKey(
  'pkcs8',
  pemToBinary(privateKeyPem),
  {
    name: 'RSASSA-PKCS1-v1_5',
    hash: 'SHA-256',
  },
  false,
  ['sign']
);

// Sign hash
const signatureBuffer = await crypto.subtle.sign(
  'RSASSA-PKCS1-v1_5',
  privateKey,
  encoder.encode(evidenceHash)
);

const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));
```

4. **Update algorithm field:**

```typescript
algorithm: 'SHA256-RSA2048', // Update from 'SHA256-HMAC'
```

5. **Redeploy Edge Function:**

```bash
supabase functions deploy seal-evidence
```

6. **Distribute public key:**

Publish `seal_public.pem` for third-party verification:
- Include in court evidence submissions
- Provide to clients for independent verification
- Document key fingerprint

### 7.2 Enable MFA (Optional)

1. Enable MFA in Supabase Dashboard → Authentication → Providers
2. Update signup flow to prompt for MFA enrollment
3. Update `users.mfa_enabled` column on enrollment

### 7.3 Configure Email Templates

1. Supabase Dashboard → Authentication → Email Templates
2. Customize confirmation email
3. Customize password reset email
4. Add company branding

### 7.4 Set Up Monitoring

1. Enable Supabase Logs → Database Logs
2. Monitor Edge Function logs
3. Set up alerts for:
   - Failed sealing operations
   - RLS policy violations
   - High audit log volume

---

## TROUBLESHOOTING

### Issue: "relation does not exist" error

**Cause:** Migrations not applied

**Solution:**
```bash
supabase db push
supabase db reset  # If needed (WARNING: deletes data)
```

### Issue: "JWT expired" error

**Cause:** Supabase anon key expired or incorrect

**Solution:**
1. Get fresh anon key from Supabase Dashboard → Settings → API
2. Update `.env` file
3. Restart dev server

### Issue: Edge Functions return 404

**Cause:** Functions not deployed

**Solution:**
```bash
supabase functions deploy seal-evidence
supabase functions deploy verify-evidence
```

### Issue: "Cannot modify sealed job" error persists after unsealing

**Cause:** Database trigger still active (expected behavior)

**Solution:** Sealed jobs are immutable by design. Create new job instead.

### Issue: RLS policy blocking access

**Cause:** User not in correct workspace

**Solution:**
```sql
-- Check user's workspace
SELECT id, email, workspace_id FROM users WHERE id = '<user-id>';

-- Check job's workspace
SELECT id, title, workspace_id FROM jobs WHERE id = '<job-id>';

-- Ensure workspace_id matches
```

### Issue: Magic link expired

**Cause:** Token older than 7 days

**Solution:**
```typescript
// Generate new token
const result = await generateMagicLink(jobId);
```

---

## ROLLBACK PROCEDURE

If deployment fails or issues occur:

### Rollback Migrations

```bash
# Reset to specific migration
supabase db reset --db-url <connection-string>
```

### Rollback Edge Functions

```bash
# Delete function
supabase functions delete seal-evidence
supabase functions delete verify-evidence
```

### Restore from Backup

```bash
# Supabase Dashboard → Database → Backups → Restore
```

---

## VERIFICATION CHECKLIST

Use this checklist to confirm deployment:

### Database
- [ ] All 8 tables exist (workspaces, users, jobs, clients, technicians, job_access_tokens, evidence_seals, audit_logs)
- [ ] RLS enabled on all tables
- [ ] RLS policies created (run: `SELECT * FROM pg_policies`)
- [ ] Triggers created (run: `SELECT * FROM pg_trigger`)
- [ ] RPC functions created (4 functions)

### Edge Functions
- [ ] seal-evidence deployed
- [ ] verify-evidence deployed
- [ ] SEAL_SECRET_KEY set
- [ ] Functions return 200/400 (not 404)

### Authentication
- [ ] Can sign up new user
- [ ] Confirmation email received
- [ ] Can sign in
- [ ] Session persists on refresh

### Authorization
- [ ] Can create job
- [ ] Can generate magic link
- [ ] Magic link validates correctly
- [ ] Expired tokens rejected

### Sealing
- [ ] Can seal job
- [ ] Sealed job shows seal badge
- [ ] Cannot modify sealed job
- [ ] Verification returns valid

### Audit Trail
- [ ] Audit logs created on job create
- [ ] Audit logs created on job update
- [ ] Audit logs created on job seal
- [ ] Cannot delete audit logs

---

## NEXT STEPS

After successful deployment:

1. **Update REALITY_AUDIT_REPORT.md:**
   - Mark "Edge Functions Deployed" as ✅
   - Mark "Database Migrations Verified" as ✅
   - Update "Deployment Status" section

2. **Proceed to Phase D.1 (GPS Validation):**
   - Implement GPS validation against job address
   - Add distance calculation (job location vs photo GPS)
   - Flag photos >100m from job site

3. **Monitor Production:**
   - Set up Supabase alerts
   - Monitor Edge Function logs
   - Track audit log volume

---

## SUPPORT

**Issues:** https://github.com/vm799/trust_by_design/issues
**Supabase Docs:** https://supabase.com/docs
**CONTRACTS.md:** API reference documentation

---

**Deployment Guide Version:** 1.0.0
**Last Updated:** 2026-01-17
**Status:** Complete for Phases C.1-C.5
