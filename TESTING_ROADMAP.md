# 🏆 JOBPROOF WORLD-CLASS TESTING ROADMAP

## 📊 Overview

This document outlines the complete testing strategy for JobProof following the **Testing Trophy** methodology:

```
        /\
       /E2E\          10% - Critical User Journeys (Playwright)
      /------\
     /  IST   \       40% - Component Integration (RTL + MSW)
    /----------\
   /    UNIT    \     30% - Business Logic (Vitest)
  /--------------\
 /    STATIC     \    20% - TypeScript + ESLint
/------------------\
```

---

## 🎯 Testing Philosophy

1. **Fast Feedback**: Unit tests run in <2s, integration in <10s
2. **High Confidence**: Focus on integration tests for critical workflows
3. **Production-Like**: E2E tests use real browser + network conditions
4. **Offline-First**: Test offline capabilities and sync mechanisms
5. **Mobile-First**: Prioritize mobile testing for field technicians

---

## 🔧 TIER 1: Static Analysis (20% effort)

### TypeScript Type Checking

**Current Status**: ✅ Configured

**Commands**:
```bash
npm run type-check    # Check types
npm run build         # TypeScript compilation
```

**Coverage Target**: 100% type coverage

### ESLint + Accessibility

**Current Status**: ✅ Configured (see `.eslintrc.json`)

**Commands**:
```bash
npm run lint          # Run linter
npm run lint:fix      # Auto-fix issues
```

**Rules Enforced**:
- React Hooks dependencies
- Accessibility (jsx-a11y)
- TypeScript best practices
- No `any` types (warning)

### Pre-commit Hooks (Recommended)

Install Husky:
```bash
npm install --save-dev husky lint-staged
npx husky init
```

Add to `.husky/pre-commit`:
```bash
#!/bin/sh
npx lint-staged
npm run type-check
```

Add to `package.json`:
```json
"lint-staged": {
  "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
  "*.{json,md}": ["prettier --write"]
}
```

---

## 🧪 TIER 2: Unit Tests (30% effort)

### Framework: Vitest

**Configuration**: `vitest.config.ts`

**Run Tests**:
```bash
npm run test              # Run all tests
npm run test:unit         # Unit tests only
npm run test:watch        # Watch mode
npm run test:coverage     # Generate coverage report
```

### Coverage Targets

| Metric | Target | Current |
|--------|--------|---------|
| Lines | 80% | 0% |
| Functions | 75% | 0% |
| Branches | 75% | 0% |
| Statements | 80% | 0% |

### Unit Test Checklist

#### ✅ Business Logic (`lib/`)

- [x] **`lib/db.ts`** (tests/unit/db.test.ts)
  - [x] CRUD operations (create, read, update, delete)
  - [x] Magic link generation and validation
  - [x] Workspace isolation via RLS
  - [x] Sealed job protection

- [x] **`lib/sealing.ts`** (tests/unit/sealing.test.ts)
  - [x] `canSealJob()` validation rules
  - [x] Evidence bundle creation
  - [x] SHA-256 hash generation
  - [x] Signature verification
  - [x] Tamper detection

- [ ] **`lib/syncQueue.ts`** (tests/unit/syncQueue.test.ts)
  - [ ] Add items to sync queue
  - [ ] Retry with exponential backoff
  - [ ] Remove synced items
  - [ ] Handle max retries
  - [ ] Batch sync operations

- [ ] **`lib/auth.ts`** (tests/unit/auth.test.ts)
  - [ ] Email/password signup
  - [ ] Email/password login
  - [ ] Google OAuth flow
  - [ ] Session validation
  - [ ] Workspace creation on signup

#### ✅ Utility Functions

- [ ] **Date formatting** (tests/unit/utils/dates.test.ts)
  - [ ] ISO string to human-readable
  - [ ] Timezone handling
  - [ ] Relative time (e.g., "2 hours ago")

