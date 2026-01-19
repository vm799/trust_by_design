import { test, expect, type Page } from '@playwright/test';

/**
 * E2E CRITICAL PATH TESTS - JOBPROOF
 *
 * These tests verify the complete user journeys from end to end.
 * They run against a real browser and test the full stack integration.
 *
 * Critical Paths:
 * 1. Admin: Create Job → Generate Magic Link
 * 2. Technician: Access via Magic Link → Submit Job with Evidence
 * 3. Admin: Review Submission → Seal Evidence
 * 4. Public: Verify Sealed Evidence
 */

// Test data
const TEST_USER = {
  email: 'test@jobproof.pro',
  password: 'TestPassword123!',
  fullName: 'Test Admin User',
};

const TEST_CLIENT = {
  name: 'E2E Test Client Corp',
  email: 'client@e2etest.com',
  phone: '+1-555-9999',
  address: '123 Test Street, Test City, TC 12345',
};

const TEST_TECHNICIAN = {
  name: 'E2E Test Technician',
  email: 'tech@e2etest.com',
  phone: '+1-555-8888',
  specialty: 'HVAC',
};

// Helper functions
async function login(page: Page, email: string, password: string) {
  await page.goto('/');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/admin/);
}

async function createClient(page: Page, client: typeof TEST_CLIENT) {
  await page.getByRole('link', { name: /clients/i }).click();
  await page.getByRole('button', { name: /add client/i }).click();

  await page.getByLabel(/client name/i).fill(client.name);
  await page.getByLabel(/email/i).fill(client.email);
  await page.getByLabel(/phone/i).fill(client.phone);
  await page.getByLabel(/address/i).fill(client.address);

  await page.getByRole('button', { name: /save/i }).click();
  await expect(page.getByText(client.name)).toBeVisible();
}

async function createTechnician(page: Page, tech: typeof TEST_TECHNICIAN) {
  await page.getByRole('link', { name: /technicians/i }).click();
  await page.getByRole('button', { name: /add technician/i }).click();

  await page.getByLabel(/technician name/i).fill(tech.name);
  await page.getByLabel(/email/i).fill(tech.email);
  await page.getByLabel(/phone/i).fill(tech.phone);
  await page.getByLabel(/specialty/i).fill(tech.specialty);

  await page.getByRole('button', { name: /save/i }).click();
  await expect(page.getByText(tech.name)).toBeVisible();
}

