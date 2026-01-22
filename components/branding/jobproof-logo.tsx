/**
 * JobProof Brand Logo Component
 * Production-ready logo with multiple variants and dark mode support
 */

import { cn } from '@/lib/utils';

interface JobProofLogoProps {
  variant?: 'full' | 'mark';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showTagline?: boolean;
  className?: string;
  'aria-hidden'?: boolean;
}

const sizeMap = {
  xs: { container: 'h-6', icon: 'w-6 h-6', text: 'text-sm', tagline: 'text-[10px]' },
  sm: { container: 'h-8', icon: 'w-8 h-8', text: 'text-base', tagline: 'text-xs' },
  md: { container: 'h-12', icon: 'w-12 h-12', text: 'text-xl', tagline: 'text-sm' },
  lg: { container: 'h-16', icon: 'w-16 h-16', text: 'text-2xl', tagline: 'text-base' },
  xl: { container: 'h-20', icon: 'w-20 h-20', text: 'text-3xl', tagline: 'text-lg' },
};

/**
 * JobProof icon mark - shield with checkmark
 * Represents trust, verification, and completion
 */
export function JobProofMark({
  size = 'md',
  className,
  'aria-hidden': ariaHidden,
}: Omit<JobProofLogoProps, 'variant' | 'showTagline'>) {
  const sizes = sizeMap[size];

  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn(sizes.icon, className)}
      role="img"
      aria-label={ariaHidden ? undefined : 'JobProof logo mark'}
      aria-hidden={ariaHidden}
    >
      <title>JobProof</title>
      {/* Shield background */}
      <path
        d="M20 4L8 10V18C8 26 12 32 20 36C28 32 32 26 32 18V10L20 4Z"
        className="fill-blue-600 dark:fill-blue-500"
      />
      {/* Inner shield accent */}
      <path
        d="M20 6L10 11V18C10 24.5 13 29.5 20 33C27 29.5 30 24.5 30 18V11L20 6Z"
        className="fill-blue-700 dark:fill-blue-600"
      />
      {/* Checkmark */}
      <path
        d="M17 20L19 22L24 16"
        className="stroke-white dark:stroke-slate-50"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Accent dot (orange) */}
      <circle
        cx="27"
        cy="13"
        r="2.5"
        className="fill-orange-500 dark:fill-orange-400"
      />
    </svg>
  );
}

/**
 * Full JobProof logo with wordmark and optional tagline
 */
export function JobProofLogo({
  variant = 'full',
  size = 'md',
  showTagline = false,
  className,
  'aria-hidden': ariaHidden,
}: JobProofLogoProps) {
  const sizes = sizeMap[size];

  if (variant === 'mark') {
    return <JobProofMark size={size} className={className} aria-hidden={ariaHidden} />;
  }

  return (
    <div
      className={cn('flex items-center gap-3', sizes.container, className)}
      role="img"
      aria-label={ariaHidden ? undefined : 'JobProof logo'}
      aria-hidden={ariaHidden}
    >
      <JobProofMark size={size} aria-hidden />

      <div className="flex flex-col justify-center">
        <span className={cn('font-bold leading-none text-slate-900 dark:text-white', sizes.text)}>
          JobProof
        </span>
        {showTagline && (
          <span className={cn('font-medium leading-tight text-slate-600 dark:text-slate-400', sizes.tagline)}>
            Trust by design
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Utility: Export raw SVG string for favicon generation
 * Use this to generate PNG favicons at different sizes
 */
export const jobProofMarkSVG = `
<svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M20 4L8 10V18C8 26 12 32 20 36C28 32 32 26 32 18V10L20 4Z" fill="#2563EB"/>
  <path d="M20 6L10 11V18C10 24.5 13 29.5 20 33C27 29.5 30 24.5 30 18V11L20 6Z" fill="#1D4ED8"/>
  <path d="M17 20L19 22L24 16" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="27" cy="13" r="2.5" fill="#F97316"/>
</svg>`.trim();
