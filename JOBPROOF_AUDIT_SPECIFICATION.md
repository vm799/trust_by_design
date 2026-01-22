# JobProof Audit Specification
**Version:** 1.0
**Date:** 2026-01-22
**Status:** ACTIVE
**Scope:** Complete System Audit Framework

---

## Executive Summary

This document defines the comprehensive audit specification for the JobProof evidence management system. It establishes mandatory audit procedures, verification methods, success criteria, and compliance requirements to ensure the system maintains its core promise: **legally defensible, tamper-evident work evidence**.

**Audit Philosophy:**
- **Trust, but verify:** All security claims must be independently verifiable
- **Defense in depth:** Multiple layers of validation
- **Continuous verification:** Audits are not one-time events
- **Fail-secure:** Any audit failure must block production deployment

---

## 1. Audit Scope and Objectives

### 1.1 Primary Objectives

1. **Security Assurance:** Verify that authentication, authorization, and cryptographic controls prevent unauthorized access and tampering
2. **Data Integrity:** Confirm that evidence sealing and verification mechanisms are functioning correctly
3. **Compliance:** Ensure adherence to legal, regulatory, and specification requirements
4. **Performance:** Validate that the system operates within acceptable performance parameters
5. **Operational Resilience:** Test offline-first architecture and sync reliability

### 1.2 Audit Boundaries

**IN SCOPE:**
- Frontend application (React/TypeScript)
- Backend services (Supabase: Postgres, Auth, Edge Functions)
- Cryptographic sealing infrastructure
- Authentication and authorization (RLS policies)
- Offline synchronization
- Data integrity mechanisms
- API security
- Third-party integrations (what3words, Google OAuth)

**OUT OF SCOPE:**
- Infrastructure provider security (Supabase, Vercel, Google Cloud)
- Browser security vulnerabilities
- Network transport security (assumed HTTPS)
- Physical device security

### 1.3 Audit Frequency

| Audit Type | Frequency | Trigger |
|------------|-----------|---------|
| **Critical Security Audit** | Weekly | Pre-deployment, post-incident |
| **RLS Policy Verification** | Daily | Database schema changes |
| **Cryptographic Seal Verification** | Daily | Production monitoring |
| **Integration Testing** | Per commit | CI/CD pipeline |
| **Performance Audit** | Monthly | Significant code changes |
| **Compliance Audit** | Quarterly | Regulatory requirements |
| **Full System Audit** | Annually | Certification renewal |

---

## 2. Security Audit Procedures

### 2.1 Authentication Audit

#### 2.1.1 Magic Link Authentication
**Objective:** Verify secure email-based authentication

**Procedures:**
1. **Token Generation Test:**
   ```sql
   -- Verify tokens expire after 7 days
   SELECT id, token, expires_at, created_at
   FROM magic_link_tokens
   WHERE expires_at < NOW()
   AND used_at IS NULL;
   -- Expected: Expired tokens are rejected
   ```

2. **Token Uniqueness Test:**
   ```sql
   -- Check for token collisions
   SELECT token, COUNT(*)
   FROM magic_link_tokens
   GROUP BY token
   HAVING COUNT(*) > 1;
   -- Expected: 0 rows (all tokens unique)
   ```

3. **Token Invalidation Test:**
   - Generate magic link
   - Use token once
   - Attempt to reuse token
   - **Expected:** Second attempt fails with "Token already used" error

4. **Email Verification:**
   - Verify emails are sent via authenticated SMTP
   - Check SPF, DKIM, DMARC records
   - Test email deliverability to major providers

**Success Criteria:**
- ✅ All tokens expire within 7 days
- ✅ No token collisions exist
- ✅ Used tokens cannot be reused
- ✅ Email deliverability > 95%

#### 2.1.2 Google OAuth Integration
**Objective:** Verify secure OAuth 2.0 flow

**Procedures:**
1. **Redirect URI Validation:**
   ```bash
   # Test invalid redirect URI
   curl -X POST 'https://ndcjtpzixjbhmzbavqdm.supabase.co/auth/v1/authorize' \
     -H 'Content-Type: application/json' \
     -d '{"provider":"google","redirect_to":"https://evil.com"}'
   # Expected: Error - redirect not in allowlist
   ```

2. **State Parameter Verification:**
   - Initiate OAuth flow
   - Verify `state` parameter is present and unique
   - Verify state is validated on callback
   - **Expected:** Requests without valid state are rejected

