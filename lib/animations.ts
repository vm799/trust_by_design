/**
 * Shared Animation Constants for Framer Motion
 *
 * REMEDIATION ITEM 11: Memoize Framer Motion animation objects
 *
 * Defining animation objects outside components prevents:
 * - Creating new object references on every render
 * - Unnecessary re-renders of motion components
 * - Memory allocation overhead from inline objects
 *
 * Usage:
 *   import { fadeInUp, staggerContainer } from '../lib/animations';
 *   <motion.div variants={fadeInUp} initial="hidden" animate="visible" />
 */

import type { Variants, Transition } from 'framer-motion';

// ============================================
// FADE ANIMATIONS
// ============================================

/** Fade in from below - common entry animation */
export const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

/** Fade in from above */
export const fadeInDown = {
  hidden: { opacity: 0, y: -20 },
  visible: { opacity: 1, y: 0 },
};

/** Simple fade in */
export const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

/** Fade in with scale */
export const fadeInScale = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1 },
};

// ============================================
// SLIDE ANIMATIONS
// ============================================

/** Slide in from left */
export const slideInLeft = {
  hidden: { opacity: 0, x: -50 },
  visible: { opacity: 1, x: 0 },
};

/** Slide in from right */
export const slideInRight = {
  hidden: { opacity: 0, x: 50 },
  visible: { opacity: 1, x: 0 },
};

/** Slide in from bottom (for modals, toasts) */
export const slideInBottom = {
  hidden: { opacity: 0, y: 100 },
  visible: { opacity: 1, y: 0 },
};

// ============================================
// CONTAINER ANIMATIONS (for staggered children)
// ============================================

/** Container that staggers its children */
export const staggerContainer = {
  hidden: { opacity: 1 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
};

/** Faster stagger for lists */
export const staggerContainerFast = {
  hidden: { opacity: 1 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.05,
    },
  },
};

// ============================================
// TRANSITION PRESETS
// ============================================

/** Standard smooth transition */
export const transitionSmooth: Transition = {
  duration: 0.6,
  ease: 'easeOut',
};

/** Quick transition for UI feedback */
export const transitionQuick: Transition = {
  duration: 0.3,
  ease: 'easeOut',
};

/** Spring transition for bouncy effects */
export const transitionSpring: Transition = {
  type: 'spring',
  stiffness: 300,
  damping: 30,
};

/** Gentle spring for larger movements */
export const transitionSpringGentle: Transition = {
  type: 'spring',
  stiffness: 200,
  damping: 25,
};

// ============================================
// BACKGROUND GLOW ANIMATIONS
// ============================================

/** Pulsing glow effect for backgrounds */
export const pulseGlow = {
  scale: [1, 1.2, 1],
  opacity: [0.3, 0.6, 0.3],
};

/** Floating glow animation config */
export const floatingGlowTransition: Transition = {
  duration: 4,
  repeat: Infinity,
  ease: 'easeInOut',
};

/** Slower floating animation */
export const floatingGlowSlowTransition: Transition = {
  duration: 5,
  repeat: Infinity,
  ease: 'easeInOut',
};

// ============================================
// CAROUSEL ANIMATIONS
// ============================================

/** Carousel slide variants with direction */
export const carouselSlideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 300 : -300,
    opacity: 0,
    scale: 0.95,
  }),
  center: {
    x: 0,
    opacity: 1,
    scale: 1,
  },
  exit: (direction: number) => ({
    x: direction < 0 ? 300 : -300,
    opacity: 0,
    scale: 0.95,
  }),
};

/** Carousel transition */
export const carouselTransition: Transition = {
  x: { type: 'spring', stiffness: 300, damping: 30 },
  opacity: { duration: 0.3 },
  scale: { duration: 0.3 },
};

// ============================================
// HOVER/TAP STATES
// ============================================

/** Hover lift effect */
export const hoverLift = {
  y: -5,
  transition: { duration: 0.2 },
};

/** Tap scale effect */
export const tapScale = {
  scale: 0.95,
};

/** Combined hover and tap for buttons */
export const buttonMotionProps = {
  whileHover: { y: -2 },
  whileTap: { scale: 0.98 },
  transition: { duration: 0.15 },
};

// ============================================
// DELAYED VARIANTS (for sequenced reveals)
// ============================================

/** Create fade in up with custom delay */
export const createFadeInUpDelayed = (delay: number): Variants => ({
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay },
  },
});

