# JobProof Pre-Commit Safety Check

Run this before every PR merge. Answer YES or NO to each question.

---

## Data Integrity

- [ ] Can any user action fail without visible feedback?
- [ ] Can a photo exist only in React state?
- [ ] Can a sync succeed while data is missing?
- [ ] Can a user think a job is complete when it is not?
- [ ] Can the app be killed mid-flow and lose data?

## Dead Code

- [ ] Are there any dead routes?
- [ ] Are there any disabled buttons with no explanation?
- [ ] Are there any TODO comments that should be fixed now?
- [ ] Are there any commented-out code blocks?

## Architecture Compliance

- [ ] Is there any `useState` for jobs/clients/technicians?
- [ ] Is there any direct `supabase.auth.getUser()` call in components?
- [ ] Is there any `service_role` key in frontend code?
- [ ] Are there any inline animation objects in Framer Motion?
- [ ] Are there any array index keys in React lists?

## Field Safety

- [ ] Are all touch targets at least 44px?
- [ ] Does offline mode work (airplane mode test)?
- [ ] Are error states visible with retry options?
- [ ] Is sync status visible to the user?

---

## Verdict

If **ANY** answer above is **YES**:

```
DO NOT MERGE
```

Fix the issue first, then re-run this check.

---

## Quick Verification Commands

```bash
# Architecture compliance
grep -r "useState.*Job\[\]" components/ views/ && echo "FAIL: useState for jobs"
grep -r "supabase.auth.getUser" components/ && echo "FAIL: Direct auth call"
grep -r "service_role" components/ views/ lib/ && echo "FAIL: service_role in frontend"

# Tests and build
npm test -- --run && npm run lint && npm run type-check && npm run build

# All pass?
echo "PRE-COMMIT CHECKS PASSED"
```

---

*Run this daily. Run this before every merge. No exceptions.*
