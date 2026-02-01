# EXECUTION & RALPH WIGGUM PROTOCOL

The "Engine Room" - How Claude handles the actual coding loop.

---

## The "Ralph" Loop (Self-Correction)

When a command fails (Lint, Type-Check, Test, or Build):

```
┌─────────────────────────────────────────────────────────────┐
│  RALPH LOOP: "I'm helping!"                                 │
│                                                             │
│  1. OBSERVE   → Capture stdout/stderr completely            │
│  2. DIAGNOSE  → Identify the EXACT error (file:line)        │
│  3. HYPOTHESIZE → Document why it failed                    │
│  4. FIX       → Apply minimal, targeted patch               │
│  5. VERIFY    → Rerun the failing command                   │
│                                                             │
│  ⚠️  MAX 3 LOOPS before escalating to Human                 │
└─────────────────────────────────────────────────────────────┘
```

### Loop Counter Protocol

```
LOOP 1: "First attempt - likely a typo or import issue"
  → Fix the obvious error
  → Rerun command

LOOP 2: "Pattern issue - need to check surrounding code"
  → Read more context (20+ lines around error)
  → Check similar working code for patterns
  → Apply fix based on working patterns

LOOP 3: "Deeper issue - architecture or dependency problem"
  → Check if issue is in dependencies or related files
  → Review recent changes that might have caused regression
  → Apply fix or prepare detailed escalation report

ESCALATE: "Human intervention required"
  → Document all 3 attempts and their outcomes
  → Provide clear summary of what was tried
  → Suggest potential solutions for human to choose
```

---

## Verification Loop (Mandatory After Every Change)

Every code modification MUST end with this sequence:

```bash
# Step 1: Run Tests (CRITICAL - Must pass)
npm test -- --run

# Step 2: Type Check (catches interface mismatches)
npm run type-check

# Step 3: Lint Check (catches style/pattern violations)
npm run lint

# Step 4: Build Verification (ensures production-ready)
npm run build
```

### Quick Verification (for minor changes)

```bash
npm test -- --run && npm run type-check && echo "VERIFIED"
```

### Full Verification (before commits)

```bash
npm test -- --run && npm run lint && npm run type-check && npm run build && echo "PRODUCTION READY"
```

---

## Error Categories & Response Patterns

### Category 1: TypeScript Errors

```
ERROR: Property 'X' does not exist on type 'Y'

RALPH RESPONSE:
1. Read the type definition for 'Y'
2. Check if property was renamed or removed
3. Update the code to use correct property name
4. If type is wrong, update the type definition
```

### Category 2: Import Errors

```
ERROR: Cannot find module 'X'

RALPH RESPONSE:
1. Check if file exists at expected path
2. Verify the export exists in source file
3. Check for typos in import path
4. If new dependency, verify it's in package.json
```

### Category 3: Test Failures

```
ERROR: Expected X but received Y

RALPH RESPONSE:
1. Read the test to understand expected behavior
2. Read the implementation to understand actual behavior
3. Determine if test or implementation is wrong
4. Fix the correct one (usually implementation)
```

### Category 4: Lint Errors

```
ERROR: 'X' is defined but never used

RALPH RESPONSE:
1. Remove unused import/variable
2. OR if it should be used, find where to use it
3. Rerun lint to verify fix
```

### Category 5: Build Errors

```
ERROR: Cannot resolve 'X' in 'Y'

RALPH RESPONSE:
1. Check vite.config.ts for alias issues
2. Verify lazy import paths are correct
3. Check manualChunks configuration
4. Ensure file exists and is exported correctly
```

---

## Pre-Commit Checklist (Automated)

Before any `git commit`, execute:

```bash
# Security: No secrets in frontend
grep -r "service_role" components/ views/ lib/ && echo "FAIL: service_role found" || echo "PASS: No secrets"

# Architecture: No direct auth calls
grep -r "supabase.auth.getUser" components/ && echo "FAIL: Direct auth call" || echo "PASS: Using AuthContext"

# Performance: No inline animations
grep -r "animate={{" components/ views/ && echo "WARN: Inline animation" || echo "PASS: Using constants"

# Tests must pass
npm test -- --run || exit 1

# Build must succeed
npm run build || exit 1

echo "PRE-COMMIT CHECKS PASSED"
```

