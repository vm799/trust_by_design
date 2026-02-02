# JobProof Dashboard UX Contract v1

**Status:** ENFORCED
**Scope:** Dashboard only (Manager / Technician / Solo Contractor)
**Applies to:** Mobile-first, offline-first, enterprise field use

---

## A. First Principles (Non-Negotiable)

### Law 1 — One Truth, One Focus

At any moment, the dashboard may present exactly ONE primary thing that matters right now.

If more than one thing matters, the dashboard is lying.

---

### Law 2 — Everything Clickable Must Resolve

If a user taps something, one of these must happen:
- Navigate to the exact underlying entity
- Perform a visible action
- Explain why no action is possible

Silent clicks = broken trust.

---

### Law 3 — Counts Must Equal Drill-Down

Any number shown on the dashboard must equal the number of items shown when drilled into.

No aggregation. No reinterpretation. No secondary filters.

---

## B. Canonical Dashboard Structure (Mandatory)

The dashboard is not a collection of widgets.
It is a decision surface.

The ONLY allowed structure:

```
1. FOCUS (0 or 1 item)
2. QUEUE (0–5 items)
3. BACKGROUND (collapsed, optional)
```

Anything outside this is forbidden.

---

## C. Definitions

### 1️⃣ FOCUS

"What requires attention now?"

**Rules:**
- Max: 1
- Must be actionable
- Must explain why it is the focus
- Must have a primary CTA

**Allowed Focus Types:**
- Job blocked (missing evidence, sync failed, expired link)
- Urgent unassigned job
- Technician stuck on job > threshold
- Sealing required to complete report

**Forbidden:**
- Summary metrics
- Technician lists
- Idle states
- Counts without context

---

### 2️⃣ QUEUE

"What's next, if I resolve the focus?"

**Rules:**
- Max: 5
- Ordered by urgency
- Each item must have exactly one primary action
- No counters, only concrete items

**Allowed:**
- Jobs needing assignment
- Jobs awaiting evidence
- Jobs pending seal
- Technicians awaiting action

**Forbidden:**
- "X items need attention"
- Grouped summaries
- Mixed entity types without clear action

---

### 3️⃣ BACKGROUND

"Everything else"

**Rules:**
- Collapsed by default
- Read-only unless expanded
- No alerts
- No urgency indicators

**Allowed:**
- Idle technicians
- Completed jobs
- Historical items

---

## D. Attention & Flags Rules

Flags may exist ONLY if:
- They map to exactly one job or technician
- They appear in Focus or Queue
- They resolve on interaction

**Forbidden:**
- Global "Attention Needed" counters
- Flags that only explain themselves via tooltip
- Flags that disappear when clicked

---

## E. Technician Interaction Rules

- Clicking a technician must:
  - Open their active job, OR
  - Open a clear "No active job" state with next action
- "Idle" is not an alert
- "Idle" never appears in Focus

---

## F. Offline & Trust Rules

- Dashboard must render fully offline using cached state
- Sync state must be visible per job (pending / failed / synced)
- No badge may imply success unless data is confirmed persisted
- Old cached data must be clearly labeled if stale

---

## G. Things That Are Explicitly Forbidden

- ❌ "17 need attention" without showing 17 items
- ❌ Clicking a row and nothing happening
- ❌ Mixing technician issues and job issues in one list
- ❌ Multiple "important" sections competing visually
- ❌ Dashboards that need explanation

---

## H. Success Criteria

The dashboard passes contract only if:
- A user can answer "What should I do next?" in ≤ 3 seconds
- Every click leads somewhere meaningful
- Numbers never contradict drill-downs
- Removing the dashboard would slow the user down

---

*This contract is the source of truth for all dashboard implementations.*
