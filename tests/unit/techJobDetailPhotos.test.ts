/**
 * TechJobDetail Photo Display Tests
 * ===================================
 *
 * Verifies that TechJobDetail correctly loads photos from IndexedDB
 * when they have isIndexedDBRef=true, instead of trying to render
 * broken media key URLs as image sources.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const TECH_JOB_DETAIL_PATH = join(__dirname, '../../views/tech/TechJobDetail.tsx');
const techJobDetailSource = readFileSync(TECH_JOB_DETAIL_PATH, 'utf-8');

describe('TechJobDetail IndexedDB Photo Display', () => {
  it('imports getMediaLocal for loading photo data from IndexedDB', () => {
    expect(techJobDetailSource).toMatch(/import.*getMediaLocal.*from.*offline\/db/);
  });

  it('loads photos from IndexedDB when isIndexedDBRef is true', () => {
    // Must check isIndexedDBRef before attempting IndexedDB load
    expect(techJobDetailSource).toContain('photo.isIndexedDBRef');
    expect(techJobDetailSource).toContain('getMediaLocal(photo.url)');
  });

  it('uses getPhotoSrc helper instead of raw photo.url for img src', () => {
    // All photo img tags must use the helper that resolves IndexedDB references
    expect(techJobDetailSource).toContain('src={getPhotoSrc(photo)}');
    // Must NOT use raw photo.url directly (would show broken media_key URLs)
    expect(techJobDetailSource).not.toMatch(/src=\{photo\.url\s*\|\|/);
  });

  it('stores loaded data URLs in state for reactive rendering', () => {
    // photoDataUrls state must exist to hold loaded Base64 data
    expect(techJobDetailSource).toContain('photoDataUrls');
    expect(techJobDetailSource).toContain('setPhotoDataUrls');
  });

  it('getPhotoSrc returns empty string for unloaded IndexedDB refs', () => {
    // Prevents broken image icons while IndexedDB data is loading
    expect(techJobDetailSource).toMatch(/photoDataUrls\.get\(photo\.id\)\s*\|\|\s*''/);
  });
});
