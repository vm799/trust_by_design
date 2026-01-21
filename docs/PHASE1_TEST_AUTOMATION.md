# PHASE 1 Test Automation - Auth & Workspace Flows

## Overview

Automated end-to-end testing for JobProof PHASE 1 authentication and workspace creation flows, integrated into CI/CD pipeline with structured logging to `claude.md`.

## Test Coverage

### PHASE 1 Tests (`tests/e2e/auth-flows.spec.ts`)

1. **Email/Password Signup → Workspace Creation**
   - Tests email-first auth flow
   - Verifies workspace creation RPC call
   - Validates no 403/42501 permission errors

2. **Magic Link Signup Flow**
   - Tests OTP/Magic Link authentication
   - Requires email service integration

3. **Google OAuth Signup → Workspace Setup**
   - Tests OAuth redirect flow
   - Verifies post-OAuth workspace setup
   - Validates redirect allowlist security

4. **Existing User Login (No Duplicate Workspace)**
   - Ensures no duplicate workspace creation
   - Validates session restoration for returning users

5. **Session Persistence & Logout Flow**
   - Tests session storage and reload
   - Verifies clean logout (localStorage cleared)

6. **RPC Permission Verification**
   - Tests `check_user_exists` RPC accessibility
   - Validates all auth RPC endpoints

7. **OAuth Redirect Allowlist Security**
   - Tests redirect URL validation
   - Prevents open redirect vulnerabilities

## Local Testing

### Prerequisites

1. **Install dependencies:**
   ```bash
   npm ci
   npx playwright install --with-deps chromium
   ```

2. **Configure environment variables:**
   ```bash
   # .env.local
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   VITE_APP_URL=http://localhost:5173
   ```

3. **Start development server:**
   ```bash
   npm run dev
   ```

### Running Tests

**Run all PHASE 1 tests:**
```bash
npm run test:e2e -- tests/e2e/auth-flows.spec.ts
```

**Run specific test:**
```bash
npx playwright test tests/e2e/auth-flows.spec.ts -g "Email/Password Signup"
```

**Run with UI mode (debugging):**
```bash
npm run test:e2e:ui
```

**Run only on Chromium:**
```bash
npm run test:e2e:chromium -- tests/e2e/auth-flows.spec.ts
```

### Logging Results Locally

After running tests, log results to `claude.md`:

```bash
node scripts/log-test-results.js test-results/results.json
```

This will append a structured summary to `claude.md`:

```markdown
## PHASE 1 ✅ - PHASE 1 Auth + Workspace Test Run – 2026-01-21 14:32:15

**Summary:** 7/7 tests passed in 45s

- ✅ **Magic Link Signup**: PASS (8s)
- ✅ **Google OAuth Signup**: PASS (6s)
- ✅ **Session Refresh**: PASS (12s)
- ✅ **Logout/Login Cycle**: PASS (10s)

### ✅ No errors detected

### 🎉 PHASE 1 Complete

All authentication and workspace flows verified. Ready to proceed to PHASE 2.
```

## CI/CD Integration

### GitHub Actions Workflow

The `phase1-auth-tests` job in `.github/workflows/ci.yml` runs automatically on:
- Push to `main` or `claude/**` branches
- Pull requests to `main`

### Required GitHub Secrets

Configure these secrets in **GitHub Settings → Secrets and variables → Actions**:

| Secret | Description | Example |
|--------|-------------|---------|
| `VITE_SUPABASE_URL` | Supabase project URL | `https://abc123.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous key | `eyJhbGc...` |
| `VITE_APP_URL` | Staging/production URL | `https://staging.jobproof.pro` |

### Optional Notification Secrets

For Slack/Email notifications on test failures:

| Secret | Description |
|--------|-------------|
| `SLACK_WEBHOOK_URL` | Slack incoming webhook URL |
| `SENDGRID_API_KEY` | SendGrid API key for email |
| `EMAIL_TO` | Recipient email address |

### Workflow Steps

1. **Checkout code** - Pull latest code from repository
2. **Setup Node.js** - Install Node 18 with npm cache
3. **Install dependencies** - Run `npm ci` for deterministic installs
4. **Install Playwright** - Install Chromium browser
5. **Start dev server** - Launch Vite dev server on port 5173
6. **Run PHASE 1 tests** - Execute auth-flows.spec.ts with JSON reporter
7. **Log results to claude.md** - Parse JSON results and append to claude.md
8. **Upload artifacts** - Save test results, reports, and claude.md
9. **Comment on PR** - Post test summary as PR comment
10. **Fail job if tests failed** - Block pipeline if any test fails

### Viewing Results

**GitHub Actions UI:**
1. Navigate to **Actions** tab in repository
2. Click on latest workflow run
3. View `phase1-auth-tests` job logs
4. Download `phase1-test-results` artifact to view reports

**Pull Request Comments:**
Test results are automatically posted as PR comments:

