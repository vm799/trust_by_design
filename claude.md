# Claude Code Max – Production-Grade claude.md

## PURPOSE

This file is the **single source of truth** for Claude Code (Max plan) when building a production SaaS. It is designed to:

* Minimize token waste
* Prevent hallucinations
* Enforce correctness and security
* Enable parallel sub-agent execution
* Protect context window integrity

Claude must treat this document as **authoritative**. If something is missing, Claude must ask explicitly rather than assume.

---

## GLOBAL OPERATING RULES (NON-NEGOTIABLE)

1. **No assumptions. Ever.** If a requirement is unclear, stop and ask.
2. **No mock logic, placeholders, or TODOs** unless explicitly approved.
3. **Production-first**: all code must be deployable.
4. **Fail closed, not open** (auth, permissions, payments, APIs).
5. **Explicit schemas > inferred schemas**.
6. **One responsibility per file**.
7. **Explain decisions briefly, then act**.
8. **Do NOT create markdown documents unless explicitly necessary.** Avoid documentation bloat.
9. **Brutal honesty required**: if something is risky, unscalable, insecure, unknown, or unverified, state it clearly.

---

## TOKEN EFFICIENCY STRATEGY

**ABSOLUTE PROHIBITIONS**:

* No demo data
* No mock data
* No test fixtures in production paths
* No fake users, fake payments, fake events
* No unverified claims in code, comments, commit messages, or chat responses

Any sample data requires **explicit approval** and must be isolated.

### Context Protection

* Never reprint large files unless changed
* Reference files by path + hash when possible
* Summarize prior work in <200 tokens before continuing
* Prefer diffs over full rewrites

### Execution Pattern

1. Plan (concise)
2. Validate plan against constraints
3. Implement
4. Verify against acceptance criteria

### Anti-Hallucination Rules

* If an API, SDK, or feature is uncertain, **say so explicitly**
* Never invent framework capabilities
* Never make unverified claims (performance, security, compliance, scale)
* If a claim cannot be proven from source or code, mark it as unverified
* Cite official behavior when relevant (or ask to verify)

---

## AGENT ARCHITECTURE

### 1. SYSTEM ARCHITECT AGENT

**Responsibilities**:

* Overall system design
* Data flows
* Security boundaries

**Outputs**:

* Architecture diagrams (textual)
* Dependency graphs
* Non-functional requirements

---

### 2. BACKEND AGENT (SUPABASE)

**Responsibilities**:

* Database schema (Postgres)
* RLS policies
* Auth hooks
* Edge Functions

**Rules**:

* All tables must include: id, created_at, updated_at
* RLS must be enabled by default
* Policies must be workspace-scoped

---

### 3. FRONTEND AGENT (REACT / NEXT.JS)

**Responsibilities**:

* App Router (Next.js)
* Server vs Client component boundaries
* Forms, validation, loading states

**Rules**:

* No client-side secrets
* Zod for validation
* TanStack Query for server state

---

### 4. PAYMENTS AGENT (STRIPE)

**Responsibilities**:

* Products & Prices
* Checkout
* Webhooks
* Entitlements

**Rules**:

* All access gated by webhook-confirmed state
* No trust in client payment signals

---

### 5. DEVOPS AGENT (VERCEL)

**Responsibilities**:

* Environment variables
* CI/CD
* Preview vs production parity

**Rules**:

* No secrets in repo
* Separate Supabase projects per env

---

### 6. SECURITY & COMPLIANCE AGENT

**Responsibilities**:

* Threat modeling
* Audit logging
* Legal constraints

---

## TECH STACK (FIXED)

* Frontend: Next.js (App Router) + TypeScript
* Backend: Supabase (Postgres + Auth + Edge Functions)
* Payments: Stripe
* Hosting: Vercel
* Styling: Tailwind
* Validation: Zod

---

## AUTHENTICATION & AUTHORIZATION

* Supabase Auth (email + magic link or OAuth)
* Workspace-based multi-tenancy
* Role model:

  * owner
  * admin
  * member

All access enforced via **RLS**, not frontend checks.

---

## DATABASE RULES

* Explicit migrations only
* No nullable foreign keys unless justified
* Soft deletes via `deleted_at`

---

## API DESIGN

* Server Actions preferred
* Edge Functions for external integrations
* Idempotency keys for Stripe + webhooks

---

## ERROR HANDLING

* Typed errors only
* User-safe messages
* Full internal logging

---

## TESTING REQUIREMENTS

* Unit tests for:

  * RLS policies
  * Billing state transitions
* Smoke tests for critical flows

---

## DEPLOYMENT CHECKLIST (MANDATORY)

* [ ] RLS enabled on all tables
* [ ] Stripe webhooks verified
* [ ] Env vars set in Vercel
* [ ] No test keys in prod
* [ ] Logging enabled

---

## HOW CLAUDE SHOULD WORK

When asked to build a feature:

1. Identify affected layers
2. Ask blocking questions
3. Generate exact code
4. Verify against this file
5. Update progress.md (see below)

If a conflict exists, **this file wins**.

---

## ACCEPTANCE STANDARD

Code is considered complete only if:

* It runs in production
* It is secure by default
* It matches stated requirements
* No assumptions were made
* Trade-offs are explicitly stated

---

## PROGRESS TRACKING (MANDATORY)

### progress.md Rules

* Maintain a single `/progress.md` file
* Update **after every meaningful action**
* Entries must be:

  * Timestamped
  * Factual
  * Action-based (what changed, why)
* Refer back to previous entries instead of repeating context

### progress.md Template

```
## YYYY-MM-DD HH:MM
Action:
- What was done

Impact:
- Files affected
- Security / performance implications

Open Risks:
- Any unresolved issues
```

Claude must treat `progress.md` as the historical ground truth.

---

END OF FILE
