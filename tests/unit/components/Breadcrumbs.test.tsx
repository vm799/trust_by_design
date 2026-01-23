import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import Breadcrumbs, {
  BackButton,
  JobCreationBreadcrumbs,
  ClientCreationBreadcrumbs,
  TechnicianCreationBreadcrumbs,
} from '../../../components/ui/Breadcrumbs';
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

// Wrapper with all providers
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>
    <ThemeProvider>
      {children}
    </ThemeProvider>
  </BrowserRouter>
);

describe('Breadcrumbs', () => {
  beforeEach(() => {
    localStorage.clear();
    window.matchMedia = createMatchMediaMock();
  });

  describe('Basic Rendering', () => {
    it('renders breadcrumb items', () => {
      render(
        <Breadcrumbs
          items={[
            { label: 'Jobs', href: '/admin/jobs' },
            { label: 'New Job' },
          ]}
          showHome={false}
        />,
        { wrapper: TestWrapper }
      );

      expect(screen.getByText('Jobs')).toBeInTheDocument();
      expect(screen.getByText('New Job')).toBeInTheDocument();
    });

    it('renders home link by default', () => {
      render(
        <Breadcrumbs
          items={[
            { label: 'Jobs', href: '/admin/jobs' },
          ]}
        />,
        { wrapper: TestWrapper }
      );

      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });

    it('hides home link when showHome is false', () => {
      render(
        <Breadcrumbs
          items={[
            { label: 'Jobs', href: '/admin/jobs' },
          ]}
          showHome={false}
        />,
        { wrapper: TestWrapper }
      );

      expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
    });

    it('renders icons when provided', () => {
      render(
        <Breadcrumbs
          items={[
            { label: 'Jobs', href: '/admin/jobs', icon: 'work' },
            { label: 'New Job' },
          ]}
          showHome={false}
        />,
        { wrapper: TestWrapper }
      );

      expect(screen.getByText('work')).toBeInTheDocument();
    });
  });

  describe('Navigation', () => {
    it('renders links for items with href', () => {
      render(
        <Breadcrumbs
          items={[
            { label: 'Jobs', href: '/admin/jobs' },
            { label: 'New Job' },
          ]}
          showHome={false}
        />,
        { wrapper: TestWrapper }
      );

      const jobsLink = screen.getByRole('link', { name: /Jobs/i });
      expect(jobsLink).toHaveAttribute('href', '/admin/jobs');
    });

    it('does not render link for last item', () => {
      render(
        <Breadcrumbs
          items={[
            { label: 'Jobs', href: '/admin/jobs' },
            { label: 'New Job', href: '/admin/jobs/new' },
          ]}
          showHome={false}
        />,
        { wrapper: TestWrapper }
      );

      // Last item should not be a link even if href is provided
      const links = screen.getAllByRole('link');
      const newJobLink = links.find(link => link.textContent?.includes('New Job'));
      expect(newJobLink).toBeUndefined();
    });

    it('renders Dashboard link to /admin', () => {
      render(
        <Breadcrumbs
          items={[
            { label: 'Jobs', href: '/admin/jobs' },
          ]}
        />,
        { wrapper: TestWrapper }
      );

      const dashboardLink = screen.getByRole('link', { name: /Dashboard/i });
      expect(dashboardLink).toHaveAttribute('href', '/admin');
    });
  });

  describe('Separators', () => {
    it('renders chevron separator by default', () => {
      render(
        <Breadcrumbs
          items={[
            { label: 'Jobs', href: '/admin/jobs' },
            { label: 'New Job' },
          ]}
          showHome={false}
        />,
        { wrapper: TestWrapper }
      );

      expect(screen.getByText('chevron_right')).toBeInTheDocument();
    });

    it('renders slash separator when specified', () => {
      render(
        <Breadcrumbs
          items={[
            { label: 'Jobs', href: '/admin/jobs' },
            { label: 'New Job' },
          ]}
          showHome={false}
          separator="slash"
        />,
        { wrapper: TestWrapper }
      );

      expect(screen.getByText('/')).toBeInTheDocument();
    });

    it('renders arrow separator when specified', () => {
      render(
        <Breadcrumbs
          items={[
            { label: 'Jobs', href: '/admin/jobs' },
            { label: 'New Job' },
          ]}
          showHome={false}
          separator="arrow"
        />,
        { wrapper: TestWrapper }
      );

      expect(screen.getByText('arrow_forward')).toBeInTheDocument();
    });

    it('does not render separator before first item', () => {
      const { container } = render(
        <Breadcrumbs
          items={[
            { label: 'Single Item' },
          ]}
          showHome={false}
        />,
        { wrapper: TestWrapper }
      );

      // No separator should be present with only one item
      expect(container.querySelector('[aria-hidden="true"]')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has navigation landmark with aria-label', () => {
      render(
        <Breadcrumbs
          items={[
            { label: 'Jobs', href: '/admin/jobs' },
            { label: 'New Job' },
          ]}
        />,
        { wrapper: TestWrapper }
      );

      const nav = screen.getByRole('navigation', { name: /Breadcrumb/i });
      expect(nav).toBeInTheDocument();
    });

    it('marks current page with aria-current', () => {
      const { container } = render(
        <Breadcrumbs
          items={[
            { label: 'Jobs', href: '/admin/jobs' },
            { label: 'New Job' },
          ]}
          showHome={false}
        />,
        { wrapper: TestWrapper }
      );

      // The aria-current is on the outer span wrapper, not the inner text span
      const currentPage = container.querySelector('[aria-current="page"]');
      expect(currentPage).toBeInTheDocument();
      expect(currentPage).toHaveTextContent('New Job');
    });

    it('hides separators from screen readers', () => {
      const { container } = render(
        <Breadcrumbs
          items={[
            { label: 'Jobs', href: '/admin/jobs' },
            { label: 'New Job' },
          ]}
          showHome={false}
        />,
        { wrapper: TestWrapper }
      );

      const separator = container.querySelector('[aria-hidden="true"]');
      expect(separator).toBeInTheDocument();
    });

    it('uses ordered list for semantic structure', () => {
      render(
        <Breadcrumbs
          items={[
            { label: 'Jobs', href: '/admin/jobs' },
            { label: 'New Job' },
          ]}
        />,
        { wrapper: TestWrapper }
      );

      expect(screen.getByRole('list')).toBeInTheDocument();
      expect(screen.getAllByRole('listitem')).toHaveLength(3); // Dashboard + Jobs + New Job
    });
  });

  describe('Custom className', () => {
    it('applies custom className', () => {
      const { container } = render(
        <Breadcrumbs
          items={[{ label: 'Test' }]}
          showHome={false}
          className="custom-class"
        />,
        { wrapper: TestWrapper }
      );

      const nav = container.querySelector('nav');
      expect(nav).toHaveClass('custom-class');
    });
  });
});

describe('BackButton', () => {
  beforeEach(() => {
    localStorage.clear();
    window.matchMedia = createMatchMediaMock();
  });

  it('renders with default label', () => {
    render(<BackButton to="/admin/jobs" />, { wrapper: TestWrapper });

    expect(screen.getByText('Back')).toBeInTheDocument();
  });

  it('renders with custom label', () => {
    render(<BackButton to="/admin/jobs" label="Back to Jobs" />, { wrapper: TestWrapper });

    expect(screen.getByText('Back to Jobs')).toBeInTheDocument();
  });

  it('renders link with correct href', () => {
    render(<BackButton to="/admin/jobs" />, { wrapper: TestWrapper });

    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/admin/jobs');
  });

  it('renders back arrow icon', () => {
    render(<BackButton to="/admin/jobs" />, { wrapper: TestWrapper });

    expect(screen.getByText('arrow_back')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<BackButton to="/admin/jobs" className="custom-class" />, { wrapper: TestWrapper });

    const link = screen.getByRole('link');
    expect(link).toHaveClass('custom-class');
  });
});

describe('Preset Breadcrumbs', () => {
  beforeEach(() => {
    localStorage.clear();
    window.matchMedia = createMatchMediaMock();
  });

  describe('JobCreationBreadcrumbs', () => {
    it('renders with default step name', () => {
      render(<JobCreationBreadcrumbs />, { wrapper: TestWrapper });

      expect(screen.getByText('Jobs')).toBeInTheDocument();
      expect(screen.getByText('New Job')).toBeInTheDocument();
    });

    it('renders with custom step name', () => {
      render(<JobCreationBreadcrumbs currentStep="Select Client" />, { wrapper: TestWrapper });

      expect(screen.getByText('Select Client')).toBeInTheDocument();
    });

    it('links Jobs to correct path', () => {
      render(<JobCreationBreadcrumbs />, { wrapper: TestWrapper });

      const jobsLink = screen.getByRole('link', { name: /Jobs/i });
      expect(jobsLink).toHaveAttribute('href', '/admin/jobs');
    });

    it('renders work icon', () => {
      render(<JobCreationBreadcrumbs />, { wrapper: TestWrapper });

      expect(screen.getByText('work')).toBeInTheDocument();
    });
  });

  describe('ClientCreationBreadcrumbs', () => {
    it('renders with default step name', () => {
      render(<ClientCreationBreadcrumbs />, { wrapper: TestWrapper });

      expect(screen.getByText('Clients')).toBeInTheDocument();
      expect(screen.getByText('New Client')).toBeInTheDocument();
    });

    it('renders with custom step name', () => {
      render(<ClientCreationBreadcrumbs currentStep="Contact Details" />, { wrapper: TestWrapper });

      expect(screen.getByText('Contact Details')).toBeInTheDocument();
    });

    it('links Clients to correct path', () => {
      render(<ClientCreationBreadcrumbs />, { wrapper: TestWrapper });

      const clientsLink = screen.getByRole('link', { name: /Clients/i });
      expect(clientsLink).toHaveAttribute('href', '/admin/clients');
    });

    it('renders people icon', () => {
      render(<ClientCreationBreadcrumbs />, { wrapper: TestWrapper });

      expect(screen.getByText('people')).toBeInTheDocument();
    });
  });

  describe('TechnicianCreationBreadcrumbs', () => {
    it('renders with default step name', () => {
      render(<TechnicianCreationBreadcrumbs />, { wrapper: TestWrapper });

      expect(screen.getByText('Technicians')).toBeInTheDocument();
      expect(screen.getByText('New Technician')).toBeInTheDocument();
    });

    it('renders with custom step name', () => {
      render(<TechnicianCreationBreadcrumbs currentStep="Skills" />, { wrapper: TestWrapper });

      expect(screen.getByText('Skills')).toBeInTheDocument();
    });

    it('links Technicians to correct path', () => {
      render(<TechnicianCreationBreadcrumbs />, { wrapper: TestWrapper });

      const techsLink = screen.getByRole('link', { name: /Technicians/i });
      expect(techsLink).toHaveAttribute('href', '/admin/technicians');
    });

    it('renders engineering icon', () => {
      render(<TechnicianCreationBreadcrumbs />, { wrapper: TestWrapper });

      expect(screen.getByText('engineering')).toBeInTheDocument();
    });
  });
});
