# Phase C.5 — Remove False UI Claims

**Status:** IN PROGRESS
**Started:** 2026-01-17
**Phase:** Trust Foundation - UI Claim Cleanup
**Closes Audit Finding:** #9 (UI Trust Claims)
**Depends On:** Phase C.1-C.4 ✅

---

## OVERVIEW

Phase C.5 removes all false trust claims from the UI. Per stakeholder requirements, the UI must not claim features that aren't actually implemented with backend enforcement.

**Principle:** No claim without enforcement.

---

## FALSE CLAIMS TO FIX (from TRUST_SYSTEM_AUDIT.md)

### 1. ✅ "Cryptographic Seal"
- **Status:** Keep (implemented in Phase C.3)
- **Evidence:** Real SHA-256 hash + signature

### 2. ❌ "Geo-metadata verified"
- **File:** `views/JobReport.tsx:164`
- **Issue:** No GPS validation against job address
- **Fix:** Remove OR change to "Geo-metadata captured" (no verification claim)
- **Phase D.1 will add:** Real GPS validation with distance calculation

### 3. ❌ "Identity Authenticated via Hub"
- **File:** `views/JobReport.tsx:168`
- **Issue:** Implies legal identity verification (we don't have KYC)
- **Fix:** Change to "Account Verified (Email)"
- **Add note:** "Account-based identity, not legally verified"

### 4. ❌ "Legal Admissibility: High"
- **Search for:** "Legal Admissibility", "Court Admissibility"
- **Issue:** Cannot guarantee court admissibility
- **Fix:** Remove entirely
- **Add disclaimer:** "This is a technical evidence tool, not legal authority"

### 5. ✅ "Chain of Custody"
- **Status:** Keep (audit trail implemented in Phase C.4)
- **Evidence:** audit_logs table with all access logged

### 6. ❌ "OPERATIONAL" Billing Status
- **File:** `views/BillingView.tsx`
- **Issue:** Hardcoded, subscriptions not implemented
- **Fix:** Change to "Free Beta" until Phase E.1

### 7. ❌ Hardcoded Usage Metrics
- **File:** `views/BillingView.tsx` (142, 4.2GB)
- **Issue:** Not calculated from real data
- **Fix:** Show "N/A" or calculate from database

### 8. ❌ "Verified" Photo Badges
- **Search for:** photo.verified
- **Issue:** What does "verified" mean? (No validation implemented)
- **Fix:** Remove OR clarify "GPS captured" (not verified)

### 9. ❌ Missing Legal Disclaimers
- **Required by stakeholder:** Legal disclaimer on reports
- **Content:**
  - "This is a technical evidence tool, not legal authority"
  - "No guarantee of court admissibility"
  - "Account-based identity (not legally verified)"

---

## TASKS

### Task 1: Audit All UI Claims

**Action:** Search codebase for trust claims

```bash
grep -r "verified" views/
grep -r "authenticated" views/
grep -r "legal" views/
grep -r "admissibility" views/
grep -r "OPERATIONAL" views/
```

**Create list:** All false claims with file:line

---

### Task 2: Fix Geo-Metadata Claims

**File:** `views/JobReport.tsx:164`

**Before:**
```tsx
<p className="text-[10px] text-slate-600 font-bold uppercase tracking-tight">
  Geo-metadata verified on-site
</p>
```

**After:**
```tsx
<p className="text-[10px] text-slate-600 font-bold uppercase tracking-tight">
  Geo-metadata captured on-site
</p>
<p className="text-[8px] text-slate-500 italic">
  (GPS coordinates recorded, not verified against address)
</p>
```

---

### Task 3: Fix Identity Claims

**File:** `views/JobReport.tsx:168`

**Before:**
```tsx
<p className="text-[10px] text-slate-600 font-bold uppercase tracking-tight">
  Identity Authenticated via Hub
</p>
```

**After:**
```tsx
<p className="text-[10px] text-slate-600 font-bold uppercase tracking-tight">
  Account Verified (Email)
</p>
<p className="text-[8px] text-slate-500 italic">
  (Account-based identity, not legally verified)
</p>
```

---

### Task 4: Add Legal Disclaimer Component

**File:** `components/LegalDisclaimer.tsx` (NEW)

```tsx
const LegalDisclaimer: React.FC = () => {
  return (
    <div className="bg-slate-50 border-l-4 border-slate-300 p-4 rounded-lg">
      <div className="flex items-start gap-3">
        <span className="material-symbols-outlined text-slate-400 text-lg">info</span>
        <div className="text-[10px] text-slate-600 space-y-1">
          <p className="font-bold uppercase tracking-wide">Legal Notice</p>
          <p>This is a technical evidence capture tool, not legal authority.</p>
          <p>No guarantee of court admissibility. Consult legal counsel for admissibility requirements.</p>
          <p>Identity verification is account-based (email), not legally verified (no KYC).</p>
        </div>
      </div>
    </div>
  );
};
```

**Add to:** `views/JobReport.tsx` at bottom

---

### Task 5: Fix Billing View

**File:** `views/BillingView.tsx`

**Changes:**
```tsx
// Before: status: "OPERATIONAL"
// After: status: "Free Beta"

// Before: usage: "142 sealed records"
// After: Calculate from database OR "N/A - Beta"

// Before: storage: "4.2GB"
// After: Calculate from Supabase Storage OR "N/A - Beta"
```

---

### Task 6: Remove/Clarify Photo Verification

**Search:** `photo.verified`

**Options:**
1. Remove "verified" badge entirely
2. Change to "GPS captured" (not verified)

**Decision:** Remove verification badge until Phase D.1 (GPS validation)

---

### Task 7: Update AuthView with Disclaimer

**File:** `views/AuthView.tsx`

**Add at bottom of form:**
```tsx
<p className="text-[9px] text-slate-500 text-center italic">
  By signing up, you acknowledge this is a technical tool for evidence capture,
  not legal authority. No guarantee of court admissibility.
</p>
```

---

## EVIDENCE OF COMPLETION

### ✅ Evidence 1: No False Claims
- Search codebase for "verified", "authenticated", "legal"
- All claims have backend enforcement OR are removed

### ✅ Evidence 2: Legal Disclaimers Added
- JobReport has LegalDisclaimer component
- AuthView has disclaimer text

### ✅ Evidence 3: Geo Claims Fixed
- "verified" → "captured"
- Note added: "not verified against address"

### ✅ Evidence 4: Identity Claims Fixed
- "Authenticated" → "Account Verified (Email)"
- Note added: "not legally verified"

---

## CANNOT BE BYPASSED BECAUSE

This is UI cleanup, enforcement is in Phases C.1-C.4:
- ✅ Authentication (C.1)
- ✅ Authorization (C.2)
- ✅ Cryptographic Sealing (C.3)
- ✅ Audit Trail (C.4)

---

## FILES TO MODIFY

| File | Changes |
|------|---------|
| `views/JobReport.tsx` | Fix geo/identity claims, add disclaimer |
| `views/BillingView.tsx` | Fix status and usage metrics |
| `views/AuthView.tsx` | Add legal disclaimer |
| `components/LegalDisclaimer.tsx` | Create component |

---

**Phase C.5 Status:** 0% (0/7 tasks)
**Estimated Time:** 2-3 hours
