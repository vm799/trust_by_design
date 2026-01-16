# Supabase Integration Testing Guide

**Purpose:** Verify Supabase email auth, storage, and sync flows work correctly
**Status:** Ready for Testing
**Prerequisites:** Supabase project set up (see SUPABASE_SETUP.md)

---

## Test Environment Setup

### 1. Verify Environment Variables

```bash
# Check .env file exists and has values
cat .env

# Should see:
# VITE_SUPABASE_URL=https://xxx.supabase.co
# VITE_SUPABASE_ANON_KEY=eyJ...
```

**If missing:**
```bash
cp .env.example .env
# Add your Supabase credentials from dashboard
```

---

### 2. Verify Supabase Tables Exist

**In Supabase Dashboard:**
1. Go to Table Editor
2. Verify these tables exist:
   - `jobs`
   - `photos`
   - `safety_checks`
   - `clients`
   - `technicians`

**If missing:** Run `supabase/schema.sql` in SQL Editor

---

### 3. Verify Storage Buckets Exist

**In Supabase Dashboard:**
1. Go to Storage
2. Verify these buckets exist:
   - `job-photos` (public)
   - `job-signatures` (public)

**If missing:** Buckets are created automatically on first upload

---

## Test 1: Email Authentication

**Goal:** Verify Supabase Auth works (when upgraded from mock auth)

### Current Status: Mock Auth (MVP)
**Location:** `views/AuthView.tsx:14-21`

```typescript
// Current - accepts ANY credentials (no validation)
const handleSubmit = (e: React.FormEvent) => {
  e.preventDefault();
  onAuth(); // Just sets localStorage
  navigate('/admin');
};
```

**This is intentional for MVP!** See [AUTH.md](./AUTH.md) for production upgrade path.

---

### Test Scenario 1.1: Login Works (Mock)

**Steps:**
1. Navigate to `http://localhost:3000/#/auth/login`
2. Enter ANY email: `test@test.com`
3. Enter ANY password: `password123`
4. Click "Enter Hub"

**Expected Result:**
- ✅ Redirects to `/admin` dashboard
- ✅ `localStorage.getItem('jobproof_auth')` === `'true'`

**If Fails:**
- Check browser console for errors
- Verify routing is working

---

### Test Scenario 1.2: Logout Works

**Steps:**
1. While logged in, navigate to Profile
2. Click "Sign Out"

**Expected Result:**
- ✅ Redirects to `/home`
- ✅ `localStorage.getItem('jobproof_auth')` === `null`

**If Fails:**
- Check `App.tsx:103-106` - handleLogout function

---

### Production Auth Testing (After Upgrade)

**When you upgrade to Supabase Auth** (see AUTH.md), test these:

**Test 1.3: Sign Up with Email**
```
1. Go to /auth/signup
2. Enter email: your-email@test.com
3. Enter password: SecurePass123!
4. Click "Initialize Hub"

Expected:
- Email sent to inbox
- Check email for verification link
- Click link
- Account verified
- Can now login
```

**Test 1.4: Login with Real Credentials**
```
1. Go to /auth/login
2. Enter verified email
3. Enter correct password
4. Click "Enter Hub"

Expected:
- Redirects to /admin
- Session persists (can refresh page, stay logged in)
```

**Test 1.5: Wrong Password**
```
1. Go to /auth/login
2. Enter email: your-email@test.com
3. Enter password: WrongPassword
4. Click "Enter Hub"

Expected:
- Shows error: "Invalid email or password"
- Does NOT redirect
```

---

## Test 2: Photo Storage Flow

**Goal:** Verify photos upload to Supabase Storage

### Test Scenario 2.1: Capture Photo (Offline)

**Steps:**
1. Open admin dashboard
2. Create test job: "Test Photo Upload"
3. Copy magic link
4. Open in new incognito tab (simulate technician)
5. **Disable network** (Chrome DevTools → Network → Offline)
6. Navigate through steps to photo capture
7. Click "Capture Photo"
8. Allow camera permissions
9. Take photo

**Expected Result:**
- ✅ Photo displays in preview
- ✅ Photo saved to IndexedDB
  - Open DevTools → Application → IndexedDB → `JobProofOfflineDB` → `media`
  - Should see entry with key like `media_abc123`
