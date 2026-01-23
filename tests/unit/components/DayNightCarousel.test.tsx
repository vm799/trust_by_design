import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { DayNightCarousel } from '../../../components/DayNightCarousel';
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

// Wrapper with ThemeProvider
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider>
    {children}
  </ThemeProvider>
);

describe('DayNightCarousel', () => {
  beforeEach(() => {
    localStorage.clear();
    window.matchMedia = createMatchMediaMock();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('Rendering', () => {
    it('renders the carousel container', () => {
      render(<DayNightCarousel />, { wrapper: TestWrapper });

      // First slide should be visible
      expect(screen.getByText('Capture Evidence')).toBeInTheDocument();
    });

    it('renders slide description', () => {
      render(<DayNightCarousel />, { wrapper: TestWrapper });

      expect(
        screen.getByText(/GPS-verified photos with timestamps/i)
      ).toBeInTheDocument();
    });

    it('renders navigation arrows', () => {
      render(<DayNightCarousel />, { wrapper: TestWrapper });

      expect(screen.getByLabelText('Previous slide')).toBeInTheDocument();
      expect(screen.getByLabelText('Next slide')).toBeInTheDocument();
    });

    it('renders dot navigation with correct count', () => {
      render(<DayNightCarousel />, { wrapper: TestWrapper });

      const dots = screen.getAllByRole('tab');
      expect(dots.length).toBe(4); // 4 slides
    });

    it('renders the day/night indicator', () => {
      render(<DayNightCarousel />, { wrapper: TestWrapper });

      // First slide is dark mode
      expect(screen.getByText('Night Mode')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('dots have correct aria-selected state on initial render', () => {
      render(<DayNightCarousel />, { wrapper: TestWrapper });

      const dots = screen.getAllByRole('tab');
      expect(dots[0]).toHaveAttribute('aria-selected', 'true');
      expect(dots[1]).toHaveAttribute('aria-selected', 'false');
      expect(dots[2]).toHaveAttribute('aria-selected', 'false');
      expect(dots[3]).toHaveAttribute('aria-selected', 'false');
    });

    it('dots have accessible labels', () => {
      render(<DayNightCarousel />, { wrapper: TestWrapper });

      const dots = screen.getAllByRole('tab');
      expect(dots[0]).toHaveAttribute('aria-label', 'Go to slide 1: Capture Evidence');
      expect(dots[1]).toHaveAttribute('aria-label', 'Go to slide 2: Get Signatures');
      expect(dots[2]).toHaveAttribute('aria-label', 'Go to slide 3: Seal & Protect');
      expect(dots[3]).toHaveAttribute('aria-label', 'Go to slide 4: Get Paid Faster');
    });

    it('navigation has tablist role', () => {
      render(<DayNightCarousel />, { wrapper: TestWrapper });

      expect(screen.getByRole('tablist', { name: /Carousel navigation/i })).toBeInTheDocument();
    });

    it('navigation arrows have accessible labels', () => {
      render(<DayNightCarousel />, { wrapper: TestWrapper });

      expect(screen.getByRole('button', { name: 'Previous slide' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Next slide' })).toBeInTheDocument();
    });
  });

  describe('Visual States', () => {
    it('renders with glassmorphism container', () => {
      const { container } = render(<DayNightCarousel />, { wrapper: TestWrapper });

      // Check for backdrop-blur class indicating glassmorphism
      const glassmorphicElement = container.querySelector('.backdrop-blur-xl');
      expect(glassmorphicElement).toBeInTheDocument();
    });

    it('renders feature icons', () => {
      render(<DayNightCarousel />, { wrapper: TestWrapper });

      // Check for material icon (first slide uses photo_camera)
      const iconElement = screen.getByText('photo_camera');
      expect(iconElement).toBeInTheDocument();
      expect(iconElement).toHaveClass('material-symbols-outlined');
    });

    it('has rounded corners', () => {
      const { container } = render(<DayNightCarousel />, { wrapper: TestWrapper });

      const roundedElement = container.querySelector('.rounded-3xl');
      expect(roundedElement).toBeInTheDocument();
    });
  });

  describe('Navigation Buttons', () => {
    it('next button is clickable', () => {
      render(<DayNightCarousel />, { wrapper: TestWrapper });

      const nextButton = screen.getByLabelText('Next slide');
      expect(nextButton).not.toBeDisabled();

      // Click should not throw
      fireEvent.click(nextButton);
    });

    it('prev button is clickable', () => {
      render(<DayNightCarousel />, { wrapper: TestWrapper });

      const prevButton = screen.getByLabelText('Previous slide');
      expect(prevButton).not.toBeDisabled();

      // Click should not throw
      fireEvent.click(prevButton);
    });

    it('dots are clickable', () => {
      render(<DayNightCarousel />, { wrapper: TestWrapper });

      const dots = screen.getAllByRole('tab');
      dots.forEach(dot => {
        expect(dot).not.toBeDisabled();
      });

      // Clicking should not throw
      fireEvent.click(dots[2]);
    });
  });

  describe('Slide Content Structure', () => {
    it('first slide has expected structure', () => {
      render(<DayNightCarousel />, { wrapper: TestWrapper });

      // Title
      expect(screen.getByText('Capture Evidence')).toBeInTheDocument();

      // Description
      expect(screen.getByText(/GPS-verified photos/i)).toBeInTheDocument();

      // Icon
      expect(screen.getByText('photo_camera')).toBeInTheDocument();
    });
  });
});