3. **PKCE Flow Test (if enabled):**
   - Verify `code_challenge` is required
   - Verify `code_verifier` is validated
   - **Expected:** Authorization code cannot be used without valid verifier

**Success Criteria:**
- ✅ Only allowlisted redirect URIs accepted
- ✅ State parameter prevents CSRF attacks
- ✅ PKCE prevents authorization code interception

#### 2.1.3 Session Management
**Objective:** Verify secure session handling

**Procedures:**
1. **Session Expiry Test:**
   ```typescript
   // Test 1: Short-lived access token
   // 1. Sign in
   // 2. Wait for access token to expire (60 minutes)
   // 3. Make authenticated request
   // Expected: Token refreshed automatically

   // Test 2: Refresh token expiry
   // 1. Sign in
   // 2. Wait for refresh token to expire (30 days)
   // 3. Attempt to use refresh token
   // Expected: Must re-authenticate
   ```

2. **Session Fixation Test:**
   - Capture session ID before login
   - Log in
   - Verify session ID changed after login
   - **Expected:** New session ID issued post-authentication

3. **Concurrent Session Test:**
   - Log in from Device A
   - Log in from Device B with same credentials
   - Verify both sessions are valid OR only latest is valid (per policy)
   - **Expected:** Behavior matches security policy

**Success Criteria:**
- ✅ Access tokens expire within 60 minutes
- ✅ Refresh tokens expire within 30 days
- ✅ Session IDs regenerated on login
- ✅ Concurrent session policy enforced

---

### 2.2 Authorization Audit (RLS Policies)

#### 2.2.1 Workspace Isolation
**Objective:** Verify users cannot access data outside their workspace

**Procedures:**
1. **Cross-Workspace Access Test:**
   ```sql
   -- Setup: Create 2 workspaces with different users
   -- Test as user_workspace_a
   SET LOCAL request.jwt.claims TO '{"sub":"user_a_id","workspace_id":"workspace_a"}';

   -- Attempt to read workspace B's jobs
   SELECT * FROM jobs WHERE workspace_id = 'workspace_b';
   -- Expected: 0 rows

   -- Attempt to insert job into workspace B
   INSERT INTO jobs (id, workspace_id, title)
   VALUES (gen_random_uuid(), 'workspace_b', 'Unauthorized Job');
   -- Expected: ERROR - RLS policy violation
   ```

2. **Admin vs Member Permission Test:**
   ```sql
   -- Test as member (not admin)
   SET LOCAL request.jwt.claims TO '{"sub":"member_id","role":"member"}';

   -- Attempt admin-only operation
   UPDATE workspaces SET name = 'Hacked' WHERE id = 'target_workspace_id';
   -- Expected: ERROR - RLS policy violation
   ```

3. **Sealed Job Immutability Test:**
   ```sql
   -- Attempt to modify sealed job
   UPDATE jobs
   SET title = 'Modified After Seal'
   WHERE id = 'sealed_job_id' AND sealed_at IS NOT NULL;
   -- Expected: ERROR - Trigger prevents update
   ```

**Success Criteria:**
- ✅ Users see ONLY their workspace's data
- ✅ Cross-workspace writes blocked
- ✅ Role-based permissions enforced
- ✅ Sealed jobs cannot be modified

#### 2.2.2 Magic Link Token Access
**Objective:** Verify token-based access grants limited permissions

**Procedures:**
1. **Token Scope Test:**
   ```typescript
   // Test 1: Valid token for Job A
   const response = await fetch('/api/jobs/job_a_id', {
     headers: { 'X-Job-Token': 'valid_token_for_job_a' }
   });
   // Expected: 200 OK, job data returned

   // Test 2: Same token for Job B
   const response2 = await fetch('/api/jobs/job_b_id', {
     headers: { 'X-Job-Token': 'valid_token_for_job_a' }
   });
   // Expected: 403 Forbidden
   ```

2. **Token Expiry Enforcement:**
   ```sql
   -- Use expired token
   SET LOCAL request.headers TO '{"x-job-token":"expired_token"}';
   SELECT * FROM jobs WHERE id = 'job_id';
   -- Expected: 0 rows (token expired, access denied)
   ```

**Success Criteria:**
- ✅ Tokens grant access to assigned job only
- ✅ Expired tokens are rejected
- ✅ Tokens cannot be used for other operations

---

### 2.3 Cryptographic Sealing Audit

#### 2.3.1 RSA-2048 Algorithm Verification
**Objective:** Ensure all production seals use RSA-2048, not HMAC fallback

