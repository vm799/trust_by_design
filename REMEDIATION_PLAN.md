# 🔒 TRUST BY DESIGN — REMEDIATION PLAN

**Status:** PHASE A COMPLETE — Ready for Phase C Implementation
**Date:** 2026-01-16
**Based On:** TRUST_SYSTEM_AUDIT.md
**Stakeholder Answers:** Received and validated

---

## PHASE B GATE — PASSED ✅

All 6 critical question categories have been answered by stakeholder. Key decisions:

### 1. Legal & Compliance
- **Jurisdiction:** England & Wales
- **Positioning:** Technical tool, NOT legal authority
- **Claims:** Tamper-evident records, NO admissibility guarantees
- **GDPR:** Compliant by design, right to erasure (except sealed records under contract)

### 2. Authentication & Identity
- **Provider:** Supabase Auth (managed)
- **Methods:** Email/password (required), Google OAuth (optional)
- **MFA:** Optional in beta, mandatory for admin/sealing operations
- **Identity Level:** Account-based (asserted), NOT legally verified (no KYC)

### 3. Cryptographic Sealing
- **Method:** Hash-sealed + server-side trusted timestamp
- **Trigger:** Explicit user action ("Seal Evidence")
- **Immutability:** DB-level enforcement, irreversible
- **Future:** External TSA or blockchain anchoring (Phase 2)

### 4. Location Verification
- **Primary:** Device GPS (browser/mobile API)
- **Accuracy:** Best-effort, metadata stored (±meters)
- **Fallback:** IP geolocation (marked "low confidence")
- **Control:** Opt-in per protocol

### 5. Business Model
- **Pricing:** Freemium beta → Tiered SaaS (Free/Pro/Team/Enterprise)
- **Limits:** Records/month, storage retention, sealing operations
- **Enforcement:** Server-side hard limits from day one
- **Monetization:** Sealing operations, evidence exports

### 6. Protocol Configuration
- **Definition:** Structured evidence capture template (what/order/conditions/constraints)
- **Creator:** Admins only (beta), Pro users later
- **Contents:** Required inputs, validation rules, sealing requirements, metadata
- **Mutability:** Draft mode only, locked when published, versioned
- **Runtime:** Evidence must conform to protocol, non-compliant records cannot seal

---

## REMEDIATION CHECKLIST

Extracted from TRUST_SYSTEM_AUDIT.md Step 1 findings. Each item mapped to implementation requirements.

### 🔴 CRITICAL — NOT IMPLEMENTED (Must Fix)

| # | Feature | Audit Finding | Required Reality | Blocking Issues | Phase |
|---|---------|---------------|------------------|-----------------|-------|
| **1** | **Authentication** | Accepts any email/password | Supabase Auth integration, real validation | NONE (answers provided) | C.1 |
| **2** | **Geometric Verification** | No GPS validation | Validate GPS against job address, radius check | Need address geocoding service | C.4 |
| **3** | **Protocol Sealing** | Status change only, NO crypto | Hash evidence bundle, sign with server key, store signature | NONE (answers provided) | C.3 |
| **4** | **Subscription Enforcement** | Hardcoded "Enterprise Protocol" | Real subscription tiers in DB, usage tracking | Stripe integration timeline? | E.1 |
| **5** | **Usage Metrics** | Hardcoded values (142, 4.2GB) | Calculate from actual data | NONE | E.1 |
| **6** | **Data Retention** | No automated deletion | GDPR-compliant retention policies, scheduled deletion | Retention windows per tier? | E.3 |
| **7** | **Audit Trail** | NO audit trail | Append-only audit_logs table, track all access | NONE (answers provided) | C.4 |
| **8** | **what3words** | Random word generator | Real what3words API integration OR remove feature | API budget approval? | D.2 |
| **9** | **UI Trust Claims** | 9 false claims identified | Remove or enforce all trust claims | NONE | C.6 |

### 🟡 PARTIAL — NEEDS COMPLETION

