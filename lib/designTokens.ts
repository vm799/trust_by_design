/**
 * JOBPROOF DESIGN SYSTEM TOKENS
 *
 * Single source of truth for visual design:
 * - Colors (brand, semantic, status)
 * - Typography scales
 * - Spacing grid (8px base)
 * - Shadows (depth levels)
 * - Gradients (hero, accent, status)
 * - Animation timings & easing
 * - Affordance rules (what looks clickable)
 *
 * Last Updated: Feb 2026
 */

// ============================================================================
// COLOR PALETTE
// ============================================================================

export const colors = {
  // Brand Primary
  primary: '#2563eb',        // Blue - Trust, Professional
  'primary-hover': '#1d4ed8',
  'primary-light': '#dbeafe', // 50%
  'primary-dark': '#1e40af',

  // Status Colors (Semantic)
  success: '#10b981',         // Emerald - Complete jobs
  'success-hover': '#059669',
  'success-light': '#d1fae5',

  danger: '#ef4444',          // Red - Overdue, urgent
  'danger-hover': '#dc2626',
  'danger-light': '#fee2e2',

  warning: '#f59e0b',         // Amber - Attention needed
  'warning-hover': '#d97706',
  'warning-light': '#fef3c7',

  info: '#0ea5e9',            // Sky - Information
  'info-hover': '#0284c7',
  'info-light': '#e0f2fe',

  // Neutral Scale
  'slate-50': '#f8fafc',
  'slate-100': '#f1f5f9',
  'slate-200': '#e2e8f0',
  'slate-300': '#cbd5e1',
  'slate-400': '#94a3b8',
  'slate-500': '#64748b',
  'slate-600': '#475569',
  'slate-700': '#334155',
  'slate-800': '#1e293b',
  'slate-900': '#0f172a',

  // Background & Text
  background: '#ffffff',
  'background-dark': '#f8fafc',
  'background-dark-alt': '#f1f5f9',
  foreground: '#0f172a',
  'foreground-muted': '#64748b',

  // Role-Specific Accents
  'tech-accent': '#10b981',      // Technician - Emerald
  'manager-accent': '#8b5cf6',   // Manager - Violet
  'solo-accent': '#f59e0b',      // Solo contractor - Amber

  // Special Effects
  'sealed-glow': '#00ffcc',      // Forensic teal
  'sealed-glow-dim': 'rgba(0, 255, 204, 0.3)',
  'sealed-glow-faint': 'rgba(0, 255, 204, 0.1)',
};

// ============================================================================
// TYPOGRAPHY
// ============================================================================

export const typography = {
  // Font Families
  sans: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',

  // Heading Scale
  h1: {
    fontSize: '36px',
    fontWeight: 700,
    lineHeight: '1.2',
    letterSpacing: '-0.5px',
  },
  h2: {
    fontSize: '28px',
    fontWeight: 700,
    lineHeight: '1.3',
    letterSpacing: '-0.25px',
  },
  h3: {
    fontSize: '24px',
    fontWeight: 700,
    lineHeight: '1.3',
    letterSpacing: '0px',
  },
  h4: {
    fontSize: '20px',
    fontWeight: 600,
    lineHeight: '1.4',
    letterSpacing: '0px',
  },
  h5: {
    fontSize: '16px',
    fontWeight: 600,
    lineHeight: '1.5',
    letterSpacing: '0px',
  },

  // Body Copy
  body: {
    fontSize: '14px',
    fontWeight: 400,
    lineHeight: '1.6',
    letterSpacing: '0px',
  },
  'body-large': {
    fontSize: '16px',
    fontWeight: 400,
    lineHeight: '1.6',
    letterSpacing: '0px',
  },
  'body-small': {
    fontSize: '12px',
    fontWeight: 400,
    lineHeight: '1.5',
    letterSpacing: '0px',
  },

  // Labels & Tags
  label: {
    fontSize: '12px',
    fontWeight: 500,
    lineHeight: '1.4',
    letterSpacing: '0.5px',
    textTransform: 'uppercase' as const,
  },
  caption: {
    fontSize: '11px',
    fontWeight: 500,
    lineHeight: '1.3',
    letterSpacing: '0.3px',
  },

  // Button Text
  button: {
    fontSize: '14px',
    fontWeight: 600,
    lineHeight: '1.4',
    letterSpacing: '0px',
  },
};

// ============================================================================
// SPACING GRID (8px base)
// ============================================================================

export const spacing = {
  xs: '4px',    // 0.5 units
  sm: '8px',    // 1 unit
  md: '16px',   // 2 units
  lg: '24px',   // 3 units
  xl: '32px',   // 4 units
  '2xl': '48px', // 6 units
  '3xl': '64px', // 8 units
};

// ============================================================================
// SHADOWS (Depth Levels)
// ============================================================================

export const shadows = {
  // Subtle - Small components, hover states
  sm: '0 1px 2px rgba(0, 0, 0, 0.05)',

  // Normal - Cards, regular components
  md: '0 4px 6px rgba(0, 0, 0, 0.07), 0 2px 4px rgba(0, 0, 0, 0.05)',

  // Large - Elevated sections, modals
  lg: '0 10px 15px rgba(0, 0, 0, 0.1), 0 4px 6px rgba(0, 0, 0, 0.05)',

  // Extra Large - Top-level overlays
  xl: '0 20px 25px rgba(0, 0, 0, 0.15), 0 10px 10px rgba(0, 0, 0, 0.05)',

  // Focus Ring (accessibility)
  focus: '0 0 0 4px rgba(37, 99, 235, 0.5)',
};

