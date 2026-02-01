# JobProof Test Pyramid Plan

**Created:** January 31, 2026
**Status:** Implementation Ready
**Goal:** Transform unbalanced test suite into robust, pyramid-shaped coverage

---

## Executive Summary

The JobProof codebase currently has **348 test cases** across 23 test files. However, the test distribution is severely unbalanced:

| Test Type | Current | Target | Gap |
|-----------|---------|--------|-----|
| Unit Tests | 315 (91%) | 450-500 (50%) | +135-185 strategic tests |
| Integration Tests | 18 (5%) | 250-400 (30%) | +232-382 tests |
| E2E Tests | 16 (4%) | 150-200 (20%) | +134-184 tests |

**Current Ratio:** 175:1:1 (heavily unit-biased)
**Target Ratio:** 50:30:20 (balanced pyramid)

---

## Current State Analysis

### Test Coverage by Domain

| Domain | Files | Tested | Coverage | Priority |
|--------|-------|--------|----------|----------|
| Components | 49 | 2 | 4% | CRITICAL |
| Views/Pages | 53 | 1 | 1.8% | CRITICAL |
| Custom Hooks | 9 | 1 | 11% | CRITICAL |
| Library Functions | 42 | 4 | 9.5% | HIGH |
| Forms | 5+ | 1 | 20% | HIGH |
| Offline System | 4 | 1 | 25% | HIGH |

### Critical Paths Without Adequate Testing

1. **Job Lifecycle** - Admin creates job -> Tech assigned -> Evidence captured -> Job sealed
2. **Technician Evidence Capture** - Magic link access -> Photo upload -> GPS/W3W verification
3. **Offline Functionality** - Airplane mode -> Data persistence -> Sync on reconnect
4. **Authentication Flows** - Session persistence, token refresh, cross-browser magic links
5. **Form Draft Persistence** - Auto-save on keystroke -> Recovery after crash
6. **Data Context & Workspace Isolation** - Multi-tenant data separation

---

## Test Pyramid Architecture

```
                    ┌─────────────┐
                    │    E2E      │  20% (150-200 tests)
                    │  Critical   │  - User journeys
                    │   Paths     │  - Cross-system integration
                    └──────┬──────┘
                           │
              ┌────────────┴────────────┐
              │       Integration       │  30% (250-400 tests)
              │    Component + API      │  - Service boundaries
              │    Offline + Auth       │  - Database operations
              └───────────┬─────────────┘
                          │
        ┌─────────────────┴─────────────────┐
        │             Unit Tests            │  50% (450-500 tests)
        │   Hooks, Utils, Pure Functions    │  - Fast, isolated
        │   Component Logic, Validation     │  - No external deps
        └───────────────────────────────────┘
```

---

## Phase 1: Foundation (Weeks 1-4)

**Goal:** Add 100 critical path unit tests for hooks and core libraries

### 1.1 Hook Tests (+40 test cases)

| Hook | File | Priority | Test Cases |
|------|------|----------|------------|
| useAuthFlow | `hooks/useAuthFlow.ts` | CRITICAL | 15 |
| useNavigation | `hooks/useNavigation.ts` | CRITICAL | 10 |
| useWorkspaceData | `hooks/useWorkspaceData.ts` | HIGH | 10 |
| useTechnicianJob | `hooks/useTechnicianJob.ts` | HIGH | 5 |

**useAuthFlow Test Cases:**
```typescript
// tests/unit/hooks/useAuthFlow.test.ts
describe('useAuthFlow', () => {
  // State transitions
  it('initializes in idle state')
  it('transitions to loading on auth check')
  it('transitions to authenticated on valid session')
  it('transitions to unauthenticated on no session')
  it('handles session refresh correctly')

  // Error handling
  it('handles network errors gracefully')
  it('handles invalid token errors')
  it('handles expired session errors')

  // Side effects
  it('persists auth state to localStorage')
  it('clears auth state on logout')
  it('triggers onAuth callback on success')
  it('triggers onError callback on failure')

  // Edge cases
  it('handles concurrent auth checks')
  it('debounces rapid auth state changes')
  it('handles browser storage quota errors')
});
```

### 1.2 Core Library Tests (+35 test cases)