- [ ] **Data validators** (tests/unit/utils/validators.test.ts)
  - [ ] Email validation
  - [ ] Phone number formatting
  - [ ] Address validation
  - [ ] File size limits
  - [ ] Image format validation

#### ✅ Custom Hooks

- [ ] **`hooks/useSubscription.ts`** (tests/unit/hooks/useSubscription.test.ts)
  - [ ] Fetch subscription tier
  - [ ] Calculate job usage
  - [ ] Enforce job limits
  - [ ] Cache subscription data

### Example Unit Test

See `tests/unit/db.test.ts` for a complete example.

**Key Pattern**:
```typescript
describe('lib/db - createJob', () => {
  it('should create a new job successfully', async () => {
    const jobData = { title: 'Test Job', ... };
    const result = await createJob(jobData);

    expect(result.success).toBe(true);
    expect(result.data).toHaveProperty('id');
  });

  it('should return error when workspace_id is missing', async () => {
    const result = await createJob({ title: 'Test' });
    expect(result.success).toBe(false);
  });
});
```

---

## 🔗 TIER 3: Integration System Testing (IST) (40% effort)

### Framework: React Testing Library + MSW

**Purpose**: Test component interactions + API mocking

**Run Tests**:
```bash
npm run test:integration    # Integration tests only
npm run test:msw            # Run with MSW server
```

### MSW (Mock Service Worker) Setup

**Configuration**: `tests/mocks/server.ts`

**How it works**:
1. MSW intercepts HTTP requests
2. Returns mock responses without hitting real backend
3. Simulate error states (401, 500, network timeout)

**Example Handler**:
```typescript
http.post(`${SUPABASE_URL}/rest/v1/jobs`, async ({ request }) => {
  const body = await request.json();
  return HttpResponse.json({
    ...body,
    id: `job-${Date.now()}`,
    created_at: new Date().toISOString(),
  }, { status: 201 });
})
```

### Integration Test Checklist

#### ✅ Core Workflows

- [x] **TechnicianPortal** (tests/integration/TechnicianPortal.test.tsx)
  - [x] Magic link validation
  - [x] Job loading
  - [x] Photo capture with geolocation
  - [x] Safety checklist completion
  - [x] Signature capture
  - [x] Work summary entry
  - [x] Draft persistence
  - [x] Job submission and sync
  - [x] Offline capability

- [ ] **AdminDashboard** (tests/integration/AdminDashboard.test.tsx)
  - [ ] Job creation
  - [ ] Client/technician management
  - [ ] Magic link generation
  - [ ] Job filtering and search
  - [ ] Job status updates

- [ ] **JobReport** (tests/integration/JobReport.test.tsx)
  - [ ] Display sealed evidence
  - [ ] Verify evidence integrity
  - [ ] Generate invoice
  - [ ] Public view mode

#### ✅ Component Integration

- [ ] **CreateJob + Client/Tech Selection** (tests/integration/CreateJob.test.tsx)
  - [ ] Form validation
  - [ ] Client dropdown populated from API
  - [ ] Technician dropdown populated from API
  - [ ] Template selection
  - [ ] Job creation success/error states

- [ ] **Photo Upload + Geolocation** (tests/integration/PhotoUpload.test.tsx)
  - [ ] File selection
  - [ ] Geolocation capture
  - [ ] Photo type categorization
  - [ ] IndexedDB storage (offline)
  - [ ] Supabase upload (online)
  - [ ] Retry on failure

### API Mocking Strategy

**Success Scenarios**:
```typescript
// Mock successful job creation
server.use(
  http.post(`${SUPABASE_URL}/rest/v1/jobs`, () =>
    HttpResponse.json(mockJob, { status: 201 })
  )
);
```

