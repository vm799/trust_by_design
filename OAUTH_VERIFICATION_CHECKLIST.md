# OAuth Configuration Verification Checklist
## PATH A - PHASE 1 Manual Verification Required

**Date:** 2026-01-21
**Branch:** `claude/jobproof-audit-spec-PEdmd`
**Status:** ⏸️ AWAITING MANUAL VERIFICATION

---

## ✅ Completed Automatically

- [x] Created `lib/redirects.ts` with secure REDIRECT_ALLOWLIST
- [x] Updated all OAuth redirect calls to use allowlist
- [x] Replaced dynamic `window.location.origin` usages
- [x] Files updated:
  - `lib/auth.ts` (signUp, signInWithMagicLink, signInWithGoogle, requestPasswordReset)
  - `lib/db.ts` (generateMagicLink)
  - `views/CreateJob.tsx` (magic link generation)
  - `views/JobReport.tsx` (report sharing)

---

## 🔍 Manual Verification Required

### 1. Supabase Dashboard - Redirect URLs Configuration

**Action:** Verify that Supabase Auth is configured with the correct redirect URLs

**Steps:**

1. **Navigate to Supabase Dashboard:**
   - Go to: https://supabase.com/dashboard
   - Select your project: `jobproof` (Project Ref: `ndcjtpzixjbhmzbavqdm`)

2. **Open Authentication Settings:**
   - Click: **Authentication** (left sidebar)
   - Click: **URL Configuration** (tab)

3. **Verify Redirect URLs (CRITICAL):**

   The following URLs **MUST** be listed under **"Redirect URLs"**:

   **Production:**
   ```
   https://jobproof.pro
   https://jobproof.pro/auth/callback
   ```

   **Development:**
   ```
   http://localhost:3000
   http://localhost:3000/auth/callback
   ```

4. **Verify Site URL:**
   - Site URL should be: `https://jobproof.pro`

5. **Take Screenshot:**
   - Capture the "URL Configuration" page
   - Save as: `screenshots/supabase-redirect-config-verified.png`

**Expected Result:**
✅ All 4 URLs listed above are present in the Supabase redirect allowlist

**If URLs are missing:**
1. Click "+ Add URL" button
2. Enter each missing URL
3. Click "Save"

---

### 2. Google Cloud Console - OAuth Configuration

**Action:** Verify Google OAuth client is configured with correct redirect URIs

**Steps:**

1. **Navigate to Google Cloud Console:**
   - Go to: https://console.cloud.google.com
   - Select project: `jobproof` or relevant OAuth project

2. **Open OAuth Credentials:**
   - Navigate to: **APIs & Services** → **Credentials**
   - Find your OAuth 2.0 Client ID for JobProof

3. **Verify Authorized Redirect URIs:**

   The following URI **MUST** be listed:

   ```
   https://ndcjtpzixjbhmzbavqdm.supabase.co/auth/v1/callback
   ```

   **IMPORTANT:** This is the **ONLY** redirect URI that should be listed.
   Do NOT add application URLs (jobproof.pro, localhost) here.

4. **Verify Authorized JavaScript Origins (if present):**
   - `https://jobproof.pro`
   - `http://localhost:3000` (optional, for local development)

5. **Take Screenshot:**
   - Capture the OAuth client configuration
   - Save as: `screenshots/google-oauth-config-verified.png`

**Expected Result:**
✅ Supabase callback URL is listed as authorized redirect URI
✅ No other redirect URIs are present (security best practice)

**If configuration is incorrect:**
1. Click "Edit" on the OAuth client
2. Add the Supabase callback URL if missing
3. Remove any incorrect redirect URIs
4. Click "Save"

---

### 3. Test OAuth Flows

**Action:** Manually test all OAuth flows after configuration verification

**Test Scenarios:**

#### Test 1: Magic Link Signup
```bash
# Expected Flow:
1. Navigate to: http://localhost:3000 or https://jobproof.pro
2. Click "Sign up with Email"
3. Enter email address
4. Submit form
5. Check email for magic link
6. Click magic link
7. Verify redirect to: /#/admin
8. Verify user is authenticated
```

**Expected Result:**
✅ Magic link email received
✅ Clicking link redirects to correct URL in allowlist
✅ User is authenticated successfully

---

#### Test 2: Google OAuth Signup
```bash
# Expected Flow:
1. Navigate to: http://localhost:3000 or https://jobproof.pro
2. Click "Sign in with Google"
3. Complete Google authentication
4. Verify redirect back to application origin (NOT /auth/callback)
5. Verify user is authenticated
```

**Expected Result:**
✅ Google OAuth popup appears
✅ After authentication, redirects to origin URL
✅ User is authenticated successfully
✅ No "redirect_uri_mismatch" error

---

#### Test 3: Session Refresh
```bash
# Expected Flow:
1. Sign in successfully
2. Close browser tab (keep browser open)
3. Wait 5 minutes
4. Reopen application URL
5. Verify user is still authenticated (session persisted)
```

**Expected Result:**
✅ Session persists across browser restarts
✅ Auto-refresh token works

---

#### Test 4: Logout/Login Cycle
```bash
# Expected Flow:
1. Sign in successfully
2. Click "Logout"
3. Verify redirected to login page
4. Sign in again
5. Verify successful authentication
```

**Expected Result:**
✅ Logout clears session
✅ Re-login works without errors

---

## 🚨 Failure Handling

**If any test fails:**

1. **STOP** PATH A execution immediately
2. Document the failure in `progress.md`:
   ```
   ## PHASE 1 - BLOCKED
   Test Failed: [Test Name]
   Error: [Error Message]
   Expected: [Expected Behavior]
   Actual: [Actual Behavior]
   ```
3. Review error logs:
   - Browser console (F12)
   - Supabase Dashboard → Logs → Auth Logs
   - Google Cloud Console → Logs Explorer
4. Fix configuration issue
5. Re-run verification tests

---

## ✅ Verification Complete

**Once all manual steps are verified:**

1. Update `progress.md`:
   ```
   ## PHASE 1 - COMPLETE
   - OAuth redirect allowlist implemented: ✅
   - Supabase dashboard verified: ✅
   - Google Cloud Console verified: ✅
   - All OAuth flows tested: ✅
   ```

2. Mark task complete in todo list

3. Proceed to **PHASE 2: Workspace Model Enforcement**

---

## Reference Information

**Allowlist Implementation:**
See: `lib/redirects.ts`

**Current Allowlist:**
```typescript
export const REDIRECT_ALLOWLIST = [
  'https://jobproof.pro',
  'http://localhost:3000',
] as const;
```

**Supabase Project:**
- URL: `https://ndcjtpzixjbhmzbavqdm.supabase.co`
- Project Ref: `ndcjtpzixjbhmzbavqdm`

**Related Documentation:**
- OAuth Audit Report: `OAUTH_AUTH_AUDIT_REPORT.md`
- Deployment Guide: `DEPLOYMENT_GUIDE.md`
- Progress Log: `progress.md`

---

**End of Verification Checklist**