| Library | File | Priority | Test Cases |
|---------|------|----------|------------|
| auth | `lib/auth.ts` | CRITICAL | 15 |
| validation | `lib/validation.ts` | HIGH | 10 |
| theme | `lib/theme.tsx` | MEDIUM | 10 |

**auth.ts Test Cases:**
```typescript
// tests/unit/lib/auth.test.ts
describe('auth', () => {
  // Session management
  it('creates session from valid credentials')
  it('refreshes session before expiry')
  it('handles session not found')
  it('handles refresh token expired')

  // Magic link
  it('generates valid magic link URL')
  it('validates magic link token format')
  it('handles expired magic link')
  it('handles already-used magic link')

  // OAuth
  it('initiates OAuth flow correctly')
  it('handles OAuth callback with code')
  it('handles OAuth error response')

  // Security
  it('sanitizes redirect URLs')
  it('prevents open redirect attacks')
  it('validates PKCE challenge')
});
```

### 1.3 Utility Tests (+25 test cases)

| Utility | File | Priority | Test Cases |
|---------|------|----------|------------|
| errorLogger | `lib/errorLogger.ts` | MEDIUM | 8 |
| redirects | `lib/redirects.ts` | MEDIUM | 8 |
| encryption | `lib/encryption.ts` | HIGH | 9 |

---

## Phase 2: Component Coverage (Weeks 5-8)

**Goal:** Add 80 component tests + 150 integration tests

### 2.1 UI Component Tests (+30 test cases)

| Component | File | Test Cases |
|-----------|------|------------|
| Modal | `components/ui/Modal.tsx` | 8 |
| Card | `components/ui/Card.tsx` | 6 |
| ErrorState | `components/ui/ErrorState.tsx` | 8 |
| StatusBadge | `components/ui/StatusBadge.tsx` | 8 |

**Modal Test Cases:**
```typescript
// tests/unit/components/Modal.test.tsx
describe('Modal', () => {
  it('renders when open prop is true')
  it('does not render when open is false')
  it('calls onClose when backdrop clicked')
  it('calls onClose when Escape pressed')
  it('traps focus within modal')
  it('restores focus on close')
  it('applies correct z-index')
  it('renders children correctly')
});
```

### 2.2 Layout Component Tests (+25 test cases)

| Component | File | Test Cases |
|-----------|------|------------|
| AppShell | `components/layout/AppShell.tsx` | 10 |
| PageHeader | `components/layout/PageHeader.tsx` | 8 |
| BottomNav | `components/layout/BottomNav.tsx` | 7 |

### 2.3 Feature Component Tests (+25 test cases)

| Component | File | Test Cases |
|-----------|------|------------|
| JobCard | `components/JobCard.tsx` | 8 |
| OnboardingTour | `components/OnboardingTour.tsx` | 8 |
| OfflineBanner | `components/OfflineBanner.tsx` | 9 |

### 2.4 Integration Tests (+150 test cases)

**2.4.1 Offline Sync Integration (40 tests)**
```typescript
// tests/integration/offline-sync-real.test.ts
describe('Offline Sync (Real IndexedDB)', () => {
  // Draft persistence
  it('persists form draft on every keystroke')
  it('recovers draft after page refresh')
  it('recovers draft after browser crash simulation')
  it('clears draft after successful submit')

  // Sync queue
  it('queues operations when offline')
  it('processes queue when online')
  it('retries failed operations with backoff')
  it('handles partial sync failures')

  // Conflict resolution
  it('detects server conflicts')
  it('applies last-write-wins for non-critical data')
  it('prompts user for critical conflicts')
  it('logs conflicts to audit trail')

  // ... 28 more tests
});
```

**2.4.2 Form Draft Persistence (35 tests)**
```typescript
// tests/integration/form-drafts.test.ts
describe('Form Draft Persistence', () => {
  // JobForm
  it('saves JobForm draft on field change')
  it('loads JobForm draft on mount')
  it('merges draft with server data')

  // ClientForm
  it('saves ClientForm draft on field change')
  it('loads ClientForm draft on mount')

  // TechnicianForm
  it('saves TechnicianForm draft on field change')

  // ... 29 more tests
});
```

