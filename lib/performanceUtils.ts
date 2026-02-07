/**
 * Performance Optimization Utilities
 * Provides debounce, throttle, and request deduplication helpers
 */

import { useEffect, useRef, useCallback, useState } from 'react';

/**
 * Debounce hook for delaying function execution
 * Useful for search inputs, form validation, etc.
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Debounced callback hook
 * Returns a memoized debounced function
 */
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): (...args: Parameters<T>) => void {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  return useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        callback(...args);
      }, delay);
    },
    [callback, delay]
  );
}

/**
 * Throttle function - limits execution frequency
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  return function (this: any, ...args: Parameters<T>) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Debounce function - delays execution until after wait period
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  return function (this: any, ...args: Parameters<T>) {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

/**
 * Request Deduplication Cache
 * Prevents duplicate concurrent requests with same parameters
 */
class RequestCache {
  private cache = new Map<string, Promise<any>>();
  private timeouts = new Map<string, NodeJS.Timeout>();

  /**
   * Get or create a cached request
   * @param key Unique identifier for the request
   * @param fetcher Function that performs the actual request
   * @param ttl Time to live in milliseconds (default: 5000ms)
   */
  async dedupe<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number = 5000
  ): Promise<T> {
    // Check if request is already in flight
    if (this.cache.has(key)) {
      return this.cache.get(key) as Promise<T>;
    }

    // Create new request
    const promise = fetcher()
      .then((result) => {
        // Schedule cache cleanup
        const timeout = setTimeout(() => {
          this.cache.delete(key);
          this.timeouts.delete(key);
        }, ttl);
        this.timeouts.set(key, timeout);
        return result;
      })
      .catch((error) => {
        // Remove from cache on error
        this.cache.delete(key);
        throw error;
      });

    this.cache.set(key, promise);
    return promise;
  }

  /**
   * Clear all cached requests
   */
  clear(): void {
    // Clear all timeouts
    this.timeouts.forEach((timeout) => clearTimeout(timeout));
    this.timeouts.clear();
    this.cache.clear();
  }

  /**
   * Clear a specific cached request
   */
  clearKey(key: string): void {
    const timeout = this.timeouts.get(key);
    if (timeout) {
      clearTimeout(timeout);
      this.timeouts.delete(key);
    }
    this.cache.delete(key);
  }
}

// Global request cache instance
export const requestCache = new RequestCache();

/**
 * Generate a cache key from function name and arguments
 */
export function generateCacheKey(fnName: string, ...args: any[]): string {
  return `${fnName}:${JSON.stringify(args)}`;
}