test.describe('CRITICAL PATH: Complete Job Proof Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Start fresh by clearing application data
    await page.context().clearCookies();
    await page.goto('/');
  });

  test('CP-01: Admin creates account and sets up workspace', async ({ page }) => {
    test.setTimeout(60000);

    // Sign up
    await page.goto('/#/auth');
    await page.getByRole('tab', { name: /sign up/i }).click();

    await page.getByLabel('Full Name').fill(TEST_USER.fullName);
    await page.getByLabel('Email').fill(TEST_USER.email);
    await page.getByLabel(/^Password$/).fill(TEST_USER.password);
    await page.getByLabel(/confirm password/i).fill(TEST_USER.password);
    await page.getByLabel(/company name/i).fill('E2E Test Company');

    await page.getByRole('button', { name: /create account/i }).click();

    // Should redirect to admin dashboard
    await expect(page).toHaveURL(/\/admin/, { timeout: 15000 });

    // Onboarding should appear
    await expect(page.getByText(/welcome to jobproof/i)).toBeVisible();

    // Complete onboarding
    await page.getByRole('button', { name: /get started/i }).click();
    await expect(page.getByText(/dashboard/i)).toBeVisible();
  });

  test('CP-02: Admin creates job and generates magic link', async ({ page, context }) => {
    test.setTimeout(90000);

    // Login
    await login(page, TEST_USER.email, TEST_USER.password);

    // Create client first
    await createClient(page, TEST_CLIENT);

    // Create technician
    await createTechnician(page, TEST_TECHNICIAN);

    // Navigate to job creation
    await page.getByRole('link', { name: /jobs/i }).click();
    await page.getByRole('button', { name: /create job/i }).click();

    // Fill job form
    await page.getByLabel(/job title/i).fill('E2E Test HVAC Installation');
    await page.getByLabel(/client/i).selectOption({ label: TEST_CLIENT.name });
    await page.getByLabel(/technician/i).selectOption({ label: TEST_TECHNICIAN.name });
    await page.getByLabel(/address/i).fill('456 Job Site Ave, Work City, WC 54321');
    await page.getByLabel(/date/i).fill('2024-02-01');
    await page.getByLabel(/notes/i).fill('Install new HVAC system in main office');

    // Submit job
    await page.getByRole('button', { name: /create job/i }).click();

    // Should show success message
    await expect(page.getByText(/job created successfully/i)).toBeVisible();

    // Job should appear in list
    await expect(page.getByText('E2E Test HVAC Installation')).toBeVisible();

    // Open job details
    await page.getByText('E2E Test HVAC Installation').click();

    // Generate magic link
    await page.getByRole('button', { name: /generate magic link/i }).click();

    // Magic link should be displayed
    const magicLinkInput = page.getByLabel(/magic link/i);
    await expect(magicLinkInput).toBeVisible();

    const magicLink = await magicLinkInput.inputValue();
    expect(magicLink).toContain('/#/track/');

    // Store magic link for next test
    await context.storageState({ path: './tests/e2e/.auth/admin-with-job.json' });

    // Also store the magic link token in a file for technician test
    const token = magicLink.split('/#/track/')[1];
    await page.evaluate((tk) => {
      localStorage.setItem('e2e_magic_token', tk);
    }, token);
  });

  test('CP-03: Technician accesses job and submits evidence', async ({ page, browser }) => {
    test.setTimeout(120000);

    // Get the magic link token from the previous test
    const adminContext = await browser.newContext({
      storageState: './tests/e2e/.auth/admin-with-job.json',
    });
    const adminPage = await adminContext.newPage();
    const token = await adminPage.evaluate(() => {
      return localStorage.getItem('e2e_magic_token');
    });
    await adminContext.close();

    // Technician opens magic link
    await page.goto(`/#/track/${token}`);

    // Should load job details
    await expect(page.getByText('E2E Test HVAC Installation')).toBeVisible();
    await expect(page.getByText(TEST_CLIENT.name)).toBeVisible();

    // Step 1: Add "Before" photos
    await page.getByRole('button', { name: /add photo/i }).click();

    // Upload file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles('./tests/fixtures/sample-photo.jpg');

    // Set photo type
    await page.getByLabel(/photo type/i).selectOption('Before');

    // Wait for photo to appear
    await expect(page.getByText(/sample-photo.jpg/i)).toBeVisible({ timeout: 10000 });

    // Add "After" photo
    await page.getByRole('button', { name: /add photo/i }).click();
    await fileInput.setInputFiles('./tests/fixtures/sample-photo-2.jpg');
    await page.getByLabel(/photo type/i).selectOption('After');
    await expect(page.getByText(/sample-photo-2.jpg/i)).toBeVisible({ timeout: 10000 });

    // Step 2: Complete safety checklist
    const safetyCheckboxes = page.locator('[role="checkbox"]');
    const count = await safetyCheckboxes.count();
    for (let i = 0; i < count; i++) {
      await safetyCheckboxes.nth(i).check();
    }

    // Step 3: Add signature
    await page.getByLabel(/signer name/i).fill(TEST_TECHNICIAN.name);
    await page.getByLabel(/signer role/i).fill('Lead HVAC Technician');

    // Draw signature on canvas
    const canvas = page.locator('canvas[data-testid="signature-canvas"]');
    await canvas.hover();
    await page.mouse.down();
    await page.mouse.move(100, 50);
    await page.mouse.move(150, 100);
    await page.mouse.move(200, 50);
    await page.mouse.up();

    await page.getByRole('button', { name: /save signature/i }).click();
    await expect(page.getByText(/signature captured/i)).toBeVisible();

    // Step 4: Add work summary
    await page.getByLabel(/work summary/i).fill(
      'HVAC system installed successfully. All components tested and operational. No issues encountered.'
    );

    // Step 5: Submit job
    await page.getByRole('button', { name: /submit job/i }).click();

    // Should show success message
    await expect(page.getByText(/submitted successfully/i)).toBeVisible({ timeout: 15000 });

    // Should redirect to success page
    await expect(page).toHaveURL(/\/submission-success/, { timeout: 10000 });
  });

  test('CP-04: Admin reviews submission and seals evidence', async ({ page }) => {
    test.setTimeout(90000);

    // Login as admin
    await login(page, TEST_USER.email, TEST_USER.password);

    // Navigate to jobs
    await page.getByRole('link', { name: /jobs/i }).click();

    // Find submitted job
    const jobCard = page.locator('text=E2E Test HVAC Installation').first();
    await expect(jobCard).toBeVisible();

    // Click to view details
    await jobCard.click();

    // Should show job status as "Submitted"
    await expect(page.getByText(/status.*submitted/i)).toBeVisible();

    // Should show photos
    await expect(page.getByText(/sample-photo.jpg/i)).toBeVisible();
    await expect(page.getByText(/sample-photo-2.jpg/i)).toBeVisible();

    // Should show signature
    await expect(page.getByText(TEST_TECHNICIAN.name)).toBeVisible();
    await expect(page.getByText(/Lead HVAC Technician/i)).toBeVisible();

    // Should show work summary
    await expect(page.getByText(/HVAC system installed successfully/i)).toBeVisible();

    // Seal evidence
    await page.getByRole('button', { name: /seal evidence/i }).click();

    // Confirm sealing
    await page.getByRole('button', { name: /confirm seal/i }).click();

    // Should show sealing in progress
    await expect(page.getByText(/sealing evidence/i)).toBeVisible();

    // Should show success after sealing
    await expect(page.getByText(/evidence sealed successfully/i)).toBeVisible({
      timeout: 20000,
    });

    // Should show seal badge
    await expect(page.getByText(/sealed/i)).toBeVisible();

    // Should show evidence hash
    await expect(page.getByText(/evidence hash/i)).toBeVisible();

    // Job status should be "Archived"
    await expect(page.getByText(/status.*archived/i)).toBeVisible();
  });

  test('CP-05: Public user verifies sealed evidence', async ({ page }) => {
    test.setTimeout(60000);

    // Login as admin to get job ID
    await login(page, TEST_USER.email, TEST_USER.password);
    await page.getByRole('link', { name: /jobs/i }).click();

    const jobCard = page.locator('text=E2E Test HVAC Installation').first();
    await jobCard.click();

    // Get the public verification link
    const verifyLink = await page.getByLabel(/public verification link/i).inputValue();

    // Open in new context (simulate public user)
    await page.context().clearCookies();
    await page.goto(verifyLink);

    // Should show public job report
    await expect(page.getByText('E2E Test HVAC Installation')).toBeVisible();
    await expect(page.getByText(TEST_CLIENT.name)).toBeVisible();

    // Should show seal status
    await expect(page.getByText(/sealed/i)).toBeVisible();

    // Click verify button
    await page.getByRole('button', { name: /verify evidence/i }).click();

    // Should show verification in progress
    await expect(page.getByText(/verifying/i)).toBeVisible();

    // Should show verification success
    await expect(page.getByText(/evidence verified/i)).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/integrity confirmed/i)).toBeVisible();

    // Should display verification details
    await expect(page.getByText(/evidence hash/i)).toBeVisible();
    await expect(page.getByText(/sealed at/i)).toBeVisible();
    await expect(page.getByText(/sealed by/i)).toBeVisible();
  });
});

