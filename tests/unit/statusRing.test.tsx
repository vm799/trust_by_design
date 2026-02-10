/**
 * StatusRing Component Tests
 *
 * Tests the SVG gauge that visualizes job completion capacity:
 * - Ring segments render correctly for different job distributions
 * - Color transitions based on completion percentage
 * - Tap toggles between count and percentage views
 * - Accessibility (aria-label, role)
 * - Edge cases (empty jobs, all complete, all pending)
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import StatusRing from '../../components/ui/StatusRing';

describe('StatusRing Component', () => {
  describe('rendering', () => {
    it('should render an SVG element', () => {
      const { container } = render(
        <StatusRing totalJobs={10} completedJobs={7} activeJobs={2} pendingJobs={1} />
      );
      const svg = container.querySelector('svg');
      expect(svg).toBeTruthy();
    });

    it('should display completed count by default', () => {
      render(
        <StatusRing totalJobs={10} completedJobs={7} activeJobs={2} pendingJobs={1} />
      );
      expect(screen.getByText('7')).toBeTruthy();
      expect(screen.getByText(/of 10/i)).toBeTruthy();
    });

    it('should render ring with correct aria-label', () => {
      render(
        <StatusRing totalJobs={10} completedJobs={7} activeJobs={2} pendingJobs={1} />
      );
      const ring = screen.getByRole('figure');
      expect(ring.getAttribute('aria-label')).toContain('70%');
    });
  });

  describe('color states', () => {
    it('should show green when completion > 75%', () => {
      const { container } = render(
        <StatusRing totalJobs={10} completedJobs={8} activeJobs={1} pendingJobs={1} />
      );
      const progressCircle = container.querySelector('[data-testid="ring-progress"]');
      expect(progressCircle?.getAttribute('class')).toContain('emerald');
    });

    it('should show amber when completion 40-75%', () => {
      const { container } = render(
        <StatusRing totalJobs={10} completedJobs={5} activeJobs={3} pendingJobs={2} />
      );
      const progressCircle = container.querySelector('[data-testid="ring-progress"]');
      expect(progressCircle?.getAttribute('class')).toContain('amber');
    });

    it('should show red when completion < 40%', () => {
      const { container } = render(
        <StatusRing totalJobs={10} completedJobs={2} activeJobs={3} pendingJobs={5} />
      );
      const progressCircle = container.querySelector('[data-testid="ring-progress"]');
      expect(progressCircle?.getAttribute('class')).toContain('red');
    });
  });

  describe('tap interaction', () => {
    it('should toggle to percentage view on tap', () => {
      render(
        <StatusRing totalJobs={10} completedJobs={7} activeJobs={2} pendingJobs={1} />
      );
      const ring = screen.getByRole('figure');
      fireEvent.click(ring);
      expect(screen.getByText('70%')).toBeTruthy();
    });

    it('should toggle back to count view on second tap', () => {
      render(
        <StatusRing totalJobs={10} completedJobs={7} activeJobs={2} pendingJobs={1} />
      );
      const ring = screen.getByRole('figure');
      fireEvent.click(ring);
      fireEvent.click(ring);
      expect(screen.getByText('7')).toBeTruthy();
    });
  });

  describe('edge cases', () => {
    it('should handle zero jobs gracefully', () => {
      const { container } = render(
        <StatusRing totalJobs={0} completedJobs={0} activeJobs={0} pendingJobs={0} />
      );
      expect(container.querySelector('svg')).toBeTruthy();
      expect(screen.getByText('0')).toBeTruthy();
    });

    it('should handle all jobs completed', () => {
      render(
        <StatusRing totalJobs={5} completedJobs={5} activeJobs={0} pendingJobs={0} />
      );
      const ring = screen.getByRole('figure');
      fireEvent.click(ring);
      expect(screen.getByText('100%')).toBeTruthy();
    });

    it('should handle single job', () => {
      render(
        <StatusRing totalJobs={1} completedJobs={0} activeJobs={1} pendingJobs={0} />
      );
      expect(screen.getByText('0')).toBeTruthy();
    });
  });

  describe('accessibility', () => {
    it('should have minimum 44px touch target', () => {
      const { container } = render(
        <StatusRing totalJobs={10} completedJobs={7} activeJobs={2} pendingJobs={1} />
      );
      const ring = screen.getByRole('figure');
      expect(ring.className).toContain('min-h-[44px]');
      expect(ring.className).toContain('min-w-[44px]');
    });
  });
});
