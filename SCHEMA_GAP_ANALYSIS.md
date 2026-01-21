# Database Schema Gap Analysis & Recommendations

This document compares the `DATABASE_BLUEPRINT.md` (derived from `PROJECT_SPEC_V3.md`) against the existing Supabase schema audit.

## Executive Summary
The existing Supabase schema is **highly advanced** and already aligns with 90% of the `PROJECT_SPEC_V3.md` intent, surpassing the initial "MLP" assumptions in some areas (e.g., Multi-tenancy/Workspaces).

**Key Conclusion:** Do **NOT** delete the existing schema. Instead, **refine** the `DATABASE_BLUEPRINT` to map the Spec requirements to the existing tables, and focus heavily on implementing the missing **RLS Policies** which are currently non-existent.

---

## 1. Entity Reconciliation

| Entity (Spec) | Existing Table | Status | Recommendation |
| :--- | :--- | :--- | :--- |
| **Contractor** | `technicians` | **Match** | **Use `technicians`.** The V3 Spec uses the term "Technician" repeatedly. The generic "Contractor" prompt instruction was likely a loose label. The existing table `technicians` is correct and fully populated. |
| **Proof Photos** | `photos` | **Match** | **Use `photos`.** Existing table includes `lat`, `lng`, `w3w`, `verified`, and `sync_status`. |
| **Sealing** | `evidence_seals` | **Advanced** | **Use `evidence_seals`.** The existing schema normalizes seals into a separate table linked to jobs. This is superior to putting fields directly on `jobs` as it allows for seal history or re-sealing. |
| **Sync/Offline** | `sync_status` | **Match** | **Use existing Enums.** Both `jobs` and `photos` have `sync_status` (USER-DEFINED type). This is a robust implementation of the Offline-First requirement. |
| **Multi-tenancy** | `workspaces` | **Advanced** | **Keep `workspaces`.** The existing schema is built for SaaS (Multi-tenant) with `workspace_id`. The Blueprint assumed a simpler single-agency model. The `workspaces` model is production-ready. |

---

## 2. Critical Gaps (Must Fix)

### A. Row-Level Security (RLS) - **CRITICAL FAILURE**
*   **Current State:** Audit confirms **0 RLS Policies** in public schema. "Deny All" is effectively NOT implemented or everything is public.
*   **Requirement:** V3 Spec demands strict RLS.
*   **Action:** We must write specific RLS policies for `technicians`, `jobs`, `photos`, `clients`, and `evidence_seals` enforcing `workspace_id` isolation vs `auth.uid()`.

### B. Missing Field Alignment
While most fields exist, strict verifications are needed:
1.  **`jobs.local_id`**: The existing schema has `onboarding_steps` and `job_access_tokens` but explicit "local temporary IDs" for offline creation aren't clear in `jobs`.
    *   *Advisory:* Check if `id` is being generated client-side (UUID v4) before sync. If so, `id` *is* the `local_id` and no separate column is needed.

2.  **`clients.signature`**: The Blueprint asked for `invoices` with signatures.
    *   *Observation:* Existing schema has `jobs.signature_url`, `jobs.signer_name`. It seems the "Invoice" acceptance happens at the *Job* level in the current build.
    *   *Recommendation:* Verify if a separate `invoices` table is strictly required by V3 or if signing the `job` (work order) is sufficient for the MLP. If strict V3 adherence is needed, create `invoices`.

---

## 3. Revised Implementation Plan

1.  **Update Blueprint:** Rename `contractors` -> `technicians`, `proof_photos` -> `photos`.
2.  **Adopt Workspace Model:** Update RLS definitions to check `workspace_id`.
3.  **Preserve `evidence_seals`:** Update Blueprint to recognize this table as the sealing source of truth.
4.  **Execute RLS:** The primary work is now generating the SQL to enable RLS and add policies.

## 4. Immediate Advice to User
*   **Do not drop tables.** The current structure is structurally sound and supports the V3 spec.
*   **Rename "Contractor" in mental model to "Technician"** to align with Code + Spec.
*   **Focus 100% on RLS.** The application is currently insecure.
