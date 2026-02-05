/**
 * Micro-Interactions Library
 * PhD-Level UX Delight - Haptic feedback, celebrations, and subtle animations
 */

/**
 * Escape HTML special characters to prevent XSS attacks.
 * All user-facing text in innerHTML MUST be escaped.
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Haptic feedback for mobile (if supported)
export const hapticFeedback = (type: 'light' | 'medium' | 'heavy' | 'success' | 'error' = 'light') => {
  if (!navigator.vibrate) return;

  const patterns: Record<string, number | number[]> = {
    light: 10,
    medium: 20,
    heavy: 30,
    success: [10, 50, 10, 50, 20],
    error: [50, 100, 50],
  };

  try {
    navigator.vibrate(patterns[type]);
  } catch {
    // Silently fail if vibration not supported
  }
};

// Confetti celebration effect
export const celebrateSuccess = () => {
  const colors = ['#3b82f6', '#10b981', '#f97316', '#8b5cf6', '#ec4899'];
  const confettiCount = 50;

  const container = document.createElement('div');
  container.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 9999;
    overflow: hidden;
  `;
  document.body.appendChild(container);

  for (let i = 0; i < confettiCount; i++) {
    const confetti = document.createElement('div');
    const color = colors[Math.floor(Math.random() * colors.length)];
    const size = Math.random() * 10 + 5;
    const startX = Math.random() * 100;
    const duration = Math.random() * 2 + 2;
    const delay = Math.random() * 0.5;

    confetti.style.cssText = `
      position: absolute;
      top: -20px;
      left: ${startX}%;
      width: ${size}px;
      height: ${size}px;
      background: ${color};
      border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
      animation: confetti-fall ${duration}s ease-out ${delay}s forwards;
      transform: rotate(${Math.random() * 360}deg);
    `;

    container.appendChild(confetti);
  }

  // Add keyframes if not already present
  if (!document.getElementById('confetti-keyframes')) {
    const style = document.createElement('style');
    style.id = 'confetti-keyframes';
    style.textContent = `
      @keyframes confetti-fall {
        0% {
          transform: translateY(0) rotate(0deg) scale(1);
          opacity: 1;
        }
        100% {
          transform: translateY(100vh) rotate(720deg) scale(0.5);
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(style);
  }

  // Cleanup after animation
  setTimeout(() => {
    container.remove();
  }, 4000);

  // Haptic feedback
  hapticFeedback('success');
};

// Subtle pulse animation for important elements
export const pulseElement = (element: HTMLElement, color = '#3b82f6') => {
  element.style.animation = 'none';
  element.offsetHeight; // Trigger reflow
  element.style.boxShadow = `0 0 0 0 ${color}40`;
  element.style.animation = 'pulse-ring 1s ease-out';

  // Add keyframes if not present
  if (!document.getElementById('pulse-keyframes')) {
    const style = document.createElement('style');
    style.id = 'pulse-keyframes';
    style.textContent = `
      @keyframes pulse-ring {
        0% {
          box-shadow: 0 0 0 0 currentColor;
        }
        70% {
          box-shadow: 0 0 0 10px transparent;
        }
        100% {
          box-shadow: 0 0 0 0 transparent;
        }
      }
    `;
    document.head.appendChild(style);
  }

  setTimeout(() => {
    element.style.animation = '';
    element.style.boxShadow = '';
  }, 1000);
};

// Success checkmark animation
export const showSuccessCheckmark = (container: HTMLElement) => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 52 52');
  svg.style.cssText = `
    width: 52px;
    height: 52px;
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
  `;

  svg.innerHTML = `
    <circle cx="26" cy="26" r="25" fill="none" stroke="#10b981" stroke-width="2"
      style="stroke-dasharray: 166; stroke-dashoffset: 166; animation: stroke 0.6s cubic-bezier(0.65, 0, 0.45, 1) forwards;" />
    <path fill="none" stroke="#10b981" stroke-width="3" d="M14.1 27.2l7.1 7.2 16.7-16.8"
      style="stroke-dasharray: 48; stroke-dashoffset: 48; animation: stroke 0.3s cubic-bezier(0.65, 0, 0.45, 1) 0.8s forwards;" />
  `;

  // Add stroke animation keyframes
  if (!document.getElementById('stroke-keyframes')) {
    const style = document.createElement('style');
    style.id = 'stroke-keyframes';
    style.textContent = `
      @keyframes stroke {
        100% {
          stroke-dashoffset: 0;
        }
      }
    `;
    document.head.appendChild(style);
  }

  container.appendChild(svg);

  return () => svg.remove();
};

// Button press feedback
export const buttonPressFeedback = (event: React.MouseEvent<HTMLButtonElement>) => {
  const button = event.currentTarget;
  button.style.transform = 'scale(0.98)';

  setTimeout(() => {
    button.style.transform = '';
  }, 100);

  hapticFeedback('light');
};

// Smooth scroll to element
export const smoothScrollTo = (element: HTMLElement, offset = 0) => {
  const top = element.getBoundingClientRect().top + window.scrollY - offset;
  window.scrollTo({
    top,
    behavior: 'smooth',
  });
};

// Stagger animation for lists
export const staggerChildren = (container: HTMLElement, delay = 50) => {
  const children = container.children;
  Array.from(children).forEach((child, index) => {
    const el = child as HTMLElement;
    el.style.opacity = '0';
    el.style.transform = 'translateY(10px)';
    el.style.transition = 'opacity 0.3s ease, transform 0.3s ease';

    setTimeout(() => {
      el.style.opacity = '1';
      el.style.transform = 'translateY(0)';
    }, index * delay);
  });
};

// Number counter animation
export const animateNumber = (
  element: HTMLElement,
  start: number,
  end: number,
  duration = 1000,
  prefix = '',
  suffix = ''
) => {
  const startTime = performance.now();
  const diff = end - start;

  const animate = (currentTime: number) => {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // Ease out cubic
    const easeOut = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(start + diff * easeOut);

    element.textContent = `${prefix}${current.toLocaleString()}${suffix}`;

    if (progress < 1) {
      requestAnimationFrame(animate);
    }
  };

  requestAnimationFrame(animate);
};

// Toast notification with auto-dismiss
export const showToast = (
  message: string,
  type: 'success' | 'error' | 'info' | 'warning' = 'info',
  duration = 4000
) => {
  const toast = document.createElement('div');

  const icons: Record<string, string> = {
    success: 'check_circle',
    error: 'error',
    info: 'info',
    warning: 'warning',
  };

  const colors: Record<string, string> = {
    success: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
    error: 'bg-red-500/10 border-red-500/30 text-red-400',
    info: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
    warning: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
  };

  toast.className = `fixed bottom-6 right-6 z-[200] max-w-sm animate-in slide-in-from-bottom-5 fade-in duration-300`;
  toast.innerHTML = `
    <div class="bg-slate-900 border-2 ${colors[type]} rounded-2xl p-4 shadow-2xl backdrop-blur-sm flex items-center gap-3">
      <span class="material-symbols-outlined text-xl">${icons[type]}</span>
      <p class="text-sm font-medium text-white flex-1">${escapeHtml(message)}</p>
      <button onclick="this.parentElement.parentElement.remove()" class="text-slate-500 hover:text-white transition-colors">
        <span class="material-symbols-outlined text-sm">close</span>
      </button>
    </div>
  `;

  document.body.appendChild(toast);

  // Haptic feedback for errors
  if (type === 'error') {
    hapticFeedback('error');
  } else if (type === 'success') {
    hapticFeedback('success');
  }

  // Auto-dismiss
  setTimeout(() => {
    toast.style.animation = 'slide-out-to-right-5 0.3s ease-out forwards, fade-out 0.3s ease-out forwards';
    setTimeout(() => toast.remove(), 300);
  }, duration);

  return () => toast.remove();
};

// Keyboard shortcut hint
export const showKeyboardHint = (key: string, action: string) => {
  const hint = document.createElement('div');
  hint.className = 'fixed bottom-6 left-6 z-[200] animate-in fade-in slide-in-from-bottom-2 duration-200';
  hint.innerHTML = `
    <div class="bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 shadow-lg flex items-center gap-2">
      <kbd class="bg-slate-700 px-2 py-1 rounded text-xs font-mono text-white">${escapeHtml(key)}</kbd>
      <span class="text-slate-400 text-sm">${escapeHtml(action)}</span>
    </div>
  `;

  document.body.appendChild(hint);

  setTimeout(() => {
    hint.style.animation = 'fade-out 0.2s ease-out forwards';
    setTimeout(() => hint.remove(), 200);
  }, 2000);
};
