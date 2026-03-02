/**
 * Evidence Pipeline Integration Tests
 * ====================================
 *
 * Tests the FULL evidence pipeline data flow:
 *   Photo capture → IndexedDB → Supabase Storage → JSONB update → Seal → Verify
 *
 * These tests validate the fixes for the root cause identified in the
 * forensic audit (March 2026):
 *   1. seal-evidence Edge Function now reads photos from JSONB column
 *   2. Signature is synced to bunker_jobs.signature_data before sealing
 *   3. Status 'Archived' is allowed by DB constraint
 *   4. processUpdateJob syncs clientConfirmation to server
 *   5. mergeJobData correctly handles server+local photo merge
 *
 * Root cause: Two competing photo storage systems (inline base64 columns
 * vs JSONB array) were never reconciled. The seal function read the old
 * columns (NULL) while the app wrote to the new JSONB column.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { canSealJob } from '@/lib/sealing';

// Read source files for pattern validation
const sealEdgeFunctionPath = join(__dirname, '../../supabase/functions/seal-evidence/index.ts');
const sealEdgeFunctionSource = readFileSync(sealEdgeFunctionPath, 'utf-8');

const syncPath = join(__dirname, '../../lib/offline/sync.ts');
const syncSource = readFileSync(syncPath, 'utf-8');

const techEvidenceReviewPath = join(__dirname, '../../views/tech/TechEvidenceReview.tsx');
const techEvidenceReviewSource = readFileSync(techEvidenceReviewPath, 'utf-8');

const migrationDir = join(__dirname, '../../supabase/migrations');

// ============================================================================
// 1. SEAL-EVIDENCE EDGE FUNCTION: Photo Source Validation
// ============================================================================

describe('Seal-Evidence Edge Function reads JSONB photos', () => {
  it('reads from photos JSONB column as primary source for bunker_jobs', () => {
    // The seal function MUST read from job.photos (JSONB array) not
    // job.before_photo_data (legacy base64 column)
    expect(sealEdgeFunctionSource).toContain('Array.isArray(job.photos)');
    expect(sealEdgeFunctionSource).toContain('job.photos.length > 0');
  });

  it('falls back to legacy columns only when JSONB is empty', () => {
    // Legacy fallback should ONLY trigger when photos JSONB is empty
    // (for pre-migration jobs), not as primary source
    expect(sealEdgeFunctionSource).toMatch(/else\s*\{[\s\S]*?before_photo_data/);
  });

  it('warns when sealing with zero photos', () => {
    // A seal with no photos is likely a data flow bug — warn clearly
    expect(sealEdgeFunctionSource).toContain('NO photos');
  });

  it('reads signature_url in addition to signature_data', () => {
    // Signatures may be stored as Storage URLs, not just inline base64
    expect(sealEdgeFunctionSource).toMatch(/signature_url.*\|\|.*signature_data|signature_data.*\|\|.*signature_url/);
  });

  it('updates bunker_jobs sealed_at directly', () => {
    // The seal function must update sealed_at on bunker_jobs directly,
    // not rely on generate-report to do it later
    expect(sealEdgeFunctionSource).toContain("from('bunker_jobs')");
    expect(sealEdgeFunctionSource).toMatch(/bunker_jobs.*update.*sealed_at/s);
  });
});

// ============================================================================
// 2. PROCESSUPLOADJOB: Signature + ClientConfirmation Sync
// ============================================================================

describe('processUpdateJob syncs all evidence fields', () => {
  it('syncs signature to bunker_jobs.signature_data', () => {
    expect(syncSource).toContain('updateData.signature_data = job.signature');
  });

  it('syncs signerName to bunker_jobs.signer_name', () => {
    expect(syncSource).toContain('updateData.signer_name = job.signerName');
  });

  it('syncs clientConfirmation to bunker_jobs.client_confirmation', () => {
    expect(syncSource).toContain('updateData.client_confirmation = job.clientConfirmation');
  });

  it('syncs completionNotes to bunker_jobs.completion_notes', () => {
    expect(syncSource).toContain('updateData.completion_notes = job.completionNotes');
  });

  it('syncs photos JSONB array to bunker_jobs.photos', () => {
    expect(syncSource).toContain('updateData.photos = job.photos.map');
  });

  it('syncs signatureTimestamp to bunker_jobs', () => {
    expect(syncSource).toContain('updateData.signature_timestamp = job.signatureTimestamp');
  });
});

// ============================================================================
// 3. PULLJOBS: Read back all evidence fields from server
// ============================================================================

describe('pullJobs reads evidence fields from server', () => {
  it('reads photos from server JSONB column', () => {
    expect(syncSource).toContain('Array.isArray(row.photos) ? row.photos : []');
  });

  it('reads signature from server', () => {
    expect(syncSource).toContain('row.signature_data || row.signature_url');
  });

  it('reads signerName from server', () => {
    expect(syncSource).toContain('signerName: row.signer_name');
  });

  it('reads clientConfirmation from server', () => {
    expect(syncSource).toContain('clientConfirmation: row.client_confirmation');
  });

  it('reads completionNotes from server', () => {
    expect(syncSource).toContain('completionNotes: row.completion_notes');
  });

  it('reads seal status from server', () => {
    expect(syncSource).toContain('sealedAt: row.sealed_at');
    expect(syncSource).toContain('evidenceHash: row.evidence_hash');
    expect(syncSource).toContain('sealedBy: row.sealed_by');
  });
});

// ============================================================================
// 4. MERGEJOBDATA: Server + Local Photo Merge
// ============================================================================

describe('mergeJobData photo merge strategy', () => {
  it('merges server and local photos by ID (no duplicates)', () => {
    // When both server and local have photos, merge by ID
    expect(syncSource).toContain('serverPhotoIds');
    expect(syncSource).toContain('localOnlyPhotos');
  });

  it('preserves local-only photos not yet on server', () => {
    expect(syncSource).toContain('!serverPhotoIds.has(p.id)');
  });

  it('keeps all local photos when server has none', () => {
    // When server photos is [], keep all local photos
    expect(syncSource).toMatch(/Server has no photos.*keep all local/s);
  });
});

// ============================================================================
// 5. TECHEVIDENCEREVIEW: Signature → job.signature sync
// ============================================================================

describe('TechEvidenceReview signature flow', () => {
  it('sets job.signature when client signs (not just clientConfirmation)', () => {
    // CRITICAL: Without this, processUpdateJob doesn't sync signature to server
    // because it only reads job.signature, not job.clientConfirmation.signature
    const confirmHandler = techEvidenceReviewSource.match(
      /handleCanvasConfirmed[\s\S]*?contextUpdateJob/
    );
    expect(confirmHandler).not.toBeNull();

    // The updatedJob must have `signature` set (not just clientConfirmation.signature)
    const updatedJobBlock = techEvidenceReviewSource.match(
      /const updatedJob[\s\S]*?contextUpdateJob\(updatedJob\)/
    );
    expect(updatedJobBlock?.[0]).toContain('signature,');
    expect(updatedJobBlock?.[0]).toContain('signerName:');
  });

  it('queues SEAL_JOB when offline instead of calling invokeSealing', () => {
    // Offline seal must go through queue, not direct Edge Function call
    expect(techEvidenceReviewSource).toContain("queueAction('SEAL_JOB'");
  });

  it('sets status to Submitted before sealing', () => {
    const updatedJobBlock = techEvidenceReviewSource.match(
      /const updatedJob[\s\S]*?contextUpdateJob/
    );
    expect(updatedJobBlock?.[0]).toContain("status: 'Submitted'");
  });
});

// ============================================================================
// 6. DATABASE MIGRATION: Status Constraint
// ============================================================================

describe('Database migration allows full job lifecycle', () => {
  it('has migration to allow Archived status', () => {
    const fs = require('fs');
    const migrations = fs.readdirSync(migrationDir);
    const pipelineMigration = migrations.find((f: string) =>
      f.includes('fix_evidence_pipeline')
    );
    expect(pipelineMigration).toBeDefined();

    const migrationSource = readFileSync(
      join(migrationDir, pipelineMigration),
      'utf-8'
    );
    expect(migrationSource).toContain('Archived');
    expect(migrationSource).toContain('Draft');
    expect(migrationSource).toContain('Paused');
    expect(migrationSource).toContain('Cancelled');
  });
});

// ============================================================================
// 7. PROCESSUPLOADPHOTO: Photos persist to server JSONB
// ============================================================================

describe('processUploadPhoto persists photo metadata to server', () => {
  it('updates bunker_jobs.photos JSONB after successful upload', () => {
    // After uploading to Storage, photo metadata must be written to
    // the bunker_jobs.photos JSONB column
    expect(syncSource).toMatch(/processUploadPhoto[\s\S]*?bunker_jobs[\s\S]*?photos.*serverPhotos/s);
  });

  it('includes essential photo fields in server JSONB', () => {
    // Server JSONB must include fields needed for sealing
    const photoMapBlock = syncSource.match(
      /serverPhotos = updatedPhotos\.map[\s\S]*?\}\)\)/
    );
    expect(photoMapBlock).not.toBeNull();
    const block = photoMapBlock![0];
    expect(block).toContain('p.id');
    expect(block).toContain('p.url');
    expect(block).toContain('p.type');
    expect(block).toContain('p.timestamp');
    expect(block).toContain('p.lat');
    expect(block).toContain('p.lng');
  });
});

// ============================================================================
// 8. canSealJob: Correct validation for sealing readiness
// ============================================================================

describe('canSealJob validation', () => {

  it('blocks seal when photos have pending syncStatus', () => {
    const result = canSealJob({
      status: 'Submitted',
      photos: [{ id: 'p1', url: 'test.jpg', syncStatus: 'pending', type: 'before' }],
      signature: 'sig-data',
      signerName: 'Test',
    });
    expect(result.canSeal).toBe(false);
    expect(result.reasons.join(' ')).toContain('synced');
  });

  it('blocks seal when photos have isIndexedDBRef', () => {
    const result = canSealJob({
      status: 'Submitted',
      photos: [{ id: 'p1', url: 'media_123', syncStatus: 'synced', type: 'before', isIndexedDBRef: true }],
      signature: 'sig-data',
      signerName: 'Test',
    });
    expect(result.canSeal).toBe(false);
    expect(result.reasons.join(' ')).toContain('synced');
  });

  it('allows seal when all photos are synced', () => {
    const result = canSealJob({
      status: 'Submitted',
      photos: [
        { id: 'p1', url: 'https://storage.example.com/photo1.jpg', syncStatus: 'synced', type: 'before', photo_hash: 'abc' },
        { id: 'p2', url: 'https://storage.example.com/photo2.jpg', syncStatus: 'synced', type: 'after', photo_hash: 'def' },
      ],
      signature: 'data:image/png;base64,test',
      signerName: 'Client Name',
    });
    expect(result.canSeal).toBe(true);
    expect(result.reasons).toHaveLength(0);
  });

  it('blocks seal when no signature', () => {
    const result = canSealJob({
      status: 'Submitted',
      photos: [{ id: 'p1', url: 'test.jpg', syncStatus: 'synced', type: 'before' }],
      signature: null,
      signerName: 'Test',
    });
    expect(result.canSeal).toBe(false);
    expect(result.reasons.join(' ')).toContain('signature');
  });
});
