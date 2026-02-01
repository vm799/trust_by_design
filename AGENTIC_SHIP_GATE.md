# JobProof Ship Gate — Field Readiness

This release may ship to production **only if** all items below are verified.

---

## Critical Failure Resolution

- [ ] All P0 (Critical) issues from latest critique are resolved
- [ ] All P1 (High Risk) issues are resolved or have documented workarounds
- [ ] No known data loss scenarios exist

## Error Handling

- [ ] Every `catch` block results in user-visible feedback
- [ ] No silent failures (console.log only is not acceptable)
- [ ] Network errors show retry options
- [ ] Auth failures redirect appropriately

## Sync Integrity

- [ ] Per-job sync state is visible to user
- [ ] Per-photo sync state is visible to user
- [ ] Orphan recovery paths exist and work
- [ ] Sync queue retries with exponential backoff
- [ ] Conflict resolution is deterministic

## Offline Verification

All tested manually with:

- [ ] Airplane mode enabled
- [ ] App killed mid-operation
- [ ] Low storage scenario
- [ ] Camera permission revocation
- [ ] Location permission revocation

## Security Checklist

- [ ] No `service_role` keys in frontend code
- [ ] All tables have RLS policies
- [ ] `auth.uid()` used for user isolation
- [ ] Sealed evidence cannot be modified
- [ ] Invoiced jobs cannot be deleted

## Performance

- [ ] Bundle size within acceptable limits
- [ ] Lazy loading works (routes load on demand)
- [ ] No animation jank on low-end devices
- [ ] Memory leaks checked (long session test)

---

## Verification Commands

```bash
# Security audit
grep -r "service_role" components/ views/ lib/ && echo "BLOCKED: service_role found" || echo "PASS"
grep -r "supabase.auth.getUser" components/ && echo "BLOCKED: direct auth" || echo "PASS"

# Full test suite
npm test -- --run

# Production build
npm run build

# All pass?
echo "SHIP GATE: All automated checks passed"
echo "MANUAL CHECKS REQUIRED: Offline testing, permission revocation"
```

---

## Ship Decision

| Condition | Decision |
|-----------|----------|
| All items checked | **SHIP** |
| Any item unchecked | **BLOCK** |
| P0 unresolved | **BLOCK** |
| Offline test failed | **BLOCK** |
| Security check failed | **BLOCK** |

---

## If Blocked

1. Document the blocking issue
2. Run `AGENTIC_CRITIQUE.md` to assess scope
3. Run `AGENTIC_EXECUTION.md` to fix
4. Re-run this ship gate

---

*This is what prevents "we'll fix it tomorrow." No shortcuts.*
