# 🧪 JOBPROOF UAT TEST SUITE

**Persona**: Senior QA Manager & Product Owner
**Purpose**: Comprehensive User Acceptance Testing for JobProof SaaS
**Last Updated**: 2026-01-19

---

## 📋 How to Use This Document

1. **Copy this into Notion/Spreadsheet** for tracking
2. **Test each scenario** on your staging/production environment
3. **Mark Status** as `Pass`, `Fail`, or `Edge Case`
4. **Document bugs** using the Bug Report Template below
5. **Submit bug reports** to Claude for code fixes

---

## 🎯 UAT TEST SUITE BY USER JOURNEY

### JOURNEY 1: Onboarding & Account Setup

| Test ID | Feature Area | User Action | Expected Result | Status | Bug Notes |
|---------|--------------|-------------|-----------------|--------|-----------|
| UAT-001 | Onboarding | Navigate to https://jobproof.pro | Landing page loads with JobProof logo, navigation, and "Get Started" CTA | | |
| UAT-002 | Onboarding | Click "Get Started" button | Redirects to /#/auth sign-up form | | |
| UAT-003 | Authentication | Enter invalid email (e.g., "test@") | Shows validation error: "Please enter a valid email address" | | |
| UAT-004 | Authentication | Enter weak password (e.g., "123") | Shows error: "Password must be at least 8 characters with 1 uppercase, 1 number" | | |
| UAT-005 | Authentication | Enter mismatched passwords in "Confirm Password" | Shows error: "Passwords do not match" | | |
| UAT-006 | Authentication | Complete sign-up with valid details (Full Name, Email, Password, Company Name) | Account created, redirects to /admin dashboard | | |
| UAT-007 | Onboarding | After first login, onboarding modal appears | Modal shows "Welcome to JobProof!" with persona selection (Admin/Technician/Both) | | |
| UAT-008 | Onboarding | Select "Admin" persona and click "Get Started" | Onboarding modal closes, dashboard shows "Create your first job" empty state | | |
| UAT-009 | Onboarding | Close onboarding without selection | Modal closes, can access dashboard (onboarding doesn't block usage) | | |
| UAT-010 | Authentication | Click "Sign Out" in sidebar | User logged out, redirects to /#/auth | | |
| UAT-011 | Authentication | Sign in with existing credentials | Successfully logs in, redirects to /admin dashboard | | |
| UAT-012 | Authentication | Click "Continue with Google" button | Opens Google OAuth consent screen | | |
| UAT-013 | Authentication | Complete Google OAuth sign-in | Account created/logged in, redirects to dashboard | | |
| UAT-014 | Authentication | Try to sign in with incorrect password | Shows error: "Invalid login credentials" | | |
| UAT-015 | Authentication | Click "Forgot Password" link | Shows password reset form or email sent confirmation | | |

---

### JOURNEY 2: Client Management

| Test ID | Feature Area | User Action | Expected Result | Status | Bug Notes |
|---------|--------------|-------------|-----------------|--------|-----------|
| UAT-020 | Clients | Navigate to /clients from sidebar | Shows Clients list view with "Add Client" button | | |
| UAT-021 | Clients | Click "Add Client" button | Opens "Create Client" modal/form | | |
| UAT-022 | Clients | Leave all fields blank and click "Save" | Shows validation errors for required fields (Name, Email) | | |
| UAT-023 | Clients | Enter invalid email format | Shows error: "Please enter a valid email address" | | |
| UAT-024 | Clients | Fill valid client details: Name="Acme Corp", Email="contact@acme.com", Phone="+1-555-0100", Address="123 Business St" | Client created successfully, appears in client list | | |
| UAT-025 | Clients | Search for created client by name | Client appears in filtered results | | |
| UAT-026 | Clients | Click on client card/row | Shows client details view with edit button | | |
| UAT-027 | Clients | Click "Edit" on client | Opens edit form with pre-filled data | | |
| UAT-028 | Clients | Update client phone number and save | Client updated successfully, changes reflected in list | | |
| UAT-029 | Clients | Click "Delete" on client (with no associated jobs) | Confirmation modal appears: "Are you sure?" | | |
| UAT-030 | Clients | Confirm deletion | Client deleted, removed from list | | |
| UAT-031 | Clients | Try to delete client with associated jobs | Shows error: "Cannot delete client with active jobs" | | |
| UAT-032 | Clients | Create duplicate client with same email | Shows error: "Client with this email already exists" | | |

---

### JOURNEY 3: Technician Management

| Test ID | Feature Area | User Action | Expected Result | Status | Bug Notes |
|---------|--------------|-------------|-----------------|--------|-----------|
| UAT-040 | Technicians | Navigate to /technicians from sidebar | Shows Technicians list view with "Add Technician" button | | |
| UAT-041 | Technicians | Click "Add Technician" button | Opens "Create Technician" modal/form | | |
| UAT-042 | Technicians | Leave required fields blank and save | Shows validation errors for Name, Email, Specialty | | |
| UAT-043 | Technicians | Create technician: Name="John Smith", Email="john@jobproof.pro", Phone="+1-555-1000", Specialty="HVAC" | Technician created, appears in list | | |
| UAT-044 | Technicians | Search for technician by specialty (e.g., "HVAC") | Filtered results show matching technicians | | |
| UAT-045 | Technicians | Edit technician specialty from "HVAC" to "Electrical" | Update successful, changes reflected in list | | |
| UAT-046 | Technicians | Delete technician with no assigned jobs | Technician deleted successfully | | |
| UAT-047 | Technicians | Try to delete technician with active jobs | Shows error or warning about active jobs | | |

---

### JOURNEY 4: Job Creation & Magic Link Generation

| Test ID | Feature Area | User Action | Expected Result | Status | Bug Notes |
|---------|--------------|-------------|-----------------|--------|-----------|
| UAT-050 | Job Creation | Navigate to /admin dashboard | Shows "Create Job" button and job list | | |
| UAT-051 | Job Creation | Click "Create Job" button | Opens Create Job form with fields: Title, Client dropdown, Technician dropdown, Date, Address, Notes | | |
| UAT-052 | Job Creation | Submit form without filling required fields | Shows validation errors for Title, Client, Technician, Date | | |
| UAT-053 | Job Creation | Select client from dropdown | Client name populates correctly | | |
| UAT-054 | Job Creation | Select technician from dropdown | Technician name populates correctly | | |
| UAT-055 | Job Creation | Fill all fields: Title="HVAC Installation", Client="Acme Corp", Technician="John Smith", Date=today+1, Address="123 Test St", Notes="Install new system" | Job created successfully, appears in job list with status "Pending" | | |
| UAT-056 | Job Creation | Click on newly created job in list | Opens Job Details view | | |
| UAT-057 | Magic Link | Click "Generate Magic Link" button in Job Details | Magic link generated and displayed in input field (format: /#/track/{token}) | | |
| UAT-058 | Magic Link | Click "Copy Link" button next to magic link | Link copied to clipboard, shows "Copied!" confirmation | | |
| UAT-059 | Magic Link | Click "Show QR Code" button | QR code image appears with magic link encoded | | |
| UAT-060 | Magic Link | Right-click QR code and "Save Image As" | QR code downloads as PNG file | | |
| UAT-061 | Magic Link | Copy magic link and open in new incognito window | Redirects to Technician Portal with job details loaded (no login required) | | |
| UAT-062 | Magic Link | Wait 25 hours, then try to access magic link | Shows error: "Link expired or invalid" | | |
| UAT-063 | Job Creation | Try to create job with past date | Shows warning or allows (depending on business rules) | | |
| UAT-064 | Job Creation | Create job without assigning technician | Job created with status "Unassigned" | | |

---

### JOURNEY 5: Technician Job Submission (Core Workflow)

| Test ID | Feature Area | User Action | Expected Result | Status | Bug Notes |
|---------|--------------|-------------|-----------------|--------|-----------|
| UAT-070 | Magic Link Access | Open magic link in browser (/#/track/{token}) | Loads Technician Portal with job title, client, address, and date displayed | | |
| UAT-071 | Magic Link Access | Try to access magic link for already sealed job | Shows error: "This job has been sealed and cannot be modified" + redirect | | |
| UAT-072 | Photo Upload | Click "Add Photo" or camera icon | File picker opens OR camera activates (on mobile) | | |
| UAT-073 | Photo Upload | Select a photo (JPEG, <5MB) from device | Photo appears in photo gallery with thumbnail | | |
| UAT-074 | Photo Upload | Click on uploaded photo thumbnail | Photo opens in full-screen preview/modal | | |
| UAT-075 | Photo Upload | Select "Photo Type" dropdown (Before/During/After/Evidence) | Photo categorized correctly, shows badge with type | | |
| UAT-076 | Photo Upload | Upload 10 photos in rapid succession | All photos upload and appear in gallery (no duplicates, no crashes) | | |
| UAT-077 | Photo Upload | Try to upload file >10MB | Shows error: "File size exceeds 10MB limit" | | |
| UAT-078 | Photo Upload | Try to upload non-image file (e.g., PDF) | Shows error: "Only image files are allowed (JPG, PNG)" | | |
| UAT-079 | Geolocation | Allow geolocation permission when prompted | Photo metadata shows latitude, longitude, and What3Words address | | |
| UAT-080 | Geolocation | Deny geolocation permission | Photo still uploads, but no GPS data shown (graceful degradation) | | |
| UAT-081 | Safety Checklist | Scroll to Safety Checklist section | Shows list of safety items with checkboxes (PPE, hazards, tools, etc.) | | |
| UAT-082 | Safety Checklist | Check all required safety items | Checkboxes marked, form validation passes | | |
| UAT-083 | Safety Checklist | Try to submit job without checking required items | Shows error: "Please complete all required safety checks" | | |
| UAT-084 | Signature | Scroll to Signature section | Shows canvas area with "Sign Here" placeholder | | |
| UAT-085 | Signature | Draw signature with mouse/finger | Signature appears on canvas in real-time | | |
| UAT-086 | Signature | Click "Clear Signature" button | Canvas clears, can redraw | | |
| UAT-087 | Signature | Enter Signer Name (e.g., "John Smith") | Text input accepts name | | |
| UAT-088 | Signature | Enter Signer Role (e.g., "Lead Technician") | Text input accepts role | | |
| UAT-089 | Signature | Click "Save Signature" button | Signature saved, shows confirmation message | | |
| UAT-090 | Signature | Try to submit job without signature | Shows error: "Signature required to submit job" | | |
| UAT-091 | Work Summary | Scroll to Work Summary section | Shows textarea field for notes | | |
| UAT-092 | Work Summary | Type detailed work summary (200+ characters) | Text appears correctly, no character limit errors | | |
| UAT-093 | Draft Persistence | Make changes (add photo, check safety item), wait 5 seconds | Shows "Draft saved" indicator in UI | | |
| UAT-094 | Draft Persistence | Refresh page mid-workflow | Returns to job with all previous changes restored (photos, checklist, signature) | | |
| UAT-095 | Job Submission | Click "Submit Job" button (with all fields complete) | Shows loading spinner, then success message: "Job submitted successfully!" | | |
| UAT-096 | Job Submission | After successful submission | Redirects to success page OR shows "Job submitted, you can close this page" message | | |
| UAT-097 | Job Submission | Try to access magic link after submission | Shows message: "This job has already been submitted" | | |
| UAT-098 | Offline Mode | Turn off WiFi/mobile data BEFORE loading job | Job loads from cache (if previously visited) OR shows offline message | | |
| UAT-099 | Offline Mode | Work offline: add photos, complete checklist, sign | Changes saved to browser storage (IndexedDB/localStorage) | | |
| UAT-100 | Offline Mode | Click "Submit Job" while offline | Shows message: "Job queued for sync. Will upload when online." | | |
| UAT-101 | Offline Mode | Turn WiFi back on after offline submission | Auto-syncs job to server, shows "Sync successful" notification | | |

---

### JOURNEY 6: Admin Job Review & Evidence Sealing

| Test ID | Feature Area | User Action | Expected Result | Status | Bug Notes |
|---------|--------------|-------------|-----------------|--------|-----------|
| UAT-110 | Job Review | Navigate to /admin dashboard after technician submits job | Job status shows "Submitted" with green badge | | |
| UAT-111 | Job Review | Click on submitted job in list | Opens Job Report view with all evidence displayed | | |
| UAT-112 | Job Report | Scroll to Photos section | All uploaded photos displayed, grouped by type (Before/During/After) | | |
| UAT-113 | Job Report | Click on photo thumbnail | Photo opens in full-screen lightbox/modal | | |
| UAT-114 | Job Report | Check photo metadata (GPS, timestamp) | Shows latitude, longitude, What3Words, and timestamp for each photo | | |
| UAT-115 | Job Report | Scroll to Safety Checklist section | Shows completed checklist with all items checked ✓ | | |
| UAT-116 | Job Report | Scroll to Signature section | Shows signature image with signer name and role | | |
| UAT-117 | Job Report | Scroll to Work Summary section | Shows technician's work summary text | | |
| UAT-118 | Evidence Sealing | Click "Seal Evidence" button | Confirmation modal appears: "Are you sure? This cannot be undone." | | |
| UAT-119 | Evidence Sealing | Click "Cancel" in confirmation modal | Modal closes, job remains unsealed | | |
| UAT-120 | Evidence Sealing | Click "Confirm Seal" in modal | Shows loading spinner: "Sealing evidence..." | | |
| UAT-121 | Evidence Sealing | Wait for sealing to complete (5-10 seconds) | Success message appears: "Evidence sealed successfully!" | | |
| UAT-122 | Evidence Sealing | After sealing, check job status | Status changes to "Archived" with seal badge 🛡️ | | |
| UAT-123 | Evidence Sealing | Check that "Seal Evidence" button is now disabled/hidden | Button no longer clickable or shows "Sealed" badge | | |
| UAT-124 | Evidence Sealing | Try to edit sealed job (change title, notes) | All edit controls disabled, shows warning: "Sealed jobs cannot be modified" | | |
| UAT-125 | Evidence Sealing | Scroll to Evidence Hash section | Shows SHA-256 hash (64-character hex string) | | |
| UAT-126 | Evidence Sealing | Check "Sealed At" timestamp | Shows ISO timestamp of when job was sealed | | |
| UAT-127 | Evidence Sealing | Check "Sealed By" field | Shows email address of admin who sealed the job | | |
| UAT-128 | Evidence Sealing | Try to seal job with missing photos | Shows error: "Cannot seal: job must have at least 1 photo" | | |
| UAT-129 | Evidence Sealing | Try to seal job with missing signature | Shows error: "Cannot seal: signature required" | | |

---

### JOURNEY 7: Public Evidence Verification

| Test ID | Feature Area | User Action | Expected Result | Status | Bug Notes |
|---------|--------------|-------------|-----------------|--------|-----------|
| UAT-140 | Public Access | Navigate to public job URL (e.g., /#/job/{jobId}/public) | Loads public Job Report view (no login required) | | |
| UAT-141 | Public Access | Check if sensitive data is hidden | Admin-only fields (client email, technician phone) are NOT shown | | |
| UAT-142 | Public Verification | Click "Verify Evidence" button | Shows loading: "Verifying evidence integrity..." | | |
| UAT-143 | Public Verification | Wait for verification to complete | Shows success message: "✅ Evidence verified - No tampering detected" | | |
| UAT-144 | Public Verification | Check verification details panel | Shows: Evidence Hash, Sealed At timestamp, Verification Status: Valid | | |
| UAT-145 | Public Verification | Try to verify unsealed job | Shows message: "This job has not been sealed yet" | | |
| UAT-146 | Public Verification | Simulate tampered job (would require backend manipulation) | Shows error: "⚠️ TAMPERING DETECTED - Evidence hash mismatch!" | | |

---

### JOURNEY 8: Invoicing

| Test ID | Feature Area | User Action | Expected Result | Status | Bug Notes |
|---------|--------------|-------------|-----------------|--------|-----------|
| UAT-150 | Invoices | Navigate to /invoices from sidebar | Shows invoice list view with "Create Invoice" button | | |
| UAT-151 | Invoice Creation | Click "Generate Invoice" from sealed job report | Opens invoice form with job details pre-filled | | |
| UAT-152 | Invoice Creation | Check pre-filled fields | Client name, job title, amount (from job.price or default $450) auto-populated | | |
| UAT-153 | Invoice Creation | Edit invoice amount to $650 | Amount updates correctly | | |
| UAT-154 | Invoice Creation | Click "Create Invoice" button | Invoice created with status "Draft", appears in invoice list | | |
| UAT-155 | Invoice Management | Click on invoice in list | Opens invoice details view | | |
| UAT-156 | Invoice Management | Click "Mark as Sent" button | Invoice status changes to "Sent", shows sent date | | |
| UAT-157 | Invoice Management | Click "Mark as Paid" button | Invoice status changes to "Paid", shows payment date | | |
| UAT-158 | Invoice Management | Try to edit paid invoice | Shows warning or prevents modification | | |
| UAT-159 | Invoice Management | Check due date calculation | Due date = Issue date + 14 days by default | | |

---

### JOURNEY 9: Billing & Subscription

| Test ID | Feature Area | User Action | Expected Result | Status | Bug Notes |
|---------|--------------|-------------|-----------------|--------|-----------|
| UAT-170 | Pricing | Navigate to /#/pricing from landing page | Shows pricing tiers: Free (5 jobs), Professional ($29/month, 50 jobs), Business ($99/month, unlimited) | | |
| UAT-171 | Subscription | Click "Upgrade" button on Professional tier | Redirects to Stripe Checkout with $29/month plan | | |
| UAT-172 | Subscription | Complete checkout with test card (4242 4242 4242 4242) | Payment successful, redirects to /admin with success message | | |
| UAT-173 | Subscription | Check account subscription status | Shows "Professional" tier badge in sidebar or settings | | |
| UAT-174 | Subscription | Create jobs up to limit (50 for Professional) | All jobs created successfully | | |
| UAT-175 | Subscription | Try to create job beyond limit on Free tier (6th job) | Shows error: "Upgrade to create more jobs. You've reached the 5 job limit." | | |
| UAT-176 | Subscription | Click "Manage Billing" in settings | Opens Stripe Customer Portal | | |
| UAT-177 | Subscription | In Stripe Portal, click "Cancel Subscription" | Subscription canceled, downgraded to Free tier at end of billing period | | |
| UAT-178 | Subscription | Check job limit after downgrade | Limited to 5 jobs, existing jobs remain accessible (read-only for excess) | | |

---

## 🔥 STRESS & EDGE TESTS (SaaS-Specific)

### Network & Connectivity

| Test ID | Feature Area | Scenario | User Action | Expected Result | Status | Bug Notes |
|---------|--------------|----------|-------------|-----------------|--------|-----------|
| EDGE-001 | Offline Sync | Network disconnect during photo upload | Upload 5 photos → Turn off WiFi mid-upload → Turn WiFi back on | Shows "Upload failed" for incomplete uploads → Auto-retries → All photos eventually uploaded | | |
| EDGE-002 | Offline Sync | Submit job while offline, then go online | Complete job → Turn off WiFi → Submit → Turn WiFi on | Job queued in localStorage → Auto-syncs when online → Status changes to "Submitted" in admin dashboard | | |
| EDGE-003 | Network Latency | Slow 3G connection (use Chrome DevTools throttling) | Set throttling to "Slow 3G" → Upload 3MB photo | Shows progress bar → Upload completes (may take 30-60s) → No timeout errors | | |
| EDGE-004 | Network Timeout | Long request timeout during sealing | Seal evidence → Simulate 30s API delay | Shows loading spinner for 30s → Eventually times out OR completes → Shows appropriate error/success message | | |
| EDGE-005 | Duplicate Requests | Double-click submit button rapidly | Click "Submit Job" twice in <1 second | Only 1 job submission processed → Button disabled after first click → No duplicate jobs created | | |

---

### Session & Authentication

| Test ID | Feature Area | Scenario | User Action | Expected Result | Status | Bug Notes |
|---------|--------------|----------|-------------|-----------------|--------|-----------|
| EDGE-010 | Session Expiry | Session expires mid-workflow | Start creating job → Wait 25 hours (or manually clear cookies) → Click "Save" | Shows "Session expired, please log in" modal → Draft saved in localStorage → After re-login, draft restored | | |
| EDGE-011 | Concurrent Sessions | Open 2 browser tabs, log in both | Tab 1: Create job → Tab 2: Create job with same details | Both jobs created independently → No data corruption or sync conflicts | | |
| EDGE-012 | Token Expiry | Access magic link after 24 hours | Generate magic link → Wait 24+ hours → Open link | Shows error: "This link has expired. Please contact your admin for a new link." | | |
| EDGE-013 | Invalid Token | Manually edit magic link token in URL | Change /#/track/abc123 to /#/track/invalid | Shows 404 or "Invalid link" error page → Redirects to home | | |
| EDGE-014 | Sealed Job Access | Try to access magic link for sealed job | Job is sealed → Open magic link | Shows message: "This job has been sealed and cannot be modified" → Redirects or shows read-only view | | |

---

### File Upload & Storage

| Test ID | Feature Area | Scenario | User Action | Expected Result | Status | Bug Notes |
|---------|--------------|-------------|-----------------|--------|-----------|
| EDGE-020 | Large Files | Upload 15MB photo | Select 15MB JPEG file | Shows error: "File size exceeds 10MB limit" → File not uploaded | | |
| EDGE-021 | File Type Validation | Upload PDF instead of image | Select .pdf file in photo uploader | Shows error: "Only image files allowed (JPG, PNG, HEIC)" | | |
| EDGE-022 | Corrupted Image | Upload corrupted/invalid image file | Select corrupted .jpg file | Shows error: "Invalid image file" OR uploads but shows broken image icon | | |
| EDGE-023 | Mass Upload | Upload 50 photos at once | Select 50 photos (5MB each) in file picker | All photos queued → Upload progress bar shows 1/50, 2/50... → All eventually uploaded OR shows reasonable limit (e.g., "Max 20 photos at once") | | |
| EDGE-024 | Slow Upload | Upload on slow 2G network | Set throttling to "Slow 2G" → Upload 5MB photo | Shows upload progress bar → Takes 2-5 minutes → Eventually completes OR shows timeout with retry option | | |
| EDGE-025 | Storage Quota | Fill browser storage (IndexedDB) | Work offline and upload 100+ photos (>500MB total) | Shows warning: "Storage quota exceeded" → Prompts to go online and sync OR prevents new uploads | | |

---

### Browser Compatibility

| Test ID | Feature Area | Scenario | User Action | Expected Result | Status | Bug Notes |
|---------|--------------|----------|-------------|-----------------|--------|-----------|
| EDGE-030 | Mobile Safari | Test on iPhone 12/13 Safari | Complete full technician workflow on mobile | All features work (camera, signature, geolocation) → UI responsive → No crashes | | |
| EDGE-031 | Mobile Chrome | Test on Android (Pixel 5) Chrome | Complete full technician workflow on mobile | All features work → Camera captures photos → Geolocation works | | |
| EDGE-032 | Desktop Chrome | Test on Windows/Mac Chrome latest | Complete admin workflow | All features work → No console errors | | |
| EDGE-033 | Desktop Firefox | Test on Firefox latest | Complete admin workflow | All features work → No major visual bugs | | |
| EDGE-034 | Desktop Safari | Test on macOS Safari | Complete admin workflow | All features work → Stripe checkout works | | |
| EDGE-035 | Tablet (iPad) | Test on iPad Pro Safari | Complete technician workflow | UI adapts to tablet size → Touch interactions work | | |
| EDGE-036 | Old Browser | Test on Chrome v100 (2-year-old version) | Try to access app | Shows warning: "Please update your browser" OR works with graceful degradation | | |

---

### Screen Sizes & Responsiveness

| Test ID | Feature Area | Scenario | User Action | Expected Result | Status | Bug Notes |
|---------|--------------|----------|-------------|-----------------|--------|-----------|
| EDGE-040 | Mobile Portrait | Test on 375x667 (iPhone SE) | Navigate through all views | All content visible → No horizontal scroll → Buttons accessible | | |
| EDGE-041 | Mobile Landscape | Rotate phone to landscape | View job report in landscape | Layout adapts → No broken UI → Photos display in gallery | | |
| EDGE-042 | Tablet Portrait | Test on 768x1024 (iPad) | Complete technician workflow | UI uses tablet layout → Larger touch targets → Signature canvas sized appropriately | | |
| EDGE-043 | Desktop 4K | Test on 3840x2160 display | View admin dashboard | UI scales correctly → No tiny text → Content centered or fills screen appropriately | | |
| EDGE-044 | Desktop Small | Test on 1280x720 window | View all pages | Content responsive → No overflowing elements → Sidebar collapsible | | |

---

### Data Edge Cases

| Test ID | Feature Area | Scenario | User Action | Expected Result | Status | Bug Notes |
|---------|--------------|----------|-------------|-----------------|--------|-----------|
| EDGE-050 | Long Text | Enter 5000-character work summary | Type very long work summary | Text accepted → Shows character count → No truncation errors → Saves successfully | | |
| EDGE-051 | Special Characters | Use emojis/Unicode in fields | Enter "🔧 HVAC Fix 中文" as job title | Characters saved correctly → Display correctly in UI → No encoding errors | | |
| EDGE-052 | Empty State | View dashboard with 0 jobs | New account with no jobs created | Shows empty state illustration + "Create your first job" CTA | | |
| EDGE-053 | Many Jobs | Create 500+ jobs | Bulk create 500 jobs (via API or repeated creation) | Dashboard loads without performance issues → Pagination works → Search/filter functional | | |
| EDGE-054 | Missing Data | Job created without optional fields | Create job with only required fields (no notes, no address) | Job created successfully → Shows "N/A" or blank for optional fields → No crashes | | |
| EDGE-055 | Duplicate Names | Create 2 clients with same name | Create "Acme Corp" twice (different emails) | Both clients created → Dropdown shows "Acme Corp (contact@acme.com)" and "Acme Corp (info@acme.com)" to differentiate | | |

---

### Performance & Load

| Test ID | Feature Area | Scenario | User Action | Expected Result | Status | Bug Notes |
|---------|--------------|----------|-------------|-----------------|--------|-----------|
| EDGE-060 | Page Load | Cold start (first visit, no cache) | Clear cache → Visit https://jobproof.pro | Page loads in <3 seconds on 4G → No FOUC (flash of unstyled content) | | |
| EDGE-061 | Page Load | Warm start (with cache) | Revisit page after caching | Page loads in <1 second → Instant navigation | | |
| EDGE-062 | Image Loading | Job with 50 photos | View job report with 50 photos | Photos lazy-load → Initial view shows placeholders → Scrolling loads more → No janky scrolling | | |
| EDGE-063 | Sync Queue | Process 100 queued items | Queue 100 photos offline → Go online | Sync processes in batches → Shows progress: "Syncing 10/100..." → Completes in <5 minutes | | |
| EDGE-064 | API Errors | Supabase 500 error during job creation | Simulate 500 error (via MSW or backend) | Shows user-friendly error: "Unable to create job. Please try again." → Provides retry button | | |

---

## 🐛 BUG REPORT TEMPLATE

Use this template to report failures to Claude for code fixes.

---

### BUG REPORT #___

**Associated Test ID**: UAT-XXX or EDGE-XXX

**Date Reported**: YYYY-MM-DD

**Reporter**: Your Name

---

#### 1. Test Scenario

**Feature Area**: [Onboarding / Job Submission / Evidence Sealing / etc.]

**User Action**:
```
Step 1: [What you clicked/did]
Step 2: [Next action]
Step 3: [Final action before bug appeared]
```

---

#### 2. Expected vs. Observed Behavior

**Expected Result**:
_[What should have happened according to UAT test]_

**Observed Result**:
_[What actually happened - be specific]_

---

#### 3. Console Errors

**Instructions**: Open Chrome DevTools (F12) → Console tab → Copy ALL red errors

```
[Paste console errors here]
Example:
Uncaught TypeError: Cannot read properties of undefined (reading 'id')
    at TechnicianPortal.tsx:145:22
```

---

#### 4. Network Errors (If Applicable)

**Instructions**: DevTools → Network tab → Look for failed requests (red)

```
Request URL: https://...supabase.co/rest/v1/jobs
Status Code: 401 Unauthorized
Response: {"error": "Invalid JWT token"}
```

---

#### 5. Screenshots/Video

**Attach**:
- Screenshot of the error
- Screen recording (use Loom/QuickTime) showing steps to reproduce

---

#### 6. Environment Details

**Browser**: Chrome 120 / Firefox 121 / Safari 17 / Mobile Safari (iOS 17)

**Device**: Desktop (Windows 11) / iPhone 13 Pro / Pixel 5

**Network**: WiFi / 4G / 3G / Offline

**Account**: Free tier / Professional / Business

---

#### 7. Reproduction Steps (Detailed)

```
1. Sign in as admin (test@jobproof.pro)
2. Navigate to /admin/create
3. Fill job form with:
   - Title: "Test Job"
   - Client: "Acme Corp"
   - Technician: "John Smith"
4. Click "Create Job" button
5. ERROR APPEARS: [describe what happens]
```

---

#### 8. Relevant Component (Your Analysis)

**Likely Component**: `views/TechnicianPortal.tsx` or `lib/db.ts` or `components/PhotoUpload.tsx`

_[If you know which file is likely responsible, note it here. Otherwise, leave blank.]_

---

#### 9. Frequency

- [ ] Happens every time (100% reproducible)
- [ ] Happens sometimes (intermittent)
- [ ] Happened once (cannot reproduce)

---

#### 10. Workaround (If Found)

_[Did you find a way to work around this bug? E.g., "Refreshing the page fixes it" or "Clicking twice works"]_

---

#### 11. Impact Severity

- [ ] **Critical** - Blocks core workflow, app unusable
- [ ] **High** - Major feature broken, workaround exists
- [ ] **Medium** - Minor feature broken, low user impact
- [ ] **Low** - Cosmetic issue, typo, minor visual bug

---

**END OF BUG REPORT**

---

## 🔄 FEEDBACK LOOP: How to Submit Bugs to Claude

### Step 1: Complete the UAT Test

- Go through each test in the suite
- Mark `Status` column as `Pass`, `Fail`, or `Edge Case`
- Take notes in `Bug Notes` column

---

### Step 2: For Each Failure, Create Bug Report

- Copy the **Bug Report Template** above
- Fill in ALL sections (especially Console Errors and Reproduction Steps)
- Save as `BUG-001.md`, `BUG-002.md`, etc.

---

### Step 3: Submit to Claude

**Option A: Copy-Paste Method**

```
Hey Claude,

I found a bug during UAT testing. Here's the detailed report:

[PASTE ENTIRE BUG REPORT HERE]

Please analyze this and provide the exact code fix for the relevant React component.
```

---

**Option B: File Upload Method** (if your interface supports it)

1. Save bug report as `BUG-001.md`
2. Upload file to Claude
3. Say: "Please analyze this bug report and provide the code fix"

---

**Option C: Structured Prompt**

```
# BUG FIX REQUEST

**Test ID**: UAT-075
**Component**: TechnicianPortal.tsx
**Issue**: Photo type dropdown not saving selection

**Console Error**:
TypeError: Cannot read properties of undefined (reading 'type')
    at TechnicianPortal.tsx:234:18

**Reproduction Steps**:
1. Access magic link as technician
2. Upload photo
3. Select "Before" from Photo Type dropdown
4. Refresh page
5. Photo shows type as "undefined" instead of "Before"

**Expected Fix**:
- Photo type should persist in state
- Should save to localStorage draft
- Should sync to Supabase on submission

Please provide the corrected code for TechnicianPortal.tsx handling photo type selection and persistence.
```

---

### Step 4: Claude Provides Fix

Claude will:
1. ✅ Analyze the error and identify root cause
2. ✅ Provide exact code changes with file path
3. ✅ Explain why the bug occurred
4. ✅ Suggest how to prevent similar bugs

---

### Step 5: Apply Fix & Retest

1. Apply the code changes Claude provided
2. Re-run the failed UAT test
3. If still failing, provide updated bug report with new error
4. Repeat until test passes ✅

---

### Step 6: Track Progress

Create a simple spreadsheet to track:

| Bug ID | Test ID | Status | Fixed By | Verified |
|--------|---------|--------|----------|----------|
| BUG-001 | UAT-075 | Fixed | Claude (2026-01-19) | ✅ |
| BUG-002 | EDGE-010 | In Progress | - | ⏳ |
| BUG-003 | UAT-120 | Fixed | Claude (2026-01-20) | ✅ |

---

## 📊 UAT COMPLETION CHECKLIST

### Before You Start

- [ ] Set up staging environment (or use production carefully)
- [ ] Create test accounts (admin, technician)
- [ ] Create test data (1 client, 1 technician, 1 job)
- [ ] Have Chrome DevTools ready
- [ ] Install screen recorder (Loom, QuickTime, OBS)

---

### During Testing

- [ ] Test on Desktop Chrome first (baseline)
- [ ] Then test on Mobile Safari (technician-critical)
- [ ] Document EVERY failure with screenshot
- [ ] Copy console errors immediately
- [ ] Note any slow performance (>3s loads)

---

### After Testing

- [ ] Count total Pass/Fail/Edge cases
- [ ] Calculate pass rate: `(Pass / Total) * 100%`
- [ ] Prioritize Critical bugs for immediate fix
- [ ] Submit all bug reports to Claude
- [ ] Retest after fixes applied

---

## 🎯 Success Criteria

**Minimum for Production Release**:
- ✅ 95%+ pass rate on JOURNEY 1-6 (core workflows)
- ✅ 85%+ pass rate on JOURNEY 7-9 (secondary features)
- ✅ 70%+ pass rate on EDGE tests
- ✅ 0 Critical bugs
- ✅ <5 High severity bugs

---

## 📝 Notes for Testers

1. **Be thorough**: Even minor bugs compound user frustration
2. **Test on real devices**: Mobile emulation ≠ actual iPhone/Android
3. **Think like a user**: Don't test as a developer (avoid workarounds)
4. **Document everything**: Future you will thank you
5. **Test edge cases**: Where 90% of bugs hide

---

**Good luck with testing! 🚀**

If you find bugs, remember: every bug you catch in UAT is a bug that won't hit real users in production.