test.describe('CRITICAL PATH: Offline Capability', () => {
  test('CP-06: Technician works offline and syncs later', async ({ page, context }) => {
    test.setTimeout(120000);

    // Get magic link token (from previous test setup)
    const token = 'mock-offline-token'; // In real test, get from admin flow

    // Go offline BEFORE loading the app
    await context.setOffline(true);

    await page.goto(`/#/track/${token}`);

    // Should still load (from cache/service worker)
    await expect(page.getByText(/offline mode/i)).toBeVisible();

    // Add photos offline
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles('./tests/fixtures/sample-photo.jpg');

    // Should save to IndexedDB
    await expect(page.getByText(/saved locally/i)).toBeVisible();

    // Complete other fields
    await page.getByLabel(/work summary/i).fill('Completed work offline');

    // Submit job
    await page.getByRole('button', { name: /submit job/i }).click();

    // Should queue for sync
    await expect(page.getByText(/queued for sync/i)).toBeVisible();

    // Go back online
    await context.setOffline(false);

    // Should auto-sync
    await expect(page.getByText(/syncing/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/synced successfully/i)).toBeVisible({ timeout: 30000 });
  });
});

test.describe('CRITICAL PATH: Mobile Responsiveness', () => {
  test('CP-07: Technician completes job on mobile device', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Mobile-specific test');
    test.setTimeout(120000);

    const token = 'mock-mobile-token';

    await page.goto(`/#/track/${token}`);

    // Should display mobile-optimized UI
    await expect(page.getByRole('button', { name: /menu/i })).toBeVisible();

    // Test photo capture with camera (on mobile)
    await page.getByRole('button', { name: /camera/i }).click();

    // Should show camera interface (if supported)
    const cameraInput = page.locator('input[accept*="image"]');
    await expect(cameraInput).toHaveAttribute('capture', 'environment');

    // Test signature capture on touch screen
    const canvas = page.locator('canvas[data-testid="signature-canvas"]');
    await canvas.tap({ position: { x: 50, y: 50 } });
    await canvas.tap({ position: { x: 100, y: 100 } });

    // Should capture signature
    await expect(page.getByText(/signature captured/i)).toBeVisible();
  });
});

