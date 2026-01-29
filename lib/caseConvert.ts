/**
 * Case Conversion Utilities
 *
 * Ensures JavaScript camelCase objects are properly converted to PostgreSQL snake_case
 * and vice versa. Critical for preventing Supabase 400 errors from schema mismatches.
 *
 * @author Claude Code - Performance Optimization
 */

/**
 * Convert camelCase string to snake_case
 * @example toSnakeCase('managerEmail') // 'manager_email'
 */
export function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

/**
 * Convert snake_case string to camelCase
 * @example toCamelCase('manager_email') // 'managerEmail'
 */
export function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Convert object keys from camelCase to snake_case (for Supabase INSERT/UPDATE)
 * @param obj - JavaScript object with camelCase keys
 * @returns Object with snake_case keys for PostgreSQL
 */
export function toSnakeCaseKeys<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => toSnakeCaseKeys(item as Record<string, unknown>)) as unknown as Record<string, unknown>;
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = toSnakeCase(key);
    // Recursively convert nested objects
    if (value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      result[snakeKey] = toSnakeCaseKeys(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      result[snakeKey] = value.map(item =>
        typeof item === 'object' && item !== null
          ? toSnakeCaseKeys(item as Record<string, unknown>)
          : item
      );
    } else {
      result[snakeKey] = value;
    }
  }
  return result;
}

/**
 * Convert object keys from snake_case to camelCase (for Supabase SELECT)
 * @param obj - PostgreSQL object with snake_case keys
 * @returns Object with camelCase keys for JavaScript
 */
export function toCamelCaseKeys<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => toCamelCaseKeys(item as Record<string, unknown>)) as unknown as Record<string, unknown>;
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = toCamelCase(key);
    // Recursively convert nested objects
    if (value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      result[camelKey] = toCamelCaseKeys(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      result[camelKey] = value.map(item =>
        typeof item === 'object' && item !== null
          ? toCamelCaseKeys(item as Record<string, unknown>)
          : item
      );
    } else {
      result[camelKey] = value;
    }
  }
  return result;
}

/**
 * Map of common field names (camelCase -> snake_case)
 * Used for explicit field mapping to avoid edge cases
 */
export const FIELD_MAP: Record<string, string> = {
  // Job fields
  jobId: 'job_id',
  jobName: 'job_name',
  clientEmail: 'client_email',
  clientName: 'client_name',
  managerEmail: 'manager_email',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  lastUpdated: 'last_updated',
  completedAt: 'completed_at',
  signerName: 'signer_name',
  signerRole: 'signer_role',
  signatureUrl: 'signature_url',
  syncStatus: 'sync_status',

  // Photo fields
  photoId: 'photo_id',
  isIndexedDBRef: 'is_indexed_db_ref',

  // Auth fields
  userId: 'user_id',
  workspaceId: 'workspace_id',

  // Timestamps
  expiresAt: 'expires_at',
  deletedAt: 'deleted_at',
};

/**
 * Map a specific field name to snake_case using the explicit field map
 * Falls back to automatic conversion if not in map
 */
export function mapFieldToSnake(field: string): string {
  return FIELD_MAP[field] || toSnakeCase(field);
}
