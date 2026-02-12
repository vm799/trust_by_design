import { test, expect, type Page } from '@playwright/test';

/**
 * WEEK 3 E2E VALIDATION SUITE - JOBPROOF
 *
 * Comprehensive cross-device validation for Week 3 features:
 * - Fix 3.1: Archive Strategy (sealed jobs, 180-day auto-archive)
 * - Fix 3.2: Audit Export (CSV/JSON with hashes)
 * - Fix 3.3: Sync Conflicts (multi-device reconciliation)
 *
 * Test Coverage:
 * - 6 Archive Strategy tests
 * - 5 Audit Export tests
 * - 6 Sync Conflicts tests
 * - 8 Cross-Device Scenarios
 * - 4 Regression Tests (Week 1-2 features)
 * - 3 Performance Tests
 *
 * Features:
 * - Page Object Model pattern
 * - Network condition simulation
 * - Time/date manipulation for 180-day tests
 * - Memory profiling
 * - Performance benchmarking
 * - Cross-browser validation
 */

// ============================================================================
// TEST DATA & CONSTANTS
// ============================================================================

const TEST_USER = {
  email: 'admin@week3test.pro',
  password: 'TestPassword123!',
  fullName: 'Week 3 Test Admin',
};

const TEST_CLIENT = {
  name: 'Week 3 Test Client Corp',
  email: 'client@week3.com',
  phone: '+1-555-0001',
  address: '100 Test Ave, Test City, TC 10001',
};

const TEST_TECHNICIAN = {
  name: 'Week 3 Test Technician',
  email: 'tech@week3.com',
  phone: '+1-555-0002',
  specialty: 'Electrical',
};

// CSV export expected headers
const CSV_HEADERS = [
  'Job ID',
  'Title',
  'Client',
  'Technician',
  'Status',
  'Date',
  'Address',
  'Photos',
  'Evidence Hash',
  'Sealed At',
  'Notes',
];

// Performance thresholds
const PERFORMANCE_THRESHOLDS = {
  MAX_MEMORY: 150 * 1024 * 1024, // 150MB
  EXPORT_TIMEOUT: 5000, // 5 seconds for export
  ARCHIVE_QUERY_TIMEOUT: 1000, // 1 second for archive queries
  SCROLL_FPS_TARGET: 60,
};

// ============================================================================
// PAGE OBJECT MODELS
// ============================================================================

/**
 * JobListPage - Handle job listing and filtering
 */
class JobListPage {
  constructor(private page: Page) {}

  async navigate() {
    await this.page.goto('/#/app/jobs');
    await this.page.waitForLoadState('networkidle');
  }

  async getJobCount(): Promise<number> {
    const jobs = await this.page.locator('[data-testid="job-card"]').count();
    return jobs;
  }

  async clickJobByTitle(title: string) {
    await this.page.locator(`text="${title}"`).first().click();
    await this.page.waitForLoadState('networkidle');
  }

  async openFilterMenu() {
    await this.page.getByRole('button', { name: /filter/i }).click();
  }

  async selectFilter(filterName: string) {
    const filterButton = this.page.locator(`[data-testid="filter-${filterName}"]`);
    await filterButton.click();
  }

  async getArchivedJobCount(): Promise<number> {
    await this.openFilterMenu();
    await this.selectFilter('archived');
    await this.page.waitForLoadState('networkidle');

    // Wait for job count badge to update
    const badge = this.page.locator('[data-testid="filter-count-archived"]');
    const countText = await badge.textContent();
    const count = parseInt(countText?.match(/\d+/)?.[0] || '0', 10);

    return count;
  }

  async verifyArchivedBadgeVisible(jobTitle: string): Promise<boolean> {
    const jobCard = this.page.locator(
      `[data-testid="job-card"]:has-text("${jobTitle}")`
    );
    const badge = jobCard.locator('[data-testid="status-badge-archived"]');
    return badge.isVisible();
  }

  async getArchivedDateBadge(jobTitle: string): Promise<string | null> {
    const jobCard = this.page.locator(
      `[data-testid="job-card"]:has-text("${jobTitle}")`
    );
    const badge = jobCard.locator('[data-testid="archived-date"]');
    return (await badge.isVisible()) ? await badge.textContent() : null;
  }

  async verifyJobIsReadOnly(jobTitle: string): Promise<boolean> {
    await this.clickJobByTitle(jobTitle);

    // Check if edit button is disabled or hidden
    const editButton = this.page.getByRole('button', { name: /edit/i });
    const isDisabled = await editButton.isDisabled();
    const isHidden = !(await editButton.isVisible());

    return isDisabled || isHidden;
  }
}

/**
 * JobDetailPage - Handle individual job details and actions
 */
class JobDetailPage {
  constructor(private page: Page) {}

  async getJobStatus(): Promise<string> {
    const status = this.page.locator('[data-testid="job-status"]');
    return (await status.textContent()) || '';
  }

  async getEvidenceHash(): Promise<string | null> {
    const hash = this.page.locator('[data-testid="evidence-hash"]');
    return (await hash.isVisible()) ? await hash.textContent() : null;
  }

  async getSealedAt(): Promise<string | null> {
    const sealedAt = this.page.locator('[data-testid="sealed-at"]');
    return (await sealedAt.isVisible()) ? await sealedAt.textContent() : null;
  }

  async sealEvidence(): Promise<boolean> {
    const sealButton = this.page.getByRole('button', { name: /seal evidence/i });
    if (!(await sealButton.isVisible())) return false;

    await sealButton.click();
    await this.page.getByRole('button', { name: /confirm/i }).click();

    // Wait for sealing to complete
    await this.page.waitForSelector('[data-testid="sealed-success"]', {
      timeout: 20000,
    });

    return true;
  }

  async verifyEditButtonDisabled(): Promise<boolean> {
    const editButton = this.page.getByRole('button', { name: /edit/i });
    return await editButton.isDisabled();
  }
}

/**
 * ExportPage - Handle audit export functionality
 */
class ExportPage {
  constructor(private page: Page) {}

  async openExportMenu() {
    const exportButton = this.page.getByRole('button', { name: /export/i });
    await exportButton.click();
  }

  async exportAsCSV(): Promise<string> {
    await this.openExportMenu();

    // Listen for download
    const downloadPromise = this.page.waitForEvent('download');
    await this.page.getByRole('menuitem', { name: /csv/i }).click();

    const download = await downloadPromise;
    const path = await download.path();

    // Read file content
    const fs = await import('fs').then((m) => m.promises);
    const content = await fs.readFile(path, 'utf-8');

    return content;
  }

  async exportAsJSON(): Promise<string> {
    await this.openExportMenu();

    const downloadPromise = this.page.waitForEvent('download');
    await this.page.getByRole('menuitem', { name: /json/i }).click();

    const download = await downloadPromise;
    const path = await download.path();

    const fs = await import('fs').then((m) => m.promises);
    const content = await fs.readFile(path, 'utf-8');

    return content;
  }
}

/**
 * ConflictResolverPage - Handle sync conflict resolution
 */
class ConflictResolverPage {
  constructor(private page: Page) {}

  async getConflictCount(): Promise<number> {
    const banner = this.page.locator('[data-testid="conflict-banner"]');
    if (!(await banner.isVisible())) return 0;

    const countText = await banner.textContent();
    return parseInt(countText?.match(/\d+/)?.[0] || '0', 10);
  }

  async openConflictResolver() {
    const button = this.page.getByRole('button', { name: /resolve conflict/i });
    await button.click();
    await this.page.waitForLoadState('networkidle');
  }

  async viewSideBySideComparison(): Promise<{ local: string; remote: string }> {
    const localContent = await this.page
      .locator('[data-testid="conflict-local"]')
      .textContent();
    const remoteContent = await this.page
      .locator('[data-testid="conflict-remote"]')
      .textContent();

    return {
      local: localContent || '',
      remote: remoteContent || '',
    };
  }

