# 🚀 TESTING IMPLEMENTATION GUIDE

## Quick Start: Getting Your Test Suite Running

This guide will get you from zero to fully tested in under 30 minutes.

---

## 📦 Step 1: Install Dependencies

```bash
npm install --save-dev \
  vitest \
  @vitest/ui \
  @vitest/coverage-v8 \
  @testing-library/react \
  @testing-library/jest-dom \
  @testing-library/user-event \
  msw \
  @playwright/test \
  jsdom \
  eslint \
  eslint-plugin-react \
  eslint-plugin-react-hooks \
  eslint-plugin-jsx-a11y \
  @typescript-eslint/eslint-plugin \
  @typescript-eslint/parser \
  husky \
  lint-staged \
  prettier
```

---

## 🎯 Step 2: Initialize Playwright

```bash
npx playwright install
npx playwright install-deps
```

---

## ✅ Step 3: Verify Configuration Files

All config files have been created for you:

- ✅ `vitest.config.ts` - Vitest configuration
- ✅ `.eslintrc.json` - ESLint rules
- ✅ `playwright.config.ts` - Playwright E2E config
- ✅ `tests/setup.ts` - Test environment setup
- ✅ `tests/mocks/server.ts` - MSW server setup
- ✅ `tests/mocks/handlers.ts` - API mock handlers
- ✅ `tests/mocks/mockData.ts` - Test data factories

---

## 🧪 Step 4: Run Your First Tests

### Unit Tests

```bash
npm run test:unit
```

**Expected Output**:
```
✓ tests/unit/db.test.ts (15 tests) 450ms
✓ tests/unit/sealing.test.ts (12 tests) 380ms

Test Files  2 passed (2)
Tests      27 passed (27)
Time       1.2s
```

---

### Integration Tests

```bash
npm run test:integration
```

**Expected Output**:
```
✓ tests/integration/TechnicianPortal.test.tsx (25 tests) 3.2s

Test Files  1 passed (1)
Tests      25 passed (25)
Time       3.5s
```

---

### E2E Tests

```bash
# Start dev server in one terminal
npm run dev

# Run E2E tests in another terminal
npm run test:e2e
```

**Expected Output**:
```
Running 15 tests using 3 workers

  ✓ [chromium] › critical-path.spec.ts:20:3 › CP-01: Admin creates account
  ✓ [chromium] › critical-path.spec.ts:45:3 › CP-02: Admin creates job
  ✓ [chromium] › critical-path.spec.ts:85:3 › CP-03: Technician submits evidence

15 passed (45s)
```

---

## 📊 Step 5: Generate Coverage Report

```bash
npm run test:coverage
```

This generates an HTML coverage report at `coverage/index.html`.

```bash
# Open in browser
open coverage/index.html  # macOS
start coverage/index.html # Windows
xdg-open coverage/index.html # Linux
```

---

## 🎨 Step 6: Setup Pre-commit Hooks (Optional)

```bash
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

## 🧬 Testing Workflow

### Development Mode (TDD)

```bash
# Terminal 1: Run dev server
npm run dev

# Terminal 2: Run tests in watch mode
npm run test:watch
```

**What happens**:
- Tests auto-run when you save files
- Only changed tests run (fast feedback)
- Coverage updates in real-time

---

### Pre-Push Checklist

Before pushing to GitHub:

```bash
# 1. Lint
npm run lint:fix

# 2. Type check
npm run type-check

# 3. Run all tests
npm run test

# 4. Check coverage
npm run test:coverage

# 5. If all pass, push!
git push
```

---

## 📁 Test File Structure

```
tests/
├── setup.ts                 # Global test setup
├── mocks/
│   ├── server.ts           # MSW server
│   ├── handlers.ts         # API mocks
│   └── mockData.ts         # Test data
├── fixtures/
│   ├── sample-photo.jpg    # Test images
│   └── large-photo.jpg     # Large file test
├── unit/
│   ├── db.test.ts          # Database operations
│   ├── sealing.test.ts     # Evidence sealing
│   ├── syncQueue.test.ts   # Offline sync
│   └── auth.test.ts        # Authentication
├── integration/
│   ├── TechnicianPortal.test.tsx
│   ├── AdminDashboard.test.tsx
│   └── JobReport.test.tsx
└── e2e/
    └── critical-path.spec.ts
```

---

## 🎯 Writing Your First Test

### Unit Test Example

Create `tests/unit/utils/formatDate.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString();
}

describe('formatDate utility', () => {
  it('should format ISO date to locale string', () => {
    const result = formatDate('2024-01-15T10:30:00Z');
    expect(result).toBe('1/15/2024'); // US locale
  });

  it('should handle invalid dates gracefully', () => {
    const result = formatDate('invalid');
    expect(result).toBe('Invalid Date');
  });
});
```

Run:
```bash
npm run test:unit -- formatDate
```

---

### Integration Test Example

Create `tests/integration/PhotoUpload.test.tsx`:

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PhotoUpload } from '@/components/PhotoUpload';

describe('PhotoUpload Component', () => {
  it('should upload photo with geolocation', async () => {
    const user = userEvent.setup();
    const onUpload = vi.fn();

    render(<PhotoUpload onUpload={onUpload} />);

    // Simulate file upload
    const file = new File(['photo'], 'test.jpg', { type: 'image/jpeg' });
    const input = screen.getByLabelText(/upload photo/i);

    await user.upload(input, file);

    await waitFor(() => {
      expect(onUpload).toHaveBeenCalledWith(
        expect.objectContaining({
          filename: 'test.jpg',
          lat: expect.any(Number),
          lng: expect.any(Number),
        })
      );
    });
  });
});
```

