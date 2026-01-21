# RLS and Trigger Implementation Plan

## Goal
Secure the database by enabling Row-Level Security (RLS) and enforcing business rules via Triggers, as defined in `DATABASE_BLUEPRINT.md`.

## User Choices
*   **Enforcement Method:** Option A (Triggers) - preferred for minimal client-side breakage.
*   **Scope:** Full RLS on all critical tables.
*   **Schema for Helpers:** `auth` schema (standard practice for Supabase helpers).

## Phase 1: Helper Functions
We will create `auth.workspace_id()`, `auth.is_manager()`, and `auth.technician_link()` to simplify policy logic.

## Phase 2: RLS Policies
We will enable RLS and add policies for:
*   `jobs`, `photos`, `clients`, `technicians`, `evidence_seals`
*   **Pattern:**
    *   Manager: Full Access (via `workspace_id`)
    *   Technician: Read Assigned, Update Status (via Trigger)
    *   Client: Read Own

## Phase 3: Triggers (Business Logic)
1.  **`enforce_technician_updates`**: Technicians can only update `status`, `sync_status`, `notes`.
2.  **`immutable_seals`**: Sealed jobs cannot be modified.
3.  **`immutable_photos`**: Photos cannot be deleted/modified after sync (unless Manager).

## Phase 4: Verification
*   We will generate a separate validation script `tests/verify_rls.sql` to simulate roles.

## Artifacts to Generate
1.  `supabase/migrations/001_initial_rls.sql` (The concrete SQL deliverable)
2.  `tests/verify_rls.sql` (Verification script)