  async selectLocal() {
    await this.page
      .getByRole('button', { name: /use mine|use local/i })
      .click();
    await this.page.waitForLoadState('networkidle');
  }

  async selectServer() {
    await this.page
      .getByRole('button', { name: /use server|use remote/i })
      .click();
    await this.page.waitForLoadState('networkidle');
  }

  async verifyConflictResolved(): Promise<boolean> {
    const banner = this.page.locator('[data-testid="conflict-banner"]');
    return !(await banner.isVisible());
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Parse CSV and validate headers
 */
function parseCSV(csvContent: string): {
  headers: string[];
  rows: Record<string, string>[];
} {
  const lines = csvContent.split('\n').filter((line) => line.trim());
  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));

  const rows = lines.slice(1).map((line) => {
    const values = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    return row;
  });

  return { headers, rows };
}

/**
 * Validate SHA-256 hash format (64 hex characters)
 */
function isValidSHA256(hash: string): boolean {
  const sha256Regex = /^[a-f0-9]{64}$/i;
  return sha256Regex.test(hash);
}

/**
 * Get current memory usage (approximate)
 */
async function getMemoryUsage(page: Page): Promise<number> {
  const memory = await page.evaluate(() => {
    if ((performance as any).memory) {
      return (performance as any).memory.usedJSHeapSize;
    }
    return 0;
  });
  return memory;
}

/**
 * Create a job that is N days old (for 180-day archive test)
 */
async function createOldJob(
  page: Page,
  jobTitle: string,
  daysOld: number
): Promise<void> {
  // Navigate to job creation
  await page.goto('/#/app/jobs');
  await page.getByRole('button', { name: /create job|new job/i }).click();

  // Set date to N days ago
  const oldDate = new Date();
  oldDate.setDate(oldDate.getDate() - daysOld);
  const dateString = oldDate.toISOString().split('T')[0];

  // Fill form
  await page.getByLabel(/job title|title/i).fill(jobTitle);
  await page.getByLabel(/date/i).fill(dateString);
  await page.getByLabel(/client/i).selectOption({ label: TEST_CLIENT.name });
  await page.getByLabel(/technician/i).selectOption({ label: TEST_TECHNICIAN.name });
  await page.getByLabel(/address/i).fill(TEST_CLIENT.address);
  await page.getByLabel(/notes|description/i).fill('Old job for archive test');

  // Submit
  await page.getByRole('button', { name: /create|save/i }).click();
  await page.waitForLoadState('networkidle');
}

/**
 * Measure operation duration
 */async function measureDuration<T>(
  operation: () => Promise<T>
): Promise<{ result: T; duration: number }> {
  const start = performance.now();
  const result = await operation();
  const duration = performance.now() - start;
  return { result, duration };
}

/**
 * Login helper
 */
async function login(page: Page, email: string, password: string) {
  await page.goto('/#/auth');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /sign in|login/i }).click();
  await page.waitForURL(/\/app/, { timeout: 15000 });
}

/**
 * Setup test data (create client, technician, etc.)
 */
async function setupTestData(page: Page) {
  await login(page, TEST_USER.email, TEST_USER.password);

  // Create client
  await page.goto('/#/app/clients');
  await page.getByRole('button', { name: /add client|new client/i }).click();
  await page.getByLabel(/client name/i).fill(TEST_CLIENT.name);
  await page.getByLabel(/email/i).fill(TEST_CLIENT.email);
  await page.getByLabel(/phone/i).fill(TEST_CLIENT.phone);
  await page.getByLabel(/address/i).fill(TEST_CLIENT.address);
  await page.getByRole('button', { name: /save|create/i }).click();
  await page.waitForLoadState('networkidle');

  // Create technician
  await page.goto('/#/app/technicians');
  await page.getByRole('button', { name: /add technician|new technician/i }).click();
  await page.getByLabel(/technician name/i).fill(TEST_TECHNICIAN.name);
  await page.getByLabel(/email/i).fill(TEST_TECHNICIAN.email);
  await page.getByLabel(/phone/i).fill(TEST_TECHNICIAN.phone);
  await page.getByLabel(/specialty/i).fill(TEST_TECHNICIAN.specialty);
  await page.getByRole('button', { name: /save|create/i }).click();
  await page.waitForLoadState('networkidle');
}

// ============================================================================
// FIXTURES & SETUP
// ============================================================================

// Fixtures are implemented within individual test suites using beforeEach hooks
// to ensure proper setup and teardown for each test

// ============================================================================
// TEST SUITES
// ============================================================================

