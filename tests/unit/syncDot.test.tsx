/**
 * SyncDot Component Tests
 *
 * Tests the compact sync status indicator:
 * - Hollow circle for pending/local-only
 * - Pulsing for syncing
 * - Solid green for synced
 * - Solid red for failed
 * - Accessible tooltip/aria-label
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import SyncDot from '../../components/ui/SyncDot';

describe('SyncDot Component', () => {
  describe('visual states', () => {
    it('should render hollow circle for pending status', () => {
      const { container } = render(<SyncDot status="pending" />);
      const dot = container.querySelector('[data-testid="sync-dot"]');
      expect(dot).toBeTruthy();
      expect(dot?.className).toContain('border');
      expect(dot?.className).toContain('amber');
    });

    it('should render pulsing for syncing status', () => {
      const { container } = render(<SyncDot status="syncing" />);
      const dot = container.querySelector('[data-testid="sync-dot"]');
      expect(dot?.className).toContain('animate-pulse');
      expect(dot?.className).toContain('amber');
    });

    it('should render solid green for synced status', () => {
      const { container } = render(<SyncDot status="synced" />);
      const dot = container.querySelector('[data-testid="sync-dot"]');
      expect(dot?.className).toContain('bg-emerald');
    });

    it('should render solid red for failed status', () => {
      const { container } = render(<SyncDot status="failed" />);
      const dot = container.querySelector('[data-testid="sync-dot"]');
      expect(dot?.className).toContain('bg-red');
    });
  });

  describe('accessibility', () => {
    it('should have aria-label for pending', () => {
      render(<SyncDot status="pending" />);
      const el = screen.getByLabelText(/local.*only|pending/i);
      expect(el).toBeTruthy();
    });

    it('should have aria-label for synced', () => {
      render(<SyncDot status="synced" />);
      const el = screen.getByLabelText(/synced|cloud/i);
      expect(el).toBeTruthy();
    });

    it('should have aria-label for failed', () => {
      render(<SyncDot status="failed" />);
      const el = screen.getByLabelText(/failed|error/i);
      expect(el).toBeTruthy();
    });

    it('should have aria-label for syncing', () => {
      render(<SyncDot status="syncing" />);
      const el = screen.getByLabelText(/syncing/i);
      expect(el).toBeTruthy();
    });
  });

  describe('sizing', () => {
    it('should default to size-2 (8px)', () => {
      const { container } = render(<SyncDot status="synced" />);
      const dot = container.querySelector('[data-testid="sync-dot"]');
      expect(dot?.className).toContain('size-2');
    });

    it('should accept custom size via className', () => {
      const { container } = render(<SyncDot status="synced" className="size-3" />);
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.className).toContain('size-3');
    });
  });

  describe('with label', () => {
    it('should show label text when showLabel is true', () => {
      render(<SyncDot status="synced" showLabel />);
      expect(screen.getByText(/synced/i)).toBeTruthy();
    });

    it('should show failed label', () => {
      render(<SyncDot status="failed" showLabel />);
      expect(screen.getByText(/failed/i)).toBeTruthy();
    });

    it('should not show label by default', () => {
      const { container } = render(<SyncDot status="synced" />);
      expect(container.textContent).toBe('');
    });
  });
});
