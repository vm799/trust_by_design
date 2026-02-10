/**
 * Image Compression Pipeline
 *
 * Compresses photos before IndexedDB storage and cloud upload.
 * Target: <500KB per photo to optimize offline storage and sync bandwidth.
 *
 * Strategy:
 *   1. Resize to max 1200px on longest side (preserves aspect ratio)
 *   2. JPEG encode at 0.8 quality
 *   3. Iteratively reduce quality until under target size
 *
 * Used by:
 *   - EvidenceCapture (on photo capture)
 *   - JobRunner / Bunker mode (on photo capture)
 *   - SyncQueue (pre-upload compression - future)
 */

const MAX_DIMENSION = 1200;
const INITIAL_QUALITY = 0.8;
const QUALITY_STEP = 0.1;
const MIN_QUALITY = 0.1;
const BASE64_OVERHEAD_FACTOR = 1.37;

/**
 * Estimate actual byte size from a base64 data URL string.
 * Base64 encodes 3 bytes into 4 characters, so actual ≈ length * 0.75
 */
export function estimateBase64Bytes(dataUrl: string): number {
  if (!dataUrl) return 0;
  const base64Part = dataUrl.split(',')[1] || dataUrl;
  return Math.round(base64Part.length * 0.75);
}

/**
 * Compress an image data URL to a target maximum size.
 *
 * @param dataUrl - Source image as base64 data URL
 * @param maxSizeKB - Target maximum size in kilobytes (default: 500)
 * @returns Compressed data URL and estimated byte size
 */
export async function compressImage(
  dataUrl: string,
  maxSizeKB: number = 500
): Promise<{ dataUrl: string; sizeBytes: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;

      let { width, height } = img;

      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        if (width > height) {
          height = (height / width) * MAX_DIMENSION;
          width = MAX_DIMENSION;
        } else {
          width = (width / height) * MAX_DIMENSION;
          height = MAX_DIMENSION;
        }
      }

      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);

      let quality = INITIAL_QUALITY;
      let compressed = canvas.toDataURL('image/jpeg', quality);

      while (
        compressed.length > maxSizeKB * 1024 * BASE64_OVERHEAD_FACTOR &&
        quality > MIN_QUALITY
      ) {
        quality -= QUALITY_STEP;
        compressed = canvas.toDataURL('image/jpeg', quality);
      }

      resolve({
        dataUrl: compressed,
        sizeBytes: Math.round(compressed.length * 0.75),
      });
    };
    img.src = dataUrl;
  });
}