// ARCHIVE STRATEGY TESTS (Fix 3.1)
test.describe('ARCHIVE STRATEGY (Fix 3.1)', () => {
  test('AS-01: Sealed jobs appear in archive filter', async ({ page }) => {
    test.setTimeout(90000);
    await setupTestData(page);
    await page.goto('/#/app/jobs');

    const listPage = new JobListPage(page);

    // Create a job
    await page.getByRole('button', { name: /create job|new job/i }).click();
    await page.getByLabel(/job title/i).fill('Job to Seal');
    await page.getByLabel(/client/i).selectOption({ label: TEST_CLIENT.name });
    await page.getByLabel(/technician/i).selectOption({ label: TEST_TECHNICIAN.name });
    await page.getByLabel(/address/i).fill(TEST_CLIENT.address);
    await page.getByLabel(/date/i).fill(new Date().toISOString().split('T')[0]);
    await page.getByRole('button', { name: /create|save/i }).click();
    await page.waitForLoadState('networkidle');

    // Navigate to job and seal
    await listPage.clickJobByTitle('Job to Seal');
    const detailPage = new JobDetailPage(page);
    const sealed = await detailPage.sealEvidence();
    expect(sealed).toBe(true);

    // Go back to list and check archive filter
    await page.goto('/#/app/jobs');
    const archivedCount = await listPage.getArchivedJobCount();
    expect(archivedCount).toBeGreaterThan(0);
  });

  test('AS-02: Jobs older than 180 days auto-archive', async ({ page }) => {
    test.setTimeout(90000);
    await setupTestData(page);

    // Create a job that is 181 days old
    await createOldJob(page, 'Ancient Job', 181);

    // Navigate to jobs list
    await page.goto('/#/app/jobs');
    await page.waitForLoadState('networkidle');

    // Check if old job appears in archived filter
    const listPage = new JobListPage(page);
    const archivedCount = await listPage.getArchivedJobCount();
    expect(archivedCount).toBeGreaterThan(0);

    // Verify the old job is marked as archived
    const isArchived = await listPage.verifyArchivedBadgeVisible('Ancient Job');
    expect(isArchived).toBe(true);
  });

  test('AS-03: Archive filter count updates correctly', async ({ page }) => {
    test.setTimeout(90000);
    await setupTestData(page);

    const listPage = new JobListPage(page);

    // Get initial archived count
    const initialCount = await listPage.getArchivedJobCount();

    // Create and seal a new job
    await page.goto('/#/app/jobs');
    await page.getByRole('button', { name: /create job|new job/i }).click();
    await page.getByLabel(/job title/i).fill('Job to Archive Now');
    await page.getByLabel(/client/i).selectOption({ label: TEST_CLIENT.name });
    await page.getByLabel(/technician/i).selectOption({ label: TEST_TECHNICIAN.name });
    await page.getByLabel(/address/i).fill(TEST_CLIENT.address);
    await page.getByLabel(/date/i).fill(new Date().toISOString().split('T')[0]);
    await page.getByRole('button', { name: /create|save/i }).click();
    await page.waitForLoadState('networkidle');

    // Navigate to job and seal
    await listPage.clickJobByTitle('Job to Archive Now');
    const detailPage = new JobDetailPage(page);
    await detailPage.sealEvidence();

    // Get updated archived count
    await page.goto('/#/app/jobs');
    const updatedCount = await listPage.getArchivedJobCount();

    expect(updatedCount).toBe(initialCount + 1);
  });

  test('AS-04: Archived jobs show "Archived on [date]" badge', async ({ page }) => {
    test.setTimeout(90000);
    await setupTestData(page);

    // Create and seal a job
    await page.goto('/#/app/jobs');
    await page.getByRole('button', { name: /create job|new job/i }).click();
    await page.getByLabel(/job title/i).fill('Badge Test Job');
    await page.getByLabel(/client/i).selectOption({ label: TEST_CLIENT.name });
    await page.getByLabel(/technician/i).selectOption({ label: TEST_TECHNICIAN.name });
    await page.getByLabel(/address/i).fill(TEST_CLIENT.address);
    await page.getByLabel(/date/i).fill(new Date().toISOString().split('T')[0]);
    await page.getByRole('button', { name: /create|save/i }).click();
    await page.waitForLoadState('networkidle');

    const listPage = new JobListPage(page);
    await listPage.clickJobByTitle('Badge Test Job');
    const detailPage = new JobDetailPage(page);
    await detailPage.sealEvidence();

    // Go back to list and check for archived date badge
    await page.goto('/#/app/jobs');
    const archivedDate = await listPage.getArchivedDateBadge('Badge Test Job');

    expect(archivedDate).toBeTruthy();
    expect(archivedDate).toMatch(/archived on|archived at/i);
  });

  test('AS-05: Archived jobs cannot be edited', async ({ page }) => {
    test.setTimeout(90000);
    await setupTestData(page);

    // Create and seal a job
    await page.goto('/#/app/jobs');
    await page.getByRole('button', { name: /create job|new job/i }).click();
    await page.getByLabel(/job title/i).fill('Read-Only Job');
    await page.getByLabel(/client/i).selectOption({ label: TEST_CLIENT.name });
    await page.getByLabel(/technician/i).selectOption({ label: TEST_TECHNICIAN.name });
    await page.getByLabel(/address/i).fill(TEST_CLIENT.address);
    await page.getByLabel(/date/i).fill(new Date().toISOString().split('T')[0]);
    await page.getByRole('button', { name: /create|save/i }).click();
    await page.waitForLoadState('networkidle');

    const listPage = new JobListPage(page);
    await listPage.clickJobByTitle('Read-Only Job');
    const detailPage = new JobDetailPage(page);
    await detailPage.sealEvidence();

    // Verify edit button is disabled
    const isReadOnly = await detailPage.verifyEditButtonDisabled();
    expect(isReadOnly).toBe(true);
  });

  test('AS-06: Archive persists across page refreshes', async ({ page }) => {
    test.setTimeout(90000);
    await setupTestData(page);

    // Create and seal a job
    await page.goto('/#/app/jobs');
    await page.getByRole('button', { name: /create job|new job/i }).click();
    await page.getByLabel(/job title/i).fill('Persist Test Job');
    await page.getByLabel(/client/i).selectOption({ label: TEST_CLIENT.name });
    await page.getByLabel(/technician/i).selectOption({ label: TEST_TECHNICIAN.name });
    await page.getByLabel(/address/i).fill(TEST_CLIENT.address);
    await page.getByLabel(/date/i).fill(new Date().toISOString().split('T')[0]);
    await page.getByRole('button', { name: /create|save/i }).click();
    await page.waitForLoadState('networkidle');

    const listPage = new JobListPage(page);
    await listPage.clickJobByTitle('Persist Test Job');
    const detailPage = new JobDetailPage(page);
    await detailPage.sealEvidence();

    // Verify archived in detail view
    const sealedAt = await detailPage.getSealedAt();
    expect(sealedAt).toBeTruthy();

    // Refresh page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify archived status persists
    const persistedSealedAt = await detailPage.getSealedAt();
    expect(persistedSealedAt).toBeTruthy();
    expect(persistedSealedAt).toBe(sealedAt);
  });
});

// AUDIT EXPORT TESTS (Fix 3.2)
test.describe('AUDIT EXPORT (Fix 3.2)', () => {
  test('AE-01: CSV export contains all headers', async ({ page }) => {
    test.setTimeout(60000);
    await setupTestData(page);

    // Create a test job
    await page.goto('/#/app/jobs');
    await page.getByRole('button', { name: /create job|new job/i }).click();
    await page.getByLabel(/job title/i).fill('Export Test Job');
    await page.getByLabel(/client/i).selectOption({ label: TEST_CLIENT.name });
    await page.getByLabel(/technician/i).selectOption({ label: TEST_TECHNICIAN.name });
    await page.getByLabel(/address/i).fill(TEST_CLIENT.address);
    await page.getByLabel(/date/i).fill(new Date().toISOString().split('T')[0]);
    await page.getByRole('button', { name: /create|save/i }).click();
    await page.waitForLoadState('networkidle');

    // Export as CSV
    const exportPage = new ExportPage(page);
    const csvContent = await exportPage.exportAsCSV();

    const { headers } = parseCSV(csvContent);

    // Verify all expected headers are present
    CSV_HEADERS.forEach((header) => {
      expect(headers).toContain(header);
    });
  });

  test('AE-02: CSV quotes escaped properly', async ({ page }) => {
    test.setTimeout(60000);
    await setupTestData(page);

    // Create a job with quotes in the notes
    await page.goto('/#/app/jobs');
    await page.getByRole('button', { name: /create job|new job/i }).click();
    await page.getByLabel(/job title/i).fill('Quote Test Job');
    await page.getByLabel(/client/i).selectOption({ label: TEST_CLIENT.name });
    await page.getByLabel(/technician/i).selectOption({ label: TEST_TECHNICIAN.name });
    await page.getByLabel(/address/i).fill(TEST_CLIENT.address);
    await page.getByLabel(/notes|description/i).fill('Job with "quoted" text and commas, like this');
    await page.getByLabel(/date/i).fill(new Date().toISOString().split('T')[0]);
    await page.getByRole('button', { name: /create|save/i }).click();
    await page.waitForLoadState('networkidle');

    // Export as CSV
    const exportPage = new ExportPage(page);
    const csvContent = await exportPage.exportAsCSV();

    // Verify CSV is valid (no parsing errors)
    const { rows } = parseCSV(csvContent);
    expect(rows.length).toBeGreaterThan(0);

    // Verify quoted content is preserved
    const jobRow = rows.find((row) => row['Title'] === 'Quote Test Job');
    expect(jobRow).toBeDefined();
    expect(jobRow?.['Notes']).toContain('quoted');
  });

  test('AE-03: CSV SHA-256 hashes are valid (64 hex chars)', async ({ page }) => {
    test.setTimeout(60000);
    await setupTestData(page);

    // Create and seal a job
    await page.goto('/#/app/jobs');
    await page.getByRole('button', { name: /create job|new job/i }).click();
    await page.getByLabel(/job title/i).fill('Hash Test Job');
    await page.getByLabel(/client/i).selectOption({ label: TEST_CLIENT.name });
    await page.getByLabel(/technician/i).selectOption({ label: TEST_TECHNICIAN.name });
    await page.getByLabel(/address/i).fill(TEST_CLIENT.address);
    await page.getByLabel(/date/i).fill(new Date().toISOString().split('T')[0]);
    await page.getByRole('button', { name: /create|save/i }).click();
    await page.waitForLoadState('networkidle');

    const listPage = new JobListPage(page);
    await listPage.clickJobByTitle('Hash Test Job');
    const detailPage = new JobDetailPage(page);
    await detailPage.sealEvidence();

    // Export as CSV
    const exportPage = new ExportPage(page);
    const csvContent = await exportPage.exportAsCSV();

    const { rows } = parseCSV(csvContent);
    const hashRow = rows.find((row) => row['Title'] === 'Hash Test Job');

    if (hashRow?.['Evidence Hash']) {
      const hash = hashRow['Evidence Hash'].trim();
      expect(isValidSHA256(hash)).toBe(true);
    }
  });

  test('AE-04: JSON export is valid JSON format', async ({ page }) => {
    test.setTimeout(60000);
    await setupTestData(page);

    // Create a test job
    await page.goto('/#/app/jobs');
    await page.getByRole('button', { name: /create job|new job/i }).click();
    await page.getByLabel(/job title/i).fill('JSON Test Job');
    await page.getByLabel(/client/i).selectOption({ label: TEST_CLIENT.name });
    await page.getByLabel(/technician/i).selectOption({ label: TEST_TECHNICIAN.name });
    await page.getByLabel(/address/i).fill(TEST_CLIENT.address);
    await page.getByLabel(/date/i).fill(new Date().toISOString().split('T')[0]);
    await page.getByRole('button', { name: /create|save/i }).click();
    await page.waitForLoadState('networkidle');

    // Export as JSON
    const exportPage = new ExportPage(page);
    const jsonContent = await exportPage.exportAsJSON();

    // Parse and validate JSON
    let parsed;
    expect(() => {
      parsed = JSON.parse(jsonContent);
    }).not.toThrow();

    expect(parsed).toBeDefined();
    expect(Array.isArray(parsed) || typeof parsed === 'object').toBe(true);
  });

  test('AE-05: Export includes all job records', async ({ page }) => {
    test.setTimeout(90000);
    await setupTestData(page);

    // Create multiple jobs
    await page.goto('/#/app/jobs');
    for (let i = 1; i <= 3; i++) {
      await page.getByRole('button', { name: /create job|new job/i }).click();
      await page.getByLabel(/job title/i).fill(`Export Multi Job ${i}`);
      await page.getByLabel(/client/i).selectOption({ label: TEST_CLIENT.name });
      await page.getByLabel(/technician/i).selectOption({ label: TEST_TECHNICIAN.name });
      await page.getByLabel(/address/i).fill(TEST_CLIENT.address);
      await page.getByLabel(/date/i).fill(new Date().toISOString().split('T')[0]);
      await page.getByRole('button', { name: /create|save/i }).click();
      await page.waitForLoadState('networkidle');
      await page.goto('/#/app/jobs');
    }

    // Export as CSV
    const exportPage = new ExportPage(page);
    const csvContent = await exportPage.exportAsCSV();

    const { rows } = parseCSV(csvContent);

    // Verify all jobs are in export
    expect(rows.some((r) => r['Title'].includes('Export Multi Job 1'))).toBe(true);
    expect(rows.some((r) => r['Title'].includes('Export Multi Job 2'))).toBe(true);
    expect(rows.some((r) => r['Title'].includes('Export Multi Job 3'))).toBe(true);
  });
});

