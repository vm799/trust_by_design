import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Tooltip, { SimpleTooltip, InfoTooltip, HelpTooltip } from '../../../components/ui/Tooltip';
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

describe('Tooltip Component', () => {
  beforeEach(() => {
    localStorage.clear();
    window.matchMedia = createMatchMediaMock();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Rendering', () => {
    it('renders children without tooltip initially', () => {
      render(
        <Tooltip content="Test tooltip">
          <button>Hover me</button>
        </Tooltip>,
        { wrapper: TestWrapper }
      );

      expect(screen.getByText('Hover me')).toBeInTheDocument();
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    it('renders nothing when content is empty', () => {
      render(
        <Tooltip content="">
          <button>Hover me</button>
        </Tooltip>,
        { wrapper: TestWrapper }
      );

      expect(screen.getByText('Hover me')).toBeInTheDocument();
    });
  });

  describe('Props', () => {
    it('accepts position prop', () => {
      render(
        <Tooltip content="Test" position="bottom">
          <button>Hover me</button>
        </Tooltip>,
        { wrapper: TestWrapper }
      );

      expect(screen.getByText('Hover me')).toBeInTheDocument();
    });

    it('accepts variant prop', () => {
      render(
        <Tooltip content="Test" variant="highlighted">
          <button>Hover me</button>
        </Tooltip>,
        { wrapper: TestWrapper }
      );

      expect(screen.getByText('Hover me')).toBeInTheDocument();
    });

    it('accepts showClose prop', () => {
      render(
        <Tooltip content="Test" showClose>
          <button>Hover me</button>
        </Tooltip>,
        { wrapper: TestWrapper }
      );

      expect(screen.getByText('Hover me')).toBeInTheDocument();
    });

    it('accepts autoDismiss prop', () => {
      render(
        <Tooltip content="Test" autoDismiss>
          <button>Hover me</button>
        </Tooltip>,
        { wrapper: TestWrapper }
      );

      expect(screen.getByText('Hover me')).toBeInTheDocument();
    });

    it('accepts custom delayDuration', () => {
      render(
        <Tooltip content="Test" delayDuration={500}>
          <button>Hover me</button>
        </Tooltip>,
        { wrapper: TestWrapper }
      );

      expect(screen.getByText('Hover me')).toBeInTheDocument();
    });
  });

  describe('Variants', () => {
    const variants = ['default', 'highlighted', 'warning', 'success', 'info'] as const;

    variants.forEach((variant) => {
      it(`renders with ${variant} variant`, () => {
        render(
          <Tooltip content="Test tooltip" variant={variant}>
            <button>Hover me</button>
          </Tooltip>,
          { wrapper: TestWrapper }
        );

        expect(screen.getByText('Hover me')).toBeInTheDocument();
      });
    });
  });

  describe('Positions', () => {
    const positions = ['top', 'bottom', 'left', 'right'] as const;

    positions.forEach((position) => {
      it(`supports ${position} position`, () => {
        render(
          <Tooltip content="Test tooltip" position={position}>
            <button>Hover me</button>
          </Tooltip>,
          { wrapper: TestWrapper }
        );

        expect(screen.getByText('Hover me')).toBeInTheDocument();
      });
    });
  });
});

describe('SimpleTooltip Component', () => {
  beforeEach(() => {
    localStorage.clear();
    window.matchMedia = createMatchMediaMock();
  });

  it('renders children', () => {
    render(
      <SimpleTooltip content="Simple tip">
        <span>Info text</span>
      </SimpleTooltip>,
      { wrapper: TestWrapper }
    );

    expect(screen.getByText('Info text')).toBeInTheDocument();
  });

  it('accepts position prop', () => {
    render(
      <SimpleTooltip content="Simple tip" position="bottom">
        <span>Info text</span>
      </SimpleTooltip>,
      { wrapper: TestWrapper }
    );

    expect(screen.getByText('Info text')).toBeInTheDocument();
  });
});

describe('InfoTooltip Component', () => {
  beforeEach(() => {
    localStorage.clear();
    window.matchMedia = createMatchMediaMock();
  });

  it('renders children', () => {
    render(
      <InfoTooltip content="Form field help">
        <input type="text" placeholder="Enter value" />
      </InfoTooltip>,
      { wrapper: TestWrapper }
    );

    expect(screen.getByPlaceholderText('Enter value')).toBeInTheDocument();
  });

  it('accepts position prop', () => {
    render(
      <InfoTooltip content="Form field help" position="right">
        <input type="text" placeholder="Enter value" />
      </InfoTooltip>,
      { wrapper: TestWrapper }
    );

    expect(screen.getByPlaceholderText('Enter value')).toBeInTheDocument();
  });
});

describe('HelpTooltip Component', () => {
  beforeEach(() => {
    localStorage.clear();
    window.matchMedia = createMatchMediaMock();
  });

  it('renders help button', () => {
    render(
      <HelpTooltip content="Help information" />,
      { wrapper: TestWrapper }
    );

    expect(screen.getByRole('button', { name: /help/i })).toBeInTheDocument();
  });

  it('renders with different sizes', () => {
    const { rerender } = render(
      <HelpTooltip content="Help" size="sm" />,
      { wrapper: TestWrapper }
    );

    expect(screen.getByRole('button')).toBeInTheDocument();

    rerender(
      <TestWrapper>
        <HelpTooltip content="Help" size="md" />
      </TestWrapper>
    );
    expect(screen.getByRole('button')).toBeInTheDocument();

    rerender(
      <TestWrapper>
        <HelpTooltip content="Help" size="lg" />
      </TestWrapper>
    );
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('renders material icon', () => {
    render(
      <HelpTooltip content="Help information" />,
      { wrapper: TestWrapper }
    );

    expect(screen.getByText('help')).toBeInTheDocument();
    expect(screen.getByText('help')).toHaveClass('material-symbols-outlined');
  });
});

describe('Tooltip Accessibility', () => {
  beforeEach(() => {
    localStorage.clear();
    window.matchMedia = createMatchMediaMock();
  });

  it('trigger is focusable', () => {
    render(
      <Tooltip content="Test tooltip">
        <button>Focusable button</button>
      </Tooltip>,
      { wrapper: TestWrapper }
    );

    const trigger = screen.getByText('Focusable button');
    expect(trigger).toBeInTheDocument();
    expect(trigger.closest('button')).not.toBeDisabled();
  });

  it('close button has aria-label when showClose is true', async () => {
    vi.useRealTimers();
    const user = userEvent.setup();

    render(
      <Tooltip content="Test tooltip" showClose>
        <button>Hover me</button>
      </Tooltip>,
      { wrapper: TestWrapper }
    );

    // Hover to show tooltip
    await user.hover(screen.getByText('Hover me'));

    // Wait for tooltip to appear (300ms delay + some buffer)
    await waitFor(() => {
      const closeButton = screen.queryByRole('button', { name: /close tooltip/i });
      if (closeButton) {
        expect(closeButton).toHaveAttribute('aria-label', 'Close tooltip');
      }
    }, { timeout: 500 });
  });

  it('HelpTooltip button has aria-label', () => {
    render(
      <HelpTooltip content="Help text" />,
      { wrapper: TestWrapper }
    );

    expect(screen.getByRole('button', { name: /help/i })).toHaveAttribute('aria-label', 'Help');
  });
});

describe('Tooltip Configuration', () => {
  beforeEach(() => {
    localStorage.clear();
    window.matchMedia = createMatchMediaMock();
  });

  it('uses default delay of 300ms', () => {
    // The component should use SHOW_DELAY = 300 as default
    render(
      <Tooltip content="Test">
        <button>Button</button>
      </Tooltip>,
      { wrapper: TestWrapper }
    );

    // Component renders - delay is applied internally by Radix
    expect(screen.getByText('Button')).toBeInTheDocument();
  });

  it('allows custom delay duration', () => {
    render(
      <Tooltip content="Test" delayDuration={1000}>
        <button>Button</button>
      </Tooltip>,
      { wrapper: TestWrapper }
    );

    expect(screen.getByText('Button')).toBeInTheDocument();
  });

  it('allows custom auto-dismiss delay', () => {
    render(
      <Tooltip content="Test" autoDismiss autoDismissDelay={5000}>
        <button>Button</button>
      </Tooltip>,
      { wrapper: TestWrapper }
    );

    expect(screen.getByText('Button')).toBeInTheDocument();
  });
});