| # | Feature | Audit Finding | Required Reality | Blocking Issues | Phase |
|---|---------|---------------|------------------|-----------------|-------|
| **10** | **On-site Verification** | GPS real, what3words fake | Keep GPS, fix what3words (see #8) | NONE | D.2 |
| **11** | **Evidence Storage** | Works but not encrypted/immutable | Encrypt at rest, hash on capture, immutable after seal | NONE | D.3 |
| **12** | **Digital Signatures** | Ink capture only | Bind signature to account ID + job, verify identity | NONE | D.4 |
| **13** | **Invoicing** | CRUD only, no payment | QuickBooks API OR mark as "future feature" | Integration priority? | E.2 |
| **14** | **Safety Checklist** | Captured but not enforced | Block submission if required items unchecked | NONE | D.5 |
| **15** | **Job Templates** | Empty defaultTasks | Implement Protocol system per stakeholder spec | NONE (answers provided) | D.6 |
| **16** | **Supabase Integration** | RLS policies completely open | Workspace isolation, user-scoped RLS | NONE (answers provided) | C.2 |

### ✅ IMPLEMENTED — NO CHANGES

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| **17** | Offline Photo Storage | ✅ Works | IndexedDB implementation solid |
| **18** | GPS Capture | ✅ Works | Browser Geolocation API |
| **19** | Canvas Signature | ✅ Works | HTML5 Canvas, needs binding to identity |
| **20** | Sync Queue | ✅ Works | Exponential backoff implemented |
| **21** | Job CRUD | ✅ Works | localStorage, needs migration to DB |
| **22** | Photo Upload | ✅ Works | Supabase Storage integration |

---

## BLOCKING QUESTIONS (RESOLVED)

All questions from audit STEP 5 have been answered. Additional questions identified:

### NEW BLOCKING QUESTIONS

**Q1:** Address geocoding service for GPS validation (#2)?
**Options:** Google Maps Geocoding API, Mapbox, OpenStreetMap Nominatim
**Recommendation:** Mapbox (free tier: 100K requests/month)

**Q2:** what3words API budget (#8)?
**Cost:** $1,000-5,000/year
**Decision Required:** Integrate API OR remove feature entirely?
**Recommendation:** Remove for beta, add in Phase 2 if budget available

**Q3:** Retention windows per subscription tier (#6)?
**Suggestion:**
- Free: 30 days
- Pro: 1 year
- Team: 3 years
- Enterprise: 7 years (configurable)

**Q4:** Stripe integration timeline (#4)?
**Recommendation:** Phase E (after core trust system works)

**Q5:** QuickBooks integration priority (#13)?
**Recommendation:** Mark as "future feature", manual invoice export for beta

---

## PHASE C: TRUST FOUNDATION BUILD ORDER

Implementation must follow this exact order. No parallelization until explicitly noted.

### C.1 — Authentication (Week 1-2)

**Closes Audit Finding:** #1 (Authentication)

**Tasks:**
1. ✅ Enable Supabase Auth in dashboard
2. ✅ Create users table with workspace_id, role, identity_level
3. ✅ Replace AuthView.tsx mock with real auth flow
4. ✅ Implement session management
5. ✅ Add logout functionality
6. ✅ Add Google OAuth (optional)
7. ✅ Add MFA for admin/sealing operations (optional in beta)

**Evidence of Completion:**
- File: `lib/supabase.ts` - Real auth client configured
- File: `views/AuthView.tsx` - Calls `supabase.auth.signInWithPassword()`
- File: `supabase/schema.sql` - users table with RLS
- Test: Cannot access `/admin` without valid session

**Cannot Be Bypassed Because:**
- Session token validated server-side by Supabase
- RLS policies check `auth.uid()`
- localStorage alone cannot grant access

---

### C.2 — Authorization (Week 2-3)

**Closes Audit Finding:** #16 (Supabase RLS)

**Tasks:**
1. ✅ Add workspace_id to all tables
2. ✅ Implement RLS policies:
   - Users can only access own workspace data
   - Technicians can only access assigned jobs
   - Clients can only access own jobs
3. ✅ Create workspaces table
4. ✅ Migrate existing data to workspace model
5. ✅ Implement tokenized magic links:
   - Generate UUID token on job creation
   - Store in job_access_tokens table
   - Validate token before granting access
   - Expire tokens after 7 days or job seal

**Evidence of Completion:**
- File: `supabase/schema.sql` - RLS policies with `workspace_id` checks
- File: `supabase/schema.sql` - job_access_tokens table
- File: `lib/magicLinks.ts` - Token generation and validation
- Test: User A cannot query User B's jobs via SQL
- Test: Expired/invalid token returns 403

**Cannot Be Bypassed Because:**
- RLS enforced at PostgreSQL level
- Supabase client cannot override RLS
- Magic link tokens validated against database

---

### C.3 — Cryptographic Sealing (Week 3-4)

**Closes Audit Finding:** #3 (Protocol Sealing)

**Tasks:**
1. ✅ Create sealing service (Supabase Edge Function)
2. ✅ Implement deterministic hash:
   - Serialize evidence bundle (job + photos + signature + metadata)
   - SHA-256 hash of canonical JSON
3. ✅ Implement server-side signature:
   - Generate RSA-2048 key pair (stored in Supabase Vault)
   - Sign hash with private key
   - Store signature in evidence_seals table
4. ✅ Add server-trusted timestamp (UTC)
5. ✅ Add database constraints:
   - sealed_at NOT NULL = immutable
   - Trigger to reject updates on sealed records
6. ✅ Implement verification endpoint:
   - Recalculate hash from evidence
   - Verify signature with public key
   - Return tamper status

**Evidence of Completion:**
- File: `supabase/functions/seal-evidence/index.ts` - Sealing logic
- File: `supabase/schema.sql` - evidence_seals table
- File: `supabase/schema.sql` - UPDATE trigger rejecting sealed record changes
- File: `lib/verifyEvidence.ts` - Client-side verification
- Test: Sealed job cannot be modified via UI or SQL
- Test: Tampered evidence detected on verification

**Cannot Be Bypassed Because:**
- Sealing happens server-side (Edge Function)
- Private key never exposed to client
- Database trigger prevents updates
- Hash verification detects any tampering

---

### C.4 — Audit Trail (Week 4)

**Closes Audit Finding:** #7 (Audit Trail)

**Tasks:**
1. ✅ Create audit_logs table (append-only)
2. ✅ Log all evidence access:
   - Job view (who, when, IP, user_agent)
   - Photo view
   - Report export
   - Evidence seal
3. ✅ Implement middleware to auto-log access
4. ✅ Add RLS policy: users can only read own workspace audit logs
5. ✅ Create audit trail viewer (admin only)

**Evidence of Completion:**
- File: `supabase/schema.sql` - audit_logs table with RLS
- File: `supabase/functions/middleware.ts` - Auto-logging
- File: `views/AuditTrailView.tsx` - Audit viewer
- Test: Job view creates audit log entry
- Test: Audit log cannot be deleted

**Cannot Be Bypassed Because:**
- Logs created server-side via middleware
- Table has no DELETE permission
- RLS prevents cross-workspace access

---

### C.5 — Remove False UI Claims (Week 4)

**Closes Audit Finding:** #9 (UI Trust Claims)

**Tasks:**
1. ✅ Remove or justify each false claim from audit:
   - "Cryptographic Seal" → Keep AFTER C.3 implemented
   - "Geo-metadata verified" → Remove OR add verification logic
   - "Identity Authenticated via Hub" → Change to "Account Verified"
   - "Legal Admissibility: High" → Remove entirely
   - "Chain of Custody" → Keep AFTER C.4 implemented
   - "OPERATIONAL" billing → Remove until subscriptions work
   - Usage metrics → Calculate from real data
   - "Verified" photo badges → Remove OR clarify what was verified
2. ✅ Add legal disclaimers per stakeholder requirement:
   - "This is a technical evidence tool, not legal authority"
   - "No guarantee of court admissibility"
3. ✅ Add identity level metadata:
   - "Account-based identity (not legally verified)"

**Evidence of Completion:**
- File: `views/JobReport.tsx` - Updated trust claims
- File: `components/LegalDisclaimer.tsx` - Disclaimer component
- Manual review: No claim exists without backend enforcement

**Cannot Be Bypassed Because:**
- This is UI cleanup, enforcement is in C.1-C.4

---

## PHASE D: VERIFICATION & INTEGRITY (Week 5-7)

Can start after Phase C is complete. Some tasks can run in parallel.

### D.1 — GPS Validation (Week 5)

**Closes Audit Finding:** #2 (Geometric Verification)

**Tasks:**
1. ✅ Integrate Mapbox Geocoding API
2. ✅ On evidence capture:
   - Geocode job address to lat/lng
   - Calculate distance from device GPS
   - Store distance_from_site_meters
3. ✅ Add validation threshold (configurable per protocol):
   - Default: 100 meters
   - Mark as "verified" if within threshold
   - Mark as "low confidence" if outside
4. ✅ Update UI to show verification status

**Evidence of Completion:**
- File: `lib/locationVerification.ts` - Validation logic
- File: `supabase/functions/validate-location/index.ts` - Server-side check
- Test: GPS 50m from site = verified
- Test: GPS 200m from site = low confidence

**Cannot Be Bypassed Because:**
- Validation runs server-side
- Client cannot fake distance calculation
- Original GPS + distance both stored

---

### D.2 — what3words Decision (Week 5)

**Closes Audit Finding:** #8, #10 (what3words)

**Decision Point:** Budget approved for API?

**Option A:** API Approved
1. ✅ Integrate what3words API
2. ✅ Validate w3w address against GPS
3. ✅ Store both for dual-verification

**Option B:** API Not Approved (RECOMMENDED FOR BETA)
1. ✅ Remove what3words feature entirely
2. ✅ Update UI to remove w3w references
3. ✅ Keep GPS-only verification

**Evidence of Completion:**
- Option A: Real API calls in `lib/what3words.ts`
- Option B: No w3w references in codebase

---

### D.3 — Evidence Integrity (Week 6)

**Closes Audit Finding:** #11 (Evidence Storage)

**Tasks:**
1. ✅ Hash photos on capture (SHA-256)
2. ✅ Store hash in photos table
3. ✅ Verify hash on display
4. ✅ Encrypt photos at rest in Supabase Storage:
   - Enable storage encryption in Supabase dashboard
5. ✅ Add tamper detection to report view:
   - Show "verified" only if hash matches
   - Show "tampered" if hash mismatch

**Evidence of Completion:**
- File: `lib/photoIntegrity.ts` - Hashing logic
- File: `views/TechnicianPortal.tsx` - Hash on capture
- File: `views/JobReport.tsx` - Verify on display
- Test: Modified photo shows "tampered" status

**Cannot Be Bypassed Because:**
- Hash calculated client-side AND verified server-side on seal
- Supabase Storage encryption is platform-level
- Hash mismatch prevents sealing

---

### D.4 — Signature Binding (Week 6)

**Closes Audit Finding:** #12 (Digital Signatures)

**Tasks:**
1. ✅ Bind signature to account:
   - Store signer_user_id (from auth.uid())
   - Store signer_name (from user profile)
   - Store signer_email
2. ✅ Verify signer is authorized:
   - Check technician is assigned to job
   - Check user has not been removed from workspace
3. ✅ Include signature in seal hash
4. ✅ Update UI to show:
   - "Signed by [name] ([email])"
   - "Account-based identity (not legally verified)"

**Evidence of Completion:**
- File: `supabase/schema.sql` - signatures table with user_id
- File: `views/TechnicianPortal.tsx` - Capture with identity binding
- Test: Cannot sign if not assigned technician

**Cannot Be Bypassed Because:**
- Signature includes auth.uid() from session
- Assignment validated in RLS policy

---

### D.5 — Safety Checklist Enforcement (Week 7)

**Closes Audit Finding:** #14 (Safety Checklist)

**Tasks:**
1. ✅ Add protocol-level validation rules
2. ✅ Block seal if required items unchecked
3. ✅ Show clear error message
4. ✅ Log which items were skipped in audit trail

**Evidence of Completion:**
- File: `lib/protocolValidation.ts` - Validation logic
- File: `views/TechnicianPortal.tsx` - UI enforcement
- Test: Cannot seal with unchecked required items

**Cannot Be Bypassed Because:**
- Validation runs server-side in seal endpoint
- Seal will fail if validation fails

---

### D.6 — Protocol System (Week 7)

**Closes Audit Finding:** #15 (Job Templates)

**Tasks:**
1. ✅ Create protocols table per stakeholder spec:
   - id, workspace_id, name, description
   - required_inputs (JSONB: photos, text, video, location)
   - validation_rules (JSONB: min_photos, gps_required, etc.)
   - sealing_requirements (JSONB)
   - status (draft/published)
   - version
2. ✅ Create protocol builder UI (admin only)
3. ✅ Link jobs to protocol_id + protocol_version
4. ✅ Enforce protocol requirements at runtime
5. ✅ Block seal if evidence doesn't conform to protocol

**Evidence of Completion:**
- File: `supabase/schema.sql` - protocols table
- File: `views/ProtocolBuilder.tsx` - Protocol creation UI
- File: `lib/protocolValidation.ts` - Runtime enforcement
- Test: Cannot seal job missing required protocol inputs

**Cannot Be Bypassed Because:**
- Protocol requirements validated server-side
- Evidence bundle includes protocol_version for auditability

---

## PHASE E: BUSINESS SYSTEMS (Week 8-10)

Can start after Phase D. Lower priority than trust foundation.

### E.1 — Subscription & Usage Tracking (Week 8-9)

**Closes Audit Finding:** #4, #5 (Subscription, Usage Metrics)

**Tasks:**
1. ✅ Create subscriptions table:
   - workspace_id, tier, status, limits (JSONB)
2. ✅ Create usage_metrics table:
   - Records actual counts (sealed_jobs, storage_bytes)
3. ✅ Implement usage tracking:
   - Increment on seal operation
   - Calculate storage from Supabase Storage API
4. ✅ Implement hard limits:
   - Block seal if tier limit reached
   - Show upgrade prompt
5. ✅ Integrate Stripe (basic):
   - Subscription creation
   - Webhook for status updates
   - No full payment flow in beta

**Evidence of Completion:**
- File: `supabase/schema.sql` - subscriptions, usage_metrics tables
- File: `lib/usageTracking.ts` - Real calculations
- File: `views/BillingView.tsx` - Display real data
- Test: Free tier blocked at limit
- Test: Usage metrics match reality

**Cannot Be Bypassed Because:**
- Limits enforced in seal endpoint
- Usage calculated server-side from actual data

---

### E.2 — Invoicing Decision (Week 9)

**Closes Audit Finding:** #13 (Invoicing)

**Decision Point:** QuickBooks integration priority?

**Option A:** Integrate QuickBooks API
1. ✅ OAuth flow
2. ✅ Create invoice in QuickBooks on job seal
3. ✅ Sync payment status

**Option B:** Manual Export (RECOMMENDED FOR BETA)
1. ✅ Generate CSV export of invoices
2. ✅ Manual import to QuickBooks
3. ✅ Mark as "future feature" in roadmap

**Evidence of Completion:**
- Option A: QuickBooks API integration
- Option B: CSV export button

---

### E.3 — Data Retention (Week 10)

**Closes Audit Finding:** #6 (Data Retention)

**Tasks:**
1. ✅ Define retention windows per tier (see blocking questions)
2. ✅ Add retention_until column to jobs table
3. ✅ Create scheduled job (pg_cron):
   - Mark expired records
   - Archive to cold storage OR delete
4. ✅ Implement GDPR right to erasure:
   - User can request deletion
   - Sealed records under contract are NOT deleted
   - Warn user before deletion
5. ✅ Implement data export (GDPR Article 15)

**Evidence of Completion:**
- File: `supabase/migrations/retention_policy.sql` - Scheduled deletion
- File: `lib/gdpr.ts` - Data export and deletion
- Test: Expired job deleted after retention window
- Test: Cannot delete sealed job under contract

**Cannot Be Bypassed Because:**
- Deletion runs server-side via pg_cron
- Sealed records protected by database constraint

---

## CONTINUOUS RE-AUDIT CHECKPOINTS

After each phase, run this audit checklist:

### Checkpoint C (After Week 4)
- ✅ Authentication: Real Supabase Auth, no mock?
- ✅ Authorization: RLS policies enforced?
- ✅ Cryptographic Sealing: Hash + signature + timestamp?
- ✅ Audit Trail: All access logged?
- ✅ UI Claims: Removed or enforced?

### Checkpoint D (After Week 7)
- ✅ GPS Validation: Distance calculated and stored?
- ✅ Evidence Integrity: Photos hashed and verified?
- ✅ Signature Binding: Linked to account ID?
- ✅ Safety Enforcement: Required items checked?
- ✅ Protocol System: Runtime enforcement?

### Checkpoint E (After Week 10)
- ✅ Subscription: Real limits enforced?
- ✅ Usage Metrics: Calculated from actual data?
- ✅ Invoicing: Integrated OR marked as future?
- ✅ Data Retention: GDPR compliant?

---

## FAILURE CONDITIONS CHECKLIST

After final implementation, verify NONE of these are true:

- ❌ A trust claim exists without backend enforcement
- ❌ A "verified" label can be faked client-side
- ❌ A sealed job can be modified post-seal
- ❌ A user can access data without authorization
- ❌ Usage metrics are hardcoded
- ❌ Authentication accepts any credentials
- ❌ RLS policies use `USING (true)`
- ❌ Cryptographic seal is just a status change
- ❌ what3words is randomly generated
- ❌ Audit trail does not exist

---

## NEXT STEPS

1. **Stakeholder:** Approve this plan
2. **Stakeholder:** Answer NEW blocking questions (Q1-Q5)
3. **Engineer:** Begin Phase C.1 (Authentication)
4. **Engineer:** Checkpoint after each phase
5. **Engineer:** Produce TRUST_SYSTEM_AUDIT_FINAL.md after Phase E

---

**PLAN STATUS:** READY FOR IMPLEMENTATION
**ESTIMATED TIMELINE:** 10 weeks
**BLOCKING QUESTIONS:** 5 (see above)
