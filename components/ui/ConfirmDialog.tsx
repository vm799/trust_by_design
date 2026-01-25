/**
 * ConfirmDialog - Destructive Action Confirmation
 *
 * Specialized modal for confirming destructive or important actions.
 *
 * Phase A: Foundation & App Shell
 */

import React from 'react';
import Modal from './Modal';
import ActionButton from './ActionButton';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
  loading?: boolean;
  icon?: string;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  loading = false,
  icon,
}) => {
  const variantConfig = {
    danger: {
      icon: icon || 'warning',
      iconBg: 'bg-red-500/10',
      iconColor: 'text-red-400',
      buttonVariant: 'danger' as const,
    },
    warning: {
      icon: icon || 'error',
      iconBg: 'bg-amber-500/10',
      iconColor: 'text-amber-400',
      buttonVariant: 'primary' as const,
    },
    info: {
      icon: icon || 'info',
      iconBg: 'bg-blue-500/10',
      iconColor: 'text-blue-400',
      buttonVariant: 'primary' as const,
    },
  };

  const config = variantConfig[variant];

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm" showClose={false}>
      <div className="text-center">
        {/* Icon */}
        <div className={`
          size-16 mx-auto mb-4 rounded-2xl
          flex items-center justify-center
          ${config.iconBg}
        `}>
          <span className={`material-symbols-outlined text-4xl ${config.iconColor}`}>
            {config.icon}
          </span>
        </div>

        {/* Title */}
        <h3 className="text-lg font-semibold text-white mb-2">
          {title}
        </h3>

        {/* Message */}
        <p className="text-sm text-slate-400 mb-6">
          {message}
        </p>

        {/* Actions */}
        <div className="flex gap-3">
          <ActionButton
            variant="secondary"
            onClick={onClose}
            disabled={loading}
            fullWidth
          >
            {cancelLabel}
          </ActionButton>
          <ActionButton
            variant={config.buttonVariant}
            onClick={onConfirm}
            loading={loading}
            fullWidth
          >
            {confirmLabel}
          </ActionButton>
        </div>
      </div>
    </Modal>
  );
};

export default ConfirmDialog;
