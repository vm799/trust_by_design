/**
 * UI Components Index
 *
 * Phase A: Foundation & App Shell
 */

export { default as Card } from './Card';
export { default as StatusBadge } from './StatusBadge';
export { default as ActionButton } from './ActionButton';
export { default as Modal } from './Modal';
export { default as ConfirmDialog } from './ConfirmDialog';
export { default as EmptyState } from './EmptyState';
export { default as ErrorState } from './ErrorState';  // REMEDIATION ITEM 10
export { default as LoadingSkeleton } from './LoadingSkeleton';
export { default as Tooltip, SimpleTooltip, InfoTooltip, HelpTooltip } from './Tooltip';
export type { TooltipProps } from './Tooltip';
export { default as InfoBox } from './InfoBox';
export type { InfoBoxProps } from './InfoBox';
export {
  default as Breadcrumbs,
  BackButton,
  JobCreationBreadcrumbs,
  ClientCreationBreadcrumbs,
  TechnicianCreationBreadcrumbs,
} from './Breadcrumbs';
export type { BreadcrumbItem, BreadcrumbsProps } from './Breadcrumbs';
export {
  default as FocusStack,
  DefaultFocusJobCard,
  DefaultQueueJobCard,
  DefaultCollapsedJobCard,
} from './FocusStack';
export type {
  FocusJobRenderProps,
  QueueJobRenderProps,
  CollapsedJobRenderProps,
} from './FocusStack';
