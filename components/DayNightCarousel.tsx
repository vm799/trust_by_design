import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../lib/theme';
import {
  carouselSlideVariants,
  carouselTransition,
  floatingGlowTransition,
  floatingGlowSlowTransition,
} from '../lib/animations';

interface CarouselSlide {
  id: string;
  title: string;
  description: string;
  icon: string;
  isDark: boolean;
}

// REMEDIATION ITEM 11: Animation objects defined outside component
const glowAnimation1 = { scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] };
const glowAnimation2 = { scale: [1.2, 1, 1.2], opacity: [0.4, 0.2, 0.4] };
const ringAnimation = { scale: [1, 1.1, 1], opacity: [0.5, 0, 0.5] };
const ringTransition = { duration: 2, repeat: Infinity, ease: 'easeInOut' as const };
const iconInitial = { scale: 0.8, rotate: -10 };
const iconAnimate = { scale: 1, rotate: 0 };
const iconTransition = { type: 'spring' as const, stiffness: 200, damping: 15 };

const slides: CarouselSlide[] = [
  {
    id: 'capture',
    title: 'Capture Evidence',
    description: 'GPS-verified photos with timestamps for professional documentation',
    icon: 'photo_camera',
    isDark: true,
  },
  {
    id: 'sign',
    title: 'Get Signatures',
    description: 'Digital sign-off from clients on mobile devices',
    icon: 'draw',
    isDark: false,
  },
  {
    id: 'seal',
    title: 'Seal & Protect',
    description: 'SHA-256 cryptographic sealing for immutable proof',
    icon: 'verified_user',
    isDark: true,
  },
  {
    id: 'paid',
    title: 'Get Paid Faster',
    description: 'Eliminate disputes with professional documentation',
    icon: 'payments',
    isDark: false,
  },
];

/**
 * Day/Night Carousel - Accessible Framer Motion carousel
 * Showcases features with alternating day/night aesthetics
 */