**Procedures:**
1. **Algorithm Distribution Check:**
   ```sql
   -- Check seal algorithms in production
   SELECT
     algorithm,
     COUNT(*) as seal_count,
     MIN(sealed_at) as first_seal,
     MAX(sealed_at) as last_seal
   FROM evidence_seals
   WHERE sealed_at > NOW() - INTERVAL '30 days'
   GROUP BY algorithm;
   -- Expected: Only 'SHA256-RSA2048' present
   ```

2. **HMAC Fallback Detection:**
   ```sql
   -- Critical: No HMAC seals in production
   SELECT COUNT(*) as hmac_seal_count
   FROM evidence_seals
   WHERE algorithm = 'SHA256-HMAC'
   AND sealed_at > NOW() - INTERVAL '1 day';
   -- Expected: 0 (MUST be zero in production)
   ```

3. **Key Rotation Verification:**
   ```sql
   -- Check for multiple public keys (indicates rotation)
   SELECT DISTINCT
     LEFT(signature, 64) as key_fingerprint,
     COUNT(*) as seals_with_key
   FROM evidence_seals
   GROUP BY key_fingerprint;
   -- Expected: 1-2 keys (current + recently rotated)
   ```

**Success Criteria:**
- ✅ 100% of seals use SHA256-RSA2048
- ✅ 0 HMAC fallback seals in production
- ✅ Key rotation documented when detected

#### 2.3.2 Seal Integrity Verification
**Objective:** Verify sealed evidence has not been tampered with

**Procedures:**
1. **Signature Verification Test:**
   ```typescript
   // For each sealed job in sample set
   const job = await fetchSealedJob(jobId);
   const seal = await fetchEvidenceSeal(jobId);

   // Reconstruct evidence bundle
   const bundle = {
     jobId: job.id,
     title: job.title,
     photos: job.photos.map(p => ({
       url: p.url,
       metadata: p.metadata,
       timestamp: p.captured_at
     })),
     signatures: job.signatures,
     sealed_at: seal.sealed_at
   };

   // Hash bundle
   const evidenceHash = sha256(JSON.stringify(bundle));

   // Verify signature
   const isValid = await verifyRSASignature(
     evidenceHash,
     seal.signature,
     publicKey
   );

   // Expected: isValid === true
   ```

2. **Tamper Detection Test:**
   ```typescript
   // Modify sealed data in database
   await db.query('UPDATE jobs SET title = $1 WHERE id = $2',
     ['Tampered Title', sealedJobId]);

   // Attempt verification
   const result = await verifySeal(sealedJobId);

   // Expected: result.valid === false
   // Expected: result.error === 'Hash mismatch - evidence tampered'
   ```

3. **Timestamp Integrity:**
   ```sql
   -- Check for backdated seals
   SELECT id, created_at, sealed_at
   FROM jobs
   WHERE sealed_at < created_at;
   -- Expected: 0 rows (seal cannot predate creation)
   ```

**Success Criteria:**
- ✅ 100% of sampled seals verify correctly
- ✅ Tampered data detected by verification
- ✅ No backdated seals exist

#### 2.3.3 Key Management Audit
**Objective:** Verify cryptographic keys are securely managed

**Procedures:**
1. **Private Key Access Control:**
   ```bash
   # Verify private key is not in codebase
   git grep -i "BEGIN PRIVATE KEY\|BEGIN RSA PRIVATE KEY"
   # Expected: 0 results

   # Verify private key is in secure environment variables
   supabase secrets list | grep SEAL_PRIVATE_KEY
   # Expected: SEAL_PRIVATE_KEY present
   ```

2. **Public Key Distribution:**
   ```typescript
   // Verify public key is accessible for verification
   const publicKey = await fetch('/api/seal-public-key');
   // Expected: 200 OK, valid PEM-encoded public key

   // Verify key format
   const keyObject = crypto.createPublicKey(publicKey);
   // Expected: No errors, valid RSA-2048 key
   ```

3. **Key Rotation Procedure Test:**
   - Generate new RSA-2048 keypair
   - Deploy new private key to environment
   - Seal new job
   - Verify old seals still validate with old public key
   - Verify new seals validate with new public key
   - **Expected:** Both old and new seals remain valid

**Success Criteria:**
- ✅ Private key never in source control
- ✅ Private key in secure environment variables only
- ✅ Public key accessible for verification
- ✅ Key rotation tested and documented

---

### 2.4 API Security Audit

#### 2.4.1 Input Validation
**Objective:** Verify all API inputs are validated and sanitized

