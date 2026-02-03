import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Test Configuration for JobProof
 *
 * Tests critical user journeys across browsers and devices
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // Increase retries in CI for flaky network-dependent tests
  retries: process.env.CI ? 3 : 0,
  workers: process.env.CI ? 1 : undefined,
  // Increase test timeout in CI to handle slower environments
  timeout: process.env.CI ? 60000 : 30000,
  // Increase expect timeout for assertions
  expect: {
    timeout: process.env.CI ? 15000 : 5000,
  },
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    ['list'],
  ],
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:5173',
    // Capture traces on all retries in CI for debugging
    trace: process.env.CI ? 'on-all-retries' : 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // Increase action timeout in CI
    actionTimeout: process.env.CI ? 15000 : 10000,
    // Add navigation timeout
    navigationTimeout: process.env.CI ? 30000 : 15000,
    // CRITICAL: Disable Service Worker for deterministic E2E tests
    // SW introduces non-determinism via caching. Test app behavior, not SW.
    // To test offline flows specifically, create dedicated tests that enable SW.
    serviceWorkers: 'block',
  },

  projects: [
    // Desktop browsers
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    // Mobile browsers (critical for field technicians)
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },

    // Tablet
    {
      name: 'iPad Pro',
      use: { ...devices['iPad Pro'] },
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    // Always reuse existing server - CI workflow starts preview server separately
    reuseExistingServer: true,
    // Increase timeout for slow CI environments
    timeout: 180000,
    // Don't fail if server is already running (e.g., from CI workflow)
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