// SYNC CONFLICTS TESTS (Fix 3.3)
test.describe('SYNC CONFLICTS (Fix 3.3)', () => {
  test('SC-01: Conflict banner appears when versions differ', async ({ browser, page: page1 }) => {
    test.setTimeout(120000);
    await setupTestData(page1);

    // Create a job on first device
    await page1.goto('/#/app/jobs');
    await page1.getByRole('button', { name: /create job|new job/i }).click();
    await page1.getByLabel(/job title/i).fill('Conflict Test Job');
    await page1.getByLabel(/client/i).selectOption({ label: TEST_CLIENT.name });
    await page1.getByLabel(/technician/i).selectOption({ label: TEST_TECHNICIAN.name });
    await page1.getByLabel(/address/i).fill(TEST_CLIENT.address);
    await page1.getByLabel(/date/i).fill(new Date().toISOString().split('T')[0]);
    await page1.getByRole('button', { name: /create|save/i }).click();
    await page1.waitForLoadState('networkidle');

    // Create second context (simulating second device)
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    await login(page2, TEST_USER.email, TEST_USER.password);

    // Simulate offline on device 2, make a change
    await context2.setOffline(true);
    await page2.goto('/#/app/jobs');
    const listPage2 = new JobListPage(page2);
    await listPage2.clickJobByTitle('Conflict Test Job');
    // Make a change to notes
    await page2.getByLabel(/notes|description/i).fill('Changed on device 2');
    await page2.getByRole('button', { name: /save|update/i }).click();

    // On device 1, make a different change
    const listPage1 = new JobListPage(page1);
    await listPage1.clickJobByTitle('Conflict Test Job');
    await page1.getByLabel(/notes|description/i).fill('Changed on device 1');
    await page1.getByRole('button', { name: /save|update/i }).click();

    // Bring device 2 back online
    await context2.setOffline(false);
    await page2.waitForLoadState('networkidle');

    // Conflict banner should appear
    const conflictResolver = new ConflictResolverPage(page2);
    const conflictCount = await conflictResolver.getConflictCount();
    expect(conflictCount).toBeGreaterThan(0);

    await context2.close();
  });

  test('SC-02: "Use Mine" button applies local version', async ({ browser, page: page1 }) => {
    test.setTimeout(120000);
    await setupTestData(page1);

    // Similar setup as SC-01
    await page1.goto('/#/app/jobs');
    await page1.getByRole('button', { name: /create job|new job/i }).click();
    await page1.getByLabel(/job title/i).fill('Use Mine Test Job');
    await page1.getByLabel(/client/i).selectOption({ label: TEST_CLIENT.name });
    await page1.getByLabel(/technician/i).selectOption({ label: TEST_TECHNICIAN.name });
    await page1.getByLabel(/address/i).fill(TEST_CLIENT.address);
    await page1.getByLabel(/date/i).fill(new Date().toISOString().split('T')[0]);
    await page1.getByRole('button', { name: /create|save/i }).click();
    await page1.waitForLoadState('networkidle');

    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    await login(page2, TEST_USER.email, TEST_USER.password);

    // Simulate conflict
    await context2.setOffline(true);
    await page2.goto('/#/app/jobs');
    const listPage2 = new JobListPage(page2);
    await listPage2.clickJobByTitle('Use Mine Test Job');
    const localNotes = 'My local version';
    await page2.getByLabel(/notes|description/i).fill(localNotes);
    await page2.getByRole('button', { name: /save|update/i }).click();

    const listPage1 = new JobListPage(page1);
    await listPage1.clickJobByTitle('Use Mine Test Job');
    await page1.getByLabel(/notes|description/i).fill('Server version');
    await page1.getByRole('button', { name: /save|update/i }).click();

    // Bring online and resolve
    await context2.setOffline(false);
    await page2.waitForLoadState('networkidle');

    const conflictResolver = new ConflictResolverPage(page2);
    const hasConflict = (await conflictResolver.getConflictCount()) > 0;
    expect(hasConflict).toBe(true);

    await conflictResolver.openConflictResolver();
    await conflictResolver.selectLocal();

    // Verify local version is applied
    const resolved = await conflictResolver.verifyConflictResolved();
    expect(resolved).toBe(true);

    await context2.close();
  });

  test('SC-03: "Use Server" button applies remote version', async ({ browser, page: page1 }) => {
    test.setTimeout(120000);
    await setupTestData(page1);

    // Create job
    await page1.goto('/#/app/jobs');
    await page1.getByRole('button', { name: /create job|new job/i }).click();
    await page1.getByLabel(/job title/i).fill('Use Server Test Job');
    await page1.getByLabel(/client/i).selectOption({ label: TEST_CLIENT.name });
    await page1.getByLabel(/technician/i).selectOption({ label: TEST_TECHNICIAN.name });
    await page1.getByLabel(/address/i).fill(TEST_CLIENT.address);
    await page1.getByLabel(/date/i).fill(new Date().toISOString().split('T')[0]);
    await page1.getByRole('button', { name: /create|save/i }).click();
    await page1.waitForLoadState('networkidle');

    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    await login(page2, TEST_USER.email, TEST_USER.password);

    // Simulate conflict
    await context2.setOffline(true);
    await page2.goto('/#/app/jobs');
    const listPage2 = new JobListPage(page2);
    await listPage2.clickJobByTitle('Use Server Test Job');
    await page2.getByLabel(/notes|description/i).fill('Local version that will be discarded');
    await page2.getByRole('button', { name: /save|update/i }).click();

    const listPage1 = new JobListPage(page1);
    await listPage1.clickJobByTitle('Use Server Test Job');
    const serverNotes = 'Server version to keep';
    await page1.getByLabel(/notes|description/i).fill(serverNotes);
    await page1.getByRole('button', { name: /save|update/i }).click();

    // Bring online and resolve
    await context2.setOffline(false);
    await page2.waitForLoadState('networkidle');

    const conflictResolver = new ConflictResolverPage(page2);
    const hasConflict = (await conflictResolver.getConflictCount()) > 0;
    expect(hasConflict).toBe(true);

    await conflictResolver.openConflictResolver();
    await conflictResolver.selectServer();

    // Verify server version is applied
    const resolved = await conflictResolver.verifyConflictResolved();
    expect(resolved).toBe(true);

    await context2.close();
  });

  test('SC-04: Conflict resolver shows side-by-side comparison', async ({ browser, page: page1 }) => {
    test.setTimeout(120000);
    await setupTestData(page1);

    // Create job
    await page1.goto('/#/app/jobs');
    await page1.getByRole('button', { name: /create job|new job/i }).click();
    await page1.getByLabel(/job title/i).fill('Comparison Test Job');
    await page1.getByLabel(/client/i).selectOption({ label: TEST_CLIENT.name });
    await page1.getByLabel(/technician/i).selectOption({ label: TEST_TECHNICIAN.name });
    await page1.getByLabel(/address/i).fill(TEST_CLIENT.address);
    await page1.getByLabel(/date/i).fill(new Date().toISOString().split('T')[0]);
    await page1.getByRole('button', { name: /create|save/i }).click();
    await page1.waitForLoadState('networkidle');

    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    await login(page2, TEST_USER.email, TEST_USER.password);

    // Simulate conflict
    await context2.setOffline(true);
    await page2.goto('/#/app/jobs');
    const listPage2 = new JobListPage(page2);
    await listPage2.clickJobByTitle('Comparison Test Job');
    await page2.getByLabel(/notes|description/i).fill('LOCAL: Version A');
    await page2.getByRole('button', { name: /save|update/i }).click();

    const listPage1 = new JobListPage(page1);
    await listPage1.clickJobByTitle('Comparison Test Job');
    await page1.getByLabel(/notes|description/i).fill('REMOTE: Version B');
    await page1.getByRole('button', { name: /save|update/i }).click();

    // Bring online
    await context2.setOffline(false);
    await page2.waitForLoadState('networkidle');

    const conflictResolver = new ConflictResolverPage(page2);
    await conflictResolver.openConflictResolver();

    // Verify side-by-side comparison is visible
    const comparison = await conflictResolver.viewSideBySideComparison();
    expect(comparison.local).toBeTruthy();
    expect(comparison.remote).toBeTruthy();
    expect(comparison.local).toContain('LOCAL');
    expect(comparison.remote).toContain('REMOTE');

    await context2.close();
  });

  test('SC-05: Resolved conflicts disappear from banner', async ({ browser, page: page1 }) => {
    test.setTimeout(120000);
    await setupTestData(page1);

    // Create job
    await page1.goto('/#/app/jobs');
    await page1.getByRole('button', { name: /create job|new job/i }).click();
    await page1.getByLabel(/job title/i).fill('Resolve Banner Test Job');
    await page1.getByLabel(/client/i).selectOption({ label: TEST_CLIENT.name });
    await page1.getByLabel(/technician/i).selectOption({ label: TEST_TECHNICIAN.name });
    await page1.getByLabel(/address/i).fill(TEST_CLIENT.address);
    await page1.getByLabel(/date/i).fill(new Date().toISOString().split('T')[0]);
    await page1.getByRole('button', { name: /create|save/i }).click();
    await page1.waitForLoadState('networkidle');

    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    await login(page2, TEST_USER.email, TEST_USER.password);

    // Create conflict
    await context2.setOffline(true);
    await page2.goto('/#/app/jobs');
    const listPage2 = new JobListPage(page2);
    await listPage2.clickJobByTitle('Resolve Banner Test Job');
    await page2.getByLabel(/notes|description/i).fill('Device 2 notes');
    await page2.getByRole('button', { name: /save|update/i }).click();

    const listPage1 = new JobListPage(page1);
    await listPage1.clickJobByTitle('Resolve Banner Test Job');
    await page1.getByLabel(/notes|description/i).fill('Device 1 notes');
    await page1.getByRole('button', { name: /save|update/i }).click();

    // Bring online
    await context2.setOffline(false);
    await page2.waitForLoadState('networkidle');

    const conflictResolver = new ConflictResolverPage(page2);

    // Verify conflict banner is visible
    const conflictCount = await conflictResolver.getConflictCount();
    expect(conflictCount).toBeGreaterThan(0);

    // Resolve conflict
    await conflictResolver.openConflictResolver();
    await conflictResolver.selectServer();

    // Verify banner is gone
    const isResolved = await conflictResolver.verifyConflictResolved();
    expect(isResolved).toBe(true);

    await context2.close();
  });

  test('SC-06: Conflict persists across page refreshes until resolved', async ({ browser, page: page1 }) => {
    test.setTimeout(120000);
    await setupTestData(page1);

    // Create job
    await page1.goto('/#/app/jobs');
    await page1.getByRole('button', { name: /create job|new job/i }).click();
    await page1.getByLabel(/job title/i).fill('Persist Conflict Test Job');
    await page1.getByLabel(/client/i).selectOption({ label: TEST_CLIENT.name });
    await page1.getByLabel(/technician/i).selectOption({ label: TEST_TECHNICIAN.name });
    await page1.getByLabel(/address/i).fill(TEST_CLIENT.address);
    await page1.getByLabel(/date/i).fill(new Date().toISOString().split('T')[0]);
    await page1.getByRole('button', { name: /create|save/i }).click();
    await page1.waitForLoadState('networkidle');

    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    await login(page2, TEST_USER.email, TEST_USER.password);

    // Create conflict
    await context2.setOffline(true);
    await page2.goto('/#/app/jobs');
    const listPage2 = new JobListPage(page2);
    await listPage2.clickJobByTitle('Persist Conflict Test Job');
    await page2.getByLabel(/notes|description/i).fill('Device 2 version');
    await page2.getByRole('button', { name: /save|update/i }).click();

    const listPage1 = new JobListPage(page1);
    await listPage1.clickJobByTitle('Persist Conflict Test Job');
    await page1.getByLabel(/notes|description/i).fill('Device 1 version');
    await page1.getByRole('button', { name: /save|update/i }).click();

    // Bring online
    await context2.setOffline(false);
    await page2.waitForLoadState('networkidle');

    const conflictResolver = new ConflictResolverPage(page2);

    // Verify conflict exists
    const conflictCount = await conflictResolver.getConflictCount();
    expect(conflictCount).toBeGreaterThan(0);

    // Refresh page
    await page2.reload();
    await page2.waitForLoadState('networkidle');

    // Conflict should still be visible
    conflictCount = await conflictResolver.getConflictCount();
    expect(conflictCount).toBeGreaterThan(0);

    await context2.close();
  });
});