**Procedures:**
1. **SQL Injection Test:**
   ```bash
   # Test job creation with SQL injection attempt
   curl -X POST '/api/jobs' \
     -H 'Content-Type: application/json' \
     -d '{"title":"Test'; DROP TABLE jobs;--"}'
   # Expected: Input sanitized, no SQL execution
   ```

2. **XSS Test:**
   ```typescript
   // Create job with XSS payload
   await createJob({
     title: '<script>alert("XSS")</script>',
     description: '<img src=x onerror="alert(1)">'
   });

   // Fetch and render job
   const job = await fetchJob(jobId);
   // Expected: Script tags escaped/removed
   ```

3. **File Upload Validation:**
   ```typescript
   // Upload non-image file as photo
   const maliciousFile = new File(['<?php shell_exec("whoami"); ?>'], 'shell.php', {
     type: 'image/jpeg' // Fake MIME type
   });

   const result = await uploadPhoto(maliciousFile);
   // Expected: Rejected - file type validation
   ```

**Success Criteria:**
- ✅ SQL injection attempts blocked
- ✅ XSS payloads sanitized
- ✅ File uploads validated by content, not just MIME type

#### 2.4.2 Rate Limiting
**Objective:** Verify API endpoints are protected against abuse

**Procedures:**
1. **Brute Force Protection Test:**
   ```bash
   # Attempt 100 login requests in 10 seconds
   for i in {1..100}; do
     curl -X POST '/auth/login' \
       -H 'Content-Type: application/json' \
       -d '{"email":"test@example.com","password":"wrong"}' &
   done
   # Expected: Rate limit triggered after ~10 requests
   ```

2. **API Quota Test:**
   ```bash
   # Exceed daily API limit
   for i in {1..1000}; do
     curl -H "Authorization: Bearer $TOKEN" '/api/jobs'
   done
   # Expected: 429 Too Many Requests after quota exceeded
   ```

**Success Criteria:**
- ✅ Login attempts rate-limited (10/minute)
- ✅ API requests rate-limited (1000/hour)
- ✅ Rate limit headers present (X-RateLimit-*)

---

## 3. Data Integrity Audit

### 3.1 Evidence Bundle Verification

#### 3.1.1 Photo Metadata Immutability
**Objective:** Verify photo metadata cannot be altered after capture

**Procedures:**
1. **Metadata Capture Test:**
   ```typescript
   // Capture photo with metadata
   const photo = await capturePhoto();

   // Verify required metadata present
   assert(photo.metadata.timestamp !== null);
   assert(photo.metadata.gps_lat !== null);
   assert(photo.metadata.gps_lng !== null);
   assert(photo.metadata.gps_accuracy !== null);
   ```

2. **Metadata Tampering Detection:**
   ```sql
   -- Attempt to modify photo metadata after capture
   UPDATE photos
   SET metadata = jsonb_set(metadata, '{gps_lat}', '0.0')
   WHERE id = 'photo_id' AND job_id IN (
     SELECT id FROM jobs WHERE sealed_at IS NOT NULL
   );
   -- Expected: ERROR or 0 rows updated (trigger prevents)
   ```

3. **Exif Data Validation:**
   ```typescript
   // For photos with Exif data
   const exifData = await extractExif(photoBlob);
   const dbMetadata = await getPhotoMetadata(photoId);

   // Compare Exif timestamp to DB timestamp
   const timeDiff = Math.abs(
     new Date(exifData.DateTime) - new Date(dbMetadata.timestamp)
   );

   // Expected: Difference < 1 second
   assert(timeDiff < 1000);
   ```

**Success Criteria:**
- ✅ All photos have complete metadata
- ✅ Sealed photo metadata cannot be modified
- ✅ Exif data matches database metadata

#### 3.1.2 GPS Accuracy Validation
**Objective:** Verify GPS coordinates are plausible and accurate

**Procedures:**
1. **Coordinate Range Test:**
   ```sql
   -- Check for impossible GPS coordinates
   SELECT id, metadata->>'gps_lat' as lat, metadata->>'gps_lng' as lng
   FROM photos
   WHERE
     (metadata->>'gps_lat')::float NOT BETWEEN -90 AND 90
     OR (metadata->>'gps_lng')::float NOT BETWEEN -180 AND 180;
   -- Expected: 0 rows
   ```