**Error Scenarios**:
```typescript
// Mock 401 Unauthorized
server.use(
  http.get(`${SUPABASE_URL}/rest/v1/jobs`, () =>
    HttpResponse.json({ error: 'Unauthorized' }, { status: 401 })
  )
);

// Mock 500 Server Error
server.use(
  http.post(`${SUPABASE_URL}/rest/v1/jobs`, () =>
    HttpResponse.json({ error: 'Internal server error' }, { status: 500 })
  )
);

// Mock Network Error
server.use(
  http.post(`${SUPABASE_URL}/rest/v1/jobs`, () =>
    HttpResponse.error()
  )
);

// Mock Timeout
server.use(
  http.post(`${SUPABASE_URL}/rest/v1/jobs`, () =>
    new Promise(() => {}) // Never resolves
  )
);
```

### Example Integration Test

See `tests/integration/TechnicianPortal.test.tsx` for a complete example.

**Key Pattern**:
```typescript
describe('INTEGRATION: TechnicianPortal - Photo Capture', () => {
  it('should capture photo with GPS coordinates', async () => {
    const user = userEvent.setup();
    render(<TechnicianPortal jobs={mockJobs} />);

    const file = new File(['photo'], 'test.jpg', { type: 'image/jpeg' });
    const input = screen.getByLabelText(/add photo/i);

    await user.upload(input, file);

    await waitFor(() => {
      expect(screen.getByText(/test.jpg/i)).toBeInTheDocument();
    });

    // Verify geolocation was captured
    expect(navigator.geolocation.getCurrentPosition).toHaveBeenCalled();
  });
});
```

---

## 🌐 TIER 4: End-to-End (E2E) Tests (10% effort)

### Framework: Playwright

**Configuration**: `playwright.config.ts`

**Run Tests**:
```bash
npm run test:e2e                # Run all E2E tests
npm run test:e2e:ui             # Run with Playwright UI
npm run test:e2e:debug          # Debug mode
npm run test:e2e:chromium       # Chromium only
npm run test:e2e:mobile         # Mobile devices only
```

### Browser/Device Coverage

| Device | Priority | Status |
|--------|----------|--------|
| Desktop Chrome | High | ✅ |
| Desktop Firefox | Medium | ✅ |
| Desktop Safari | Medium | ✅ |
| Mobile Chrome (Pixel 5) | **Critical** | ✅ |
| Mobile Safari (iPhone 12) | **Critical** | ✅ |
| iPad Pro | Low | ✅ |

### Critical Paths (Happy Paths)

#### ✅ CP-01: Admin Account Setup
```
Sign Up → Email Verification → Onboarding → Dashboard
```

#### ✅ CP-02: Job Creation & Magic Link
```
Create Client → Create Technician → Create Job → Generate Magic Link → Copy Link
```

#### ✅ CP-03: Technician Job Submission
```
Access Magic Link → Load Job → Add Photos → Complete Safety Checks →
Add Signature → Enter Work Summary → Submit Job
```

#### ✅ CP-04: Evidence Sealing
```
Admin Reviews Job → Verify All Evidence Present → Seal Evidence →
Generate Cryptographic Hash → Job Archived
```

#### ✅ CP-05: Public Verification
```
Public User Opens Verification Link → View Job Report →
Click "Verify Evidence" → See Integrity Confirmation
```

### E2E Test Checklist

- [x] **Authentication Flow** (tests/e2e/critical-path.spec.ts)
  - [x] Sign up with email/password
  - [x] Sign in with email/password
  - [x] Sign in with Google OAuth
  - [x] Session persistence
  - [x] Logout

- [x] **Complete Job Workflow** (tests/e2e/critical-path.spec.ts)
  - [x] Create job as admin
  - [x] Generate magic link
  - [x] Access as technician
  - [x] Submit evidence
  - [x] Seal as admin
  - [x] Verify as public

- [x] **Offline Capability** (tests/e2e/critical-path.spec.ts)
  - [x] Work offline
  - [x] Save to IndexedDB
  - [x] Auto-sync when online

