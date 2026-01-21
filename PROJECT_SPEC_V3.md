# PROJECT SPECIFICATION V3: Single Source of Truth
**Version:** 3.0
**Last Updated:** 2026-01-20
**Mandate:** This document represents the definitive technical architecture, build specification, and quality assurance standards for the JobProof project. All future development must align with this single source of truth.

---

# PART 1: CORE build SPECIFICATION (Architecture & MLP Flow)

## 1. Executive Summary
**JobProof v2** is a professional-grade evidence documentation platform for field service companies. It solves the $50k-500k/year problem of disputed work claims and insurance rejections by providing **cryptographically sealed, timestamped, and geolocated photo evidence**.

**Core Value Proposition:**
- **Zero-Install (Magic Links):** Technicians access jobs via SMS/Email link. No app store download.
- **Offline-First:** Works in basements, tunnels, and rural areas using IndexedDB + Background Sync.
- **Immutable Evidence:** Cryptographic sealing of all data points (GPS + Photos + Time).
- **Dual-Signal Location:** GPS + what3words for verifiable proof of presence.

---

## 2. Technical Architecture

### 2.1 Technology Stack
| Layer | Technology | Justification |
|-------|------------|---------------|
| **Frontend** | React + TypeScript + Vite | Type safety, rapid dev, 10M+ dev pool. |
| **Styling** | Tailwind CSS | Utility-first, ensures consistent design system. |
| **Local Storage** | IndexedDB (Dexie.js) | Stores 100MB+ of photos offline (vs 5MB localStorage). |
| **Backend** | Supabase (PostgreSQL) | Relational integrity, RLS security, instant API. |
| **Storage** | Supabase Storage (S3) | Scalable photo storage with signed URLs. |
| **Edge Logic** | Supabase Edge Functions | Server-side cryptographic signing and verification. |

### 2.2 Data Flow Architecture
1.  **Job Creation (Admin):** Admin creates job -> `jobs` table -> Magic Link generated.
2.  **Access (Technician):** Magic link opens app -> Authenticates via Job ID.
3.  **Capture (Offline/Online):**
    *   Photos -> `IndexedDB` (immediately).
    *   GPS -> captured via Browser API.
    *   Status -> Local update.
4.  **Sync (Background):**
    *   `syncQueue` checks connectivity.
    *   Uploads photos to Storage.
    *   Syncs metadata to DB.
5.  **Sealing (Server-Side):**
    *   Upon submission -> Edge Function (`seal-evidence`) triggered.
    *   Calculates hash of (Photos + GPS + Metadata).
    *   Signs hash with RSA-2048 Private Key.
    *   Stores `seal` record.

---

## 3. MLP (Minimum Lovable Product) Flows

### Flow A: The "Happy Path" (Admin -> Tech -> Client)
1.  **Dispatch:** Admin creates "AC Repair @ 123 Main St". System sends SMS with magic link.
2.  **Arrival:** Technician clicks link. App captures "Arrival GPS" & "Start Time".
3.  **Work:** Technician captures "Before" photo (saved locally). Performs repair. Captures "After" photo.
4.  **Sign-off:** Client signs on-screen. Technician hits "Submit".
5.  **Seal:** App uploads all data. Server seals the job. Admin gets "Completed" notification.
6.  **Invoice:** Admin clicks "Generate Invoice". PDF report attached. Sent to client.

### Flow B: The "Offline" Path
1.  **Entry:** Technician opens link while online (or cached).
2.  **Loss of Signal:** Enters basement. 4G drops.
3.  **Work:** Captures 10 high-res photos. All saved to IndexedDB.
4.  **Submission:** hits "Submit". App says "Saved Offline. Will sync when online."
5.  **Recovery:** Technician drives away. Signal returns. App auto-syncs in background.

---

# PART 2: QUALITY ASSURANCE MANDATE (Audit & Hardening)

## 1. Audit Philosophy
**"The Application must be a Trust System, not a UI Mockup."**
Previous audits revealed extensive "UI-only" features. This mandate requires **backend enforcement** for every trust claim.

## 2. Hardening Requirements (The "Must-Fix" List)

### 2.1 Cryptographic Sealing (CRITICAL)
*   **Old State:** "Cryptographic Seal" badge was just a CSS element.
*   **Mandate:**
    *   Every completed job MUST trigger the `seal-evidence` Edge Function.
    *   Use **RSA-2048** (or higher) for signing.
    *   Store the **Signature** and **Public Key** link in the database.
    *   UI must purely reflect the *database state* of the seal, not a hardcoded status.

### 2.2 Verification (CRITICAL)
*   **Old State:** "Verified" checks were hardcoded `true`.
*   **Mandate:**
    *   The `verify-evidence` function must accept a Job ID.
    *   It must re-calculate the hash of stored data.
    *   It must verify the stored signature against the public key.
    *   UI displays "Verified" ONLY if this check passes returns `true`.

### 2.3 Authentication & Authorization
*   **Old State:** `localStorage` flags, no real RLS.
*   **Mandate:**
    *   **Admin:** Must use Supabase Auth (Email/Password).
    *   **Technician:** Magic Links must use signed tokens or restrictive RLS policies (only access specific Job ID).
    *   **RLS:** "Deny All" by default. Whitelist access via Policies.

### 2.4 Data Integrity
*   **Old State:** GPS/Timestamp relied on client-side data.
*   **Mandate:**
    *   Server-side timestamps (`transaction_time`) are the source of truth for "When".
    *   Client-side GPS (`latitude`, `longitude`) must be stored alongside `accuracy` radius.

## 3. Scoring Rubric for Production Readiness

| Component | 0 - FAILED | 1 - UI ONLY | 2 - PARTIAL | 3 - PRODUCTION READY |
|-----------|------------|-------------|-------------|----------------------|
| **Auth** | No login | Fake login | Client-side only check | Supabase Auth + RLS Enforced |
| **Sealing**| None | CSS Badge | HMAC (Shared Secret) | RSA-2048 + Key Rotation |
| **Offline**| Crashes | Fails silently | Queues but flaky | IndexedDB + Reliable Background Sync |
| **Tests** | None | Manual only | Unit Tests | Unit + E2E (Playwright) Suite |

**Current GOAL:** Achieve Level 3 in **Auth**, **Sealing**, and **Offline** categories.

---

## 4. Decomissioned/Legacy Items
*   *Mock Auth* (removed in v2)
*   *Fake Metrics* (Billing view hardcoded numbers must be connected to real counts or removed)
*   *Placeholder what3words* (Must use real API or be removed if cost-prohibitive)