export const DayNightCarousel: React.FC = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const { resolvedTheme } = useTheme();

  // Auto-advance every 5 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setDirection(1);
      setCurrentIndex((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const goToSlide = (index: number) => {
    setDirection(index > currentIndex ? 1 : -1);
    setCurrentIndex(index);
  };

  const goNext = () => {
    setDirection(1);
    setCurrentIndex((prev) => (prev + 1) % slides.length);
  };

  const goPrev = () => {
    setDirection(-1);
    setCurrentIndex((prev) => (prev - 1 + slides.length) % slides.length);
  };

  const currentSlide = slides[currentIndex];
  const isSlideNight = currentSlide.isDark;

  const slideVariants = {
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

  return (
    <div className="relative w-full max-w-4xl mx-auto">
      {/* Main Carousel Container */}
      <div
        className={`
          relative overflow-hidden rounded-3xl p-1
          ${isSlideNight
            ? 'bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900'
            : 'bg-gradient-to-br from-blue-50 via-white to-amber-50'
          }
          transition-colors duration-700
        `}
      >
        {/* Glassmorphism inner container */}
        <div
          className={`
            relative rounded-[22px] p-8 sm:p-12 min-h-[300px] sm:min-h-[350px]
            backdrop-blur-xl overflow-hidden
            ${isSlideNight
              ? 'bg-slate-900/80 border border-white/10'
              : 'bg-white/80 border border-slate-200/50'
            }
            transition-all duration-700
          `}
        >
          {/* Animated background glow - REMEDIATION ITEM 11: Using memoized animation objects */}
          <motion.div
            className={`
              absolute -top-20 -right-20 w-64 h-64 rounded-full blur-3xl
              ${isSlideNight ? 'bg-primary/20' : 'bg-amber-300/30'}
            `}
            animate={glowAnimation1}
            transition={floatingGlowTransition}
          />
          <motion.div
            className={`
              absolute -bottom-20 -left-20 w-64 h-64 rounded-full blur-3xl
              ${isSlideNight ? 'bg-indigo-500/20' : 'bg-blue-300/30'}
            `}
            animate={glowAnimation2}
            transition={floatingGlowSlowTransition}
          />

          {/* Slide Content */}
          <AnimatePresence initial={false} custom={direction} mode="wait">
            <motion.div
              key={currentIndex}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{
                x: { type: 'spring', stiffness: 300, damping: 30 },
                opacity: { duration: 0.3 },
                scale: { duration: 0.3 },
              }}
              className="relative z-10 flex flex-col items-center text-center"
            >
              {/* Icon with glow effect - REMEDIATION ITEM 11: Using memoized animation objects */}
              <motion.div
                className={`
                  relative mb-6 p-6 rounded-2xl
                  ${isSlideNight
                    ? 'bg-gradient-to-br from-primary/30 to-indigo-600/20 shadow-lg shadow-primary/20'
                    : 'bg-gradient-to-br from-amber-100 to-orange-100 shadow-lg shadow-amber-200/50'
                  }
                `}
                initial={iconInitial}
                animate={iconAnimate}
                transition={iconTransition}
              >
                <span
                  className={`
                    material-symbols-outlined text-5xl sm:text-6xl
                    ${isSlideNight ? 'text-primary' : 'text-amber-600'}
                  `}
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  {currentSlide.icon}
                </span>

                {/* Animated ring - REMEDIATION ITEM 11: Using memoized animation objects */}
                <motion.div
                  className={`
                    absolute inset-0 rounded-2xl border-2
                    ${isSlideNight ? 'border-primary/50' : 'border-amber-400/50'}
                  `}
                  animate={ringAnimation}
                  transition={ringTransition}
                />
              </motion.div>

              {/* Title */}
              <h3
                className={`
                  text-2xl sm:text-3xl font-black uppercase tracking-tight mb-3
                  ${isSlideNight ? 'text-white' : 'text-slate-900'}
                `}
              >
                {currentSlide.title}
              </h3>

              {/* Description */}
              <p
                className={`
                  text-base sm:text-lg max-w-md leading-relaxed
                  ${isSlideNight ? 'text-slate-300' : 'text-slate-600'}
                `}
              >
                {currentSlide.description}
              </p>
            </motion.div>
          </AnimatePresence>

          {/* Navigation Arrows */}
          <button
            onClick={goPrev}
            className={`
              absolute left-4 top-1/2 -translate-y-1/2 z-20
              p-2 sm:p-3 rounded-full backdrop-blur-sm
              transition-all active:scale-90
              ${isSlideNight
                ? 'bg-white/10 hover:bg-white/20 text-white'
                : 'bg-slate-900/10 hover:bg-slate-900/20 text-slate-900'
              }
            `}
            aria-label="Previous slide"
          >
            <span className="material-symbols-outlined text-xl sm:text-2xl">chevron_left</span>
          </button>
          <button
            onClick={goNext}
            className={`
              absolute right-4 top-1/2 -translate-y-1/2 z-20
              p-2 sm:p-3 rounded-full backdrop-blur-sm
              transition-all active:scale-90
              ${isSlideNight
                ? 'bg-white/10 hover:bg-white/20 text-white'
                : 'bg-slate-900/10 hover:bg-slate-900/20 text-slate-900'
              }
            `}
            aria-label="Next slide"
          >
            <span className="material-symbols-outlined text-xl sm:text-2xl">chevron_right</span>
          </button>
        </div>
      </div>

      {/* Dot Navigation */}
      <div className="flex justify-center gap-2 mt-6" role="tablist" aria-label="Carousel navigation">
        {slides.map((slide, index) => (
          <button
            key={slide.id}
            onClick={() => goToSlide(index)}
            role="tab"
            aria-selected={index === currentIndex}
            aria-label={`Go to slide ${index + 1}: ${slide.title}`}
            className={`
              relative w-3 h-3 rounded-full transition-all duration-300
              ${index === currentIndex
                ? resolvedTheme === 'dark'
                  ? 'bg-primary w-8'
                  : 'bg-amber-500 w-8'
                : resolvedTheme === 'dark'
                  ? 'bg-slate-600 hover:bg-slate-500'
                  : 'bg-slate-300 hover:bg-slate-400'
              }
            `}
          />
        ))}
      </div>

      {/* Day/Night Indicator */}
      <div className="flex justify-center mt-4">
        <div
          className={`
            inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider
            backdrop-blur-sm transition-all duration-500
            ${isSlideNight
              ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
              : 'bg-amber-500/20 text-amber-700 border border-amber-500/30'
            }
          `}
        >
          <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>
            {isSlideNight ? 'dark_mode' : 'light_mode'}
          </span>
          {isSlideNight ? 'Night Mode' : 'Day Mode'}
        </div>
      </div>
    </div>
  );
};

export default DayNightCarousel;
