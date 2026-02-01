import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import React from 'react';
import { useJobGuard, useJobCreationRedirect } from '../../../hooks/useJobGuard';
import * as DataContext from '../../../lib/DataContext';
import * as microInteractions from '../../../lib/microInteractions';

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ pathname: '/admin/jobs/new' }),
  };
});

// Mock microInteractions
vi.mock('../../../lib/microInteractions', () => ({
  showToast: vi.fn(),
}));

// Mock DataContext
const mockRefresh = vi.fn().mockResolvedValue(undefined);
let mockDataContextValue = {
  clients: [] as Array<{ id: string; name: string; email?: string; address?: string; totalJobs?: number }>,
  technicians: [] as Array<{ id: string; name: string; email?: string; status?: string; rating?: number; jobsCompleted?: number }>,
  isLoading: false,
  refresh: mockRefresh,
};

vi.mock('../../../lib/DataContext', () => ({
  useData: () => mockDataContextValue,
}));

// Wrapper component for router context
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

describe('useJobGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    // Reset mock data
    mockDataContextValue = {
      clients: [],
      technicians: [],
      isLoading: false,
      refresh: mockRefresh,
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial State', () => {
    it('starts with loading state', () => {
      mockDataContextValue.isLoading = true;

      const { result } = renderHook(() => useJobGuard(), { wrapper });

      expect(result.current.isLoading).toBe(true);
    });

    it('loads clients and technicians on mount', async () => {
      const mockClients = [{ id: '1', name: 'Test Client', email: 'test@example.com', address: '123 Main St', totalJobs: 0 }];
      const mockTechs = [{ id: '1', name: 'Test Tech', email: 'tech@example.com', status: 'Available', rating: 5, jobsCompleted: 0 }];

      mockDataContextValue.clients = mockClients;
      mockDataContextValue.technicians = mockTechs;
      mockDataContextValue.isLoading = false;

      const { result } = renderHook(() => useJobGuard(), { wrapper });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.clients).toEqual(mockClients);
      expect(result.current.technicians).toEqual(mockTechs);
    });
  });

  describe('Validation Flags', () => {
    it('hasClients is true when clients exist', async () => {
      const mockClients = [{ id: '1', name: 'Test Client', email: 'test@example.com', address: '123 Main St', totalJobs: 0 }];
      mockDataContextValue.clients = mockClients;
      mockDataContextValue.technicians = [];
      mockDataContextValue.isLoading = false;

      const { result } = renderHook(() => useJobGuard(), { wrapper });

      expect(result.current.hasClients).toBe(true);
    });

    it('hasClients is false when no clients exist', async () => {
      mockDataContextValue.clients = [];
      mockDataContextValue.technicians = [];
      mockDataContextValue.isLoading = false;

      const { result } = renderHook(() => useJobGuard(), { wrapper });

      expect(result.current.hasClients).toBe(false);
    });

    it('hasTechnicians is true when technicians exist', async () => {
      const mockTechs = [{ id: '1', name: 'Test Tech', email: 'tech@example.com', status: 'Available', rating: 5, jobsCompleted: 0 }];
      mockDataContextValue.clients = [];
      mockDataContextValue.technicians = mockTechs;
      mockDataContextValue.isLoading = false;

      const { result } = renderHook(() => useJobGuard(), { wrapper });

      expect(result.current.hasTechnicians).toBe(true);
    });

    it('canCreateJob is true only when clients exist', async () => {
      const mockClients = [{ id: '1', name: 'Test Client', email: 'test@example.com', address: '123 Main St', totalJobs: 0 }];
      mockDataContextValue.clients = mockClients;
      mockDataContextValue.technicians = [];
      mockDataContextValue.isLoading = false;

      const { result } = renderHook(() => useJobGuard(), { wrapper });

      // Can create job even without technicians
      expect(result.current.canCreateJob).toBe(true);
    });

    it('canCreateJob is false when no clients exist', async () => {
      mockDataContextValue.clients = [];
      mockDataContextValue.technicians = [];
      mockDataContextValue.isLoading = false;

      const { result } = renderHook(() => useJobGuard(), { wrapper });

      expect(result.current.canCreateJob).toBe(false);
    });
  });

  describe('Auto-Redirect Mode', () => {
    it('redirects to client creation when no clients and redirectOnFail is true', async () => {
      mockDataContextValue.clients = [];
      mockDataContextValue.technicians = [];
      mockDataContextValue.isLoading = false;

      renderHook(() => useJobGuard(true), { wrapper });

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith(
          expect.stringContaining('/admin/clients/new'),
          { replace: true }
        );
      });
    });

    it('shows warning toast when redirecting', async () => {
      mockDataContextValue.clients = [];
      mockDataContextValue.technicians = [];
      mockDataContextValue.isLoading = false;

      renderHook(() => useJobGuard(true), { wrapper });

      await waitFor(() => {
        expect(microInteractions.showToast).toHaveBeenCalledWith(
          'Create a client first before adding jobs',
          'warning',
          5000
        );
      });
    });

    it('does not redirect when clients exist', async () => {
      const mockClients = [{ id: '1', name: 'Test Client', email: 'test@example.com', address: '123 Main St', totalJobs: 0 }];
      mockDataContextValue.clients = mockClients;
      mockDataContextValue.technicians = [];
      mockDataContextValue.isLoading = false;

      renderHook(() => useJobGuard(true), { wrapper });

      // Wait a tick to ensure useEffect runs
      await waitFor(() => {
        expect(mockNavigate).not.toHaveBeenCalled();
      });
    });

    it('includes returnTo parameter in redirect URL', async () => {
      mockDataContextValue.clients = [];
      mockDataContextValue.technicians = [];
      mockDataContextValue.isLoading = false;

      renderHook(() => useJobGuard(true), { wrapper });

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith(
          expect.stringContaining('returnTo='),
          { replace: true }
        );
      });
    });
  });

  describe('Toast Notifications', () => {
    it('showClientRequiredToast shows correct message', async () => {
      mockDataContextValue.clients = [];
      mockDataContextValue.technicians = [];
      mockDataContextValue.isLoading = false;

      const { result } = renderHook(() => useJobGuard(), { wrapper });

      act(() => {
        result.current.showClientRequiredToast();
      });

      expect(microInteractions.showToast).toHaveBeenCalledWith(
        'Create a client first before adding jobs',
        'warning',
        5000
      );
    });

    it('showNoTechnicianWarning shows correct message', async () => {
      mockDataContextValue.clients = [];
      mockDataContextValue.technicians = [];
      mockDataContextValue.isLoading = false;

      const { result } = renderHook(() => useJobGuard(), { wrapper });

      act(() => {
        result.current.showNoTechnicianWarning();
      });

      expect(microInteractions.showToast).toHaveBeenCalledWith(
        'No technicians available. Job will be created as unassigned.',
        'info',
        4000
      );
    });
  });

  describe('checkAndRedirect', () => {
    it('returns true when clients exist', async () => {
      const mockClients = [{ id: '1', name: 'Test Client', email: 'test@example.com', address: '123 Main St', totalJobs: 0 }];
      const mockTechs = [{ id: '1', name: 'Test Tech', email: 'tech@example.com', status: 'Available', rating: 5, jobsCompleted: 0 }];
      mockDataContextValue.clients = mockClients;
      mockDataContextValue.technicians = mockTechs;
      mockDataContextValue.isLoading = false;

      const { result } = renderHook(() => useJobGuard(), { wrapper });

      let canProceed: boolean = false;
      await act(async () => {
        canProceed = await result.current.checkAndRedirect();
      });

      expect(canProceed).toBe(true);
    });

    it('returns false and redirects when no clients', async () => {
      mockDataContextValue.clients = [];
      mockDataContextValue.technicians = [];
      mockDataContextValue.isLoading = false;

      const { result } = renderHook(() => useJobGuard(), { wrapper });

      let canProceed: boolean = true;
      await act(async () => {
        canProceed = await result.current.checkAndRedirect();
      });

      expect(canProceed).toBe(false);
      expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining('/admin/clients/new'));
    });

    it('warns about missing technicians but allows proceeding', async () => {
      const mockClients = [{ id: '1', name: 'Test Client', email: 'test@example.com', address: '123 Main St', totalJobs: 0 }];
      mockDataContextValue.clients = mockClients;
      mockDataContextValue.technicians = [];
      mockDataContextValue.isLoading = false;

      const { result } = renderHook(() => useJobGuard(), { wrapper });

      await act(async () => {
        await result.current.checkAndRedirect();
      });

      expect(microInteractions.showToast).toHaveBeenCalledWith(
        'No technicians available. Job will be created as unassigned.',
        'info',
        4000
      );
    });
  });

  describe('Refresh', () => {
    it('refresh calls DataContext refresh', async () => {
      mockDataContextValue.clients = [];
      mockDataContextValue.technicians = [];
      mockDataContextValue.isLoading = false;

      const { result } = renderHook(() => useJobGuard(), { wrapper });

      await act(async () => {
        await result.current.refresh();
      });

      expect(mockRefresh).toHaveBeenCalled();
    });
  });
});

describe('useJobCreationRedirect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirectToClientCreation navigates to client creation', () => {
    const { result } = renderHook(() => useJobCreationRedirect(), { wrapper });

    act(() => {
      result.current.redirectToClientCreation();
    });

    expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining('/admin/clients/new'));
    expect(microInteractions.showToast).toHaveBeenCalledWith(
      'Create a client first before adding jobs',
      'warning',
      5000
    );
  });

  it('redirectToTechnicianCreation navigates to technician creation', () => {
    const { result } = renderHook(() => useJobCreationRedirect(), { wrapper });

    act(() => {
      result.current.redirectToTechnicianCreation();
    });

    expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining('/admin/technicians/new'));
    expect(microInteractions.showToast).toHaveBeenCalledWith(
      'Add a technician to assign jobs',
      'info',
      4000
    );
  });
});