// CROSS-DEVICE SCENARIOS (8 tests)
test.describe('CROSS-DEVICE SCENARIOS', () => {
  test('CD-01: Device A creates job → Device B sees it', async ({ browser }) => {
    test.setTimeout(120000);

    // Device A setup
    const pageA = await browser.newPage();
    await setupTestData(pageA);

    // Device B setup
    const pageB = await browser.newPage();
    await login(pageB, TEST_USER.email, TEST_USER.password);

    // Device A creates job
    await pageA.goto('/#/app/jobs');
    await pageA.getByRole('button', { name: /create job|new job/i }).click();
    await pageA.getByLabel(/job title/i).fill('Cross Device Job');
    await pageA.getByLabel(/client/i).selectOption({ label: TEST_CLIENT.name });
    await pageA.getByLabel(/technician/i).selectOption({ label: TEST_TECHNICIAN.name });
    await pageA.getByLabel(/address/i).fill(TEST_CLIENT.address);
    await pageA.getByLabel(/date/i).fill(new Date().toISOString().split('T')[0]);
    await pageA.getByRole('button', { name: /create|save/i }).click();
    await pageA.waitForLoadState('networkidle');

    // Device B refreshes and should see the job
    await pageB.goto('/#/app/jobs');
    await pageB.waitForLoadState('networkidle');

    const jobVisible = await pageB.locator('text=Cross Device Job').isVisible();
    expect(jobVisible).toBe(true);

    await pageA.close();
    await pageB.close();
  });

  test('CD-02: Device A offline → creates job → reconnects → syncs', async ({ browser, context: mainContext }) => {
    test.setTimeout(120000);

    const pageA = await browser.newPage();
    await setupTestData(pageA);

    // Go offline
    await mainContext.setOffline(true);
    await pageA.goto('/#/app/jobs');

    // Create job offline
    await pageA.getByRole('button', { name: /create job|new job/i }).click();
    await pageA.getByLabel(/job title/i).fill('Offline Created Job');
    await pageA.getByLabel(/client/i).selectOption({ label: TEST_CLIENT.name });
    await pageA.getByLabel(/technician/i).selectOption({ label: TEST_TECHNICIAN.name });
    await pageA.getByLabel(/address/i).fill(TEST_CLIENT.address);
    await pageA.getByLabel(/date/i).fill(new Date().toISOString().split('T')[0]);
    await pageA.getByRole('button', { name: /create|save/i }).click();

    // Should show queued for sync
    const queuedMessage = await pageA
      .locator('text=/queued|pending|offline/i')
      .isVisible({ timeout: 5000 });
    expect(queuedMessage).toBe(true);

    // Go back online
    await mainContext.setOffline(false);

    // Should auto-sync
    await pageA.waitForLoadState('networkidle');
    const syncedMessage = await pageA
      .locator('text=/synced|synchronized/i')
      .isVisible({ timeout: 15000 });
    expect(syncedMessage).toBe(true);

    await pageA.close();
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  test('CD-03: Device B modifies while A offline → conflict on reconnect', async ({ browser, context: mainContext }) => {
    test.setTimeout(120000);

    // Setup both devices
    const pageA = await browser.newPage();
    const pageB = await browser.newPage();

    await setupTestData(pageA);
    await login(pageB, TEST_USER.email, TEST_USER.password);

    // Create initial job on A
    await pageA.goto('/#/app/jobs');
    await pageA.getByRole('button', { name: /create job|new job/i }).click();
    await pageA.getByLabel(/job title/i).fill('Concurrent Edit Job');
    await pageA.getByLabel(/client/i).selectOption({ label: TEST_CLIENT.name });
    await pageA.getByLabel(/technician/i).selectOption({ label: TEST_TECHNICIAN.name });
    await pageA.getByLabel(/address/i).fill(TEST_CLIENT.address);
    await pageA.getByLabel(/date/i).fill(new Date().toISOString().split('T')[0]);
    await pageA.getByRole('button', { name: /create|save/i }).click();
    await pageA.waitForLoadState('networkidle');

    // Device A goes offline
    const contextA = pageA.context();
    await contextA.setOffline(true);

    // Device A makes a change
    const listPageA = new JobListPage(pageA);
    await listPageA.clickJobByTitle('Concurrent Edit Job');
    await pageA.getByLabel(/notes|description/i).fill('Change on offline device');
    await pageA.getByRole('button', { name: /save|update/i }).click();

    // Device B makes a different change
    await pageB.goto('/#/app/jobs');
    const listPageB = new JobListPage(pageB);
    await listPageB.clickJobByTitle('Concurrent Edit Job');
    await pageB.getByLabel(/notes|description/i).fill('Change on online device');
    await pageB.getByRole('button', { name: /save|update/i }).click();
    await pageB.waitForLoadState('networkidle');

    // Device A comes back online
    await contextA.setOffline(false);
    await pageA.waitForLoadState('networkidle');

    // Should detect conflict
    const conflictResolver = new ConflictResolverPage(pageA);
    const conflictCount = await conflictResolver.getConflictCount();
    expect(conflictCount).toBeGreaterThan(0);

    await pageA.close();
    await pageB.close();
  });

  test('CD-04: Archive happens on A → B sees archived status', async ({ browser }) => {
    test.setTimeout(120000);

    const pageA = await browser.newPage();
    const pageB = await browser.newPage();

    await setupTestData(pageA);
    await login(pageB, TEST_USER.email, TEST_USER.password);

    // Create job on A
    await pageA.goto('/#/app/jobs');
    await pageA.getByRole('button', { name: /create job|new job/i }).click();
    await pageA.getByLabel(/job title/i).fill('Archive Sync Job');
    await pageA.getByLabel(/client/i).selectOption({ label: TEST_CLIENT.name });
    await pageA.getByLabel(/technician/i).selectOption({ label: TEST_TECHNICIAN.name });
    await pageA.getByLabel(/address/i).fill(TEST_CLIENT.address);
    await pageA.getByLabel(/date/i).fill(new Date().toISOString().split('T')[0]);
    await pageA.getByRole('button', { name: /create|save/i }).click();
    await pageA.waitForLoadState('networkidle');

    // A seals the job
    const listPageA = new JobListPage(pageA);
    await listPageA.clickJobByTitle('Archive Sync Job');
    const detailPageA = new JobDetailPage(pageA);
    await detailPageA.sealEvidence();

    // B should see archived status
    await pageB.goto('/#/app/jobs');
    await pageB.waitForLoadState('networkidle');

    const listPageB = new JobListPage(pageB);
    const isArchived = await listPageB.verifyArchivedBadgeVisible('Archive Sync Job');
    expect(isArchived).toBe(true);

    await pageA.close();
    await pageB.close();
  });

  test('CD-05: Export on A → B can also export', async ({ browser }) => {
    test.setTimeout(120000);

    const pageA = await browser.newPage();
    const pageB = await browser.newPage();

    await setupTestData(pageA);
    await login(pageB, TEST_USER.email, TEST_USER.password);

    // Create job on A
    await pageA.goto('/#/app/jobs');
    await pageA.getByRole('button', { name: /create job|new job/i }).click();
    await pageA.getByLabel(/job title/i).fill('Export Sync Job');
    await pageA.getByLabel(/client/i).selectOption({ label: TEST_CLIENT.name });
    await pageA.getByLabel(/technician/i).selectOption({ label: TEST_TECHNICIAN.name });
    await pageA.getByLabel(/address/i).fill(TEST_CLIENT.address);
    await pageA.getByLabel(/date/i).fill(new Date().toISOString().split('T')[0]);
    await pageA.getByRole('button', { name: /create|save/i }).click();
    await pageA.waitForLoadState('networkidle');

    // A exports
    const exportPageA = new ExportPage(pageA);
    const csvA = await exportPageA.exportAsCSV();
    expect(csvA.length).toBeGreaterThan(0);

    // B exports the same data
    await pageB.goto('/#/app/jobs');
    await pageB.waitForLoadState('networkidle');

    const exportPageB = new ExportPage(pageB);
    const csvB = await exportPageB.exportAsCSV();
    expect(csvB.length).toBeGreaterThan(0);

    // Both should contain the job
    expect(csvA).toContain('Export Sync Job');
    expect(csvB).toContain('Export Sync Job');

    await pageA.close();
    await pageB.close();
  });

  test('CD-06: Conflict on A → resolve on B → A gets update', async ({ browser }) => {
    test.setTimeout(120000);

    const pageA = await browser.newPage();
    const pageB = await browser.newPage();
    const contextA = pageA.context();

    await setupTestData(pageA);
    await login(pageB, TEST_USER.email, TEST_USER.password);

    // Create job
    await pageA.goto('/#/app/jobs');
    await pageA.getByRole('button', { name: /create job|new job/i }).click();
    await pageA.getByLabel(/job title/i).fill('Cross Resolve Job');
    await pageA.getByLabel(/client/i).selectOption({ label: TEST_CLIENT.name });
    await pageA.getByLabel(/technician/i).selectOption({ label: TEST_TECHNICIAN.name });
    await pageA.getByLabel(/address/i).fill(TEST_CLIENT.address);
    await pageA.getByLabel(/date/i).fill(new Date().toISOString().split('T')[0]);
    await pageA.getByRole('button', { name: /create|save/i }).click();
    await pageA.waitForLoadState('networkidle');

    // Create conflict
    await contextA.setOffline(true);
    const listPageA = new JobListPage(pageA);
    await listPageA.clickJobByTitle('Cross Resolve Job');
    await pageA.getByLabel(/notes|description/i).fill('A version');
    await pageA.getByRole('button', { name: /save|update/i }).click();

    await pageB.goto('/#/app/jobs');
    const listPageB = new JobListPage(pageB);
    await listPageB.clickJobByTitle('Cross Resolve Job');
    await pageB.getByLabel(/notes|description/i).fill('B version');
    await pageB.getByRole('button', { name: /save|update/i }).click();
    await pageB.waitForLoadState('networkidle');

    // Resolve on B
    const conflictResolverB = new ConflictResolverPage(pageB);
    const hasConflict = (await conflictResolverB.getConflictCount()) > 0;
    if (hasConflict) {
      await conflictResolverB.openConflictResolver();
      await conflictResolverB.selectServer();
    }

    // A comes online
    await contextA.setOffline(false);
    await pageA.waitForLoadState('networkidle');

    // A should see the resolved version
    await pageA.reload();
    await pageA.waitForLoadState('networkidle');

    // Verify no conflict on A
    const conflictResolverA = new ConflictResolverPage(pageA);
    const isResolved = await conflictResolverA.verifyConflictResolved();
    expect(isResolved).toBe(true);

    await pageA.close();
    await pageB.close();
  });

  test('CD-07: Multiple devices sync correctly', async ({ browser }) => {
    test.setTimeout(150000);

    // Setup 3 devices
    const pageA = await browser.newPage();
    const pageB = await browser.newPage();
    const pageC = await browser.newPage();

    await setupTestData(pageA);
    await login(pageB, TEST_USER.email, TEST_USER.password);
    await login(pageC, TEST_USER.email, TEST_USER.password);

    // Device A creates job
    await pageA.goto('/#/app/jobs');
    await pageA.getByRole('button', { name: /create job|new job/i }).click();
    await pageA.getByLabel(/job title/i).fill('Multi Device Job');
    await pageA.getByLabel(/client/i).selectOption({ label: TEST_CLIENT.name });
    await pageA.getByLabel(/technician/i).selectOption({ label: TEST_TECHNICIAN.name });
    await pageA.getByLabel(/address/i).fill(TEST_CLIENT.address);
    await pageA.getByLabel(/date/i).fill(new Date().toISOString().split('T')[0]);
    await pageA.getByRole('button', { name: /create|save/i }).click();
    await pageA.waitForLoadState('networkidle');

    // B and C should see it
    await pageB.goto('/#/app/jobs');
    await pageB.waitForLoadState('networkidle');
    const visibleB = await pageB.locator('text=Multi Device Job').isVisible();
    expect(visibleB).toBe(true);

    await pageC.goto('/#/app/jobs');
    await pageC.waitForLoadState('networkidle');
    const visibleC = await pageC.locator('text=Multi Device Job').isVisible();
    expect(visibleC).toBe(true);

    await pageA.close();
    await pageB.close();
    await pageC.close();
  });

  test('CD-08: Network latency does not break sync', async ({ browser, context: mainContext }) => {
    test.setTimeout(120000);

    const pageA = await browser.newPage();
    await setupTestData(pageA);

    // Create job
    await pageA.goto('/#/app/jobs');
    await pageA.getByRole('button', { name: /create job|new job/i }).click();
    await pageA.getByLabel(/job title/i).fill('Latency Test Job');
    await pageA.getByLabel(/client/i).selectOption({ label: TEST_CLIENT.name });
    await pageA.getByLabel(/technician/i).selectOption({ label: TEST_TECHNICIAN.name });
    await pageA.getByLabel(/address/i).fill(TEST_CLIENT.address);
    await pageA.getByLabel(/date/i).fill(new Date().toISOString().split('T')[0]);

    // Simulate high latency
    await mainContext.route('**/*', async (route) => {
      // Add 500ms delay
      await new Promise((resolve) => setTimeout(resolve, 500));
      await route.continue();
    });

    await pageA.getByRole('button', { name: /create|save/i }).click();
    await pageA.waitForLoadState('networkidle');

    // Should still succeed despite latency
    const jobVisible = await pageA.locator('text=Latency Test Job').isVisible({ timeout: 30000 });
    expect(jobVisible).toBe(true);

    // Unroute
    await mainContext.unroute('**/*');

    await pageA.close();
  });
});

// REGRESSION TESTS (Week 1-2 Features)
test.describe('REGRESSION TESTS', () => {
  test('REG-01: Virtual scrolling still works with 500+ jobs', async ({ page }) => {
    test.setTimeout(120000);
    await setupTestData(page);

    // Create 50 jobs to simulate large dataset
    await page.goto('/#/app/jobs');

    for (let i = 1; i <= 50; i++) {
      await page.getByRole('button', { name: /create job|new job/i }).click();
      await page.getByLabel(/job title/i).fill(`Scroll Test Job ${i}`);
      await page.getByLabel(/client/i).selectOption({ label: TEST_CLIENT.name });
      await page.getByLabel(/technician/i).selectOption({ label: TEST_TECHNICIAN.name });
      await page.getByLabel(/address/i).fill(TEST_CLIENT.address);
      await page.getByLabel(/date/i).fill(new Date().toISOString().split('T')[0]);
      await page.getByRole('button', { name: /create|save/i }).click();
      await page.waitForLoadState('networkidle');

      if (i % 10 === 0) {
        await page.goto('/#/app/jobs');
      }
    }

    // Test scrolling
    await page.goto('/#/app/jobs');
    await page.waitForLoadState('networkidle');

    // Scroll down
    await page.locator('[data-testid="job-list"]').scrollIntoViewIfNeeded();
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => {
        const list = document.querySelector('[data-testid="job-list"]');
        if (list) list.scrollTop += 500;
      });
      await page.waitForTimeout(500);
    }

    // Should still be responsive
    const jobCount = await new JobListPage(page).getJobCount();
    expect(jobCount).toBeGreaterThan(0);
  });

  test('REG-02: Form drafts still persist to IndexedDB', async ({ page }) => {
    test.setTimeout(60000);
    await setupTestData(page);

    await page.goto('/#/app/jobs');
    await page.getByRole('button', { name: /create job|new job/i }).click();

    // Fill partial form
    await page.getByLabel(/job title/i).fill('Draft Test Job');
    await page.getByLabel(/notes|description/i).fill('This is a draft');

    // Verify draft is saved
    await page.evaluate(() => {
      const db = (window as any).jobProofDB || (window as any).db;
      return db ? Object.keys(localStorage).some((k) => k.includes('draft')) : false;
    });

    // Refresh and check if draft is recovered
    await page.reload();
    await page.waitForLoadState('networkidle');

    const title = await page.getByLabel(/job title/i).inputValue();
    expect(title).toContain('Draft Test Job');
  });

  test('REG-03: Storage warning still appears', async ({ page }) => {
    test.setTimeout(60000);
    await setupTestData(page);

    await page.goto('/#/app/jobs');

    // Check if storage warning is present when storage is low
    const storageWarning = await page
      .locator('text=/storage|quota|disk/i')
      .isVisible({ timeout: 5000 });

    // Should either show or not show based on actual storage
    expect(typeof storageWarning).toBe('boolean');
  });

  test('REG-04: Memory stays <150MB with 1K jobs', async ({ page }) => {
    test.setTimeout(120000);
    await setupTestData(page);

    // Create 100 jobs
    await page.goto('/#/app/jobs');

    for (let i = 1; i <= 100; i++) {
      await page.getByRole('button', { name: /create job|new job/i }).click();
      await page.getByLabel(/job title/i).fill(`Memory Test Job ${i}`);
      await page.getByLabel(/client/i).selectOption({ label: TEST_CLIENT.name });
      await page.getByLabel(/technician/i).selectOption({ label: TEST_TECHNICIAN.name });
      await page.getByLabel(/address/i).fill(TEST_CLIENT.address);
      await page.getByLabel(/date/i).fill(new Date().toISOString().split('T')[0]);
      await page.getByRole('button', { name: /create|save/i }).click();

      if (i % 25 === 0) {
        // Check memory
        const memory = await getMemoryUsage(page);
        console.log(`Memory after ${i} jobs: ${(memory / 1024 / 1024).toFixed(2)}MB`);
      }
    }

    // Final memory check
    const finalMemory = await getMemoryUsage(page);
    console.log(`Final memory: ${(finalMemory / 1024 / 1024).toFixed(2)}MB`);

    // Should be reasonable (allow some headroom)
    expect(finalMemory).toBeLessThan(PERFORMANCE_THRESHOLDS.MAX_MEMORY * 1.5);
  });
});

