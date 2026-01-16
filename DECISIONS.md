# 🔒 TRUST BY DESIGN — STAKEHOLDER DECISIONS

**Date:** 2026-01-16
**Context:** Phase B Question Gate
**Status:** ALL QUESTIONS ANSWERED ✅

---

## ORIGINAL 6 CRITICAL QUESTION CATEGORIES

All answered in stakeholder response. Key decisions documented below.

### 1. Legal & Compliance ✅
- **Jurisdiction:** England & Wales
- **Positioning:** Technical evidence capture tool, NOT legal authority
- **Claims:** Tamper-evident records, NO admissibility guarantees
- **GDPR:** Compliant by design, right to erasure (except sealed under contract)

### 2. Authentication & Identity ✅
- **Provider:** Supabase Auth (managed)
- **Methods:** Email/password (required), Google OAuth (optional)
- **MFA:** Optional in beta, mandatory for admin/sealing operations
- **Identity Level:** Account-based (asserted), NOT legally verified (no KYC)

### 3. Cryptographic Sealing ✅
- **Method:** Hash-sealed + server-side trusted timestamp
- **Trigger:** Explicit user action ("Seal Evidence")
- **Immutability:** DB-level enforcement, irreversible
- **Future:** External TSA or blockchain anchoring (Phase 2)

### 4. Location Verification ✅
- **Primary:** Device GPS (browser/mobile API)
- **Accuracy:** Best-effort, metadata stored (±meters)
- **Fallback:** IP geolocation (marked "low confidence")
- **Control:** Opt-in per protocol

### 5. Business Model ✅
- **Pricing:** Freemium beta → Tiered SaaS (Free/Pro/Team/Enterprise)
- **Limits:** Records/month, storage retention, sealing operations
- **Enforcement:** Server-side hard limits from day one
- **Monetization:** Sealing operations, evidence exports

### 6. Protocol Configuration ✅
- **Definition:** Structured evidence capture template
- **Creator:** Admins only (beta), Pro users later
- **Contents:** Required inputs, validation rules, sealing requirements
- **Mutability:** Draft mode only, locked when published, versioned
- **Runtime:** Evidence must conform to protocol

---

## ADDITIONAL BLOCKING QUESTIONS (PHASE A)

### Q1: Address Geocoding Service ✅
**Decision:** Mapbox Geocoding API
**Rationale:** Free tier (100K requests/month) sufficient for beta
**Implementation:** Phase D.1 (Week 5)

### Q2: what3words API Budget ✅
**Decision:** Remove feature for beta, add to roadmap for future
**Rationale:** GPS-only verification sufficient, what3words adds $1K-5K/year cost
**Actions Taken:**
- Created `/roadmap` public route
- Created ROADMAP.md with what3words in "Future Features"
- Removed what3words mock from current implementation (pending Phase C)

### Q3: Data Retention Windows per Tier ✅
**Decision:** Confirmed suggested retention windows
- **Free:** 30 days
- **Pro:** 1 year
- **Team:** 3 years
- **Enterprise:** 7 years (configurable)
**Implementation:** Phase E.3 (Week 10)

### Q4: Stripe Integration Timeline ✅
**Decision:** Option A - Full Stripe integration in Phase E (Week 8-9)
**Rationale:** Basic billing critical for beta launch
**Scope:** Subscription creation, webhooks, basic billing (no full payment flow)

### Q5: QuickBooks Integration Priority ✅
**Decision:** Option B - Manual CSV export for beta, API integration post-beta
**Rationale:** Core trust system higher priority
**Actions Taken:**
- Added QuickBooks API to ROADMAP.md as "Future Feature"
- Phase E.2 will implement CSV export only

---

## IMPLEMENTATION IMPACT SUMMARY

### Phase C: Trust Foundation (Weeks 1-4)
**Based on:** Q1-Q6 answers
**Implementation:**
- Supabase Auth (Q2)
- Workspace isolation (Q2, Q5, Q6)
- Hash-based sealing (Q3)
- Legal disclaimers (Q1)
- MFA optional (Q2)

### Phase D: Verification & Integrity (Weeks 5-7)
**Based on:** Q1, Q4, Q6
**Implementation:**
- Mapbox GPS validation (Q1 answer)
- what3words REMOVED (Q2 answer)
- Protocol system (Q6)
- Best-effort location confidence (Q4)

### Phase E: Business Systems (Weeks 8-10)
**Based on:** Q3, Q4, Q5, Q6
**Implementation:**
- Stripe basic integration (Q4 answer)
- Data retention: 30d/1y/3y/7y (Q3 answer)
- CSV invoice export only (Q5 answer)
- Tiered limits enforcement (Q5)

---

## FEATURES DEFERRED TO POST-BETA

Based on stakeholder answers:

1. **what3words API** (Q2) — Future feature, on roadmap
2. **QuickBooks API** (Q5) — Future feature, on roadmap
3. **External TSA** (Q3) — Future hardening option
4. **Blockchain anchoring** (Q3) — Future hardening option
5. **Full payment processing** (Q4) — Post-beta enhancement
6. **KYC identity verification** (Q2) — Not planned for beta

---

## ROADMAP TRANSPARENCY

**Decision:** All planned/future features must be visible to users
**Implementation:** Created public `/roadmap` route showing:
- ✅ Completed features
- 🚧 In development (Phase C/D/E)
- 📅 Planned (timeline specified)
- 🔮 Future (not scheduled)

**Why:** Builds trust through transparency, manages expectations, shows honest development progress

---

## LEGAL POSITIONING

**Critical Decision from Q1:**
> "Platform is a technical evidence capture tool, not a legal authority"

**Implementation Requirements:**
1. Add disclaimer to all evidence views
2. Remove "Legal Admissibility: High" UI claims
3. Change "Authenticated" to "Account Verified"
4. Add "Identity Level: Account-based (not legally verified)"
5. Terms of Service state governing law (England & Wales)

**Phase:** C.5 (Week 4)

---

## NEXT STEPS

✅ All blocking questions answered
✅ Roadmap created and published
✅ Decisions documented
✅ Implementation plan updated

**READY TO BEGIN:** Phase C.1 - Real Authentication

---

**Last Updated:** 2026-01-16
**Status:** PHASE B GATE CLEARED — Ready for Implementation
