# ADR-003: UnopenedLinksActionCenter Consolidation into FocusCard

**Status:** Proposed
**Date:** 2026-02-02
**Author:** Claude (Sprint Planning)
**Reviewers:** PM, Tech Lead

---

## Context

The AdminDashboard currently has two parallel action surfaces for attention management:

1. **UnifiedDashboard** (via `deriveDashboardState`) - Shows FocusCard with highest-priority job/technician requiring attention
2. **UnopenedLinksActionCenter** - Separate modal showing magic links that haven't been opened by technicians

This creates UX fragmentation where managers must check two different places to understand "what needs attention."

### Current UnopenedLinksActionCenter Behavior

**Location:** `components/UnopenedLinksActionCenter.tsx`

**Trigger:** Button in AdminDashboard header when `linksNeedingAttention.length > 0`

**Data Source:** `getLinksNeedingAttention()` from `lib/db.ts` - reads from localStorage flags

**Features:**
- Lists all unopened magic links with job context
- Shows "urgent" indicator when link age ≥ 4 hours
- One-click actions: Call Tech, Call Client, Reassign, Pause, Cancel, Resend, Delete
- Bulk selection for multi-job operations
- Modal overlay (blocks dashboard interaction)

**Current Props Interface:**
```typescript
interface UnopenedLinksActionCenterProps {
  isOpen: boolean;
  onClose: () => void;
  links: MagicLinkInfo[];
  jobs: Job[];
  technicians: Technician[];
  clients: Array<{ id: string; name: string; phone?: string; email?: string }>;
  onUpdateJob: (job: Job) => void;
  onDeleteJob?: (jobId: string) => void;
  onDismissLink: (token: string) => void;
  onRefreshLinks: () => void;
  managerEmail?: string;
}
```

---

## Decision

**Defer consolidation** until after dashboard stabilization sprint completes.

### Rationale

1. **Architecture Freeze:** The `deriveDashboardState` function is frozen as single source of truth. Adding link attention logic requires careful design to preserve the 6 invariants.

2. **Different Data Sources:** Links come from localStorage flags, not Supabase. Mixing sync'd job data with local-only link flags in derivation adds complexity.

3. **Feature Parity Risk:** Current modal provides bulk operations and rich actions (call, reassign, pause, cancel, resend, delete). FocusCard pattern shows ONE item at a time - need to design queue-based alternative.

4. **Low User Impact:** Current dual-surface UX works. Consolidation is a "nice to have" improvement, not a bug fix.

---

## Proposed Migration Path (Future Sprint)

### Phase 1: Add Link Attention to deriveDashboardState

```typescript
// New FocusEntity for unopened links
interface LinkAttentionEntity extends FocusEntity {
  type: 'attention';
  metadata: {
    linkToken: string;
    sentAge: number; // hours
    techName: string;
    techPhone?: string;
  };
}
```

**Severity Mapping:**
| Link Age | Severity | Rationale |
|----------|----------|-----------|
| < 2 hours | `info` | Normal - tech may be busy |
| 2-4 hours | `warning` | Concerning - may need follow-up |
| ≥ 4 hours | `critical` | Urgent - tech likely didn't receive or is ignoring |

**Invariant Compliance:**
- INV-1: Link attention competes for focus slot with jobs/technicians
- INV-3: Use `link-{token}` prefix to avoid ID collisions
- INV-5: Urgency = sentAge (hours), sorted descending

### Phase 2: Extend QueueList Actions

Add swipe/tap actions to QueueList items for link-specific operations:
- Swipe right: Quick call tech
- Swipe left: Reassign dropdown
- Long press: Full action menu (pause, cancel, delete)

### Phase 3: Deprecate Modal

1. Add feature flag: `FEATURE_UNIFIED_LINK_ATTENTION`
2. A/B test unified vs. modal UX with managers
3. Remove modal component after 2-week observation period

---

## Alternatives Considered

### A: Keep Separate Surfaces (Current)
**Pros:** Working, no risk
**Cons:** UX fragmentation, two mental models

### B: Inline Links in QueueList Only (No Focus)
**Pros:** Simpler, links always visible
**Cons:** Violates INV-1 if critical link should take focus over jobs

### C: Merge All Attention into FocusStack
**Pros:** Unified attention surface
**Cons:** FocusStack is for stacked focus items, not queue replacement

---

## Consequences

### If We Consolidate (Future)
- Unified "what needs attention" surface
- Simpler mental model for managers
- Reduced component count
- Must preserve bulk operations capability
- Must handle localStorage → derivation data flow

### If We Keep Separate (Current)
- No migration risk
- Feature parity maintained
- UX remains fragmented
- Two codepaths to maintain

---

## Action Items

1. **Now:** Document this ADR (this document)
2. **Future Sprint:** Design FocusEntity extension for links
3. **Future Sprint:** Prototype swipe actions for QueueList
4. **Future Sprint:** A/B test with 3+ managers before removing modal

---

## References

- `components/UnopenedLinksActionCenter.tsx` - Current implementation
- `lib/deriveDashboardState.ts` - Dashboard derivation (6 invariants)
- `components/dashboard/FocusCard.tsx` - Focus rendering
- `components/dashboard/QueueList.tsx` - Queue rendering
- `docs/DASHBOARD_IMPLEMENTATION_SPEC.md` - Architecture spec

---

*This ADR documents the evaluation and deferred decision. Implementation requires PM approval and a dedicated sprint.*