**2.4.3 Data Context Integration (30 tests)**
```typescript
// tests/integration/data-context.test.ts
describe('DataContext Integration', () => {
  it('isolates data by workspace')
  it('filters clients by workspace')
  it('filters jobs by workspace')
  it('filters technicians by workspace')
  it('updates trigger correct re-renders')
  it('handles workspace switching')
  // ... 24 more tests
});
```

**2.4.4 Auth Token Refresh (25 tests)**
```typescript
// tests/integration/auth-refresh.test.ts
describe('Auth Token Refresh', () => {
  it('refreshes token before expiry')
  it('handles refresh failure gracefully')
  it('redirects to login on permanent failure')
  it('maintains session across tabs')
  // ... 21 more tests
});
```

**2.4.5 Job Lifecycle Integration (20 tests)**
```typescript
// tests/integration/job-lifecycle.test.ts
describe('Job Lifecycle', () => {
  it('creates job with all required fields')
  it('assigns technician to job')
  it('generates magic link for technician')
  it('tracks job status transitions')
  it('seals evidence on completion')
  // ... 15 more tests
});
```

---

## Phase 3: Critical Path E2E (Weeks 9-12)

**Goal:** Add 150+ E2E tests across critical user journeys

### 3.1 Job Workflow E2E (+40 tests)

```typescript
// tests/e2e/job-workflow.spec.ts
test.describe('Job Workflow', () => {
  test('admin creates new job')
  test('admin assigns technician')
  test('technician receives notification')
  test('technician accepts job')
  test('technician captures before photos')
  test('technician captures during photos')
  test('technician captures after photos')
  test('technician adds GPS coordinates')
  test('technician submits evidence')
  test('admin reviews submission')
  test('admin approves and seals job')
  test('client views sealed report')
  // ... 28 more tests
});
```

### 3.2 Offline E2E (+35 tests)

```typescript
// tests/e2e/offline-mode.spec.ts
test.describe('Offline Mode', () => {
  test('detects offline state')
  test('shows offline indicator')
  test('queues form submissions')
  test('persists photos locally')
  test('syncs when online')
  test('handles sync conflicts')
  test('survives app restart')
  // ... 28 more tests
});
```

### 3.3 Authentication E2E (+25 tests)

```typescript
// tests/e2e/authentication.spec.ts
test.describe('Authentication', () => {
  test('email signup flow')
  test('magic link login flow')
  test('session persistence')
  test('logout clears all data')
  test('handles expired session')
  test('handles invalid credentials')
  // ... 19 more tests
});
```

### 3.4 Mobile E2E (+30 tests)

```typescript
// tests/e2e/mobile.spec.ts
test.describe('Mobile Experience', () => {
  test('bottom nav works on mobile')
  test('forms are touch-friendly (44x44px)')
  test('landscape orientation works')
  test('portrait orientation works')
  test('swipe gestures work')
  test('camera access works')
  // ... 24 more tests
});
```

### 3.5 Error Scenarios E2E (+20 tests)

```typescript
// tests/e2e/error-scenarios.spec.ts
test.describe('Error Handling', () => {
  test('handles network failure gracefully')
  test('handles server 500 error')
  test('handles 404 not found')
  test('handles rate limiting')
  test('handles storage quota exceeded')
  test('recovers from IndexedDB corruption')
  // ... 14 more tests
});
```

---

## Implementation Priority Matrix

### CRITICAL (Week 1-2)

| Test | Impact | Effort | Priority Score |
|------|--------|--------|----------------|
| useAuthFlow tests | HIGH | MEDIUM | 9/10 |
| auth.ts tests | HIGH | MEDIUM | 9/10 |
| Form draft integration | HIGH | HIGH | 8/10 |
| Offline sync real DB | HIGH | HIGH | 8/10 |

### HIGH (Week 3-4)

| Test | Impact | Effort | Priority Score |
|------|--------|--------|----------------|
| useNavigation tests | MEDIUM | LOW | 7/10 |
| Component unit tests | MEDIUM | MEDIUM | 7/10 |
| Job lifecycle E2E | HIGH | HIGH | 7/10 |

### MEDIUM (Week 5-8)

