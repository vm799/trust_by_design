/**
 * Structured Error Logging Service
 *
 * Provides centralized error logging with:
 * - Structured log format for production debugging
 * - Error categorization and severity levels
 * - Context preservation for debugging
 * - Rate limiting to prevent log flooding
 * - Optional remote reporting hook
 */

export type ErrorSeverity = 'debug' | 'info' | 'warn' | 'error' | 'critical';

export type ErrorCategory =
  | 'auth'
  | 'sync'
  | 'storage'
  | 'network'
  | 'validation'
  | 'encryption'
  | 'evidence'
  | 'ui'
  | 'unknown';

export interface LogEntry {
  timestamp: string;
  severity: ErrorSeverity;
  category: ErrorCategory;
  message: string;
  code?: string;
  context?: Record<string, unknown>;
  stack?: string;
  userId?: string;
  sessionId?: string;
}

// In-memory log buffer for debugging
const LOG_BUFFER_SIZE = 100;
const logBuffer: LogEntry[] = [];

// Rate limiting - max 10 logs per category per minute
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX = 10;

// Session ID for log correlation
const sessionId = crypto.randomUUID?.() || Date.now().toString(36);

// Optional remote reporting endpoint
let remoteEndpoint: string | null = null;

/**
 * Configure remote error reporting
 */
export function configureRemoteLogging(endpoint: string): void {
  remoteEndpoint = endpoint;
}

/**
 * Check rate limit for a category
 */
function isRateLimited(category: ErrorCategory): boolean {
  const now = Date.now();
  const timestamps = rateLimitMap.get(category) || [];

  // Remove old timestamps
  const recent = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW);
  rateLimitMap.set(category, recent);

  if (recent.length >= RATE_LIMIT_MAX) {
    return true;
  }

  recent.push(now);
  return false;
}

/**
 * Create a log entry
 */
function createLogEntry(
  severity: ErrorSeverity,
  category: ErrorCategory,
  message: string,
  error?: Error | unknown,
  context?: Record<string, unknown>
): LogEntry {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    severity,
    category,
    message,
    sessionId,
    context
  };

  if (error instanceof Error) {
    entry.stack = error.stack;
    entry.code = (error as Error & { code?: string }).code;
  }

  // Try to get user ID from localStorage (if available)
  try {
    const userData = localStorage.getItem('jobproof_user_v2');
    if (userData) {
      const parsed = JSON.parse(userData);
      entry.userId = parsed.id;
    }
  } catch {
    // Ignore
  }

  return entry;
}

/**
 * Add entry to buffer
 */
function addToBuffer(entry: LogEntry): void {
  logBuffer.push(entry);
  if (logBuffer.length > LOG_BUFFER_SIZE) {
    logBuffer.shift();
  }
}

/**
 * Send to remote endpoint if configured
 */
async function sendToRemote(entry: LogEntry): Promise<void> {
  if (!remoteEndpoint) return;
  if (entry.severity !== 'error' && entry.severity !== 'critical') return;

  try {
    await fetch(remoteEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry)
    });
  } catch {
    // Don't log errors about logging errors
  }
}

/**
 * Format entry for console output
 */
function formatForConsole(entry: LogEntry): string {
  const parts = [
    `[${entry.severity.toUpperCase()}]`,
    `[${entry.category}]`,
    entry.message
  ];

  if (entry.code) {
    parts.push(`(${entry.code})`);
  }

  return parts.join(' ');
}

/**
 * Core logging function
 */
function log(
  severity: ErrorSeverity,
  category: ErrorCategory,
  message: string,
  error?: Error | unknown,
  context?: Record<string, unknown>
): void {
  // Apply rate limiting for non-critical logs
  if (severity !== 'critical' && isRateLimited(category)) {
    return;
  }

  const entry = createLogEntry(severity, category, message, error, context);
  addToBuffer(entry);

  // Console output
  const formatted = formatForConsole(entry);
  switch (severity) {
    case 'debug':
      if (process.env.NODE_ENV === 'development') {
        console.debug(formatted, context);
      }
      break;
    case 'info':
      console.info(formatted, context);
      break;
    case 'warn':
      console.warn(formatted, context);
      break;
    case 'error':
    case 'critical':
      console.error(formatted, error, context);
      sendToRemote(entry);
      break;
  }
}

// Public logging API
export const logger = {
  debug: (category: ErrorCategory, message: string, context?: Record<string, unknown>) =>
    log('debug', category, message, undefined, context),

  info: (category: ErrorCategory, message: string, context?: Record<string, unknown>) =>
    log('info', category, message, undefined, context),

  warn: (category: ErrorCategory, message: string, error?: Error | unknown, context?: Record<string, unknown>) =>
    log('warn', category, message, error, context),

  error: (category: ErrorCategory, message: string, error?: Error | unknown, context?: Record<string, unknown>) =>
    log('error', category, message, error, context),

  critical: (category: ErrorCategory, message: string, error?: Error | unknown, context?: Record<string, unknown>) =>
    log('critical', category, message, error, context),

  /**
   * Get recent logs for debugging
   */
  getRecentLogs: (count: number = 50): LogEntry[] =>
    logBuffer.slice(-count),

  /**
   * Get logs by category
   */
  getLogsByCategory: (category: ErrorCategory): LogEntry[] =>
    logBuffer.filter(e => e.category === category),

  /**
   * Clear log buffer
   */
  clear: (): void => {
    logBuffer.length = 0;
  },

  /**
   * Export logs as JSON (for support)
   */
  exportLogs: (): string =>
    JSON.stringify(logBuffer, null, 2)
};

// Global error handler
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    logger.error('unknown', 'Uncaught error', event.error, {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    logger.error('unknown', 'Unhandled promise rejection', event.reason);
  });
}
