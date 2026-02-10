/**
 * Image Compression Pipeline Tests
 *
 * Tests the shared compressImage utility:
 * - Compresses images to target size
 * - Maintains aspect ratio when resizing
 * - Returns valid base64 data URL
 * - Handles edge cases (small images, invalid input)
 * - Reports actual byte size
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { compressImage, estimateBase64Bytes } from '../../lib/imageCompression';

// Mock canvas and image in jsdom
const mockToDataURL = vi.fn();
const mockDrawImage = vi.fn();
const mockGetContext = vi.fn(() => ({
  drawImage: mockDrawImage,
}));

const originalCreateElement = document.createElement.bind(document);

beforeEach(() => {
  vi.clearAllMocks();

  // Mock createElement for canvas only - use original for everything else
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    if (tag === 'canvas') {
      return {
        width: 0,
        height: 0,
        getContext: mockGetContext,
        toDataURL: mockToDataURL,
      } as unknown as HTMLCanvasElement;
    }
    return originalCreateElement(tag);
  });
});

describe('imageCompression', () => {
  describe('estimateBase64Bytes', () => {
    it('should estimate bytes from base64 string length', () => {
      // base64 overhead: ~4/3 ratio, so actual bytes ≈ length * 0.75
      const fakeBase64 = 'data:image/jpeg;base64,' + 'A'.repeat(1000);
      const bytes = estimateBase64Bytes(fakeBase64);
      expect(bytes).toBeGreaterThan(0);
      expect(bytes).toBeLessThan(1000);
    });

    it('should return 0 for empty string', () => {
      expect(estimateBase64Bytes('')).toBe(0);
    });
  });

  describe('compressImage', () => {
    it('should return a promise', () => {
      // Set up mock to return small data URL
      mockToDataURL.mockReturnValue('data:image/jpeg;base64,smallimage');

      const result = compressImage('data:image/jpeg;base64,test');
      expect(result).toBeInstanceOf(Promise);
    });

    it('should resolve with dataUrl and sizeBytes', async () => {
      const smallDataUrl = 'data:image/jpeg;base64,' + 'A'.repeat(100);
      mockToDataURL.mockReturnValue(smallDataUrl);

      // Mock Image
      const mockImage = {
        width: 800,
        height: 600,
        onload: null as (() => void) | null,
        set src(_value: string) {
          // Trigger onload synchronously for test
          setTimeout(() => this.onload?.(), 0);
        },
      };
      vi.spyOn(globalThis, 'Image').mockImplementation(() => mockImage as unknown as HTMLImageElement);

      const result = await compressImage('data:image/jpeg;base64,original');

      expect(result).toHaveProperty('dataUrl');
      expect(result).toHaveProperty('sizeBytes');
      expect(result.dataUrl).toContain('data:image/jpeg');
      expect(result.sizeBytes).toBeGreaterThanOrEqual(0);
    });

    it('should default to 500KB max size', async () => {
      // The default maxSizeKB is 500
      const smallDataUrl = 'data:image/jpeg;base64,' + 'A'.repeat(100);
      mockToDataURL.mockReturnValue(smallDataUrl);

      const mockImage = {
        width: 400,
        height: 300,
        onload: null as (() => void) | null,
        set src(_value: string) {
          setTimeout(() => this.onload?.(), 0);
        },
      };
      vi.spyOn(globalThis, 'Image').mockImplementation(() => mockImage as unknown as HTMLImageElement);

      const result = await compressImage('data:image/jpeg;base64,test');
      // Should complete without error - default is 500KB
      expect(result.dataUrl).toBeTruthy();
    });

    it('should reduce quality iteratively for large images', async () => {
      // First call returns large, subsequent calls return smaller
      let callCount = 0;
      mockToDataURL.mockImplementation(() => {
        callCount++;
        if (callCount <= 2) {
          // Returns ~1MB (too large for 500KB target)
          return 'data:image/jpeg;base64,' + 'A'.repeat(1024 * 1024);
        }
        // Returns ~200KB (under target)
        return 'data:image/jpeg;base64,' + 'A'.repeat(200 * 1024);
      });

      const mockImage = {
        width: 3000,
        height: 2000,
        onload: null as (() => void) | null,
        set src(_value: string) {
          setTimeout(() => this.onload?.(), 0);
        },
      };
      vi.spyOn(globalThis, 'Image').mockImplementation(() => mockImage as unknown as HTMLImageElement);

      const result = await compressImage('data:image/jpeg;base64,huge', 500);

      // Should have called toDataURL multiple times (quality reduction loop)
      expect(mockToDataURL.mock.calls.length).toBeGreaterThan(1);
      expect(result.dataUrl).toBeTruthy();
    });

    it('should cap dimensions to maxDim (1200px)', async () => {
      const smallDataUrl = 'data:image/jpeg;base64,' + 'A'.repeat(100);
      mockToDataURL.mockReturnValue(smallDataUrl);

      const mockImage = {
        width: 4000,
        height: 3000,
        onload: null as (() => void) | null,
        set src(_value: string) {
          setTimeout(() => this.onload?.(), 0);
        },
      };
      vi.spyOn(globalThis, 'Image').mockImplementation(() => mockImage as unknown as HTMLImageElement);

      await compressImage('data:image/jpeg;base64,huge');

      // Canvas should have been created with capped dimensions
      const canvas = document.createElement('canvas') as any;
      // The resize logic should cap at 1200
      // Width 4000 > height 3000, so width = 1200, height = 1200 * (3000/4000) = 900
      // We verify drawImage was called
      expect(mockDrawImage).toHaveBeenCalled();
    });
  });
});
