/**
 * Utility functions for the application
 */

type ClassValue = string | number | boolean | undefined | null | ClassArray | ClassDictionary;
type ClassArray = ClassValue[];
type ClassDictionary = Record<string, any>;

/**
 * Merges class names, filtering out falsy values
 * Simple implementation without external dependencies
 *
 * @param inputs - Class values to merge
 * @returns Merged class string
 *
 * @example
 * cn('px-2 py-1', condition && 'bg-blue-500', { 'text-white': isActive })
 */
export function cn(...inputs: ClassValue[]): string {
  const classes: string[] = [];

  for (const input of inputs) {
    if (!input) continue;

    if (typeof input === 'string' || typeof input === 'number') {
      classes.push(String(input));
    } else if (Array.isArray(input)) {
      const result = cn(...input);
      if (result) classes.push(result);
    } else if (typeof input === 'object') {
      for (const [key, value] of Object.entries(input)) {
        if (value) classes.push(key);
      }
    }
  }

  return classes.join(' ');
}
