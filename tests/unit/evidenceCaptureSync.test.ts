/**
 * Evidence Capture Sync Tests
 * ============================
 *
 * Tests that EvidenceCapture correctly stores photos in IndexedDB with
 * isIndexedDBRef=true so the sync queue can upload them to Supabase.
 *
 * Also verifies the camera capture button has fixed bottom positioning
 * for thumb-accessible field use.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const EVIDENCE_CAPTURE_PATH = join(__dirname, '../../views/tech/EvidenceCapture.tsx');
const evidenceCaptureSource = readFileSync(EVIDENCE_CAPTURE_PATH, 'utf-8');

describe('EvidenceCapture Photo Sync', () => {
  it('sets isIndexedDBRef: true on new photos', () => {
    // CRITICAL: Without isIndexedDBRef, sync queue skips photo upload entirely
    expect(evidenceCaptureSource).toContain('isIndexedDBRef: true');
  });

  it('stores photo Base64 in IndexedDB media table with a key', () => {
    // Photo data must be stored in media table, not inline as Base64
    expect(evidenceCaptureSource).toContain('media_${photoId}');
    expect(evidenceCaptureSource).toContain('database.media.put');
  });

  it('uses media key as url instead of raw Base64', () => {
    // url field must contain the IndexedDB key reference, NOT raw data:image/jpeg...
    expect(evidenceCaptureSource).toContain('url: mediaKey');
    // Must NOT store raw dataUrl as the photo URL
    expect(evidenceCaptureSource).not.toMatch(/url:\s*photo\.dataUrl/);
  });

  it('saves photo, job update, and draft delete in a single atomic transaction', () => {
    // All three operations must be in one Dexie transaction to prevent data loss
    expect(evidenceCaptureSource).toContain("database.transaction('rw', database.jobs, database.media");
    // Media put must happen inside the transaction
    expect(evidenceCaptureSource).toMatch(/transaction.*\n[\s\S]*?media\.put[\s\S]*?jobs\.put[\s\S]*?media\.delete/);
  });

  it('queues UPLOAD_PHOTO action so sync worker can upload to Supabase', () => {
    // CRITICAL: Without this, processUpdateJob only syncs metadata.
    // processUploadPhoto is the ONLY function that uploads from IndexedDB to Storage.
    // It MUST be queued as a Dexie queue action.
    expect(evidenceCaptureSource).toContain("queueAction('UPLOAD_PHOTO'");
    expect(evidenceCaptureSource).toContain('id: mediaKey, jobId: job.id');
  });

  it('imports queueAction from offline/db', () => {
    // queueAction must be imported to create the UPLOAD_PHOTO queue entry
    expect(evidenceCaptureSource).toMatch(/import.*queueAction.*from.*offline\/db/);
  });
});

describe('EvidenceCapture Camera Button Positioning', () => {
  it('has fixed bottom positioning on capture button container', () => {
    // Camera button must be fixed at bottom for thumb access in field conditions
    expect(evidenceCaptureSource).toMatch(/fixed bottom-0.*Capture/s);
  });

  it('has fixed bottom positioning on action buttons (Retake/Use Photo)', () => {
    // Action buttons must also be fixed at bottom for thumb access
    expect(evidenceCaptureSource).toMatch(/fixed bottom-0.*Retake/s);
  });

  it('has backdrop blur for visual distinction from content', () => {
    // Fixed bars need backdrop blur to distinguish from scrollable content
    expect(evidenceCaptureSource).toContain('backdrop-blur-xl');
  });

  it('has spacer divs to prevent content overlap with fixed bars', () => {
    // Content needs spacers so it doesn't hide behind fixed bottom bars
    const spacerCount = (evidenceCaptureSource.match(/Spacer to prevent content/g) || []).length;
    expect(spacerCount).toBeGreaterThanOrEqual(2);
  });

  it('has min-h-[56px] on action buttons for gloved field use', () => {
    // Field worker buttons need 56px minimum touch targets (WCAG AAA)
    expect(evidenceCaptureSource).toContain('min-h-[56px]');
  });
});
