/**
 * JobDetail Sharing Race Condition Tests
 * ========================================
 *
 * Verifies that share/copy/QR/resend features in JobDetail.tsx
 * work correctly even when magicLink state hasn't been initialized
 * from job.magicLinkUrl yet (race condition on first render).
 *
 * Root cause: All handlers had `if (!magicLink)` early return,
 * but magicLink state starts null and only gets set via useEffect
 * AFTER the first render. The handlers generate fresh URLs
 * independently and don't actually need magicLink to function.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const JOB_DETAIL_PATH = join(__dirname, '../../views/app/jobs/JobDetail.tsx');
const jobDetailSource = readFileSync(JOB_DETAIL_PATH, 'utf-8');

describe('JobDetail Sharing - Race Condition Fix', () => {
  it('handleCopyLink does NOT gate on magicLink state', () => {
    // magicLink state is null on first render even when job.magicLinkUrl exists
    // The handler generates a fresh URL via getValidatedHandshakeUrl and doesn't need it
    const copyHandler = jobDetailSource.substring(
      jobDetailSource.indexOf('const handleCopyLink'),
      jobDetailSource.indexOf('const handleSendEmail')
    );
    expect(copyHandler).not.toMatch(/if\s*\(\s*!magicLink\s*\|\|/);
  });

  it('handleSendEmail does NOT gate on magicLink state', () => {
    const emailHandler = jobDetailSource.substring(
      jobDetailSource.indexOf('const handleSendEmail'),
      jobDetailSource.indexOf('const handleShare')
    );
    expect(emailHandler).not.toMatch(/if\s*\(\s*!magicLink\s*\|\|/);
  });

  it('handleShare does NOT gate on magicLink state', () => {
    const shareHandler = jobDetailSource.substring(
      jobDetailSource.indexOf('const handleShare'),
      jobDetailSource.indexOf('const getExpiryInfo')
    );
    expect(shareHandler).not.toMatch(/if\s*\(\s*!magicLink\s*\|\|/);
  });

  it('all handlers use job.magicLinkUrl as fallback for URL generation', () => {
    // When userEmail is missing and magicLink state is null,
    // handlers must fall back to job.magicLinkUrl
    expect(jobDetailSource).toContain('magicLink || job.magicLinkUrl');
  });

  it('UI conditional checks job.magicLinkUrl in addition to magicLink state', () => {
    // The "Generate" vs "Share" UI toggle must check both sources
    // Otherwise it shows "Generate" button even when link already exists
    expect(jobDetailSource).toContain('!magicLink && !job?.magicLinkUrl');
  });

  it('freshMagicLink memo does not require magicLink state to generate URL', () => {
    // freshMagicLink should generate URL from job.id + userEmail
    // even when magicLink state is null (race condition)
    const memoBlock = jobDetailSource.substring(
      jobDetailSource.indexOf('const freshMagicLink = useMemo'),
      jobDetailSource.indexOf('], [magicLink, job?.id')
    );
    // Must NOT have `!magicLink` as a bail-out condition
    expect(memoBlock).not.toMatch(/if\s*\(\s*!magicLink\s*\|\|/);
  });

  it('QR code uses job.magicLinkUrl as final fallback', () => {
    // QR code must never be empty when a link exists on the job
    expect(jobDetailSource).toMatch(/QRCodeSVG.*freshMagicLink.*magicLink.*magicLinkUrl/);
  });
});