- [x] **Mobile Responsiveness** (tests/e2e/critical-path.spec.ts)
  - [x] Photo capture on mobile
  - [x] Signature on touch screen
  - [x] Navigation on small screen

- [x] **Error Recovery** (tests/e2e/critical-path.spec.ts)
  - [x] Session expiry recovery
  - [x] Failed upload retry
  - [x] Network timeout handling

### Example E2E Test

See `tests/e2e/critical-path.spec.ts` for complete examples.

**Key Pattern**:
```typescript
test('CP-03: Technician submits job evidence', async ({ page }) => {
  // 1. Navigate via magic link
  await page.goto(`/#/track/${token}`);

  // 2. Interact with real UI
  await page.getByRole('button', { name: /add photo/i }).click();
  await fileInput.setInputFiles('./tests/fixtures/sample-photo.jpg');

  // 3. Complete workflow
  await page.getByRole('button', { name: /submit job/i }).click();

  // 4. Assert success
  await expect(page.getByText(/submitted successfully/i)).toBeVisible();
});
```

---

## 🚨 5 "KILLER" EDGE CASES (JobProof-Specific)

### 1. **Expired Session During Photo Upload**

**Scenario**: Technician spends 30 minutes on-site capturing photos. Session expires (24-hour token). They click "Submit Job" and get 401 error.

**Test**:
```typescript
test('should handle session expiry during upload', async () => {
  // Simulate session expiry mid-upload
  await page.context().clearCookies();
  await uploadButton.click();

  expect(screen.getByText(/session expired/i)).toBeVisible();
  expect(localStorage.getItem('jobproof_draft_...')).toBeDefined(); // Draft saved
});
```

**Expected Behavior**:
- Show "Session expired" modal
- Preserve all photos in IndexedDB
- Save work summary and checklist to localStorage
- Offer "Sign in again" button
- Auto-restore draft after re-auth

---

### 2. **Large File Handling (>10MB Photo on Slow 3G)**

**Scenario**: Technician uploads 15MB photo on 3G network. Upload takes 5+ minutes. App timeout is 30 seconds.

**Test**:
```typescript
test('should handle large file upload gracefully', async () => {
  const largeFile = new File(['x'.repeat(15 * 1024 * 1024)], 'large.jpg');
  await fileInput.setInputFiles(largeFile);

  expect(screen.getByText(/file too large/i)).toBeVisible();
  expect(screen.getByText(/max 10MB/i)).toBeVisible();
});