2. **Accuracy Threshold Test:**
   ```sql
   -- Flag low-accuracy GPS readings
   SELECT id, metadata->>'gps_accuracy' as accuracy
   FROM photos
   WHERE (metadata->>'gps_accuracy')::float > 50; -- 50 meters
   -- Expected: < 5% of photos (acceptable for mobile GPS)
   ```

3. **what3words Validation:**
   ```typescript
   // Verify what3words address matches GPS
   const photo = await getPhoto(photoId);
   const w3w = photo.metadata.w3w; // "filled.count.soap"

   // Reverse lookup
   const coords = await what3wordsAPI.convertToCoordinates(w3w);

   // Check distance
   const distance = calculateDistance(
     photo.metadata.gps_lat, photo.metadata.gps_lng,
     coords.lat, coords.lng
   );

   // Expected: distance < 3 meters (3x3m square)
   assert(distance < 3);
   ```

**Success Criteria:**
- ✅ All GPS coordinates within valid ranges
- ✅ 95%+ of photos have accuracy < 50m
- ✅ what3words addresses match GPS coordinates

### 3.2 Signature Integrity

#### 3.2.1 Signature Capture Validation
**Objective:** Verify signatures are captured correctly and securely

**Procedures:**
1. **Non-Empty Signature Test:**
   ```typescript
   // Attempt to submit empty signature
   const emptyCanvas = createCanvas(400, 200);
   const emptySignature = emptyCanvas.toDataURL();

   const result = await submitSignature(jobId, {
     signature: emptySignature,
     signerName: 'Test User'
   });

   // Expected: Rejected - "Signature cannot be blank"
   ```

2. **Signature Format Validation:**
   ```sql
   -- Verify all signatures are valid base64 PNG
   SELECT id, signature
   FROM signatures
   WHERE NOT signature ~ '^data:image/png;base64,[A-Za-z0-9+/=]+$';
   -- Expected: 0 rows
   ```

3. **Signer Name Requirement:**
   ```typescript
   // Attempt signature without signer name
   const result = await submitSignature(jobId, {
     signature: validSignatureData,
     signerName: ''
   });
   // Expected: Rejected - "Signer name required"
   ```

**Success Criteria:**
- ✅ Empty signatures rejected
- ✅ All signatures are valid base64 PNG
- ✅ Signer name required for all signatures

---

## 4. Offline Sync Audit

### 4.1 Sync Queue Verification

#### 4.1.1 Offline Job Creation
**Objective:** Verify jobs created offline are synced when online

**Procedures:**
1. **Offline Creation Test:**
   ```typescript
   // Simulate offline
   setNetworkStatus('offline');

   // Create job
   const job = await createJob({
     title: 'Offline Test Job',
     description: 'Created while offline'
   });

   // Verify in IndexedDB
   const localJob = await indexedDB.jobs.get(job.id);
   assert(localJob.syncStatus === 'pending');

   // Go online
   setNetworkStatus('online');
   await triggerSync();

   // Verify synced to Supabase
   const remoteJob = await supabase.from('jobs').select('*').eq('id', job.id);
   assert(remoteJob.data.length === 1);
   ```

2. **Sync Queue Persistence:**
   ```typescript
   // Create offline job
   setNetworkStatus('offline');
   const job = await createJob({title: 'Test'});

   // Close browser tab
   await closeBrowser();

   // Reopen browser (still offline)
   await reopenBrowser();
   setNetworkStatus('offline');

   // Verify job still in queue
   const queuedJobs = await getSyncQueue();
   assert(queuedJobs.some(j => j.id === job.id));
   ```

**Success Criteria:**
- ✅ Offline jobs stored in IndexedDB
- ✅ Jobs sync when network restored
- ✅ Sync queue persists across browser restarts

#### 4.1.2 Conflict Resolution
**Objective:** Verify conflicts are handled gracefully

**Procedures:**
1. **Last-Write-Wins Test:**
   ```typescript
   // Device A: Create and sync job
   const jobA = await createJob({title: 'Original Title'});
   await syncToSupabase(jobA);

   // Device B: Fetch job offline
   setNetworkStatus('offline');
   const jobB = await fetchJob(jobA.id);

   // Device A: Update job online
   await updateJob(jobA.id, {title: 'Updated by Device A'});

   // Device B: Update job offline
   await updateJob(jobB.id, {title: 'Updated by Device B'});

   // Device B: Go online and sync
   setNetworkStatus('online');
   await syncToSupabase(jobB);

   // Check final state
   const finalJob = await fetchJob(jobA.id);
   // Expected: Last write wins (Device B's update)
   assert(finalJob.title === 'Updated by Device B');
   ```