```markdown
## 🎉 PHASE 1 Auth + Workspace Tests ✅ PASSED

**Summary:** 7/7 tests passed

- Magic Link Signup: ✅
- Google OAuth Signup: ✅
- Session Refresh: ✅
- Logout/Login Cycle: ✅

✅ All tests passed! Ready to merge.

[View full report](https://github.com/your-org/trust_by_design/actions/runs/123456)
```

## Notifications

### Console Notifications (Default)

Logs test summary to console. Used in CI/CD by default.

```bash
node scripts/notify-test-failure.js test-results/results.json console
```

### Slack Notifications

Send test failure alerts to Slack:

```bash
export SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
node scripts/notify-test-failure.js test-results/results.json slack
```

**GitHub Actions Integration:**
```yaml
- name: Send Slack notification on failure
  if: failure()
  run: node scripts/notify-test-failure.js test-results/results.json slack
  env:
    SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

### Email Notifications

Send test failure alerts via email (SendGrid):

```bash
export SENDGRID_API_KEY=your-api-key
export EMAIL_TO=dev@jobproof.pro
export EMAIL_FROM=ci@jobproof.pro
node scripts/notify-test-failure.js test-results/results.json email
```

**GitHub Actions Integration:**
```yaml
- name: Send email notification on failure
  if: failure()
  run: node scripts/notify-test-failure.js test-results/results.json email
  env:
    SENDGRID_API_KEY: ${{ secrets.SENDGRID_API_KEY }}
    EMAIL_TO: ${{ secrets.EMAIL_TO }}
    EMAIL_FROM: ci@jobproof.pro
```

## Troubleshooting

### Test Failures

**"Cannot connect to http://localhost:5173"**
- Ensure dev server is running: `npm run dev`
- Check if port 5173 is available: `lsof -i :5173`

**"403 insufficient_privilege (42501)"**
- Verify `20260121_phase1_auth_fixes.sql` migration applied
- Check RPC permissions: `GRANT EXECUTE ON FUNCTION ... TO anon, authenticated`

**"Element not found" / Timeout errors**
- UI selectors may have changed
- Run in UI mode to debug: `npm run test:e2e:ui`
- Increase timeout in `playwright.config.ts`

**"Email confirmation required" (manual step)**
- Magic Link and OAuth tests require manual email confirmation
- These are documented as manual tests in console output

### CI/CD Issues

**"VITE_SUPABASE_URL is not defined"**
- Ensure GitHub Secrets are configured correctly
- Check secret names match exactly (case-sensitive)

**"Development server failed to start"**
- Check build errors in workflow logs
- Verify all dependencies installed correctly

**"Test results file not found"**
- Playwright may have crashed before writing results
- Check for OOM errors or browser crashes in logs

### Logging Issues

**"claude.md not updating"**
- Ensure script has write permissions: `chmod +x scripts/log-test-results.js`
- Check if `claude.md` exists (script creates it if missing)

**"Malformed JSON in results.json"**
- Playwright may have failed before writing JSON
- Check raw test output for errors

## Advanced Configuration

### Custom Test Selectors

Update selectors in `tests/e2e/auth-flows.spec.ts` if UI changes:

```typescript
// Example: Update email input selector
await page.fill('input[type="email"]', TEST_EMAIL);
// If changed to data attribute:
await page.fill('input[data-testid="email-input"]', TEST_EMAIL);
```

### Parallel Test Execution

Run tests across multiple browsers in parallel:

```bash
npx playwright test tests/e2e/auth-flows.spec.ts --project=chromium --project=firefox --project=webkit
```

### Test Retries

Configure retries in `playwright.config.ts`:

```typescript
export default defineConfig({
  retries: process.env.CI ? 2 : 0, // Retry twice in CI, never locally
});
```

### Video Recording

Enable video recording for all tests:

```typescript
export default defineConfig({
  use: {
    video: 'on', // Options: 'on', 'off', 'retain-on-failure', 'on-first-retry'
  },
});
```

## Next Steps

### PHASE 2: Workspace Model Enforcement

After PHASE 1 tests pass, proceed to PHASE 2:

1. **Workspace isolation tests** - Verify RLS policies prevent cross-workspace access
2. **Role-based access tests** - Test admin, member, viewer permissions
3. **Subscription tier tests** - Validate feature access by tier
4. **Evidence sealing tests** - Test immutable evidence bundle creation

### Continuous Improvement

- **Add visual regression testing** with Playwright's screenshot comparison
- **Integrate with Vercel preview deployments** for PR testing
- **Add performance benchmarks** (LCP, FID, CLS) to E2E tests
- **Automate Magic Link testing** with email service API integration

## Support

- **Documentation:** `docs/PHASE1_TEST_AUTOMATION.md` (this file)
- **Test Files:** `tests/e2e/auth-flows.spec.ts`
- **Scripts:** `scripts/log-test-results.js`, `scripts/notify-test-failure.js`
- **CI/CD:** `.github/workflows/ci.yml`

For issues or questions, reference `claude.md` for test execution history.