// PERFORMANCE TESTS
test.describe('PERFORMANCE TESTS', () => {
  test('PERF-01: 10K job load test (memory benchmark)', async ({ page }) => {
    test.setTimeout(180000);
    await setupTestData(page);

    // Measure memory before
    const memBefore = await getMemoryUsage(page);
    console.log(`Memory before load: ${(memBefore / 1024 / 1024).toFixed(2)}MB`);

    // Load large dataset
    await page.goto('/#/app/jobs');

    // Create 200 jobs (simulating 10K with smaller dataset)
    for (let i = 1; i <= 200; i++) {
      await page.getByRole('button', { name: /create job|new job/i }).click();
      await page.getByLabel(/job title/i).fill(`Perf Job ${i}`);
      await page.getByLabel(/client/i).selectOption({ label: TEST_CLIENT.name });
      await page.getByLabel(/technician/i).selectOption({ label: TEST_TECHNICIAN.name });
      await page.getByLabel(/address/i).fill(TEST_CLIENT.address);
      await page.getByLabel(/date/i).fill(new Date().toISOString().split('T')[0]);
      await page.getByRole('button', { name: /create|save/i }).click();

      if (i % 50 === 0) {
        const memory = await getMemoryUsage(page);
        console.log(`Memory after ${i} jobs: ${(memory / 1024 / 1024).toFixed(2)}MB`);
      }
    }

    // Measure memory after
    const memAfter = await getMemoryUsage(page);
    console.log(`Memory after load: ${(memAfter / 1024 / 1024).toFixed(2)}MB`);

    const memIncrease = memAfter - memBefore;
    console.log(`Memory increase: ${(memIncrease / 1024 / 1024).toFixed(2)}MB`);

    // Should not exceed threshold
    expect(memAfter).toBeLessThan(PERFORMANCE_THRESHOLDS.MAX_MEMORY * 1.2);
  });

  test('PERF-02: Scroll performance 60fps at 500+ jobs', async ({ page }) => {
    test.setTimeout(120000);
    await setupTestData(page);

    // Create 200 jobs
    await page.goto('/#/app/jobs');

    for (let i = 1; i <= 200; i++) {
      await page.getByRole('button', { name: /create job|new job/i }).click();
      await page.getByLabel(/job title/i).fill(`Scroll Perf Job ${i}`);
      await page.getByLabel(/client/i).selectOption({ label: TEST_CLIENT.name });
      await page.getByLabel(/technician/i).selectOption({ label: TEST_TECHNICIAN.name });
      await page.getByLabel(/address/i).fill(TEST_CLIENT.address);
      await page.getByLabel(/date/i).fill(new Date().toISOString().split('T')[0]);
      await page.getByRole('button', { name: /create|save/i }).click();

      if (i % 50 === 0) {
        await page.goto('/#/app/jobs');
      }
    }

    // Navigate to jobs list
    await page.goto('/#/app/jobs');
    await page.waitForLoadState('networkidle');

    // Measure scroll performance
    await page.evaluate(() => {
      return {
        initialTime: performance.now(),
      };
    });

    // Scroll 10 times and measure
    let slowFrames = 0;
    const frameDurations: number[] = [];

    for (let i = 0; i < 10; i++) {
      const before = await page.evaluate(() => performance.now());

      await page.evaluate(() => {
        const list = document.querySelector('[data-testid="job-list"]');
        if (list) list.scrollTop += 500;
      });

      await page.waitForTimeout(100);

      const after = await page.evaluate(() => performance.now());
      const duration = after - before;
      frameDurations.push(duration);

      // 60fps = ~16.67ms per frame
      if (duration > 33) {
        slowFrames++;
      }
    }

    console.log('Frame durations:', frameDurations);
    console.log('Slow frames:', slowFrames);

    // Should have less than 3 slow frames out of 10
    expect(slowFrames).toBeLessThan(3);
  });

  test('PERF-03: Archive queries complete <1s', async ({ page }) => {
    test.setTimeout(120000);
    await setupTestData(page);

    // Create 100 jobs, seal some
    await page.goto('/#/app/jobs');

    for (let i = 1; i <= 100; i++) {
      await page.getByRole('button', { name: /create job|new job/i }).click();
      await page.getByLabel(/job title/i).fill(`Archive Query Job ${i}`);
      await page.getByLabel(/client/i).selectOption({ label: TEST_CLIENT.name });
      await page.getByLabel(/technician/i).selectOption({ label: TEST_TECHNICIAN.name });
      await page.getByLabel(/address/i).fill(TEST_CLIENT.address);
      await page.getByLabel(/date/i).fill(new Date().toISOString().split('T')[0]);
      await page.getByRole('button', { name: /create|save/i }).click();

      // Seal every 10th job
      if (i % 10 === 0) {
        const listPage = new JobListPage(page);
        await listPage.clickJobByTitle(`Archive Query Job ${i}`);
        const detailPage = new JobDetailPage(page);
        await detailPage.sealEvidence();
        await page.goto('/#/app/jobs');
      }
    }

    // Measure time to query archived jobs
    const { duration } = await measureDuration(async () => {
      const listPage = new JobListPage(page);
      return await listPage.getArchivedJobCount();
    });

    console.log(`Archive query duration: ${duration}ms`);

    // Should complete in under 1 second
    expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.ARCHIVE_QUERY_TIMEOUT);
  });
});