test.describe('CRITICAL PATH: Error Recovery', () => {
  test('CP-08: Handle session expiry during job submission', async ({ page }) => {
    test.setTimeout(90000);

    await login(page, TEST_USER.email, TEST_USER.password);

    // Start creating a job
    await page.getByRole('button', { name: /create job/i }).click();

    // Simulate session expiry by clearing cookies mid-flow
    await page.context().clearCookies();

    // Try to submit
    await page.getByRole('button', { name: /create job/i }).click();

    // Should detect session expiry
    await expect(page.getByText(/session expired/i)).toBeVisible();

    // Should redirect to login
    await expect(page).toHaveURL(/\/auth/);

    // Should preserve draft data in localStorage
    const draftData = await page.evaluate(() => {
      return Object.keys(localStorage).filter((key) => key.startsWith('jobproof_draft_'));
    });
    expect(draftData.length).toBeGreaterThan(0);
  });

  test('CP-09: Recover from failed photo upload', async ({ page, context }) => {
    test.setTimeout(90000);

    const token = 'mock-token';
    await page.goto(`/#/track/${token}`);

    // Simulate network failure
    await context.route('**/storage/v1/**', (route) => route.abort());

    // Try to upload photo
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles('./tests/fixtures/sample-photo.jpg');

    // Should show upload error
    await expect(page.getByText(/upload failed/i)).toBeVisible({ timeout: 15000 });

    // Should offer retry
    const retryButton = page.getByRole('button', { name: /retry/i });
    await expect(retryButton).toBeVisible();

    // Restore network
    await context.unroute('**/storage/v1/**');

    // Retry upload
    await retryButton.click();

    // Should succeed
    await expect(page.getByText(/upload successful/i)).toBeVisible({ timeout: 15000 });
  });
});
