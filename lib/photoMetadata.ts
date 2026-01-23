/**
 * Photo Metadata Capture Service
 *
 * Captures device and context metadata for photos to enhance
 * evidence integrity and legal defensibility.
 *
 * Note: Browser cameras don't provide traditional EXIF data,
 * but we can capture equivalent metadata from device APIs.
 */

import { logger } from './errorLogger';

export interface DeviceMetadata {
  userAgent: string;
  platform: string;
  screenWidth: number;
  screenHeight: number;
  devicePixelRatio: number;
  language: string;
  timezone: string;
  timezoneOffset: number;
  online: boolean;
}

export interface CameraMetadata {
  facingMode?: 'user' | 'environment';
  width?: number;
  height?: number;
  frameRate?: number;
  deviceId?: string;
}

export interface PhotoMetadata {
  capturedAt: string;
  capturedAtUnix: number;
  device: DeviceMetadata;
  camera?: CameraMetadata;
  location?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
    altitude?: number;
    altitudeAccuracy?: number;
    heading?: number;
    speed?: number;
  };
  hash?: string;
  orientation?: number;
}

/**
 * Capture device metadata
 */
export function captureDeviceMetadata(): DeviceMetadata {
  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    devicePixelRatio: window.devicePixelRatio || 1,
    language: navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    timezoneOffset: new Date().getTimezoneOffset(),
    online: navigator.onLine
  };
}

/**
 * Extract camera metadata from MediaStreamTrack
 */
export function captureCameraMetadata(track?: MediaStreamTrack): CameraMetadata | undefined {
  if (!track) return undefined;

  try {
    const settings = track.getSettings();
    const capabilities = track.getCapabilities?.() || {};

    return {
      facingMode: settings.facingMode as 'user' | 'environment' | undefined,
      width: settings.width,
      height: settings.height,
      frameRate: settings.frameRate,
      deviceId: settings.deviceId
    };
  } catch (error) {
    logger.warn('evidence', 'Failed to capture camera metadata', error);
    return undefined;
  }
}

/**
 * Capture full photo metadata
 */
export async function capturePhotoMetadata(
  videoTrack?: MediaStreamTrack,
  position?: GeolocationPosition
): Promise<PhotoMetadata> {
  const now = new Date();

  const metadata: PhotoMetadata = {
    capturedAt: now.toISOString(),
    capturedAtUnix: now.getTime(),
    device: captureDeviceMetadata(),
    camera: captureCameraMetadata(videoTrack)
  };

  if (position) {
    metadata.location = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      altitude: position.coords.altitude ?? undefined,
      altitudeAccuracy: position.coords.altitudeAccuracy ?? undefined,
      heading: position.coords.heading ?? undefined,
      speed: position.coords.speed ?? undefined
    };
  }

  return metadata;
}

/**
 * Calculate image hash from data URL
 */
export async function hashImageData(dataUrl: string): Promise<string> {
  try {
    // Extract base64 data
    const base64Data = dataUrl.split(',')[1];
    if (!base64Data) {
      throw new Error('Invalid data URL format');
    }

    // Convert to bytes
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Calculate SHA-256 hash
    const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (error) {
    logger.error('evidence', 'Failed to hash image data', error);
    throw error;
  }
}

/**
 * Get screen orientation
 */
export function getOrientation(): number {
  if (typeof window !== 'undefined' && window.screen?.orientation?.angle !== undefined) {
    return window.screen.orientation.angle;
  }
  // Fallback for older browsers
  return window.orientation as number || 0;
}

/**
 * Create a complete evidence record for a photo
 */
export async function createPhotoEvidenceRecord(
  dataUrl: string,
  videoTrack?: MediaStreamTrack,
  position?: GeolocationPosition
): Promise<PhotoMetadata & { hash: string }> {
  const [metadata, hash] = await Promise.all([
    capturePhotoMetadata(videoTrack, position),
    hashImageData(dataUrl)
  ]);

  return {
    ...metadata,
    hash,
    orientation: getOrientation()
  };
}

/**
 * Verify photo metadata hasn't been tampered with
 */
export async function verifyPhotoIntegrity(
  dataUrl: string,
  expectedHash: string
): Promise<boolean> {
  try {
    const currentHash = await hashImageData(dataUrl);
    return currentHash === expectedHash;
  } catch (error) {
    logger.error('evidence', 'Failed to verify photo integrity', error);
    return false;
  }
}
