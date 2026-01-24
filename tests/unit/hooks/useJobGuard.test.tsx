import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { useJobGuard, useJobCreationRedirect } from '../../../hooks/useJobGuard';
import * as workspaceData from '../../../hooks/useWorkspaceData';
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

// Mock workspace data functions
vi.mock('../../../hooks/useWorkspaceData', () => ({
  getClients: vi.fn(),
  getTechnicians: vi.fn(),
}));

// Mock microInteractions
vi.mock('../../../lib/microInteractions', () => ({
  showToast: vi.fn(),
}));

// Wrapper component for router context
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

describe('useJobGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial State', () => {
    it('starts with loading state', () => {
      vi.mocked(workspaceData.getClients).mockResolvedValue([]);
      vi.mocked(workspaceData.getTechnicians).mockResolvedValue([]);

      const { result } = renderHook(() => useJobGuard(), { wrapper });

      expect(result.current.isLoading).toBe(true);
    });

    it('loads clients and technicians on mount', async () => {
      const mockClients = [{ id: '1', name: 'Test Client', email: 'test@example.com', address: '123 Main St', totalJobs: 0 }];
      const mockTechs = [{ id: '1', name: 'Test Tech', email: 'tech@example.com', status: 'Available' as const, rating: 5, jobsCompleted: 0 }];

      vi.mocked(workspaceData.getClients).mockResolvedValue(mockClients);
      vi.mocked(workspaceData.getTechnicians).mockResolvedValue(mockTechs);

      const { result } = renderHook(() => useJobGuard(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.clients).toEqual(mockClients);
      expect(result.current.technicians).toEqual(mockTechs);
    });
  });

  describe('Validation Flags', () => {
    it('hasClients is true when clients exist', async () => {
      const mockClients = [{ id: '1', name: 'Test Client', email: 'test@example.com', address: '123 Main St', totalJobs: 0 }];
      vi.mocked(workspaceData.getClients).mockResolvedValue(mockClients);
      vi.mocked(workspaceData.getTechnicians).mockResolvedValue([]);

      const { result } = renderHook(() => useJobGuard(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.hasClients).toBe(true);
    });

    it('hasClients is false when no clients exist', async () => {
      vi.mocked(workspaceData.getClients).mockResolvedValue([]);
      vi.mocked(workspaceData.getTechnicians).mockResolvedValue([]);

      const { result } = renderHook(() => useJobGuard(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.hasClients).toBe(false);
    });

    it('hasTechnicians is true when technicians exist', async () => {
      const mockTechs = [{ id: '1', name: 'Test Tech', email: 'tech@example.com', status: 'Available' as const, rating: 5, jobsCompleted: 0 }];
      vi.mocked(workspaceData.getClients).mockResolvedValue([]);
      vi.mocked(workspaceData.getTechnicians).mockResolvedValue(mockTechs);

      const { result } = renderHook(() => useJobGuard(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.hasTechnicians).toBe(true);
    });

    it('canCreateJob is true only when clients exist', async () => {
      const mockClients = [{ id: '1', name: 'Test Client', email: 'test@example.com', address: '123 Main St', totalJobs: 0 }];
      vi.mocked(workspaceData.getClients).mockResolvedValue(mockClients);
      vi.mocked(workspaceData.getTechnicians).mockResolvedValue([]);

      const { result } = renderHook(() => useJobGuard(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Can create job even without technicians
      expect(result.current.canCreateJob).toBe(true);
    });

    it('canCreateJob is false when no clients exist', async () => {
      vi.mocked(workspaceData.getClients).mockResolvedValue([]);
      vi.mocked(workspaceData.getTechnicians).mockResolvedValue([]);

      const { result } = renderHook(() => useJobGuard(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.canCreateJob).toBe(false);
    });
  });

  describe('Auto-Redirect Mode', () => {
    it('redirects to client creation when no clients and redirectOnFail is true', async () => {
      vi.mocked(workspaceData.getClients).mockResolvedValue([]);
      vi.mocked(workspaceData.getTechnicians).mockResolvedValue([]);

      renderHook(() => useJobGuard(true), { wrapper });

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith(
          expect.stringContaining('/admin/clients/new'),
          { replace: true }
        );
      });
    });

    it('shows warning toast when redirecting', async () => {
      vi.mocked(workspaceData.getClients).mockResolvedValue([]);
      vi.mocked(workspaceData.getTechnicians).mockResolvedValue([]);

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
      vi.mocked(workspaceData.getClients).mockResolvedValue(mockClients);
      vi.mocked(workspaceData.getTechnicians).mockResolvedValue([]);

      renderHook(() => useJobGuard(true), { wrapper });

      await waitFor(() => {
        expect(mockNavigate).not.toHaveBeenCalled();
      });
    });

    it('includes returnTo parameter in redirect URL', async () => {
      vi.mocked(workspaceData.getClients).mockResolvedValue([]);
      vi.mocked(workspaceData.getTechnicians).mockResolvedValue([]);

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
      vi.mocked(workspaceData.getClients).mockResolvedValue([]);
      vi.mocked(workspaceData.getTechnicians).mockResolvedValue([]);

      const { result } = renderHook(() => useJobGuard(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

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
      vi.mocked(workspaceData.getClients).mockResolvedValue([]);
      vi.mocked(workspaceData.getTechnicians).mockResolvedValue([]);

      const { result } = renderHook(() => useJobGuard(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

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
      const mockTechs = [{ id: '1', name: 'Test Tech', email: 'tech@example.com', status: 'Available' as const, rating: 5, jobsCompleted: 0 }];
      vi.mocked(workspaceData.getClients).mockResolvedValue(mockClients);
      vi.mocked(workspaceData.getTechnicians).mockResolvedValue(mockTechs);

      const { result } = renderHook(() => useJobGuard(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      let canProceed: boolean = false;
      await act(async () => {
        canProceed = await result.current.checkAndRedirect();
      });

      expect(canProceed).toBe(true);
    });

    it('returns false and redirects when no clients', async () => {
      vi.mocked(workspaceData.getClients).mockResolvedValue([]);
      vi.mocked(workspaceData.getTechnicians).mockResolvedValue([]);

      const { result } = renderHook(() => useJobGuard(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      let canProceed: boolean = true;
      await act(async () => {
        canProceed = await result.current.checkAndRedirect();
      });

      expect(canProceed).toBe(false);
      expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining('/admin/clients/new'));
    });

    it('warns about missing technicians but allows proceeding', async () => {
      const mockClients = [{ id: '1', name: 'Test Client', email: 'test@example.com', address: '123 Main St', totalJobs: 0 }];
      vi.mocked(workspaceData.getClients).mockResolvedValue(mockClients);
      vi.mocked(workspaceData.getTechnicians).mockResolvedValue([]);

      const { result } = renderHook(() => useJobGuard(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

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
    it('refresh reloads data', async () => {
      vi.mocked(workspaceData.getClients).mockResolvedValue([]);
      vi.mocked(workspaceData.getTechnicians).mockResolvedValue([]);

      const { result } = renderHook(() => useJobGuard(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Initial call count
      const initialCalls = vi.mocked(workspaceData.getClients).mock.calls.length;

      await act(async () => {
        await result.current.refresh();
      });

      expect(vi.mocked(workspaceData.getClients).mock.calls.length).toBeGreaterThan(initialCalls);
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
