/**
 * Validation utility for Auth flows
 */

export const validatePassword = (password: string): { isValid: boolean; error?: string } => {
  if (password.length < 15) {
    return { isValid: false, error: 'Password must be at least 15 characters long.' };
  }
  if (!/[A-Z]/.test(password)) {
    return { isValid: false, error: 'Password must contain at least one uppercase letter.' };
  }
  if (!/[0-9]/.test(password)) {
    return { isValid: false, error: 'Password must contain at least one number.' };
  }
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    return { isValid: false, error: 'Password must contain at least one special character.' };
  }
  return { isValid: true };
};
