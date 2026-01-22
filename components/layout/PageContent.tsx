/**
 * PageContent - Content Wrapper
 *
 * Provides consistent padding and max-width for page content.
 *
 * Phase A: Foundation & App Shell
 */

import React from 'react';

interface PageContentProps {
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
  fullWidth?: boolean;
}

const PageContent: React.FC<PageContentProps> = ({
  children,
  className = '',
  noPadding = false,
  fullWidth = false,
}) => {
  return (
    <div
      className={`
        ${noPadding ? '' : 'px-4 lg:px-8 py-4 lg:py-6'}
        ${fullWidth ? '' : 'max-w-7xl mx-auto'}
        ${className}
      `}
    >
      {children}
    </div>
  );
};

export default PageContent;
