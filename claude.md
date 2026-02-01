# Claude Operating Constraints — JobProof

You are working on JobProof, an offline-first, mobile-first, trust-critical construction field application.

## Non-Negotiable Rules

1. **Silent failure is forbidden.**
   - Every error must be visible to the user or block progression.
   - console.log is not an acceptable error handling strategy.

2. **Offline safety beats elegance.**
   - Prefer synchronous persistence over async elegance.
   - Assume the app can be killed after any line of code.

3. **Deletion is preferred to abstraction.**
   - Remove dead code, legacy paths, and future placeholders.
   - Do not retain code "for later use".

4. **Do not redesign unless explicitly instructed.**
   - Fix only what is requested.
   - Avoid introducing new patterns unless required for safety.

5. **Field reality overrides best practice.**
   - Assume wet gloves, poor signal, old Android devices, and time pressure.

If a suggestion violates these rules, do not propose it.

---

## Core Architecture (Mandatory)

### Data Pattern
```tsx
// ALWAYS use DataContext - the single source of truth
import { useData } from '../lib/DataContext';
const { jobs, clients, technicians, updateJob, refresh } = useData();

// NEVER use standalone state for jobs/clients/technicians
// NEVER use deprecated hooks from useWorkspaceData
```

### Auth Pattern
```tsx
// ALWAYS use AuthContext
import { useAuth } from '../lib/AuthContext';
const { isAuthenticated, userId, session } = useAuth();

// NEVER call supabase.auth.getUser() directly (causes 877 req/hr loop)
```

### Offline-First Mandates
- Every form saves drafts to IndexedDB (every keystroke)
- All submits queue via `lib/syncQueue.ts` when offline
- Network status awareness via `navigator.onLine`
- Airplane mode → app restart → data survives

---

## Security Requirements

- **RLS Required:** Every Supabase table MUST have Row-Level Security
- **auth.uid() Only:** User isolation via `auth.uid()`, never trust client
- **No service_role:** Never use `service_role` keys in frontend code
- **Sealed Evidence:** Jobs with `sealedAt` cannot be modified or deleted

---

## Verification Commands

```bash
# Before ANY commit (MANDATORY):
npm test -- --run && npm run lint && npm run type-check && npm run build
```

---

## Related Documentation

- `AGENTIC_CRITIQUE.md` — Evaluation mode (run after refactors)
- `AGENTIC_EXECUTION.md` — Fix mode (run after critique)
- `AGENTIC_PRE_COMMIT.md` — Daily guardrail (run before merge)
- `AGENTIC_SHIP_GATE.md` — Release blocker (run before production)

---

*This file contains permanent operating constraints. For playbooks and protocols, see the AGENTIC_*.md files.*