/** Create viewport-triggered animation props */
export const viewportOnce = { once: true };
export const viewportMargin = { margin: '-100px' };

// ============================================
// LANDING PAGE BACKGROUND ORBS
// ============================================

/** First background orb animation */
export const bgOrb1Animate = {
  x: [0, 50, 0],
  y: [0, 30, 0],
  scale: [1, 1.1, 1],
};

/** First background orb transition */
export const bgOrb1Transition: Transition = {
  duration: 20,
  repeat: Infinity,
  ease: 'easeInOut',
};

/** Second background orb animation */
export const bgOrb2Animate = {
  x: [0, -30, 0],
  y: [0, -50, 0],
  scale: [1.1, 1, 1.1],
};

/** Second background orb transition */
export const bgOrb2Transition: Transition = {
  duration: 25,
  repeat: Infinity,
  ease: 'easeInOut',
};

/** Center background orb animation */
export const bgOrbCenterAnimate = {
  scale: [1, 1.2, 1],
  opacity: [0.3, 0.5, 0.3],
};

/** Center background orb transition */
export const bgOrbCenterTransition: Transition = {
  duration: 15,
  repeat: Infinity,
  ease: 'easeInOut',
};

// ============================================
// HOVER ANIMATIONS
// ============================================

/** Card hover lift with quick transition */
export const hoverLiftQuick = {
  y: -5,
  transition: { duration: 0.2 },
};

/** Step number hover animation */
export const stepNumberHover = {
  scale: 1.1,
  rotate: 5,
};

// ============================================
// STEP TRANSITION ANIMATIONS
// ============================================

/** Step slide transition for multi-step wizards */
export const stepSlide = {
  hidden: { opacity: 0, x: 20 },
  visible: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
};

/** Step slide transition timing */
export const stepSlideTransition: Transition = {
  duration: 0.25,
};

/** Fade overlay for modal backdrops */
export const fadeOverlay = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

/** Subtle tap shrink for thumbnails */
export const tapShrink = {
  scale: 0.96,
};

// ============================================
// INLINE EXTRACTION: HOVER/TAP PRESETS
// ============================================

/** Small hover lift: y: -2 (for card/button hover) */
export const hoverLiftSmall = {
  y: -2,
} as const;

/** Tap scale shrink: scale 0.98 (subtle press feedback) */
export const tapScaleSubtle = {
  scale: 0.98,
} as const;

/** Hover scale + lift for metric cards: scale 1.02, y: -4 */
export const hoverScaleLift = {
  scale: 1.02,
  y: -4,
} as const;

/** Hover scale slight: scale 1.02 */
export const hoverScaleSlight = {
  scale: 1.02,
} as const;

/** Hover scale + shift for table rows: scale 1.01, x: 4 */
export const hoverScaleShiftSmall = {
  scale: 1.01,
  x: 4,
} as const;

/** Hover scale + shift for alert items: scale 1.02, x: 5 */
export const hoverScaleShift = {
  scale: 1.02,
  x: 5,
} as const;

/** Hover scale for action buttons: scale 1.05 */
export const hoverScaleUp = {
  scale: 1.05,
} as const;

/** Hover scale large for icon buttons: scale 1.1 */
export const hoverScaleLarge = {
  scale: 1.1,
} as const;

/** Hover lift with box shadow for stat cards */
export const hoverLiftShadow = {
  y: -4,
  boxShadow: '0 10px 15px rgba(0,0,0,0.1)',
} as const;

// ============================================
// INLINE EXTRACTION: TRANSITION PRESETS
// ============================================

/** Ultra-quick transition for micro-interactions (0.15s) */
export const transitionMicro: Transition = {
  duration: 0.15,
};

/** Fast transition (0.2s) */
export const transitionFast: Transition = {
  duration: 0.2,
};

/** Standard transition (0.3s) with delay factory */
export const transitionWithDelay = (delay: number): Transition => ({
  duration: 0.3,
  delay,
});

/** Standard transition (0.4s ease-out) */
export const transitionMedium: Transition = {
  duration: 0.4,
  ease: 'easeOut',
};

/** Spring transition for drawers/modals: damping 25, stiffness 300 */
export const transitionSpringSnappy: Transition = {
  type: 'spring',
  damping: 25,
  stiffness: 300,
};

/** Infinite pulse transition: 2s repeating ease-in-out */
export const transitionPulse: Transition = {
  duration: 2,
  repeat: Infinity,
  ease: 'easeInOut',
};

