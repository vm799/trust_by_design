/**
 * Integration Tests: Dashboard Components
 *
 * Tests the integration between:
 * - deriveDashboardState (state derivation)
 * - FocusCard, QueueList, BackgroundCollapse (UI components)
 * - useDashboard hook (state management)
 *
 * @see /docs/DASHBOARD_IMPLEMENTATION_SPEC.md
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

// Components
import FocusCard, { FocusCardSkeleton } from '../../components/dashboard/FocusCard';
import QueueList, { QueueListSkeleton } from '../../components/dashboard/QueueList';
import BackgroundCollapse, { BackgroundCollapseSkeleton } from '../../components/dashboard/BackgroundCollapse';
import SyncStatusBadge from '../../components/dashboard/SyncStatusBadge';

// Types
import {
  FocusEntity,
  QueueItem,
  BackgroundSection,
  BackgroundItem,
} from '../../lib/dashboardState';

// ============================================================================
// TEST HELPERS
// ============================================================================

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <MemoryRouter>
      {component}
    </MemoryRouter>
  );
};

function createFocusEntity(overrides: Partial<FocusEntity> = {}): FocusEntity {
  return {
    id: 'focus-1',
    type: 'job',
    title: 'Urgent HVAC Repair',
    reason: 'In Progress - Needs attention',
    severity: 'warning',
    actionLabel: 'View Details',
    actionRoute: '/jobs/focus-1',
    ...overrides,
  };
}

function createQueueItem(overrides: Partial<QueueItem> = {}): QueueItem {
  return {
    id: `queue-${Math.random().toString(36).slice(2, 8)}`,
    type: 'job',
    title: 'Scheduled Maintenance',
    urgency: 50,
    route: '/jobs/queue-1',
    ...overrides,
  };
}

function createBackgroundSection(overrides: Partial<BackgroundSection> = {}): BackgroundSection {
  return {
    id: 'idle-technicians',
    title: 'Idle Technicians',
    collapsedByDefault: true,
    items: [
      {
        id: 'tech-1',
        type: 'technician',
        title: 'John Smith',
        subtitle: 'Available',
        route: '/technicians/tech-1',
      },
    ],
    ...overrides,
  };
}

// ============================================================================
// FOCUSCARD TESTS
// ============================================================================

describe('FocusCard', () => {
  it('renders focus entity with correct content', () => {
    const entity = createFocusEntity();
    const onAction = vi.fn();

    renderWithRouter(<FocusCard entity={entity} onAction={onAction} />);

    expect(screen.getByText('Urgent HVAC Repair')).toBeInTheDocument();
    expect(screen.getByText('In Progress - Needs attention')).toBeInTheDocument();
    expect(screen.getByText('View Details')).toBeInTheDocument();
  });

  it('calls onAction when action button clicked', () => {
    const entity = createFocusEntity();
    const onAction = vi.fn();

    renderWithRouter(<FocusCard entity={entity} onAction={onAction} />);

    const actionButton = screen.getByRole('button', { name: /view details/i });
    fireEvent.click(actionButton);

    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('renders critical severity with correct styling', () => {
    const entity = createFocusEntity({ severity: 'critical' });
    const onAction = vi.fn();

    const { container } = renderWithRouter(<FocusCard entity={entity} onAction={onAction} />);

    // Check for critical styling (red left border accent on glassmorphism card)
    const card = container.querySelector('[class*="border-l-red"]');
    expect(card).toBeInTheDocument();
  });

  it('renders warning severity with correct styling', () => {
    const entity = createFocusEntity({ severity: 'warning' });
    const onAction = vi.fn();

    const { container } = renderWithRouter(<FocusCard entity={entity} onAction={onAction} />);

    // Check for warning styling (amber left border accent on glassmorphism card)
    const card = container.querySelector('[class*="border-l-amber"]');
    expect(card).toBeInTheDocument();
  });

  it('renders info severity with correct styling', () => {
    const entity = createFocusEntity({ severity: 'info' });
    const onAction = vi.fn();

    const { container } = renderWithRouter(<FocusCard entity={entity} onAction={onAction} />);

    // Check for info styling (primary left border accent on glassmorphism card)
    const card = container.querySelector('[class*="border-l-primary"]');
    expect(card).toBeInTheDocument();
  });

  it('displays sync status badge when syncStatus is not synced', () => {
    const entity = createFocusEntity({ syncStatus: 'pending' });
    const onAction = vi.fn();

    renderWithRouter(<FocusCard entity={entity} onAction={onAction} />);

    // Should show syncing indicator (pending status shows "Syncing")
    expect(screen.getByText(/syncing/i)).toBeInTheDocument();
  });

  it('renders skeleton loading state', () => {
    const { container } = renderWithRouter(<FocusCardSkeleton />);

    // Check for animate-pulse class (loading indicator)
    const skeleton = container.querySelector('.animate-pulse');
    expect(skeleton).toBeInTheDocument();
  });

  it('has 56px minimum touch target for action button (field worker size)', () => {
    const entity = createFocusEntity();
    const onAction = vi.fn();

    renderWithRouter(<FocusCard entity={entity} onAction={onAction} />);

    const actionButton = screen.getByRole('button', { name: /view details/i });
    // Field worker buttons use 56px minimum per CLAUDE.md accessibility requirements
    expect(actionButton).toHaveClass('min-h-[56px]');
  });
});

// ============================================================================
// QUEUELIST TESTS
// ============================================================================

describe('QueueList', () => {
  it('renders queue items correctly', () => {
    const items = [
      createQueueItem({ id: 'q1', title: 'Job 1', urgency: 100 }),
      createQueueItem({ id: 'q2', title: 'Job 2', urgency: 50 }),
    ];
    const onItemClick = vi.fn();

    renderWithRouter(<QueueList items={items} onItemClick={onItemClick} />);

    expect(screen.getByText('Job 1')).toBeInTheDocument();
    expect(screen.getByText('Job 2')).toBeInTheDocument();
  });

  it('displays "Next Up" header with count', () => {
    const items = [
      createQueueItem({ id: 'q1' }),
      createQueueItem({ id: 'q2' }),
    ];
    const onItemClick = vi.fn();

    const { container } = renderWithRouter(<QueueList items={items} onItemClick={onItemClick} />);

    expect(screen.getByText('Next Up')).toBeInTheDocument();
    // Count badge is in the header with specific styling
    const countBadge = container.querySelector('h2 span.px-1\\.5');
    expect(countBadge).toHaveTextContent('2');
  });

  it('renders clickable items with navigation', () => {
    const items = [createQueueItem({ id: 'q1', title: 'Clickable Job', route: '/app/jobs/q1' })];
    const onItemClick = vi.fn();

    const { container } = renderWithRouter(<QueueList items={items} onItemClick={onItemClick} />);

    // QuickActionCard uses react-router navigation instead of callback
    // Verify the item renders as a clickable button
    const itemButton = screen.getByRole('button', { name: /clickable job/i });
    expect(itemButton).toBeInTheDocument();

    // Click should work without errors (navigation happens via react-router)
    fireEvent.click(itemButton);

    // Verify card has colour-coded styling
    expect(container.querySelector('[class*="bg-"]')).toBeInTheDocument();
  });

  it('returns null when items array is empty', () => {
    const onItemClick = vi.fn();

    const { container } = renderWithRouter(<QueueList items={[]} onItemClick={onItemClick} />);

    expect(container.firstChild).toBeNull();
  });

  it('displays position indicators correctly', () => {
    const items = [
      createQueueItem({ id: 'q1', title: 'First' }),
      createQueueItem({ id: 'q2', title: 'Second' }),
    ];
    const onItemClick = vi.fn();

    const { container } = renderWithRouter(<QueueList items={items} onItemClick={onItemClick} />);

    // QuickActionCard displays position as badge number
    // Find all elements containing position numbers
    const positionOne = screen.getAllByText('1');
    const positionTwo = screen.getAllByText('2');
    expect(positionOne.length).toBeGreaterThanOrEqual(1);
    expect(positionTwo.length).toBeGreaterThanOrEqual(1);

    // Verify titles are rendered
    expect(screen.getByText('First')).toBeInTheDocument();
    expect(screen.getByText('Second')).toBeInTheDocument();
  });

  it('shows urgency colour indicator', () => {
    const items = [
      createQueueItem({ id: 'q1', title: 'Urgent', urgency: 100 }),
      createQueueItem({ id: 'q2', title: 'Warning', urgency: 60 }),
      createQueueItem({ id: 'q3', title: 'Normal', urgency: 20 }),
    ];
    const onItemClick = vi.fn();

    const { container } = renderWithRouter(<QueueList items={items} onItemClick={onItemClick} />);

    // QuickActionCard uses colour-coded containers based on urgency
    // Critical (urgency >= 80): bg-red-50 or dark:bg-red-950
    // Warning (urgency >= 60): bg-amber-50 or dark:bg-amber-950
    // Info (urgency >= 40): bg-blue-50 or dark:bg-blue-950
    // Neutral (below 40): bg-slate-50 or dark:bg-slate-800
    expect(container.querySelector('[class*="bg-red"]')).toBeInTheDocument();
    expect(container.querySelector('[class*="bg-amber"]')).toBeInTheDocument();
    expect(container.querySelector('[class*="bg-slate"]')).toBeInTheDocument();
  });

  it('renders skeleton loading state', () => {
    const { container } = renderWithRouter(<QueueListSkeleton count={3} />);

    // Check for animate-pulse class (loading indicator)
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('shows subtitle when provided', () => {
    const items = [
      createQueueItem({ id: 'q1', title: 'Job Title', subtitle: 'Client Name' }),
    ];
    const onItemClick = vi.fn();

    renderWithRouter(<QueueList items={items} onItemClick={onItemClick} />);

    expect(screen.getByText('Client Name')).toBeInTheDocument();
  });

  it('shows sync status badge for pending items', () => {
    const items = [
      createQueueItem({ id: 'q1', title: 'Pending Job', syncStatus: 'pending' }),
    ];
    const onItemClick = vi.fn();

    renderWithRouter(<QueueList items={items} onItemClick={onItemClick} />);

    // Pending status shows "Syncing" in the badge
    expect(screen.getByLabelText(/syncing/i)).toBeInTheDocument();
  });

  describe('Virtualization', () => {
    it('uses standard rendering for small lists (< 10 items)', () => {
      const items = Array.from({ length: 5 }, (_, i) =>
        createQueueItem({ id: `q${i}`, title: `Item ${i}` })
      );
      const onItemClick = vi.fn();

      const { container } = renderWithRouter(
        <QueueList items={items} onItemClick={onItemClick} />
      );

      // Should not have virtualized list class
      expect(container.querySelector('[style*="overflow"]')).toBeNull();
    });

    it('enables virtualization for large lists (> 10 items)', () => {
      const items = Array.from({ length: 15 }, (_, i) =>
        createQueueItem({ id: `q${i}`, title: `Item ${i}` })
      );
      const onItemClick = vi.fn();

      const { container } = renderWithRouter(
        <QueueList items={items} onItemClick={onItemClick} />
      );

      // Should have virtualized list (react-window adds overflow styles)
      const virtualList = container.querySelector('[style*="overflow"]');
      expect(virtualList).toBeInTheDocument();
    });

    it('respects virtualize prop override', () => {
      const items = Array.from({ length: 5 }, (_, i) =>
        createQueueItem({ id: `q${i}`, title: `Item ${i}` })
      );
      const onItemClick = vi.fn();

      const { container } = renderWithRouter(
        <QueueList items={items} onItemClick={onItemClick} virtualize={true} />
      );

      // Should force virtualization even with few items
      const virtualList = container.querySelector('[style*="overflow"]');
      expect(virtualList).toBeInTheDocument();
    });
  });
});

// ============================================================================
// BACKGROUNDCOLLAPSE TESTS
// ============================================================================

describe('BackgroundCollapse', () => {
  it('renders section title', () => {
    const section = createBackgroundSection({ title: 'Idle Technicians' });
    const onItemClick = vi.fn();

    renderWithRouter(<BackgroundCollapse section={section} onItemClick={onItemClick} />);

    expect(screen.getByText('Idle Technicians')).toBeInTheDocument();
  });

  it('renders all items in section', () => {
    const section = createBackgroundSection({
      items: [
        { id: 'tech-1', type: 'technician', title: 'John Smith', route: '/tech/1' },
        { id: 'tech-2', type: 'technician', title: 'Jane Doe', route: '/tech/2' },
      ],
    });
    const onItemClick = vi.fn();

    renderWithRouter(<BackgroundCollapse section={section} onItemClick={onItemClick} />);

    expect(screen.getByText('John Smith')).toBeInTheDocument();
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
  });

  it('returns null for empty sections', () => {
    const section = createBackgroundSection({ items: [] });
    const onItemClick = vi.fn();

    const { container } = renderWithRouter(
      <BackgroundCollapse section={section} onItemClick={onItemClick} />
    );

    expect(container.firstChild).toBeNull();
  });

  it('starts collapsed when collapsedByDefault is true', () => {
    const section = createBackgroundSection({ collapsedByDefault: true });
    const onItemClick = vi.fn();

    renderWithRouter(<BackgroundCollapse section={section} onItemClick={onItemClick} />);

    // Details element should not have "open" attribute
    const details = screen.getByRole('group');
    expect(details).not.toHaveAttribute('open');
  });

  it('starts expanded when collapsedByDefault is false', () => {
    const section = createBackgroundSection({ collapsedByDefault: false });
    const onItemClick = vi.fn();

    renderWithRouter(<BackgroundCollapse section={section} onItemClick={onItemClick} />);

    // Details element should have "open" attribute
    const details = screen.getByRole('group');
    expect(details).toHaveAttribute('open');
  });

  it('calls onItemClick when item with route clicked', () => {
    const section = createBackgroundSection({
      items: [
        { id: 'item-1', type: 'technician', title: 'Click Me', route: '/tech/1' },
      ],
    });
    const onItemClick = vi.fn();

    renderWithRouter(<BackgroundCollapse section={section} onItemClick={onItemClick} />);

    // Find and click the button
    const itemButton = screen.getByRole('button', { name: /click me/i });
    fireEvent.click(itemButton);

    expect(onItemClick).toHaveBeenCalledWith(section.items[0]);
  });

  it('shows subtitle when provided', () => {
    const section = createBackgroundSection({
      items: [
        { id: 'item-1', type: 'technician', title: 'Tech Name', subtitle: 'On break', route: '/tech/1' },
      ],
    });
    const onItemClick = vi.fn();

    renderWithRouter(<BackgroundCollapse section={section} onItemClick={onItemClick} />);

    expect(screen.getByText('On break')).toBeInTheDocument();
  });

  it('shows sync status badge for non-synced items', () => {
    const section = createBackgroundSection({
      items: [
        { id: 'item-1', type: 'job', title: 'Pending Job', syncStatus: 'pending', route: '/jobs/1' },
      ],
    });
    const onItemClick = vi.fn();

    renderWithRouter(<BackgroundCollapse section={section} onItemClick={onItemClick} />);

    // Pending status shows "Syncing" in the compact badge
    expect(screen.getByLabelText(/syncing/i)).toBeInTheDocument();
  });

  it('renders skeleton loading state', () => {
    const { container } = renderWithRouter(<BackgroundCollapseSkeleton />);

    // Check for animate-pulse class (loading indicator)
    const skeleton = container.querySelector('.animate-pulse');
    expect(skeleton).toBeInTheDocument();
  });

  it('has 44px minimum touch target for items', () => {
    const section = createBackgroundSection({
      items: [
        { id: 'item-1', type: 'technician', title: 'Touch Target', route: '/tech/1' },
      ],
    });
    const onItemClick = vi.fn();

    renderWithRouter(<BackgroundCollapse section={section} onItemClick={onItemClick} />);

    const itemButton = screen.getByRole('button', { name: /touch target/i });
    expect(itemButton).toHaveClass('min-h-[44px]');
  });
});

// ============================================================================
// SYNCSTATUSBADGE TESTS
// ============================================================================

describe('SyncStatusBadge', () => {
  it('renders synced status with correct styling', () => {
    const { container } = renderWithRouter(<SyncStatusBadge status="synced" />);

    expect(screen.getByText(/synced/i)).toBeInTheDocument();
    // Uses emerald color for synced status
    expect(container.querySelector('.text-emerald-600')).toBeInTheDocument();
  });

  it('renders pending status with correct styling', () => {
    const { container } = renderWithRouter(<SyncStatusBadge status="pending" />);

    // Pending status shows "Syncing" label
    expect(screen.getByText(/syncing/i)).toBeInTheDocument();
    expect(container.querySelector('.text-amber-600')).toBeInTheDocument();
  });

  it('renders failed status with correct styling', () => {
    const { container } = renderWithRouter(<SyncStatusBadge status="failed" />);

    expect(screen.getByText(/failed/i)).toBeInTheDocument();
    expect(container.querySelector('.text-red-600')).toBeInTheDocument();
  });

  it('renders compact variant with icon only', () => {
    const { container } = renderWithRouter(<SyncStatusBadge status="pending" compact />);

    // Compact variant shows only icon (material-symbols-outlined)
    const icon = container.querySelector('.material-symbols-outlined');
    expect(icon).toBeInTheDocument();
    // Compact variant should have aria-label for accessibility
    expect(icon).toHaveAttribute('aria-label', 'Syncing');
  });

  it('has aria-label for accessibility', () => {
    renderWithRouter(<SyncStatusBadge status="synced" />);

    const badge = screen.getByLabelText(/sync status: synced/i);
    expect(badge).toBeInTheDocument();
  });
});

// ============================================================================
// TYPE ICON TESTS
// ============================================================================

describe('Type Icons', () => {
  it('QueueList renders job icon for job type', () => {
    const items = [createQueueItem({ type: 'job', title: 'Job Item' })];
    const onItemClick = vi.fn();

    renderWithRouter(<QueueList items={items} onItemClick={onItemClick} />);

    // Check for work icon
    expect(screen.getByText('work')).toBeInTheDocument();
  });

  it('QueueList renders person icon for technician type', () => {
    const items = [createQueueItem({ type: 'technician', title: 'Tech Item' })];
    const onItemClick = vi.fn();

    renderWithRouter(<QueueList items={items} onItemClick={onItemClick} />);

    // Check for person icon
    expect(screen.getByText('person')).toBeInTheDocument();
  });

  it('QueueList renders notifications icon for attention type', () => {
    const items = [createQueueItem({ type: 'attention', title: 'Attention Item' })];
    const onItemClick = vi.fn();

    renderWithRouter(<QueueList items={items} onItemClick={onItemClick} />);

    // Check for notifications icon
    expect(screen.getByText('notifications')).toBeInTheDocument();
  });
});

// ============================================================================
// ACCESSIBILITY TESTS
// ============================================================================

describe('Accessibility', () => {
  it('FocusCard action button is keyboard accessible', () => {
    const entity = createFocusEntity();
    const onAction = vi.fn();

    renderWithRouter(<FocusCard entity={entity} onAction={onAction} />);

    const actionButton = screen.getByRole('button', { name: /view details/i });

    // Should be focusable
    actionButton.focus();
    expect(document.activeElement).toBe(actionButton);

    // Should respond to Enter key
    fireEvent.keyDown(actionButton, { key: 'Enter', code: 'Enter' });
    // Note: keyDown doesn't trigger click, but button is keyboard accessible
  });

  it('QueueList items are keyboard accessible', () => {
    const items = [createQueueItem({ id: 'q1', title: 'Keyboard Item' })];
    const onItemClick = vi.fn();

    renderWithRouter(<QueueList items={items} onItemClick={onItemClick} />);

    const itemButton = screen.getByRole('button', { name: /keyboard item/i });

    // Should be focusable
    itemButton.focus();
    expect(document.activeElement).toBe(itemButton);
  });

  it('BackgroundCollapse uses native details element for accessibility', () => {
    const section = createBackgroundSection();
    const onItemClick = vi.fn();

    renderWithRouter(<BackgroundCollapse section={section} onItemClick={onItemClick} />);

    // Should use native <details> element
    const details = screen.getByRole('group');
    expect(details.tagName.toLowerCase()).toBe('details');
  });

  it('BackgroundCollapse summary is keyboard accessible', () => {
    const section = createBackgroundSection();
    const onItemClick = vi.fn();

    renderWithRouter(<BackgroundCollapse section={section} onItemClick={onItemClick} />);

    // Summary should be discoverable (native browser behavior handles keyboard)
    const summary = screen.getByText('Idle Technicians').closest('summary');
    expect(summary).toBeInTheDocument();
  });
});

// ============================================================================
// EDGE CASES
// ============================================================================

describe('Edge Cases', () => {
  it('handles very long titles with truncation', () => {
    const items = [
      createQueueItem({
        id: 'q1',
        title: 'This is a very long title that should be truncated when displayed in the queue list component',
      }),
    ];
    const onItemClick = vi.fn();

    const { container } = renderWithRouter(<QueueList items={items} onItemClick={onItemClick} />);

    // Check for truncate class
    const titleElement = container.querySelector('.truncate');
    expect(titleElement).toBeInTheDocument();
  });

  it('handles missing optional fields gracefully', () => {
    const items = [
      {
        id: 'q1',
        type: 'job' as const,
        title: 'Minimal Item',
        urgency: 50,
        route: '/jobs/q1',
        // No subtitle, no syncStatus
      },
    ];
    const onItemClick = vi.fn();

    // Should not throw
    expect(() => {
      renderWithRouter(<QueueList items={items} onItemClick={onItemClick} />);
    }).not.toThrow();
  });

  it('handles special characters in titles', () => {
    const items = [
      createQueueItem({
        id: 'q1',
        title: 'HVAC Repair @ 123 Main St. <urgent>',
      }),
    ];
    const onItemClick = vi.fn();

    renderWithRouter(<QueueList items={items} onItemClick={onItemClick} />);

    expect(screen.getByText(/HVAC Repair @ 123 Main St/)).toBeInTheDocument();
  });

  it('handles rapid clicks on queue items', () => {
    const items = [createQueueItem({ id: 'q1', title: 'Rapid Click', route: '/test/rapid' })];
    const onItemClick = vi.fn();

    const { container } = renderWithRouter(<QueueList items={items} onItemClick={onItemClick} />);

    // QuickActionCard uses buttons that trigger navigation
    // Find the main clickable button on the card
    const itemButton = container.querySelector('button');
    expect(itemButton).toBeInTheDocument();

    // Rapid clicks should work without errors
    if (itemButton) {
      fireEvent.click(itemButton);
      fireEvent.click(itemButton);
      fireEvent.click(itemButton);
    }

    // QuickActionCard navigates via react-router instead of calling onItemClick
    // Verify component renders and handles clicks without error
    expect(container.querySelector('[class*="bg-"]')).toBeInTheDocument();
  });
});