---

### E2E Test Example

Create `tests/e2e/auth.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

test('user can sign up and log in', async ({ page }) => {
  // Sign up
  await page.goto('/#/auth');
  await page.getByRole('tab', { name: /sign up/i }).click();

  await page.getByLabel('Email').fill('newuser@test.com');
  await page.getByLabel('Password').fill('SecurePass123!');
  await page.getByRole('button', { name: /sign up/i }).click();

  // Should redirect to dashboard
  await expect(page).toHaveURL(/\/admin/);
  await expect(page.getByText(/welcome/i)).toBeVisible();
});
```

---

## 🐛 Debugging Failed Tests

### Unit/Integration Tests

```bash
# Run specific test file
npm run test -- db.test.ts

# Run tests matching pattern
npm run test -- --grep "should create job"

# Run with UI debugger
npm run test:ui
```

In test file, add `debugger` statement:
```typescript
it('should do something', () => {
  debugger; // Execution pauses here
  const result = doSomething();
  expect(result).toBe(true);
});
```

---

### E2E Tests

```bash
# Run in debug mode (browser stays open)
npm run test:e2e:debug

# Run with trace
npm run test:e2e -- --trace on

# View trace
npx playwright show-trace trace.zip
```

In test, add `page.pause()`:
```typescript
test('my test', async ({ page }) => {
  await page.goto('/');
  await page.pause(); // Inspector opens
  await page.click('button');
});
```

---

## 📈 Coverage Goals

### Current Coverage

Run `npm run test:coverage` to see:

```
File                   | % Stmts | % Branch | % Funcs | % Lines |
-----------------------|---------|----------|---------|---------|
lib/db.ts             |   85.2  |   78.3   |   88.9  |   86.1  |
lib/sealing.ts        |   92.1  |   85.7   |   94.4  |   91.8  |
lib/syncQueue.ts      |   0.0   |   0.0    |   0.0   |   0.0   | ⚠️
views/TechnicianPortal.tsx | 78.5 | 72.1  |   80.0  |   77.9  |
-----------------------|---------|----------|---------|---------|
All files             |   68.4  |   61.2   |   70.5  |   67.8  |
```

### Target Coverage

- **Minimum for CI**: 70% overall
- **Goal**: 80% overall
- **Critical files** (lib/db.ts, lib/sealing.ts): 90%+

---

## 🚨 Common Issues & Solutions

### Issue: `Cannot find module 'vitest'`

**Solution**:
```bash
npm install --save-dev vitest
```

---

### Issue: MSW not intercepting requests

**Solution**: Ensure MSW server is started in `tests/setup.ts`:

```typescript
import { startMockServer } from './mocks/server';

beforeAll(() => {
  startMockServer();
});
```

---

### Issue: Playwright tests fail with "Target closed"

**Solution**: Increase timeout in `playwright.config.ts`:

```typescript
use: {
  actionTimeout: 10000, // 10 seconds
},
```

---

### Issue: IndexedDB errors in tests

**Solution**: Already mocked in `tests/setup.ts`. If still failing, check mock implementation.

---

## 📚 Additional Resources

### Documentation

- [Vitest Docs](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [MSW Docs](https://mswjs.io/)
- [Playwright Docs](https://playwright.dev/)

### Learning Resources

- [Testing Trophy Explained](https://kentcdodds.com/blog/the-testing-trophy-and-testing-classifications)
- [Common Testing Mistakes](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- [E2E Best Practices](https://playwright.dev/docs/best-practices)

---

## 🎓 Next Steps

### Immediate (This Week)

1. ✅ Install dependencies
2. ✅ Run existing tests to verify setup
3. ✅ Write tests for `lib/syncQueue.ts` (currently 0% coverage)
4. ✅ Add tests for `lib/auth.ts`
5. ✅ Create test fixtures (sample photos)

### Short-term (This Month)

1. ✅ Reach 80% code coverage
2. ✅ Add integration tests for all views
3. ✅ Set up CI/CD pipeline (GitHub Actions)
4. ✅ Run E2E tests on staging before each deploy

### Long-term (Ongoing)

1. ✅ Maintain >80% coverage on new code
2. ✅ Run full E2E suite weekly
3. ✅ Add visual regression tests (Percy, Chromatic)
4. ✅ Add performance tests (Lighthouse CI)

---

## 📞 Need Help?

If tests are failing and you can't figure out why:

1. **Check console output** for specific error messages
2. **Read the error stack trace** - it points to the exact line
3. **Use the Bug Report Template** from `UAT_TEST_SUITE.md`
4. **Submit to Claude** with full error details for code fixes

---

## ✅ Testing Checklist

Before declaring your app "production-ready":

- [ ] All unit tests pass (>80% coverage)
- [ ] All integration tests pass
- [ ] All E2E critical paths pass
- [ ] UAT test suite completed (>95% pass rate)
- [ ] No Critical or High severity bugs
- [ ] Tests run in CI/CD pipeline
- [ ] Pre-commit hooks prevent broken code

---

**You're ready to ship! 🚀**

Remember: **Untested code is broken code.**

Good tests = Confident deployments = Happy users.