/** Faster infinite pulse: 1.5s repeating ease-in-out */
export const transitionPulseFast: Transition = {
  duration: 1.5,
  repeat: Infinity,
  ease: 'easeInOut',
};

/** Infinite spin: 1s linear repeat */
export const transitionSpin: Transition = {
  duration: 1,
  repeat: Infinity,
  ease: 'linear',
};

// ============================================
// INLINE EXTRACTION: PULSE ANIMATIONS
// ============================================

/** Pulsing dot: scale [1, 1.3, 1], opacity [1, 0.7, 1] */
export const pulseDot = {
  scale: [1, 1.3, 1],
  opacity: [1, 0.7, 1],
};

/** Pulsing indicator large: scale [1, 1.5, 1], opacity [1, 0.4, 1] */
export const pulseIndicatorLarge = {
  scale: [1, 1.5, 1],
  opacity: [1, 0.4, 1],
};

/** Pulsing indicator: scale [1, 1.4, 1], opacity [1, 0.5, 1] */
export const pulseIndicator = {
  scale: [1, 1.4, 1],
  opacity: [1, 0.5, 1],
};

/** Subtle opacity pulse: opacity [1, 0.6, 1] */
export const pulseOpacity = {
  opacity: [1, 0.6, 1],
};

/** Gentle opacity pulse: opacity [1, 0.8, 1] */
export const pulseOpacityGentle = {
  opacity: [1, 0.8, 1],
};

/** Opacity fade pulse: opacity [1, 0.5, 1] */
export const pulseOpacityFade = {
  opacity: [1, 0.5, 1],
};

/** Gentle scale pulse: scale [1, 1.1, 1] */
export const pulseScaleGentle = {
  scale: [1, 1.1, 1],
};

/** Spin animation: rotate 360 */
export const spinAnimate = {
  rotate: 360,
};

// ============================================
// INLINE EXTRACTION: ENTRY/EXIT VARIANTS
// ============================================

/** Scale in/out for FABs and badges */
export const scaleInOut = {
  hidden: { scale: 0, opacity: 0 },
  visible: { scale: 1, opacity: 1 },
  exit: { scale: 0, opacity: 0 },
};

/** Slide in from left (small offset: x: -20) */
export const slideInLeftSmall = {
  initial: { opacity: 0, x: -20 },
  animate: { opacity: 1, x: 0 },
};

/** Slide up from bottom (full-screen drawer: y: '100%') */
export const slideUpDrawer = {
  hidden: { y: '100%' },
  visible: { y: 0 },
  exit: { y: '100%' },
};

/** Slide up from bottom for modals: y: 100 */
export const slideUpModal = {
  hidden: { y: 100, opacity: 0 },
  visible: { y: 0, opacity: 1 },
  exit: { y: 100, opacity: 0 },
};

/** Fade in with small upward movement: y: 10 */
export const fadeInUpSmall = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
};

/** Fade in with small downward origin: y: -10 */
export const fadeInDownSmall = {
  initial: { opacity: 0, y: -10 },
  animate: { opacity: 1, y: 0 },
};

/** Slide in from right with exit left (for alert items) */
export const slideInRightSmall = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
};

/** Fade in with scale for modals/cards */
export const fadeInScaleUp = {
  initial: { scale: 0.95, opacity: 0, y: 20 },
  animate: { scale: 1, opacity: 1, y: 0 },
  exit: { scale: 0.95, opacity: 0, y: 20 },
};

/** Fade in scale from small (for card stagger entries) */
export const fadeInScaleSmall = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
};

/** Fade in scale with upward movement (for metrics cards) */
export const fadeInScaleMetric = {
  initial: { opacity: 0, scale: 0.95, y: 10 },
  animate: { opacity: 1, scale: 1, y: 0 },
};

/** Fade in scale with larger upward movement (for grid cards) */
export const fadeInScaleGrid = {
  initial: { opacity: 0, scale: 0.9, y: 20 },
  animate: { opacity: 1, scale: 1, y: 0 },
};

/** Collapse/expand for content sections */
export const collapseExpand = {
  hidden: { opacity: 0, height: 0 },
  visible: { opacity: 1, height: 'auto' },
  exit: { opacity: 0, height: 0 },
};

/** Dropdown menu animation */
export const dropdownMenu = {
  initial: { opacity: 0, scale: 0.9, y: -10 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.9, y: -10 },
};

/** Scale pop for badges */
export const scalePop = {
  hidden: { scale: 0 },
  visible: { scale: 1 },
  exit: { scale: 0 },
};
