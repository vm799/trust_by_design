/**
 * Toast Notification System
 *
 * Lightweight standalone toast notifications replacing browser alert() calls.
 * No React context required - renders via DOM portal.
 *
 * Usage:
 *   import { toast } from '../lib/toast';
 *   toast.success('Job saved successfully');
 *   toast.error('Failed to save. Please try again.');
 *   toast.info('Link copied to clipboard');
 *   toast.warning('Another job is in progress');
 */

export type ToastVariant = 'success' | 'error' | 'info' | 'warning';

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
  element?: HTMLDivElement;
}

let nextId = 0;
const activeToasts: ToastItem[] = [];
let container: HTMLDivElement | null = null;

const TOAST_DURATION = 4000;
const TOAST_ANIMATION_MS = 300;
const MAX_TOASTS = 5;

const variantStyles: Record<ToastVariant, { bg: string; icon: string; border: string }> = {
  success: {
    bg: 'background: linear-gradient(135deg, #065f46, #064e3b); color: #6ee7b7;',
    icon: 'check_circle',
    border: 'border-left: 4px solid #10b981;',
  },
  error: {
    bg: 'background: linear-gradient(135deg, #7f1d1d, #6b1c1c); color: #fca5a5;',
    icon: 'error',
    border: 'border-left: 4px solid #ef4444;',
  },
  info: {
    bg: 'background: linear-gradient(135deg, #1e3a5f, #1e293b); color: #93c5fd;',
    icon: 'info',
    border: 'border-left: 4px solid #3b82f6;',
  },
  warning: {
    bg: 'background: linear-gradient(135deg, #78350f, #6b3410); color: #fcd34d;',
    icon: 'warning',
    border: 'border-left: 4px solid #f59e0b;',
  },
};

function getContainer(): HTMLDivElement {
  if (container && document.body.contains(container)) return container;

  container = document.createElement('div');
  container.id = 'toast-container';
  container.setAttribute('role', 'status');
  container.setAttribute('aria-live', 'polite');
  container.setAttribute('aria-label', 'Notifications');
  container.style.cssText = `
    position: fixed;
    top: 16px;
    right: 16px;
    left: 16px;
    z-index: 9999;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    pointer-events: none;
  `;
  document.body.appendChild(container);
  return container;
}

function removeToast(item: ToastItem): void {
  if (!item.element) return;
  item.element.style.opacity = '0';
  item.element.style.transform = 'translateY(-12px) scale(0.95)';
  setTimeout(() => {
    item.element?.remove();
    const idx = activeToasts.indexOf(item);
    if (idx > -1) activeToasts.splice(idx, 1);
  }, TOAST_ANIMATION_MS);
}

function show(message: string, variant: ToastVariant): void {
  // Evict oldest if at max
  while (activeToasts.length >= MAX_TOASTS) {
    const oldest = activeToasts.shift();
    if (oldest) removeToast(oldest);
  }

  const c = getContainer();
  const style = variantStyles[variant];
  const id = nextId++;

  const el = document.createElement('div');
  el.style.cssText = `
    ${style.bg}
    ${style.border}
    padding: 12px 16px;
    border-radius: 12px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 14px;
    font-weight: 500;
    line-height: 1.4;
    max-width: 400px;
    width: 100%;
    display: flex;
    align-items: center;
    gap: 10px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.4);
    pointer-events: auto;
    cursor: pointer;
    opacity: 0;
    transform: translateY(-12px) scale(0.95);
    transition: opacity ${TOAST_ANIMATION_MS}ms ease, transform ${TOAST_ANIMATION_MS}ms ease;
  `;

  el.innerHTML = `
    <span class="material-symbols-outlined" style="font-size: 20px; flex-shrink: 0;" aria-hidden="true">${style.icon}</span>
    <span style="flex: 1;">${escapeHtml(message)}</span>
  `;

  const item: ToastItem = { id, message, variant, element: el };
  activeToasts.push(item);

  el.addEventListener('click', () => removeToast(item));
  c.appendChild(el);

  // Trigger entrance animation
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      el.style.opacity = '1';
      el.style.transform = 'translateY(0) scale(1)';
    });
  });

  // Auto-dismiss
  setTimeout(() => removeToast(item), TOAST_DURATION);
}

function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

export const toast = {
  success: (message: string) => show(message, 'success'),
  error: (message: string) => show(message, 'error'),
  info: (message: string) => show(message, 'info'),
  warning: (message: string) => show(message, 'warning'),
};

export default toast;
