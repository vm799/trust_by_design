/**
 * Validation utility for Auth flows
 */

export const validatePassword = (password: string): { isValid: boolean; error?: string } => {
  const isMin15 = password.length >= 15;
  const isAtLeast8 = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasSymbol = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  const hasNumber = /[0-9]/.test(password);

  // PhD Level Rule: 15+ chars OR (8+ chars AND upper AND symbol)
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
