/**
 * BottomSheet - Draggable bottom sheet overlay
 *
 * Slides up from the bottom with snap points (90%, 50%, 0%).
 * Drag handle at top for dismiss. Keyboard-accessible close.
 *
 * Used for evidence review, photo preview, and context panels
 * that keep the user in their current context.
 *
 * Research: Bottom sheet pattern keeps user oriented vs full-page routes.
 */

import React, { useRef, useCallback, useState, useEffect } from 'react';
import { motion, AnimatePresence, PanInfo, useMotionValue, useTransform } from 'framer-motion';

interface BottomSheetProps {
  /** Whether the sheet is open */
  isOpen: boolean;
  /** Callback when the sheet should close */
  onClose: () => void;
  /** Sheet title for header and accessibility */
  title: string;
  /** Optional subtitle */
  subtitle?: string;
  /** Sheet content */
  children: React.ReactNode;
  /** Maximum height as viewport percentage (default: 90) */
  maxHeight?: number;
  /** Whether to show the drag handle (default: true) */
  showHandle?: boolean;
}

const BottomSheet: React.FC<BottomSheetProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  maxHeight = 90,
  showHandle = true,
}) => {
  const sheetRef = useRef<HTMLDivElement>(null);
  const y = useMotionValue(0);
  const opacity = useTransform(y, [0, 300], [1, 0]);
  const [sheetHeight, setSheetHeight] = useState(0);

  // Calculate pixel height from viewport percentage
  useEffect(() => {
    setSheetHeight(window.innerHeight * (maxHeight / 100));
  }, [maxHeight]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // Prevent body scroll when sheet is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const handleDragEnd = useCallback((_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const shouldClose = info.velocity.y > 500 || info.offset.y > sheetHeight * 0.3;
    if (shouldClose) {
      onClose();
    }
  }, [onClose, sheetHeight]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          />

          {/* Sheet */}
          <motion.div
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            drag="y"
            dragConstraints={{ top: 0 }}
            dragElastic={0.2}
            onDragEnd={handleDragEnd}
            style={{ y, maxHeight: `${maxHeight}vh` }}
            className="
              fixed bottom-0 left-0 right-0 z-50
              bg-white dark:bg-slate-900
              rounded-t-3xl border-t border-white/10
              flex flex-col overflow-hidden
              shadow-2xl
            "
          >
            {/* Drag handle */}
            {showHandle && (
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
              </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-3 border-b border-slate-200 dark:border-white/10">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h2>
                {subtitle && (
                  <p className="text-sm text-slate-500">{subtitle}</p>
                )}
              </div>
              <button
                onClick={onClose}
                aria-label="Close"
                className="
                  size-10 rounded-xl flex items-center justify-center
                  text-slate-400 hover:text-slate-600 dark:hover:text-slate-200
                  hover:bg-slate-100 dark:hover:bg-slate-800
                  transition-colors min-h-[44px] min-w-[44px]
                "
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Scrollable content */}
            <motion.div
              style={{ opacity }}
              className="flex-1 overflow-y-auto overscroll-contain"
            >
              {children}
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default React.memo(BottomSheet);
