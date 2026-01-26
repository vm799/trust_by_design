# Technician Invite Link - UAT Verification Script

## Overview
This script verifies that technician job links work correctly across different browsers (cross-browser scenario).

## Prerequisites
- Access to JobProof admin dashboard
- Two different browser sessions (e.g., Chrome + Firefox, or Chrome + Incognito)
- Supabase database configured and accessible

---

## Test Case 1: Standard Cross-Browser Flow

### Steps

#### Browser A (Manager's Browser)
1. Log in to JobProof admin dashboard
2. Navigate to Jobs → Create New Job
3. Fill in required fields:
   - Title: "UAT Test Job - [timestamp]"
   - Client: Select any client
   - Technician: Select any technician
   - Address: "123 Test Street"
4. Click "Dispatch" to create job
5. **CRITICAL**: Copy the generated magic link URL
   - URL format: `https://jobproof.pro/#/track/{token}?jobId={jobId}`
6. Note the job ID and token for verification

#### Browser B (Technician's Browser - Different Session)
1. Open a completely fresh browser (incognito mode or different browser)
2. **DO NOT log in** - this simulates a technician with no cached data
3. Paste the magic link URL copied from step 5
4. **EXPECTED RESULT**:
   - ✅ Job should load successfully
   - ✅ Job title, client, and address should display correctly
   - ✅ Technician should be able to start working on the job
5. **NOT EXPECTED**:
   - ❌ "Invalid or expired link" error
   - ❌ "Link may have been opened in different browser" error
   - ❌ Redirect to error page

---

## Test Case 2: Expired Link Handling

### Steps
1. Create a job as in Test Case 1
2. Wait for link to expire (or modify expiry in database for testing)
3. Try to open the link in any browser
4. **EXPECTED RESULT**:
   - ✅ Clear error message: "This link has expired. Please ask your manager to send a new link."
   - ❌ NOT: "Invalid token" or generic error

---

## Test Case 3: Sealed Job Handling

### Steps
1. Create and complete a job (including signature)
2. Seal the job from admin dashboard
3. Try to open the original magic link
4. **EXPECTED RESULT**:
   - ✅ Clear error message: "This job has been sealed and can no longer be modified."
   - ❌ NOT: Generic "invalid link" error

---

## Test Case 4: Resend Link Flow

### Steps
1. Create a job
2. From admin dashboard, click "Resend Link" for the job
3. Copy the new link
4. Open the new link in incognito browser
5. **EXPECTED RESULT**:
   - ✅ New link should work correctly
   - ✅ Old link should still work (not revoked unless explicitly done)

---

## Verification Checklist

| Test | Expected Result | Actual Result | Pass/Fail |
|------|-----------------|---------------|-----------|
| Cross-browser link validation | Job loads in different browser | | |
| Expired link error message | Clear "expired" message with instructions | | |
| Sealed job error message | Clear "sealed" message | | |
| Resend link works | New link loads job correctly | | |
| Console errors | No "Invalid token" errors when link is valid | | |

---

## Technical Verification (Developer)

### Database Check
```sql
-- Verify token is stored on job record
SELECT id, title, magic_link_token, magic_link_url
FROM jobs
WHERE id = '[job_id]';

-- Verify token is in job_access_tokens table
SELECT * FROM job_access_tokens
WHERE job_id = '[job_id]';
```

### Console Logging
When a valid link is opened, you should see one of:
- `[validateMagicLink] Validated token via job_access_tokens: job_id=...`
- `[validateMagicLink] Validated token via jobs.magic_link_token: job_id=...`

### Error Scenarios to NOT see:
- `[validateMagicLink] Token not found in Supabase` (when link is valid)
- `Invalid token - link may have been opened in different browser` (when Supabase is available)

---

## Rollback Instructions

If issues are found, the changes can be reverted by:
1. Remove `magic_link_token` and `magic_link_url` fields from job inserts/selects in `lib/db.ts`
2. Revert `validateMagicLink` function to previous version
3. Run database migration to remove columns if added

---

## Sign-off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Developer | | | |
| QA | | | |
| Product Owner | | | |
