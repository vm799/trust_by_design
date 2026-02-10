/**
 * BottomNav Component Tests
 *
 * Tests the mobile sticky bottom navigation:
 * - 5 nav items: Dashboard, Jobs, +Add (FAB), Clients, Technicians
 * - Center FAB button for quick job creation
 * - Active state detection based on route
 * - Touch targets meet 44px minimum (WCAG)
 * - Correct /admin route paths
 * - Accessibility labels
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BottomNav from '../../components/layout/BottomNav';

const renderWithRouter = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <BottomNav />
    </MemoryRouter>
  );

describe('BottomNav Component', () => {
  describe('navigation items', () => {
    it('should render all 5 navigation items', () => {
      renderWithRouter('/admin');
      expect(screen.getByText('Dashboard')).toBeTruthy();
      expect(screen.getByText('Jobs')).toBeTruthy();
      expect(screen.getByText('Clients')).toBeTruthy();
      expect(screen.getByText('Techs')).toBeTruthy();
    });

    it('should render center FAB with add icon', () => {
      renderWithRouter('/admin');
      const fab = screen.getByLabelText('Create new job');
      expect(fab).toBeTruthy();
    });

    it('should link Dashboard to /admin', () => {
      renderWithRouter('/admin');
      const link = screen.getByText('Dashboard').closest('a');
      expect(link?.getAttribute('href')).toBe('/admin');
    });

    it('should link Jobs to /admin/jobs', () => {
      renderWithRouter('/admin');
      const link = screen.getByText('Jobs').closest('a');
      expect(link?.getAttribute('href')).toBe('/admin/jobs');
    });

    it('should link FAB to /admin/jobs/new', () => {
      renderWithRouter('/admin');
      const fab = screen.getByLabelText('Create new job');
      expect(fab.getAttribute('href')).toBe('/admin/jobs/new');
    });

    it('should link Clients to /admin/clients', () => {
      renderWithRouter('/admin');
      const link = screen.getByText('Clients').closest('a');
      expect(link?.getAttribute('href')).toBe('/admin/clients');
    });

    it('should link Techs to /admin/technicians', () => {
      renderWithRouter('/admin');
      const link = screen.getByText('Techs').closest('a');
      expect(link?.getAttribute('href')).toBe('/admin/technicians');
    });
  });

  describe('active state', () => {
    it('should highlight Dashboard when on /admin', () => {
      const { container } = renderWithRouter('/admin');
      const dashLink = screen.getByText('Dashboard').closest('a');
      expect(dashLink?.className).toContain('text-primary');
    });

    it('should highlight Jobs when on /admin/jobs', () => {
      renderWithRouter('/admin/jobs');
      const link = screen.getByText('Jobs').closest('a');
      expect(link?.className).toContain('text-primary');
    });

    it('should highlight Clients when on /admin/clients', () => {
      renderWithRouter('/admin/clients');
      const link = screen.getByText('Clients').closest('a');
      expect(link?.className).toContain('text-primary');
    });

    it('should highlight Techs when on /admin/technicians', () => {
      renderWithRouter('/admin/technicians');
      const link = screen.getByText('Techs').closest('a');
      expect(link?.className).toContain('text-primary');
    });

    it('should not highlight Dashboard when on /admin/jobs', () => {
      renderWithRouter('/admin/jobs');
      const link = screen.getByText('Dashboard').closest('a');
      expect(link?.className).not.toContain('text-primary');
    });
  });

  describe('accessibility', () => {
    it('should have nav landmark role', () => {
      const { container } = renderWithRouter('/admin');
      const nav = container.querySelector('nav');
      expect(nav).toBeTruthy();
    });

    it('should have aria-label on nav', () => {
      const { container } = renderWithRouter('/admin');
      const nav = container.querySelector('nav');
      expect(nav?.getAttribute('aria-label')).toContain('navigation');
    });

    it('should have aria-current on active item', () => {
      renderWithRouter('/admin');
      const link = screen.getByText('Dashboard').closest('a');
      expect(link?.getAttribute('aria-current')).toBe('page');
    });

    it('should have accessible label on FAB', () => {
      renderWithRouter('/admin');
      const fab = screen.getByLabelText('Create new job');
      expect(fab).toBeTruthy();
    });
  });

  describe('touch targets', () => {
    it('should have minimum 48px height on nav items', () => {
      const { container } = renderWithRouter('/admin');
      const links = container.querySelectorAll('a');
      links.forEach(link => {
        expect(
          link.className.includes('min-h-[48px]') || link.className.includes('min-h-[56px]')
        ).toBe(true);
      });
    });

    it('FAB should have elevated 56px touch target', () => {
      renderWithRouter('/admin');
      const fab = screen.getByLabelText('Create new job');
      expect(fab.className).toContain('56');
    });
  });

  describe('fixed positioning', () => {
    it('should be fixed to bottom', () => {
      const { container } = renderWithRouter('/admin');
      const nav = container.querySelector('nav');
      expect(nav?.className).toContain('fixed');
      expect(nav?.className).toContain('bottom-0');
    });

    it('should have high z-index', () => {
      const { container } = renderWithRouter('/admin');
      const nav = container.querySelector('nav');
      expect(nav?.className).toContain('z-40');
    });
  });
});