| Test | Impact | Effort | Priority Score |
|------|--------|--------|----------------|
| Layout component tests | MEDIUM | LOW | 6/10 |
| Mobile E2E tests | MEDIUM | HIGH | 6/10 |
| Error scenario tests | MEDIUM | MEDIUM | 6/10 |

---

## Test Infrastructure Improvements

### Required Setup

1. **Real IndexedDB Testing**
   - Replace `fake-indexeddb` with real browser IndexedDB in E2E
   - Add Dexie test utilities

2. **Visual Regression Testing**
   - Add Percy or Chromatic integration
   - Baseline screenshots for key pages

3. **Accessibility Testing**
   - Add `axe-playwright` for automated a11y audits
   - WCAG AAA compliance checks

4. **Performance Testing**
   - Add Lighthouse CI integration
   - Set performance budgets

### New Test Utilities

```typescript
// tests/utils/testHelpers.ts
export const createMockJob = (overrides?: Partial<Job>): Job
export const createMockClient = (overrides?: Partial<Client>): Client
export const createMockTechnician = (overrides?: Partial<Technician>): Technician
export const simulateOffline = async (): Promise<void>
export const simulateOnline = async (): Promise<void>
export const waitForSync = async (): Promise<void>
```

---

## Success Metrics

### Week 4 Targets
- [ ] 100+ new unit tests for hooks and core libs
- [ ] All 8 custom hooks have test coverage
- [ ] auth.ts has 100% coverage

### Week 8 Targets
- [ ] 80+ component tests
- [ ] 150+ integration tests
- [ ] Form draft persistence fully tested
- [ ] Offline sync tested with real IndexedDB

### Week 12 Targets
- [ ] 150+ E2E tests
- [ ] All critical paths covered
- [ ] Mobile E2E suite complete
- [ ] Overall coverage > 60%

### Long-term (Q2 2026)
- [ ] Test-to-source ratio > 10%
- [ ] Overall coverage > 80%
- [ ] Zero critical path regressions
- [ ] < 5 minute test suite runtime

---

## Test Commands

```bash
# Run all tests
npm test

# Run specific test types
npm run test:unit           # Unit tests only
npm run test:integration    # Integration tests only
npm run test:e2e            # E2E tests (headless)
npm run test:e2e:ui         # E2E with interactive UI

# Coverage report
npm run test:coverage

# Watch mode for development
npm run test:watch

# Mobile-specific E2E
npm run test:e2e:mobile
```

---

## Appendix: Test File Structure

```
tests/
├── setup.ts                          # Global test setup
├── unit/
│   ├── architecture.test.ts          # Pattern enforcement
│   ├── components/
│   │   ├── Breadcrumbs.test.tsx
│   │   ├── Tooltip.test.tsx
│   │   ├── Modal.test.tsx           # NEW
│   │   ├── Card.test.tsx            # NEW
│   │   ├── ErrorState.test.tsx      # NEW
│   │   └── StatusBadge.test.tsx     # NEW
│   ├── hooks/
│   │   ├── useJobGuard.test.tsx
│   │   ├── useAuthFlow.test.ts      # NEW
│   │   ├── useNavigation.test.ts    # NEW
│   │   └── useWorkspaceData.test.ts # NEW
│   └── lib/
│       ├── auth.test.ts             # NEW
│       ├── validation.test.ts       # NEW
│       ├── encryption.test.ts       # NEW
│       └── theme.test.tsx
├── integration/
│   ├── offline-sync.test.ts
│   ├── offline-sync-real.test.ts    # NEW
│   ├── form-drafts.test.ts          # NEW
│   ├── data-context.test.ts         # NEW
│   ├── auth-refresh.test.ts         # NEW
│   └── job-lifecycle.test.ts        # NEW
├── e2e/
│   ├── auth-flows.spec.ts
│   ├── critical-path.spec.ts
│   ├── job-workflow.spec.ts         # NEW
│   ├── offline-mode.spec.ts         # NEW
│   ├── mobile.spec.ts               # NEW
│   └── error-scenarios.spec.ts      # NEW
└── mocks/
    ├── server.ts
    ├── handlers.ts
    └── mockData.ts
```

---

**Document Status:** Ready for Implementation
**Next Steps:** Begin Phase 1 with useAuthFlow tests
