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
export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

/** Fade in from above */
export const fadeInDown: Variants = {
  hidden: { opacity: 0, y: -20 },
  visible: { opacity: 1, y: 0 },
};

/** Simple fade in */
export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

/** Fade in with scale */
export const fadeInScale: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1 },
};

// ============================================
// SLIDE ANIMATIONS
// ============================================

/** Slide in from left */
export const slideInLeft: Variants = {
  hidden: { opacity: 0, x: -50 },
  visible: { opacity: 1, x: 0 },
};

/** Slide in from right */
export const slideInRight: Variants = {
  hidden: { opacity: 0, x: 50 },
  visible: { opacity: 1, x: 0 },
};

/** Slide in from bottom (for modals, toasts) */
export const slideInBottom: Variants = {
  hidden: { opacity: 0, y: 100 },
  visible: { opacity: 1, y: 0 },
};

// ============================================
// CONTAINER ANIMATIONS (for staggered children)
// ============================================

/** Container that staggers its children */
export const staggerContainer: Variants = {
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
export const staggerContainerFast: Variants = {
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
export const carouselSlideVariants: Variants = {
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
export const stepSlide: Variants = {
  hidden: { opacity: 0, x: 20 },
  visible: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
};

/** Step slide transition timing */
export const stepSlideTransition: Transition = {
  duration: 0.25,
};

/** Fade overlay for modal backdrops */
export const fadeOverlay: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

/** Subtle tap shrink for thumbnails */
export const tapShrink = {
  scale: 0.96,
};
