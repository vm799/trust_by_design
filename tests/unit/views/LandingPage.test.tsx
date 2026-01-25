import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import LandingPage from '../../../views/LandingPage';
import { ThemeProvider } from '../../../lib/theme';

// Create a proper matchMedia mock
const createMatchMediaMock = () => {
  return vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
};

// Wrapper component with all required providers
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>
    <ThemeProvider>
      {children}
    </ThemeProvider>
  </BrowserRouter>
);

describe('LandingPage', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    window.matchMedia = createMatchMediaMock();
  });

  describe('Hero Section', () => {
    it('renders the main headline', () => {
      render(<LandingPage />, { wrapper: TestWrapper });

      expect(screen.getByText('Get Proof.')).toBeInTheDocument();
      expect(screen.getByText('Get Paid.')).toBeInTheDocument();
    });

    it('renders the subheadline with value proposition', () => {
      render(<LandingPage />, { wrapper: TestWrapper });

      expect(
        screen.getByText(/Capture timestamped, geo-verified evidence/i)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Eliminate payment disputes forever/i)
      ).toBeInTheDocument();
    });

    it('renders the primary CTA button', () => {
      render(<LandingPage />, { wrapper: TestWrapper });

      const ctaButton = screen.getByRole('link', { name: /Start Free Trial/i });
      expect(ctaButton).toBeInTheDocument();
      expect(ctaButton).toHaveAttribute('href', '/auth');
    });

    it('renders the technician portal link', () => {
      render(<LandingPage />, { wrapper: TestWrapper });

      const techLink = screen.getByRole('link', { name: /Technician Portal/i });
      expect(techLink).toBeInTheDocument();
      expect(techLink).toHaveAttribute('href', '/track-lookup');
    });

    it('displays free trial information', () => {
      render(<LandingPage />, { wrapper: TestWrapper });

      expect(
        screen.getByText(/No credit card required/i)
      ).toBeInTheDocument();
      expect(screen.getByText(/14-day free trial/i)).toBeInTheDocument();
    });
  });

  describe('Navigation', () => {
    it('renders the logo in navbar', () => {
      render(<LandingPage />, { wrapper: TestWrapper });

      // Check for the logo link pointing to home
      const logoLink = screen.getByRole('link', { name: /JobProof/i });
      expect(logoLink).toHaveAttribute('href', '/home');
    });

    it('renders the pricing link in navbar', () => {
      render(<LandingPage />, { wrapper: TestWrapper });

      // Get the first pricing link (navbar one)
      const pricingLinks = screen.getAllByRole('link', { name: /^Pricing$/i });
      expect(pricingLinks.length).toBeGreaterThanOrEqual(1);
    });

    it('renders the sign in button', () => {
      render(<LandingPage />, { wrapper: TestWrapper });

      const signInButton = screen.getByRole('link', { name: /Sign In/i });
      expect(signInButton).toBeInTheDocument();
      expect(signInButton).toHaveAttribute('href', '/auth');
    });
  });

  describe('Features Section', () => {
    it('renders all three feature cards', () => {
      render(<LandingPage />, { wrapper: TestWrapper });

      expect(screen.getByText('Immutable Proof')).toBeInTheDocument();
      expect(screen.getByText('Works Offline')).toBeInTheDocument();
      expect(screen.getByText('Client Signatures')).toBeInTheDocument();
    });

    it('renders feature descriptions', () => {
      render(<LandingPage />, { wrapper: TestWrapper });

      expect(
        screen.getByText(/SHA-256 sealed records/i)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Capture evidence anywhere/i)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Digital sign-off captured/i)
      ).toBeInTheDocument();
    });
  });

  describe('How It Works Section', () => {
    it('renders the section header', () => {
      render(<LandingPage />, { wrapper: TestWrapper });

      expect(screen.getByText('How It Works')).toBeInTheDocument();
    });

    it('renders all four steps with descriptions', () => {
      render(<LandingPage />, { wrapper: TestWrapper });

      expect(screen.getByText('Create Job')).toBeInTheDocument();
      expect(screen.getByText('Client Signs')).toBeInTheDocument();
      // Check descriptions to confirm steps are present
      expect(
        screen.getByText(/Assign technician and send magic link/i)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Sealed proof eliminates disputes/i)
      ).toBeInTheDocument();
    });

    it('renders step numbers 1-4', () => {
      render(<LandingPage />, { wrapper: TestWrapper });

      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.getByText('4')).toBeInTheDocument();
    });
  });

  describe('Pricing Section', () => {
    it('renders the section header', () => {
      render(<LandingPage />, { wrapper: TestWrapper });

      expect(screen.getByText('Simple Pricing')).toBeInTheDocument();
    });

    it('renders all three pricing tiers', () => {
      render(<LandingPage />, { wrapper: TestWrapper });

      expect(screen.getByText('Solo')).toBeInTheDocument();
      expect(screen.getByText('Team')).toBeInTheDocument();
      expect(screen.getByText('Agency')).toBeInTheDocument();
    });

    it('shows pricing amounts', () => {
      render(<LandingPage />, { wrapper: TestWrapper });

      expect(screen.getByText('Free')).toBeInTheDocument();
      expect(screen.getByText('£49')).toBeInTheDocument();
      expect(screen.getByText('£199')).toBeInTheDocument();
    });

    it('marks the Team tier as popular', () => {
      render(<LandingPage />, { wrapper: TestWrapper });

      expect(screen.getByText('Popular')).toBeInTheDocument();
    });
  });

  describe('CTA Section', () => {
    it('renders the final CTA heading', () => {
      render(<LandingPage />, { wrapper: TestWrapper });

      expect(
        screen.getByText('Stop Losing Money to Disputes')
      ).toBeInTheDocument();
    });

    it('renders multiple CTA buttons', () => {
      render(<LandingPage />, { wrapper: TestWrapper });

      // Find all CTA buttons (hero + footer)
      const ctaButtons = screen.getAllByRole('link', { name: /Free Trial/i });
      expect(ctaButtons.length).toBeGreaterThan(0);
    });
  });

  describe('Footer', () => {
    it('renders footer links', () => {
      render(<LandingPage />, { wrapper: TestWrapper });

      // Multiple pricing links exist (navbar + footer)
      const pricingLinks = screen.getAllByRole('link', { name: /^Pricing$/i });
      expect(pricingLinks.length).toBeGreaterThanOrEqual(1);

      expect(screen.getByRole('link', { name: /Help/i })).toBeInTheDocument();
    });

    it('renders copyright notice', () => {
      render(<LandingPage />, { wrapper: TestWrapper });

      const currentYear = new Date().getFullYear();
      expect(
        screen.getByText(new RegExp(`© ${currentYear} JobProof`))
      ).toBeInTheDocument();
    });
  });

  describe('Dark Mode', () => {
    // Phase 4.5: Landing page always forces dark mode, no toggle button
    it('forces dark mode on landing page (no theme toggle)', () => {
      render(<LandingPage />, { wrapper: TestWrapper });

      // Theme toggle should NOT be present - landing is always dark
      const themeToggle = screen.queryByRole('button', {
        name: /Switch to (day|night) mode/i,
      });
      expect(themeToggle).not.toBeInTheDocument();

      // Should have dark mode styling
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });
  });

  // DayNightCarousel was removed from LandingPage - features shown in static sections instead

  describe('Responsive Design', () => {
    it('renders buttons with proper padding', () => {
      render(<LandingPage />, { wrapper: TestWrapper });

      // Find CTA button and verify touch-friendly sizing
      const ctaButton = screen.getByRole('link', { name: /Start Free Trial/i });
      expect(ctaButton).toHaveClass('py-4');
    });
  });

  describe('Accessibility', () => {
    it('uses semantic heading hierarchy', () => {
      render(<LandingPage />, { wrapper: TestWrapper });

      // H1 should be present (main headline)
      const h1 = document.querySelector('h1');
      expect(h1).toBeInTheDocument();

      // H2s for section headers
      const h2s = document.querySelectorAll('h2');
      expect(h2s.length).toBeGreaterThanOrEqual(3);
    });

    it('has accessible link names', () => {
      render(<LandingPage />, { wrapper: TestWrapper });

      const links = screen.getAllByRole('link');
      links.forEach((link) => {
        // Each link should have accessible text
        expect(link.textContent || link.getAttribute('aria-label')).toBeTruthy();
      });
    });
  });
});
