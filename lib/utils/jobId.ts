/**
 * Unified Job ID Generation
 *
 * All job creation pathways MUST use this function for ID generation.
 * Ensures consistent format across Wizard, QuickCreateJob, BunkerRun, and JobRunner.
 *
 * Format: job-<uuid> (e.g., job-a1b2c3d4-e5f6-7890-abcd-ef1234567890)
 *
 * Uses crypto.randomUUID() for cryptographic uniqueness (zero collision risk).
 * Falls back to timestamp+random for environments without crypto.randomUUID().
 */

export function generateJobId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `job-${crypto.randomUUID()}`;
  }
  // Fallback for older environments
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 11);
  return `job-${timestamp}-${random}`;
}