- ✅ Photo counter shows "1 photo"
- ✅ Sync status shows "Pending" or "Offline"

**If Fails:**
- Check `views/TechnicianPortal.tsx:181-213` - onFileSelect function
- Check `db.ts:17-27` - saveMedia function
- Look for console errors

---

### Test Scenario 2.2: Photo Syncs When Online

**Steps:**
1. While still on technician portal with offline photo
2. **Re-enable network** (Chrome DevTools → Network → Online)
3. Wait 5-10 seconds

**Expected Result:**
- ✅ Sync status changes to "Syncing" then "Synced"
- ✅ Photo uploads to Supabase Storage
  - Check Supabase Dashboard → Storage → `job-photos`
  - Should see folder with job ID
  - Inside: photo file
- ✅ Database row created in `photos` table
  - Check Supabase → Table Editor → `photos`
  - Should see row with job_id, url (Supabase URL), timestamp

**If Fails:**
- Check browser console for errors
- Check Network tab for failed API calls
- Verify Supabase credentials in .env
- Check `lib/syncQueue.ts:27-155` - syncJobToSupabase function

---

### Test Scenario 2.3: Multiple Photos

**Steps:**
1. Capture 5 photos in technician portal
2. All should save to IndexedDB immediately
3. Submit job
4. Wait for sync

**Expected Result:**
- ✅ All 5 photos appear in Supabase Storage
- ✅ All 5 rows in `photos` table
- ✅ Job row in `jobs` table shows completed_at timestamp

**If Fails:**
- Check retry queue: `localStorage.getItem('jobproof_sync_queue')`
- Check console for sync errors
- Verify storage bucket permissions (should be public)

---

## Test 3: Signature Storage Flow

**Goal:** Verify signatures save correctly

### Test Scenario 3.1: Capture Signature

**Steps:**
1. In technician portal, navigate to sign-off step
2. Draw signature on canvas
3. Enter signer name: "John Smith"
4. Select role: "Homeowner"
5. Click "Submit Job"

**Expected Result (Offline):**
- ✅ Signature saved to IndexedDB
  - DevTools → IndexedDB → `media` → key like `sig_jobId`
- ✅ Job sealed locally
- ✅ Shows "Job Sealed" success screen

**Expected Result (Online):**
- ✅ Signature uploads to Supabase Storage
  - Storage → `job-signatures` → `{jobId}/signature.png`
- ✅ Job row updated with `signature_url`
- ✅ Job status = 'Submitted'

**If Fails:**
- Check signature canvas validation: `TechnicianPortal.tsx:275-285`
- Check signature save: `TechnicianPortal.tsx:289-302`
- Verify signature upload: `lib/supabase.ts:85-115`

---

## Test 4: what3words Location Flow

**Goal:** Verify dual-signal location works

### Test Scenario 4.1: Location Capture

**Steps:**
1. Open technician portal on phone (or Chrome with location enabled)
2. Click "Capture Location"
3. Allow location permissions

**Expected Result:**
- ✅ GPS coordinates captured (lat/lng)
- ✅ what3words address generated (e.g., `///filled.count.soap`)
- ✅ Both displayed in UI
- ✅ Location status shows "captured"

**Current Implementation:** Mock what3words (generates from lat/lng using word pool)

**If Fails:**
- Check browser location permissions
- Check `TechnicianPortal.tsx:118-145` - captureLocation function
- Verify Geolocation API support

---

### Test Scenario 4.2: Location Denied Fallback

**Steps:**
1. Click "Capture Location"
2. Deny location permissions

**Expected Result:**
- ✅ Status shows "denied"
- ✅ Warning message displays
- ✅ Manual lat/lng input option appears
- ✅ Can enter coordinates manually

**If Fails:**
- Check `TechnicianPortal.tsx:126-131` - permission denied handler

---

### Test Scenario 4.3: Location Saved with Photos

**Steps:**
1. Capture location first
2. Then capture photo

**Expected Result:**
- ✅ Photo metadata includes lat, lng, w3w
- ✅ Visible in admin dashboard when viewing photo
- ✅ Saved to database photos table

