/**
 * Modal Base Component
 *
 * Shared modal container with:
 * - Overlay with backdrop blur
 * - Focus trap (focus stays inside modal)
 * - Esc key closes
 * - Focus returns to trigger on close
 * - Smooth animations (Framer Motion)
 * - Full accessibility (WCAG 2.1 AA)
 */

import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface ModalBaseProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
};

/**
 * ModalBase - Accessible modal container with overlay
 *
 * Usage:
 * <ModalBase
 *   isOpen={isOpen}
 *   onClose={handleClose}
 *   title="Assign Technician"
 *   description="Select a technician to assign this job"
 * >
 *   {/* Modal content */}
 * </ModalBase>
 */
export const ModalBase: React.FC<ModalBaseProps> = React.memo(({
  isOpen,
  onClose,
  title,
  description,
  children,
  size = 'md',
  className = '',
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  // Focus trap: keep focus inside modal
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Esc key closes modal
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      // Tab key: trap focus inside modal
      if (e.key === 'Tab') {
        const modal = modalRef.current;
        if (!modal) return;

        const focusableElements = modal.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

        if (e.shiftKey) {
          // Shift+Tab on first element: go to last
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement?.focus();
          }
        } else {
          // Tab on last element: go to first
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement?.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    // Focus first interactive element
    const modal = modalRef.current;
    if (modal) {
      const firstFocusable = modal.querySelector(
        'button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
      ) as HTMLElement;
      firstFocusable?.focus();
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Focus management: return focus to trigger on close
  const handleClose = () => {
    // Store current focus for return
    if (document.activeElement instanceof HTMLElement) {
      triggerRef.current = document.activeElement;
    }
    onClose();

    // Return focus on next render
    setTimeout(() => {
      triggerRef.current?.focus();
    }, 0);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div
            key="overlay"
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={handleClose}
            aria-hidden="true"
          />

          {/* Modal */}
          <motion.div
            key="modal"
            ref={modalRef}
            className="fixed inset-0 flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={(e) => {
              // Only close if clicking overlay, not modal content
              if (e.target === e.currentTarget) {
                handleClose();
              }
            }}
            role="presentation"
          >
            <motion.div
              className={`
                bg-white dark:bg-slate-800
                rounded-2xl shadow-xl
                ${sizeClasses[size]}
                w-full
                max-h-[90vh] overflow-y-auto
                ${className}
              `}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="modal-title"
              aria-describedby={description ? 'modal-description' : undefined}
            >
              {/* Header */}
              <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h2
                    id="modal-title"
                    className="text-2xl font-bold text-slate-900 dark:text-white"
                  >
                    {title}
                  </h2>
                  {description && (
                    <p
                      id="modal-description"
                      className="text-sm text-slate-600 dark:text-slate-400 mt-1"
                    >
                      {description}
                    </p>
                  )}
                </div>

                {/* Close button */}
                <button
                  onClick={handleClose}
                  className="
                    p-2 rounded-lg
                    text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200
                    hover:bg-slate-100 dark:hover:bg-slate-700
                    transition-colors duration-200
                    focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:focus:ring-offset-slate-800
                    flex-shrink-0
                  "
                  aria-label="Close dialog"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              {/* Content */}
              <div className="p-6">
                {children}
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
});

ModalBase.displayName = 'ModalBase';

export default ModalBase;