2. **Seal Conflict Prevention:**
   ```typescript
   // Device A: Seal job offline
   setNetworkStatus('offline');
   await sealJob(jobId);

   // Device B: Modify same job offline
   await updateJob(jobId, {title: 'Modified'});

   // Both devices go online
   setNetworkStatus('online');

   // Expected: Device A's seal takes precedence, Device B's update rejected
   const job = await fetchJob(jobId);
   assert(job.sealed_at !== null);
   ```

**Success Criteria:**
- ✅ Last-write-wins strategy functions correctly
- ✅ Sealed jobs cannot be modified by conflicting updates
- ✅ No data loss during sync conflicts

#### 4.1.3 Retry Logic
**Objective:** Verify exponential backoff and retry mechanisms

**Procedures:**
1. **Exponential Backoff Test:**
   ```typescript
   // Mock failing API
   let attemptCount = 0;
   mockSupabaseAPI((req) => {
     attemptCount++;
     if (attemptCount < 3) {
       return {status: 500, body: 'Server Error'};
     }
     return {status: 200, body: {success: true}};
   });

   // Create job
   const job = await createJob({title: 'Test'});
   await syncJobToSupabase(job);

   // Verify retry attempts
   assert(attemptCount === 3);

   // Verify backoff timings (2s, 5s, 10s)
   const retryTimings = getRetryTimings();
   assert(retryTimings[0] === 2000);
   assert(retryTimings[1] === 5000);
   assert(retryTimings[2] === 10000);
   ```

2. **Max Retry Test:**
   ```typescript
   // Mock permanently failing API
   mockSupabaseAPI(() => ({status: 500}));

   // Attempt sync
   const job = await createJob({title: 'Test'});
   await syncJobToSupabase(job);

   // Verify max retries reached
   const syncStatus = await getSyncStatus(job.id);
   assert(syncStatus === 'failed');
   assert(getRetryCount(job.id) === 4); // Max 4 retries
   ```

**Success Criteria:**
- ✅ Exponential backoff implemented (2s, 5s, 10s, 30s)
- ✅ Max 4 retry attempts before marking failed
- ✅ Failed jobs can be manually retried

---

## 5. Compliance Audit

### 5.1 GDPR Compliance

#### 5.1.1 Data Access Rights
**Objective:** Verify users can access their data

**Procedures:**
1. **Data Export Test:**
   ```typescript
   // User requests data export
   const exportData = await requestDataExport(userId);

   // Verify completeness
   assert(exportData.user !== null);
   assert(exportData.workspaces.length > 0);
   assert(exportData.jobs.length > 0);
   assert(exportData.photos.length > 0);

   // Verify format (JSON)
   assert(typeof exportData === 'object');
   ```

2. **Data Portability:**
   ```typescript
   // Export data in machine-readable format
   const exportedData = await exportUserData(userId, 'json');

   // Verify can be imported elsewhere
   const parsedData = JSON.parse(exportedData);
   assert(parsedData.version === '1.0');
   ```

**Success Criteria:**
- ✅ Users can export all their data
- ✅ Export includes all personal information
- ✅ Export in machine-readable format (JSON)

#### 5.1.2 Right to Erasure
**Objective:** Verify users can delete their data

**Procedures:**
1. **Account Deletion Test:**
   ```typescript
   // User requests account deletion
   await deleteAccount(userId);

   // Verify all personal data removed
   const user = await getUser(userId);
   assert(user === null);

   // Verify workspace data handling
   const workspaces = await getWorkspacesByOwner(userId);
   assert(workspaces.length === 0 || workspaces.every(w => w.owner_id !== userId));
   ```

2. **Data Retention Policy:**
   ```sql
   -- Verify sealed evidence is preserved (legal requirement)
   SELECT COUNT(*) FROM jobs
   WHERE sealed_at IS NOT NULL
   AND created_by = 'deleted_user_id';
   -- Expected: Sealed jobs retained (anonymized)

   -- Verify unsealed jobs are deleted
   SELECT COUNT(*) FROM jobs
   WHERE sealed_at IS NULL
   AND created_by = 'deleted_user_id';
   -- Expected: 0
   ```

**Success Criteria:**
- ✅ User personal data deleted on request
- ✅ Sealed evidence retained for legal compliance
- ✅ Unsealed data deleted with account

### 5.2 Audit Logging

#### 5.2.1 Audit Trail Completeness
**Objective:** Verify all security-relevant actions are logged

