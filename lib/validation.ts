/**
 * Input Validation Module
 * Provides type-safe validation for critical user inputs
 *
 * SECURITY: All user-facing inputs should be validated before processing
 * to prevent injection attacks and data corruption.
 */

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Password validation - PhD Level Rule
 * 15+ chars OR (8+ chars AND upper AND symbol)
 */
export const validatePassword = (password: string): { isValid: boolean; error?: string } => {
  const isMin15 = password.length >= 15;
  const isAtLeast8 = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasSymbol = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  if (isMin15) {
    return { isValid: true };
  }

  if (isAtLeast8 && hasUpper && hasSymbol) {
    return { isValid: true };
  }

  if (password.length < 8) {
    return { isValid: false, error: 'Password must be at least 8 characters long.' };
  }

  return {
    isValid: false,
    error: 'Password must be 15+ characters, or 8+ characters with a capital letter and a special character.'
  };
};

/**
 * Email validation with RFC 5322 compliance
 */
export function validateEmail(input: string): ValidationResult<string> {
  const trimmed = input.trim().toLowerCase();

  if (!trimmed) {
    return { success: false, error: 'Email is required' };
  }

  if (trimmed.length > 254) {
    return { success: false, error: 'Email too long' };
  }

  // RFC 5322 compliant email regex
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

  if (!emailRegex.test(trimmed)) {
    return { success: false, error: 'Invalid email format' };
  }

  return { success: true, data: trimmed };
}

/**
 * Phone number validation (international format)
 */
export function validatePhone(input: string): ValidationResult<string> {
  const cleaned = input.replace(/[\s\-()]/g, '');

  if (!cleaned) {
    return { success: true, data: '' }; // Phone is optional
  }

  // Allow international format with country code
  const phoneRegex = /^\+?[1-9]\d{6,14}$/;

  if (!phoneRegex.test(cleaned)) {
    return { success: false, error: 'Invalid phone number format' };
  }

  return { success: true, data: cleaned };
}

/**
 * Job ID validation
 */
export function validateJobId(input: string): ValidationResult<string> {
  const trimmed = input.trim();

  if (!trimmed) {
    return { success: false, error: 'Job ID is required' };
  }

  // Job IDs should match pattern JP-TIMESTAMP-RANDOM or similar
  // Allow alphanumeric, hyphens, and underscores
  const jobIdRegex = /^[a-zA-Z0-9_-]{3,64}$/;

  if (!jobIdRegex.test(trimmed)) {
    return { success: false, error: 'Invalid job ID format' };
  }

  return { success: true, data: trimmed };
}

/**
 * Workspace slug validation
 */
export function validateWorkspaceSlug(input: string): ValidationResult<string> {
  const trimmed = input.trim().toLowerCase();

  if (!trimmed) {
    return { success: false, error: 'Workspace slug is required' };
  }

  if (trimmed.length < 3 || trimmed.length > 63) {
    return { success: false, error: 'Workspace slug must be 3-63 characters' };
  }

  // Slugs: lowercase alphanumeric and hyphens, no leading/trailing hyphens
  const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

  if (!slugRegex.test(trimmed)) {
    return { success: false, error: 'Slug can only contain lowercase letters, numbers, and hyphens' };
  }

  return { success: true, data: trimmed };
}

/**
 * General text field validation with XSS prevention
 */
export function validateTextField(
  input: string,
  options: {
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    fieldName?: string;
    sanitize?: boolean;
  } = {}
): ValidationResult<string> {
  const { required = false, minLength = 0, maxLength = 1000, fieldName = 'Field', sanitize = true } = options;
  const trimmed = input.trim();

  if (!trimmed && required) {
    return { success: false, error: `${fieldName} is required` };
  }

  if (!trimmed && !required) {
    return { success: true, data: '' };
  }

  if (trimmed.length < minLength) {
    return { success: false, error: `${fieldName} must be at least ${minLength} characters` };
  }

  if (trimmed.length > maxLength) {
    return { success: false, error: `${fieldName} must be less than ${maxLength} characters` };
  }

  // Optional XSS prevention - escape dangerous HTML
  const result = sanitize
    ? trimmed
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
    : trimmed;

  return { success: true, data: result };
}

/**
 * Magic link token validation
 */
export function validateMagicToken(input: string): ValidationResult<string> {
  const trimmed = input.trim();

  if (!trimmed) {
    return { success: false, error: 'Token is required' };
  }

  // Tokens should be alphanumeric with limited special chars
  const tokenRegex = /^[a-zA-Z0-9_-]{8,128}$/;

  if (!tokenRegex.test(trimmed)) {
    return { success: false, error: 'Invalid token format' };
  }

  return { success: true, data: trimmed };
}

/**
 * Price/amount validation
 */
export function validatePrice(input: string | number): ValidationResult<number> {
  const numValue = typeof input === 'string' ? parseFloat(input) : input;

  if (isNaN(numValue)) {
    return { success: false, error: 'Invalid price format' };
  }

  if (numValue < 0) {
    return { success: false, error: 'Price cannot be negative' };
  }

  if (numValue > 10000000) { // $10M max
    return { success: false, error: 'Price exceeds maximum allowed' };
  }

  // Round to 2 decimal places
  const rounded = Math.round(numValue * 100) / 100;

  return { success: true, data: rounded };
}

/**
 * UUID validation
 */
export function validateUUID(input: string): ValidationResult<string> {
  const trimmed = input.trim().toLowerCase();

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (!uuidRegex.test(trimmed)) {
    return { success: false, error: 'Invalid UUID format' };
  }

  return { success: true, data: trimmed };
}
