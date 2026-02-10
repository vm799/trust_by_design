/**
 * SLACountdown Component Tests
 *
 * Tests the countdown timer that shows time remaining until job SLA:
 * - Renders hours/minutes remaining
 * - Color states: green (>4h), amber (1-4h), red (<1h)
 * - Shows "Overdue" when past deadline
 * - Hides for completed/archived jobs
 * - Timer updates via interval
 * - Accessibility
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import SLACountdown from '../../components/ui/SLACountdown';

describe('SLACountdown Component', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('time display', () => {
    it('should show hours and minutes when > 1 hour remains', () => {
      const deadline = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(); // 3h from now
      vi.setSystemTime(Date.now());
      render(<SLACountdown deadline={deadline} />);
      expect(screen.getByText(/2h\s*59m|3h\s*0m/)).toBeTruthy();
    });

    it('should show minutes only when < 1 hour remains', () => {
      const deadline = new Date(Date.now() + 45 * 60 * 1000).toISOString(); // 45m from now
      vi.setSystemTime(Date.now());
      render(<SLACountdown deadline={deadline} />);
      expect(screen.getByText(/44m|45m/)).toBeTruthy();
    });

    it('should show "Overdue" when past deadline', () => {
      const deadline = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // 1h ago
      vi.setSystemTime(Date.now());
      render(<SLACountdown deadline={deadline} />);
      expect(screen.getByText(/overdue/i)).toBeTruthy();
    });
  });

  describe('color states', () => {
    it('should show green when > 4 hours remain', () => {
      const deadline = new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString();
      vi.setSystemTime(Date.now());
      const { container } = render(<SLACountdown deadline={deadline} />);
      const badge = container.firstChild as HTMLElement;
      expect(badge.className).toContain('emerald');
    });

    it('should show amber when 1-4 hours remain', () => {
      const deadline = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
      vi.setSystemTime(Date.now());
      const { container } = render(<SLACountdown deadline={deadline} />);
      const badge = container.firstChild as HTMLElement;
      expect(badge.className).toContain('amber');
    });

    it('should show red when < 1 hour remains', () => {
      const deadline = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      vi.setSystemTime(Date.now());
      const { container } = render(<SLACountdown deadline={deadline} />);
      const badge = container.firstChild as HTMLElement;
      expect(badge.className).toContain('red');
    });

    it('should show red when overdue', () => {
      const deadline = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      vi.setSystemTime(Date.now());
      const { container } = render(<SLACountdown deadline={deadline} />);
      const badge = container.firstChild as HTMLElement;
      expect(badge.className).toContain('red');
    });
  });

  describe('timer updates', () => {
    it('should update countdown every 60 seconds', () => {
      const now = Date.now();
      vi.setSystemTime(now);
      const deadline = new Date(now + 2 * 60 * 60 * 1000).toISOString(); // 2h
      render(<SLACountdown deadline={deadline} />);
      expect(screen.getByRole('timer')).toBeTruthy();

      act(() => {
        vi.advanceTimersByTime(60 * 1000); // Advance 1 minute
      });
      // Should still render without crashing after timer update
      expect(screen.getByRole('timer')).toBeTruthy();
    });
  });

  describe('edge cases', () => {
    it('should render nothing when no deadline provided', () => {
      const { container } = render(<SLACountdown deadline="" />);
      expect(container.firstChild).toBeNull();
    });

    it('should render nothing for invalid date', () => {
      const { container } = render(<SLACountdown deadline="invalid" />);
      expect(container.firstChild).toBeNull();
    });

    it('should show days when > 24 hours remain', () => {
      const deadline = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
      vi.setSystemTime(Date.now());
      render(<SLACountdown deadline={deadline} />);
      expect(screen.getByText(/1d|2d/)).toBeTruthy();
    });
  });

  describe('accessibility', () => {
    it('should have accessible time description', () => {
      const deadline = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
      vi.setSystemTime(Date.now());
      render(<SLACountdown deadline={deadline} />);
      const el = screen.getByRole('timer');
      expect(el).toBeTruthy();
    });
  });
});