// ============================================================================
// GRADIENTS
// ============================================================================

export const gradients = {
  // Hero Section - Blue to Purple
  hero: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)',

  // Success State - Green fade
  success: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)',

  // Warning State - Orange fade
  warning: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',

  // Danger State - Red fade
  danger: 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)',

  // Info State - Blue fade
  info: 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)',

  // Glass Effect - Subtle white
  glass: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)',

  // Dark Glass Effect
  'glass-dark': 'linear-gradient(135deg, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.1) 100%)',
};

// ============================================================================
// ANIMATIONS & TIMING
// ============================================================================

export const animations = {
  timings: {
    instant: '0ms',
    fast: '100ms',
    normal: '200ms',
    slow: '300ms',
    verySlow: '500ms',
  },

  easing: {
    easeOut: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
    easeInOut: 'cubic-bezier(0.42, 0, 0.58, 1)',
    easeIn: 'cubic-bezier(0.42, 0, 1, 1)',
    bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
  },

  // Preset animations
  transitions: {
    // Card hover lift
    cardHover: `transform 200ms cubic-bezier(0.25, 0.46, 0.45, 0.94),
                box-shadow 200ms cubic-bezier(0.25, 0.46, 0.45, 0.94)`,

    // Button press
    buttonPress: `transform 100ms cubic-bezier(0.25, 0.46, 0.45, 0.94),
                  box-shadow 100ms cubic-bezier(0.25, 0.46, 0.45, 0.94)`,

    // Modal slide-in
    modalSlideIn: `all 300ms cubic-bezier(0.25, 0.46, 0.45, 0.94)`,

    // Fade
    fade: `opacity 200ms cubic-bezier(0.25, 0.46, 0.45, 0.94)`,

    // Color change
    colorChange: `color 200ms cubic-bezier(0.42, 0, 0.58, 1)`,
  },
};

// ============================================================================
// AFFORDANCES (Visual Cues for Interactivity)
// ============================================================================

export const affordances = {
  // Clickable card appearance
  clickableCard: {
    default: {
      shadow: shadows.sm,
      cursor: 'pointer',
      borderColor: 'transparent',
    },
    hover: {
      shadow: shadows.md,
      transform: 'translateY(-2px)',
      transition: animations.transitions.cardHover,
    },
    active: {
      shadow: shadows.lg,
      backgroundColor: colors['primary-light'],
      borderColor: colors.primary,
    },
    focus: {
      outline: 'none',
      boxShadow: shadows.focus,
    },
  },

  // Button appearance
  button: {
    default: {
      minHeight: '44px',
      minWidth: '44px',
      padding: '8px 16px',
      borderRadius: '8px',
      transition: animations.transitions.buttonPress,
      fontWeight: 600,
    },
    hover: {
      transform: 'scale(1.02)',
      transition: animations.transitions.buttonPress,
    },
    active: {
      transform: 'scale(0.98)',
    },
    focus: {
      outline: 'none',
      boxShadow: shadows.focus,
    },
    disabled: {
      opacity: 0.5,
      cursor: 'not-allowed',
      pointerEvents: 'none',
    },
  },

  // Icon appearance
  icon: {
    default: {
      color: colors['foreground-muted'],
      transition: animations.transitions.colorChange,
    },
    hover: {
      color: colors.foreground,
    },
  },

  // Input field appearance
  input: {
    default: {
      minHeight: '44px',
      padding: '10px 12px',
      borderRadius: '8px',
      borderWidth: '1px',
      borderColor: colors['slate-200'],
      transition: animations.transitions.fade,
    },
    focus: {
      borderColor: colors.primary,
      boxShadow: shadows.focus,
      outline: 'none',
    },
    error: {
      borderColor: colors.danger,
      boxShadow: `0 0 0 4px ${colors['danger-light']}`,
    },
    disabled: {
      backgroundColor: colors['slate-100'],
      cursor: 'not-allowed',
      opacity: 0.6,
    },
  },

  // Touch target (mobile)
  touchTarget: {
    minHeight: '56px',
    minWidth: '56px',
  },
};

// ============================================================================
// BREAKPOINTS
// ============================================================================

export const breakpoints = {
  xs: '0px',
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
};

// ============================================================================
// MOTION PRESETS
// ============================================================================

export const motionPresets = {
  // Stagger children animations
  staggerContainer: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },

  // Fade in animation
  fadeIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    transition: { duration: 0.3, ease: 'easeOut' },
  },

  // Slide in from right
  slideInRight: {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    transition: { duration: 0.3, ease: 'easeOut' },
  },

  // Slide in from top
  slideInTop: {
    initial: { opacity: 0, y: -20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.3, ease: 'easeOut' },
  },

  // Scale in animation
  scaleIn: {
    initial: { opacity: 0, scale: 0.9 },
    animate: { opacity: 1, scale: 1 },
    transition: { duration: 0.3, ease: 'easeOut' },
  },

  // Bounce animation
  bounce: {
    initial: { opacity: 0, scale: 0.8 },
    animate: { opacity: 1, scale: 1 },
    transition: { duration: 0.4, ease: 'easeOut', type: 'spring', stiffness: 400 },
  },
};

// ============================================================================
// EXPORT GROUPS
// ============================================================================

export const designSystem = {
  colors,
  typography,
  spacing,
  shadows,
  gradients,
  animations,
  affordances,
  breakpoints,
  motionPresets,
};

export default designSystem;