---

## Offline Verification Loop

For any form or data-handling changes:

```bash
# Step 1: Start dev server
npm run dev &

# Step 2: Test in browser
# - Open form
# - Enter data
# - Toggle airplane mode (DevTools > Network > Offline)
# - Submit form
# - Verify data saved to IndexedDB

# Step 3: Verify sync
# - Toggle airplane mode OFF
# - Verify data syncs to Supabase
# - Check for conflicts or errors
```

---

## Supabase Type Generation

When database schema changes:

```bash
# Generate types from local Supabase
npx supabase gen types typescript --local > lib/database.types.ts

# Or from remote (production)
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > lib/database.types.ts

# Then verify types compile
npm run type-check
```

---

## Debugging Decision Matrix

```
┌────────────────────┬─────────────────────────────────────┐
│ Symptom            │ First Action                        │
├────────────────────┼─────────────────────────────────────┤
│ Test fails         │ Read test, read implementation      │
│ Type error         │ Check type definitions              │
│ Import error       │ Verify file path and exports        │
│ Build fails        │ Check vite.config.ts                │
│ Auth loop          │ Check AuthContext memoization       │
│ Data not loading   │ Check RLS policies                  │
│ Offline not saving │ Check Dexie schema in lib/db.ts     │
│ Animation janky    │ Check for inline objects            │
│ Re-render issues   │ Check for missing useMemo/memo      │
└────────────────────┴─────────────────────────────────────┘
```

---

## Escalation Report Format

When Ralph Loop exhausted (3 attempts failed):

```markdown
# Escalation Report

## Issue
[One-line description]

## Error Message
```
[Exact error from console]
```

## Attempts Made

### Attempt 1
- **Hypothesis:** [Why I thought it failed]
- **Fix Applied:** [What I changed]
- **Result:** [Still failing because...]

### Attempt 2
- **Hypothesis:** [Updated theory]
- **Fix Applied:** [What I changed]
- **Result:** [Still failing because...]

### Attempt 3
- **Hypothesis:** [Final theory]
- **Fix Applied:** [What I changed]
- **Result:** [Still failing because...]

## Recommended Next Steps
1. [Option A - with trade-offs]
2. [Option B - with trade-offs]

## Files Involved
- `path/to/file1.ts` (line X)
- `path/to/file2.tsx` (line Y)
```

---

## Recovery Commands

### When Everything Breaks

```bash
# Stash current work
git stash push -m "broken state"

# Verify baseline works
npm test -- --run && npm run build

# If baseline passes, pop and fix incrementally
git stash pop

# If baseline fails, reset to last known good
git checkout HEAD~1 -- [problematic files]
```

### Cache Corruption Fix

```bash
rm -rf node_modules/.cache
rm -rf node_modules/.vite
npm ci
npm run build
```

### Type Generation Reset

```bash
rm -f lib/database.types.ts
npx supabase gen types typescript --local > lib/database.types.ts
npm run type-check
```

---

## Performance Verification

After component changes, check for performance regressions:

```bash
# Build and analyze bundle
npm run build

# Check bundle size in dist/
ls -la dist/assets/*.js

# Verify lazy loading works
# (Large chunks should only load on navigation)
```

---

## Success Criteria

A fix is ONLY considered complete when:

```
[ ] npm test -- --run        → All tests pass
[ ] npm run type-check       → No type errors
[ ] npm run lint             → No lint errors
[ ] npm run build            → Build succeeds
[ ] Manual verification      → Feature works as expected
[ ] Offline test             → Works in airplane mode (if applicable)
```

**NO EXCEPTIONS. NO "IT SHOULD WORK." ONLY PROOF.**

---

*This protocol ensures systematic debugging and prevents infinite loops.
Follow Ralph's wisdom: Observe, Hypothesize, Iterate, Escalate.*