test('should chunk large uploads', async () => {
  // If we allow large files, test chunked upload
  const result = await uploadLargeFile(file, { chunkSize: 1024 * 1024 });
  expect(result.chunks).toBeGreaterThan(1);
});
```

**Expected Behavior**:
- Reject files >10MB with clear error
- Show file size before upload
- Display upload progress bar
- Allow cancellation mid-upload
- Alternative: Compress image client-side before upload

---

### 3. **Network Latency & Duplicate Submissions**

**Scenario**: Technician clicks "Submit Job" on poor network. Nothing happens for 10 seconds. They click again. Duplicate jobs created.

**Test**:
```typescript
test('should prevent duplicate submissions', async () => {
  const submitButton = screen.getByRole('button', { name: /submit/i });

  // Click twice rapidly
  await user.click(submitButton);
  await user.click(submitButton);

  // Only one submission
  await waitFor(() => {
    expect(mockOnUpdateJob).toHaveBeenCalledTimes(1);
  });

  expect(submitButton).toBeDisabled(); // Disabled after first click
  expect(screen.getByText(/submitting/i)).toBeVisible();
});
```

**Expected Behavior**:
- Disable submit button after first click
- Show loading spinner
- Implement idempotency key in API
- Show timeout after 30 seconds with retry option

---

### 4. **Offline → Online Transition During Sync**

**Scenario**: Technician works offline, collects 20 photos. Goes online. Sync starts. Network drops mid-sync. Photos 1-10 uploaded, 11-20 failed.

**Test**:
```typescript
test('should resume partial sync after network recovery', async () => {
  // Start with 20 photos offline
  const photos = Array.from({ length: 20 }, (_, i) => createMockPhoto(i));

  // Go online, start sync
  await context.setOffline(false);

  // Fail after 10 uploads
  server.use(
    http.post(`${SUPABASE_URL}/storage/**`, ({ request }, res, ctx) => {
      const uploadCount = parseInt(request.headers.get('x-upload-count') || '0');
      if (uploadCount > 10) return HttpResponse.error();
      return HttpResponse.json({ success: true });
    })
  );

  // Trigger sync
  await syncQueue.processQueue();

  // Verify partial success
  expect(syncQueue.pending).toHaveLength(10); // 11-20 still pending
  expect(syncQueue.synced).toHaveLength(10);  // 1-10 synced
});
```

**Expected Behavior**:
- Track sync status per photo (not per job)
- Resume from last successful upload
- Show progress: "10/20 photos uploaded"
- Retry failed uploads with exponential backoff
- Allow manual "Retry Sync" button

---

### 5. **Sealed Job Modification Attempt (Data Integrity)**

**Scenario**: Malicious user or bug tries to modify a sealed job. Database trigger should block it, but client also tries to prevent.

**Test**:
```typescript
test('should block modification of sealed job', async () => {
  const sealedJob = mockJobs.find(j => j.isSealed);

  // Try to update sealed job
  const result = await updateJob(sealedJob.id, { status: 'In Progress' });

  expect(result.success).toBe(false);
  expect(result.error).toContain('sealed');
});

test('should disable edit buttons for sealed jobs in UI', async () => {
  render(<JobReport job={sealedJob} />);

  expect(screen.getByRole('button', { name: /edit/i })).toBeDisabled();
  expect(screen.getByText(/job is sealed and cannot be modified/i)).toBeVisible();
});

test('should detect tampered evidence on verification', async () => {
  // Simulate hash mismatch
  server.use(
    http.post(`${SUPABASE_URL}/functions/v1/verify-evidence`, () =>
      HttpResponse.json({
        success: true,
        data: {
          isValid: false,
          message: 'Evidence hash mismatch - tampering detected',
        },
      })
    )
  );

  const result = await verifyEvidence('job-4');

  expect(result.data?.isValid).toBe(false);
  expect(result.data?.message).toContain('tamper');
});
```

**Expected Behavior**:
- Client-side: Disable all edit controls for sealed jobs
- Server-side: Database trigger blocks UPDATE/DELETE
- Verification endpoint detects hash mismatch
- Show warning banner: "⚠️ TAMPERING DETECTED"
- Log suspicious activity for audit

---

## 📦 Test Data Management

### Mock Data

**Location**: `tests/mocks/mockData.ts`

**Usage**:
```typescript
import { mockJobs, mockClients, createMockJob } from '@/tests/mocks/mockData';

// Use predefined mock
const job = mockJobs[0];

// Create custom mock
const customJob = createMockJob({
  status: 'Sealed',
  sealedAt: new Date().toISOString(),
});
```

### Fixtures (Images, PDFs)

**Location**: `tests/fixtures/`

**Contents**:
- `sample-photo.jpg` (500KB, 1920x1080)
- `sample-photo-2.jpg` (300KB, 1280x720)
- `large-photo.jpg` (12MB, 4000x3000) - for testing file size limits
- `corrupted-image.jpg` - for testing error handling

---

## 🚀 CI/CD Integration

### GitHub Actions Workflow

Create `.github/workflows/test.yml`:

```yaml
name: Test Suite

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run lint
      - run: npm run type-check
      - run: npm run test:unit -- --coverage
      - uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json

  integration-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run test:integration

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run test:e2e
      - uses: actions/upload-artifact@v3
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
```

---

## 📈 Coverage Dashboard

### Vitest Coverage

```bash
npm run test:coverage
open coverage/index.html
```

### Playwright Trace Viewer

```bash
npm run test:e2e -- --trace on
npx playwright show-report
```

---

## 🎓 Testing Best Practices

### 1. **Write Tests First (TDD)**

For new features:
1. Write failing test
2. Implement feature
3. Make test pass
4. Refactor

### 2. **Test User Behavior, Not Implementation**

❌ Bad:
```typescript
expect(component.state.isLoading).toBe(true);
```

✅ Good:
```typescript
expect(screen.getByText(/loading/i)).toBeVisible();
```

### 3. **Use Data-Testid Sparingly**

Prefer accessible queries:
```typescript
// ✅ Best: Accessible query
screen.getByRole('button', { name: /submit/i })