**Procedures:**
1. **Action Coverage Test:**
   ```sql
   -- Check for logged actions
   SELECT DISTINCT action FROM audit_logs;
   -- Expected: login, logout, job_created, job_sealed, job_viewed, user_added, etc.
   ```

2. **Log Integrity:**
   ```sql
   -- Verify logs cannot be modified
   UPDATE audit_logs SET action = 'tampered' WHERE id = 'log_id';
   -- Expected: ERROR - no UPDATE permission

   DELETE FROM audit_logs WHERE id = 'log_id';
   -- Expected: ERROR - no DELETE permission
   ```

3. **Timestamp Accuracy:**
   ```sql
   -- Check for backdated logs
   SELECT * FROM audit_logs
   WHERE created_at > NOW();
   -- Expected: 0 rows
   ```

**Success Criteria:**
- ✅ All security actions logged
- ✅ Logs are immutable
- ✅ Timestamps are server-generated

---

## 6. Performance Audit

### 6.1 Load Time Audit

**Procedures:**
1. **Lighthouse Audit:**
   ```bash
   npx lighthouse https://jobproof.pro --output=json --output-path=audit-report.json
   ```

   **Thresholds:**
   - Performance: > 90
   - Accessibility: > 95
   - Best Practices: > 90
   - SEO: > 90

2. **Core Web Vitals:**
   - **LCP (Largest Contentful Paint):** < 2.5s
   - **FID (First Input Delay):** < 100ms
   - **CLS (Cumulative Layout Shift):** < 0.1

### 6.2 Database Performance

**Procedures:**
1. **Query Performance:**
   ```sql
   -- Check slow queries (> 100ms)
   SELECT query, mean_exec_time, calls
   FROM pg_stat_statements
   WHERE mean_exec_time > 100
   ORDER BY mean_exec_time DESC
   LIMIT 20;
   ```

2. **Index Usage:**
   ```sql
   -- Check for missing indices
   SELECT schemaname, tablename, attname, n_distinct, correlation
   FROM pg_stats
   WHERE schemaname = 'public'
   AND n_distinct > 100
   AND correlation < 0.5;
   -- Expected: All high-cardinality columns have indices
   ```

**Success Criteria:**
- ✅ 95% of queries execute in < 100ms
- ✅ All foreign keys have indices
- ✅ No sequential scans on large tables

---

## 7. Code Quality Audit

### 7.1 TypeScript Strict Mode

**Procedures:**
```bash
# Verify strict mode enabled
grep '"strict": true' tsconfig.json
# Expected: Found

# Type check
npm run type-check
# Expected: 0 errors
```

**Success Criteria:**
- ✅ TypeScript strict mode enabled
- ✅ No type errors
- ✅ No `any` types in critical paths

### 7.2 Test Coverage

**Procedures:**
```bash
npm run test:coverage
```

**Thresholds:**
- Lines: > 80%
- Functions: > 75%
- Branches: > 75%
- Statements: > 80%

**Success Criteria:**
- ✅ All thresholds met
- ✅ Critical paths have 100% coverage

### 7.3 Dependency Security

**Procedures:**
```bash
npm audit --production
```

**Success Criteria:**
- ✅ 0 high/critical vulnerabilities
- ✅ Low/moderate vulnerabilities documented and accepted

---

## 8. Audit Reporting

### 8.1 Audit Report Format

Each audit must produce a report with:

1. **Executive Summary**
   - Audit date and duration
   - Auditor(s)
   - Overall pass/fail status
   - Critical findings summary

2. **Detailed Findings**
   - For each test:
     - Test ID
     - Objective
     - Result (pass/fail/warning)
     - Evidence (screenshots, logs, data)
     - Severity (critical/high/medium/low)

3. **Remediation Plan**
   - For each failure:
     - Root cause analysis
     - Recommended fix
     - Estimated effort
     - Priority
     - Assigned owner

4. **Compliance Statement**
   - PROJECT_SPEC_V3.md compliance level
   - GDPR compliance status
   - Any non-compliance items with justification

### 8.2 Severity Levels

| Severity | Definition | Response Time |
|----------|------------|---------------|
| **Critical** | Complete system compromise, data breach, or legal violation | Immediate (< 4 hours) |
| **High** | Security control failure, data integrity issue | 24 hours |
| **Medium** | Degraded functionality, performance issue | 7 days |
| **Low** | Minor issue, cosmetic bug | 30 days |

### 8.3 Remediation SLA