**Verify:**
```sql
-- In Supabase SQL Editor
SELECT id, lat, lng, w3w, timestamp
FROM photos
WHERE job_id = 'your-test-job-id';
```

**If Fails:**
- Check photo object creation: `TechnicianPortal.tsx:244-255`

---

## Test 5: Notes Storage

**Goal:** Verify text notes sync correctly

### Test Scenario 5.1: Add Notes

**Steps:**
1. In technician portal, go to summary step
2. Add notes: "Customer requested extra verification photos"
3. Continue to sign-off
4. Submit job

**Expected Result:**
- ✅ Notes saved locally in localStorage immediately
- ✅ Notes included in job sync
- ✅ Notes visible in admin dashboard
- ✅ Notes appear in client report
- ✅ Database `jobs` table has notes column populated

**Verify:**
```sql
-- In Supabase SQL Editor
SELECT id, notes, completed_at
FROM jobs
WHERE id = 'your-test-job-id';
```

**If Fails:**
- Check notes state: `TechnicianPortal.tsx:34` - useState
- Check sync: `lib/syncQueue.ts:68` - notes field in upsert

---

## Test 6: Offline Sync Queue

**Goal:** Verify retry logic works

### Test Scenario 6.1: Create Job Fully Offline

**Steps:**
1. Disable network completely
2. Open technician portal
3. Capture location
4. Take 3 photos
5. Complete checklist
6. Add signature
7. Submit job
8. Check console - should see "Supabase not configured" or sync error

**Expected Result:**
- ✅ All data saved to IndexedDB and localStorage
- ✅ Job shows "Pending" sync status
- ✅ Entry added to sync queue
  - Check: `localStorage.getItem('jobproof_sync_queue')`
  - Should see JSON with job data and retryCount: 0

**If Fails:**
- Job should still complete locally
- Sync will retry when online

---

### Test Scenario 6.2: Network Returns - Auto Retry

**Steps:**
1. After completing job offline (Test 6.1)
2. Re-enable network
3. Wait 60 seconds (background worker interval)
4. OR refresh page to trigger immediate retry

**Expected Result:**
- ✅ Console logs: "✅ Job xxx synced successfully to Supabase"
- ✅ Sync queue cleared
  - `localStorage.getItem('jobproof_sync_queue')` is empty or null
- ✅ All photos in Supabase Storage
- ✅ All data in Supabase tables

**If Fails:**
- Check retry worker: `lib/syncQueue.ts:157-213`
- Check exponential backoff delays: 2s, 5s, 10s, 30s
- Max retries: 4 attempts

---

### Test Scenario 6.3: Failed Sync (Max Retries)

**Steps:**
1. **Intentionally break sync** (wrong Supabase URL in .env)
2. Create and submit job
3. Wait for retries (2s, 5s, 10s, 30s)
4. After 4 failed attempts, check sync queue

**Expected Result:**
- ✅ Console logs show retry attempts
- ✅ After 4 attempts, gives up
- ✅ Sync queue shows retryCount: 4
- ✅ Job remains in queue (manual intervention needed)

**Recovery:**
1. Fix .env credentials
2. Refresh page
3. Should retry and succeed

**If Fails:**
- Check max retries constant: `lib/syncQueue.ts:15`

---

## Test 7: Integration Testing

**Goal:** Verify all flows work together

### Test Scenario 7.1: Complete Job (Happy Path)

**Steps:**
1. Admin creates job
2. Technician opens magic link
3. Reviews job details (step 0)
4. Captures location (step 1)
5. Takes 5 photos: 2 before, 2 during, 1 after (step 2)
6. Completes safety checklist (step 3)
7. Adds notes (step 3)
8. Gets signature (step 4)
9. Submits job
10. Admin views completed job
11. Client opens report link

**Expected Results:**
- ✅ Every step completes without errors
- ✅ All data syncs to Supabase
- ✅ Admin sees all photos, signature, notes
- ✅ Client sees professional report
- ✅ PDF export works

**Time to Complete:** ~5 minutes
**Data Created:**
- 1 job row
- 5 photo rows
- 4 safety check rows
- 5 photo files in Storage
- 1 signature file in Storage

