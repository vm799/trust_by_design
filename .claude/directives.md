# SUB-AGENT ORCHESTRATION DIRECTIVES

When a task is initiated, evaluate the domain and delegate to the appropriate sub-agent.
This prevents the main agent from context-bloat and ensures specialized expertise.

---

## How to Enlist Sub-Agents

Use the `Task` tool with the appropriate `subagent_type`:

```
Task(subagent_type="Explore", prompt="...")  # For codebase research
Task(subagent_type="Plan", prompt="...")     # For architecture planning
Task(subagent_type="Bash", prompt="...")     # For git/npm operations
```

---

## 1. The Architect (@arch-agent)

**Expertise:**
- Database Schema Design
- Supabase Migrations (SQL)
- TypeScript Interface Definitions
- RLS Policy Creation

**Trigger Conditions:**
- Modifying files in `supabase/migrations/`
- Changing `types.ts` or type definitions
- Creating new database tables or relationships
- Designing API contracts

**Constraints:**
- Must verify schema changes don't break existing RLS policies
- Must include `auth.uid()` in all user-data policies
- Must add corresponding TypeScript types for new tables
- Must check for foreign key impacts before migration

**Delegation Pattern:**
```
Task(
  subagent_type="Explore",
  prompt="Analyze the current database schema in supabase/migrations/.
         Identify all tables that reference [table_name] and their RLS policies.
         Report any potential foreign key conflicts."
)
```

---

## 2. The UI Engineer (@ui-agent)

**Expertise:**
- React 18 Components (Hooks, Context)
- Tailwind CSS 3.4 Patterns
- Framer Motion Animations
- Glassmorphism & Dark Mode
- Offline-First Form Design

**Trigger Conditions:**
- Editing files in `components/`
- Creating new views in `views/`
- Modifying `lib/animations.ts`
- Updating `src/styles/theme.css`

**Constraints:**
- Must use Atomic Design pattern (atoms → molecules → organisms)
- No inline styles - use Tailwind classes only
- Must use shared animation constants from `lib/animations.ts`
- Must wrap navigation components with `React.memo`
- Must use `useMemo` for expensive computations
- Must include dark mode variants

**Delegation Pattern:**
```
Task(
  subagent_type="Explore",
  prompt="Find all components in components/ui/ that use inline animation objects.
         List files that need to import from lib/animations.ts instead."
)
```

---

## 3. The Security Auditor (@sec-agent)

**Expertise:**
- Row-Level Security (RLS) Policies
- Edge Function Secrets Management
- JWT Validation & Session Handling
- auth.uid() Enforcement

**Trigger Conditions:**
- BEFORE every `git commit` (mandatory)
- When modifying `lib/auth.ts` or `lib/AuthContext.tsx`
- When creating Supabase Edge Functions
- When handling user data in any component

**Constraints:**
- Must verify no `service_role` keys in frontend code
- Must ensure all tables have RLS policies
- Must check that `auth.uid()` is used for user isolation
- Must validate JWT handling in Edge Functions

**Mandatory Pre-Commit Checks:**
```bash
# Run these before committing any auth-related changes
grep -r "service_role" components/ views/ lib/  # Must be 0
grep -r "supabase.auth.getUser" components/     # Must be 0
```

**Delegation Pattern:**
```
Task(
  subagent_type="Explore",
  prompt="Audit all files in supabase/migrations/ for RLS policies.
         Identify any tables missing policies or using insecure patterns.
         Check for any SELECT/INSERT/UPDATE/DELETE without auth.uid() check."
)
```

---

## 4. The Offline Engineer (@offline-agent)

**Expertise:**
- Dexie/IndexedDB Operations
- Sync Queue Management (`lib/syncQueue.ts`)
- Conflict Resolution Strategies
- Network Status Handling

**Trigger Conditions:**
- Modifying `lib/db.ts` or `lib/syncQueue.ts`
- Creating new forms that need offline support
- Handling data persistence in views

**Constraints:**
- Every form must save drafts to IndexedDB
- Must use optimistic UI updates
- Must handle `navigator.onLine` status
- Must implement retry with exponential backoff

**Delegation Pattern:**
```
Task(
  subagent_type="Explore",
  prompt="Find all forms in views/ that don't use Dexie for draft saving.
         Check if they implement offline submit queue via syncQueue.ts."
)
```

---

## 5. The Test Engineer (@test-agent)

**Expertise:**
- Vitest Unit Tests
- Playwright E2E Tests
- Mock Service Worker (MSW)
- Architecture Test Enforcement

**Trigger Conditions:**
- After any code change (verification)
- When creating new components or hooks
- When fixing bugs (regression prevention)

**Constraints:**
- Must run `npm test -- --run` before declaring success
- Must add tests for new functionality
- Must not reduce code coverage below thresholds

**Delegation Pattern:**
```
Task(
  subagent_type="Bash",
  prompt="Run npm test -- --run and report results.
         If any tests fail, list the failing test names and file paths."
)
```

---

## Delegation Decision Tree

```
START
  │
  ├─ Is task > 100 lines of changes?
  │   └─ YES → Use sub-agent exploration first
  │
  ├─ Does task involve supabase/migrations/?
  │   └─ YES → Enlist @arch-agent
  │
  ├─ Does task involve components/ or views/?
  │   └─ YES → Enlist @ui-agent
  │
  ├─ Does task involve auth, RLS, or secrets?
  │   └─ YES → Enlist @sec-agent (MANDATORY)
  │
  ├─ Does task involve offline/sync functionality?
  │   └─ YES → Enlist @offline-agent
  │
  └─ Is task complete?
      └─ YES → Enlist @test-agent (MANDATORY)
```

---

## Anti-Patterns (DO NOT DO)

```
# WRONG - Main agent doing deep exploration
grep -r "pattern" . | head -100
# Causes context bloat

# CORRECT - Delegate to sub-agent
Task(subagent_type="Explore", prompt="Find all files matching pattern X...")
```

```
# WRONG - Changing multiple domains in one fix
# Edit supabase/migrations/ AND components/ AND lib/

# CORRECT - One domain per fix, use sub-agents for research
# Fix 1: Migration only (after @arch-agent review)
# Fix 2: Component only (after @ui-agent review)
```

---

## Sub-Agent Communication Format

When delegating, always specify:

1. **Context:** What's the current state?
2. **Goal:** What do we need to find/verify?
3. **Constraints:** What patterns must be followed?
4. **Output:** What format should the response be in?

**Example:**
```
Task(
  subagent_type="Explore",
  prompt="""
  CONTEXT: We're adding a new 'invoices' table with RLS.

  GOAL: Find all existing RLS policies in supabase/migrations/
        that use the workspace isolation pattern.

  CONSTRAINTS:
  - Must use auth.uid() for user isolation
  - Must reference workspace_members for workspace access

  OUTPUT: List of file paths and the relevant RLS policy SQL.
  """
)
```

---

*This directive file governs how Claude Code enlists specialized sub-agents.
Follow these patterns to prevent context bloat and ensure expert handling.*