| Severity | Fix Deadline | Verification Deadline |
|----------|-------------|----------------------|
| Critical | 24 hours | 48 hours |
| High | 7 days | 14 days |
| Medium | 30 days | 45 days |
| Low | 90 days | 120 days |

---

## 9. Continuous Monitoring

### 9.1 Automated Monitoring

**Daily Checks:**
- Seal algorithm distribution (must be 100% RSA-2048)
- Failed sync count (alert if > 10)
- Authentication error rate (alert if > 5%)
- API error rate (alert if > 1%)

**Real-Time Alerts:**
- HMAC seal created (critical)
- RLS policy violation attempt (high)
- Multiple failed login attempts (medium)
- Slow query detected (> 1s) (medium)

### 9.2 Metrics Dashboard

**Required Metrics:**
- Total seals created (daily)
- Seal verification success rate (should be 100%)
- Active users (daily/weekly/monthly)
- Sync queue length (real-time)
- Failed syncs (last 24 hours)
- Average sync time
- API response times (p50, p95, p99)
- Database connection pool usage

---

## 10. Audit Sign-Off

### 10.1 Audit Approval Process

1. **Audit Execution:** Auditor performs all procedures
2. **Report Generation:** Detailed report created
3. **Review:** Technical lead reviews findings
4. **Remediation:** Failures addressed per SLA
5. **Re-Audit:** Failed tests re-executed
6. **Sign-Off:** Approval granted if all critical/high issues resolved

### 10.2 Deployment Gate

**Production deployment BLOCKED if:**
- Any critical findings unresolved
- Any high findings > 7 days old
- Test coverage < 80%
- TypeScript strict mode disabled
- HMAC seals detected in production

### 10.3 Audit Records Retention

- Audit reports: 7 years
- Audit evidence: 3 years
- Remediation plans: Permanent
- Sign-off approvals: Permanent

---

## Appendix A: Audit Checklist (Quick Reference)

### Pre-Deployment Audit (Required)

- [ ] RSA-2048 cryptographic sealing verified
- [ ] RLS policies tested and validated
- [ ] OAuth redirect allowlist configured
- [ ] TypeScript strict mode enabled, 0 errors
- [ ] Test coverage > 80%
- [ ] Lighthouse performance > 90
- [ ] No high/critical npm vulnerabilities
- [ ] Audit logs immutable and complete
- [ ] GDPR data export tested
- [ ] Sealed job immutability verified

### Monthly Audit (Required)

- [ ] Security audit (Section 2)
- [ ] Data integrity audit (Section 3)
- [ ] Offline sync audit (Section 4)
- [ ] Performance audit (Section 6)
- [ ] Dependency security audit (Section 7.3)

### Quarterly Audit (Required)

- [ ] Full compliance audit (Section 5)
- [ ] Code quality audit (Section 7)
- [ ] Penetration testing
- [ ] Third-party security assessment

### Annual Audit (Required)

- [ ] Complete system audit (all sections)
- [ ] External security audit
- [ ] Compliance certification renewal
- [ ] Disaster recovery test

---

## Appendix B: Audit Tool Configuration

### Required Tools

1. **Lighthouse CLI:**
   ```bash
   npm install -g lighthouse
   lighthouse https://jobproof.pro --output=html --output-path=audit.html
   ```

2. **npm audit:**
   ```bash
   npm audit --production --json > npm-audit-report.json
   ```

3. **Supabase CLI:**
   ```bash
   supabase db diff --schema public
   supabase test db
   ```

4. **TypeScript:**
   ```bash
   npx tsc --noEmit
   ```

5. **Vitest Coverage:**
   ```bash
   npm run test:coverage -- --reporter=json --outputFile=coverage.json
   ```

---

## Appendix C: Audit History Template

```markdown
# Audit History

## 2026-01-22 - Pre-Deployment Security Audit
- **Auditor:** Claude (Systems Architect)
- **Status:** PASS (with 2 medium findings)
- **Critical Findings:** 0
- **High Findings:** 0
- **Medium Findings:** 2
  - TypeScript strict mode disabled
  - what3words using mock data
- **Action:** Both findings remediated within 7 days
- **Sign-off:** [Approver Name], 2026-01-29

## [Next Audit Date]
...
```

---

**END OF AUDIT SPECIFICATION**

**Document Status:** ACTIVE
**Version:** 1.0
**Last Updated:** 2026-01-22
**Next Review:** 2026-04-22 (Quarterly)
**Owner:** Technical Lead / Security Team