// ✅ Good: Label query
screen.getByLabelText(/email/i)

// ⚠️ Okay: Text query
screen.getByText(/welcome/i)

// ❌ Last resort: Test ID
screen.getByTestId('submit-button')
```

### 4. **Keep Tests Independent**

Each test should:
- Set up its own data
- Clean up after itself
- Not depend on other tests

### 5. **Test Realistic Scenarios**

Include:
- Happy path
- Error states
- Edge cases
- Loading states
- Empty states

---

## 📝 Test Naming Convention

```typescript
describe('Component/Function Name', () => {
  describe('feature or method', () => {
    it('should [expected behavior] when [condition]', () => {
      // Test
    });
  });
});
```

Example:
```typescript
describe('TechnicianPortal', () => {
  describe('photo upload', () => {
    it('should capture GPS coordinates when geolocation is enabled', async () => {
      // ...
    });

    it('should save photo to IndexedDB when offline', async () => {
      // ...
    });
  });
});
```

---

## 🔄 Testing Workflow

### Daily Development

```bash
# 1. Start dev server
npm run dev

# 2. Run tests in watch mode
npm run test:watch

# 3. Make changes, tests auto-run
# 4. Commit when all tests pass
```

### Before Pull Request

```bash
# 1. Run full test suite
npm run test

# 2. Check coverage
npm run test:coverage

# 3. Run E2E tests
npm run test:e2e

# 4. Lint and type-check
npm run lint
npm run type-check

# 5. If all pass, push and create PR
```

### Before Deployment

```bash
# 1. Run all tests in CI mode
CI=true npm run test

# 2. Run E2E tests on staging environment
STAGING=true npm run test:e2e

# 3. Check coverage meets thresholds
npm run test:coverage

# 4. Deploy to production
```

---

## 📚 Additional Resources

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [MSW Documentation](https://mswjs.io/)
- [Playwright Documentation](https://playwright.dev/)
- [Testing Trophy](https://kentcdodds.com/blog/the-testing-trophy-and-testing-classifications)

---

## ✅ Testing Checklist Summary

### Unit Tests
- [ ] All lib/ functions tested
- [ ] All custom hooks tested
- [ ] Utility functions tested
- [ ] 80% code coverage

### Integration Tests
- [ ] TechnicianPortal workflow
- [ ] AdminDashboard workflow
- [ ] JobReport workflow
- [ ] Photo upload + sync
- [ ] Offline capability

### E2E Tests
- [ ] Complete user journeys
- [ ] Mobile responsiveness
- [ ] Offline → online sync
- [ ] Error recovery
- [ ] Cross-browser testing

### Edge Cases
- [ ] Session expiry handling
- [ ] Large file uploads
- [ ] Duplicate submission prevention
- [ ] Partial sync recovery
- [ ] Sealed job modification blocking

---

**Next Steps**: Install dependencies and start writing tests!

```bash
npm install --save-dev \
  vitest \
  @vitest/ui \
  @testing-library/react \
  @testing-library/jest-dom \
  @testing-library/user-event \
  msw \
  @playwright/test
```