---

## Debugging Tips

### Check IndexedDB Contents

**Chrome DevTools:**
```
1. F12 → Application tab
2. Storage → IndexedDB
3. Expand: JobProofOfflineDB
4. Click: media
5. View all stored photos/signatures
```

### Check Sync Queue

**Console:**
```javascript
// View current sync queue
JSON.parse(localStorage.getItem('jobproof_sync_queue') || '[]')

// Clear sync queue (if stuck)
localStorage.removeItem('jobproof_sync_queue')
```

### Check Supabase Storage

**Dashboard:**
```
1. Storage → job-photos
2. Click folder (job ID)
3. See all uploaded photos
4. Right-click → Copy URL → Verify in browser
```

### Check Supabase Database

**SQL Editor:**
```sql
-- View all jobs
SELECT * FROM jobs ORDER BY created_at DESC LIMIT 10;

-- View photos for specific job
SELECT * FROM photos WHERE job_id = 'JOB-123';

-- Check sync status
SELECT id, status, sync_status, completed_at
FROM jobs
WHERE sync_status = 'failed';
```

### Network Debugging

**Chrome DevTools:**
```
1. F12 → Network tab
2. Filter: Fetch/XHR
3. Look for supabase.co requests
4. Check status codes:
   - 200 = Success
   - 401 = Auth error (check anon key)
   - 403 = Permission error (check RLS policies)
   - 500 = Server error
```

---

## Common Issues & Fixes

### Issue 1: "Supabase credentials not configured"

**Symptom:** Console warning, app runs in offline-only mode

**Cause:** Missing .env file or invalid credentials

**Fix:**
1. Create .env from .env.example
2. Add Supabase URL and anon key from dashboard
3. Restart dev server: `npm run dev`

---

### Issue 2: Photos Upload But Don't Display

**Symptom:** Photos in Supabase Storage, but broken images in UI

**Cause:** CORS not configured

**Fix:**
```
1. Supabase Dashboard → Storage → job-photos → Settings
2. Add allowed origin: http://localhost:3000
3. For production, add: https://your-vercel-app.vercel.app
```

---

### Issue 3: Sync Stuck at "Pending"

**Symptom:** Jobs complete but never sync

**Cause:** Background worker not running

**Fix:**
1. Check console for worker start message:
   ```
   🚀 JobProof v2 - Background sync worker started
   ```
2. If missing, check `App.tsx:83-86`
3. Verify network is online
4. Manually trigger retry: Refresh page

---

### Issue 4: Database Insert Fails

**Symptom:** 403 Forbidden errors in Network tab

**Cause:** Row Level Security policies missing

**Fix:**
1. Re-run `supabase/schema.sql` in SQL Editor
2. Verify policies exist:
   ```sql
   SELECT * FROM pg_policies WHERE tablename = 'jobs';
   ```
3. Should see policy: "Allow anonymous access to jobs"

---

## Success Criteria

**All Tests Pass When:**
- ✅ Can create job and copy magic link
- ✅ Can open magic link without login
- ✅ Can capture location (GPS + what3words)
- ✅ Can take photos offline
- ✅ Photos save to IndexedDB immediately
- ✅ Photos sync to Supabase when online
- ✅ Can capture signature
- ✅ Can complete safety checklist
- ✅ Can add notes
- ✅ Can submit job (triggers seal)
- ✅ Job appears in admin dashboard
- ✅ All photos visible in admin view
- ✅ Client report displays correctly
- ✅ Offline → online sync works automatically
- ✅ Retry queue handles failures gracefully

---

## Next Steps After Testing

1. **If All Pass:** Ready for beta customer testing
2. **If Failures:** Document issues, fix, re-test
3. **Production Checklist:**
   - [ ] Upgrade to production auth (AUTH.md)
   - [ ] Add real what3words API key
   - [ ] Set up error tracking (Sentry)
   - [ ] Configure production CORS
   - [ ] Set up monitoring (Supabase Dashboard)
   - [ ] Create runbook for common issues

---

**Testing Status:** Ready to Begin
**Estimated Time:** 2-3 hours for comprehensive testing
**Required:** Real device testing (iPhone + Android)
