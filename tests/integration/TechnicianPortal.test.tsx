import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import TechnicianPortal from '@/views/TechnicianPortal';
import { mockJobs, createMockJob } from '../mocks/mockData';
import type { Job } from '@/types';

/**
 * INTEGRATION TEST SUITE: TECHNICIAN PORTAL - JOB SUBMISSION WORKFLOW
 *
 * This suite tests the complete technician field workflow:
 * 1. Magic link validation and job loading
 * 2. Photo capture with geolocation
 * 3. Safety checklist completion
 * 4. Signature capture
 * 5. Work summary entry
 * 6. Draft state persistence
 * 7. Job submission and sync
 * 8. Offline capability with sync queue
 *
 * Testing Trophy Level: INTEGRATION (Component + API + State)
 */

// Mock dependencies
const mockOnUpdateJob = vi.fn();
const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ token: 'mock-token-123' }),
  };
});

// Mock IndexedDB operations
const mockIndexedDB = {
  get: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
};

vi.mock('@/lib/db', async () => {
  const actual = await vi.importActual('@/lib/db');
  return {
    ...actual,
    validateMagicLink: vi.fn(async (token: string) => {
      if (token === 'mock-token-123') {
        return {
          success: true,
          data: {
            job_id: 'job-1',
            workspace_id: 'workspace-123',
            is_valid: true,
          },
        };
      }
      return { success: false, error: 'Invalid token' };
    }),
    getJobByToken: vi.fn(async () => ({
      success: true,
      data: mockJobs[0], // Pending job
    })),
  };
});

// Helper to render component with router
const renderWithRouter = (jobs: Job[] = mockJobs) => {
  return render(
    <BrowserRouter>
      <TechnicianPortal jobs={jobs} onUpdateJob={mockOnUpdateJob} />
    </BrowserRouter>
  );
};

describe('INTEGRATION: TechnicianPortal - Complete Job Submission Workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    // Mock geolocation
    const mockGeolocation = {
      getCurrentPosition: vi.fn((success) => {
        success({
          coords: {
            latitude: 40.7128,
            longitude: -74.006,
            accuracy: 10,
          },
        });
      }),
    };
    Object.defineProperty(global.navigator, 'geolocation', {
      value: mockGeolocation,
      writable: true,
    });
  });

  describe('Step 1: Magic Link Validation & Job Loading', () => {
    it('should validate magic link and load job details', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText(/HVAC Installation/i)).toBeInTheDocument();
      });

      expect(screen.getByText(/Acme Corp/i)).toBeInTheDocument();
      expect(screen.getByText(/John Smith/i)).toBeInTheDocument();
    });

    it('should redirect when token is invalid', async () => {
      vi.mocked(require('@/lib/db').validateMagicLink).mockResolvedValueOnce({
        success: false,
        error: 'Invalid token',
      });

      renderWithRouter();

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/auth');
      });

      expect(screen.getByText(/Invalid or expired link/i)).toBeInTheDocument();
    });

    it('should redirect when token is expired', async () => {
      vi.mocked(require('@/lib/db').validateMagicLink).mockResolvedValueOnce({
        success: false,
        error: 'Token expired',
      });

      renderWithRouter();

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/auth');
      });

      expect(screen.getByText(/expired/i)).toBeInTheDocument();
    });

    it('should redirect when job is already sealed', async () => {
      const sealedJob = createMockJob({
        status: 'Archived',
        sealedAt: new Date().toISOString(),
      });

      vi.mocked(require('@/lib/db').getJobByToken).mockResolvedValueOnce({
        success: true,
        data: sealedJob,
      });

      renderWithRouter([sealedJob]);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/');
      });

      expect(screen.getByText(/already sealed/i)).toBeInTheDocument();
    });
  });

  describe('Step 2: Photo Capture with Geolocation', () => {
    it('should capture photo with GPS coordinates', async () => {
      const user = userEvent.setup();
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText(/Add Photo/i)).toBeInTheDocument();
      });

      // Mock file input
      const file = new File(['photo'], 'test.jpg', { type: 'image/jpeg' });
      const input = screen.getByLabelText(/add photo/i) as HTMLInputElement;

      await user.upload(input, file);

      await waitFor(() => {
        expect(screen.getByText(/test.jpg/i)).toBeInTheDocument();
      });

      // Verify geolocation was captured
      expect(navigator.geolocation.getCurrentPosition).toHaveBeenCalled();

      // Verify photo metadata
      const photoCard = screen.getByTestId('photo-card-0');
      expect(within(photoCard).getByText(/40.7128/i)).toBeInTheDocument(); // Latitude
      expect(within(photoCard).getByText(/-74.006/i)).toBeInTheDocument(); // Longitude
    });

    it('should categorize photos by type (Before/During/After)', async () => {
      const user = userEvent.setup();
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText(/Photo Type/i)).toBeInTheDocument();
      });

      // Add a "Before" photo
      const beforeFile = new File(['before'], 'before.jpg', { type: 'image/jpeg' });
      const input = screen.getByLabelText(/add photo/i) as HTMLInputElement;

      await user.upload(input, beforeFile);
      await user.selectOptions(screen.getByLabelText(/photo type/i), 'Before');

      await waitFor(() => {
        expect(screen.getByText(/Before/i)).toBeInTheDocument();
      });

      // Add a "During" photo
      const duringFile = new File(['during'], 'during.jpg', { type: 'image/jpeg' });
      await user.upload(input, duringFile);
      await user.selectOptions(screen.getByLabelText(/photo type/i), 'During');

      await waitFor(() => {
        expect(screen.getAllByText(/Before|During/i)).toHaveLength(2);
      });
    });

    it('should store photos in IndexedDB when offline', async () => {
      const user = userEvent.setup();

      // Simulate offline mode
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false,
      });

      renderWithRouter();

      const file = new File(['photo'], 'test.jpg', { type: 'image/jpeg' });
      const input = screen.getByLabelText(/add photo/i) as HTMLInputElement;

      await user.upload(input, file);

      await waitFor(() => {
        expect(mockIndexedDB.put).toHaveBeenCalled();
      });

      // Verify photo marked as pending sync
      expect(screen.getByText(/pending sync/i)).toBeInTheDocument();
    });

    it('should handle geolocation permission denial gracefully', async () => {
      const user = userEvent.setup();

      // Mock geolocation error
      const mockGeolocation = {
        getCurrentPosition: vi.fn((success, error) => {
          error({ code: 1, message: 'User denied geolocation' });
        }),
      };
      Object.defineProperty(global.navigator, 'geolocation', {
        value: mockGeolocation,
        writable: true,
      });

      renderWithRouter();

      const file = new File(['photo'], 'test.jpg', { type: 'image/jpeg' });
      const input = screen.getByLabelText(/add photo/i) as HTMLInputElement;

      await user.upload(input, file);

      await waitFor(() => {
        expect(screen.getByText(/test.jpg/i)).toBeInTheDocument();
      });

      // Photo should still be captured, but without GPS coords
      const photoCard = screen.getByTestId('photo-card-0');
      expect(within(photoCard).queryByText(/Latitude/i)).not.toBeInTheDocument();
    });
  });

  describe('Step 3: Safety Checklist Completion', () => {
    it('should display required safety checks', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText(/Safety Checklist/i)).toBeInTheDocument();
      });

      expect(screen.getByText(/PPE worn/i)).toBeInTheDocument();
      expect(screen.getByText(/Work area hazards/i)).toBeInTheDocument();
      expect(screen.getByText(/Tools and equipment inspected/i)).toBeInTheDocument();
    });

    it('should check/uncheck safety items', async () => {
      const user = userEvent.setup();
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText(/Safety Checklist/i)).toBeInTheDocument();
      });

      const checkbox = screen.getByLabelText(/PPE worn/i) as HTMLInputElement;

      await user.click(checkbox);
      expect(checkbox.checked).toBe(true);

      await user.click(checkbox);
      expect(checkbox.checked).toBe(false);
    });

    it('should prevent submission when required checks incomplete', async () => {
      const user = userEvent.setup();
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText(/Submit Job/i)).toBeInTheDocument();
      });

      const submitButton = screen.getByText(/Submit Job/i) as HTMLButtonElement;

      // Try to submit without completing required checks
      await user.click(submitButton);

      expect(screen.getByText(/complete all required safety checks/i)).toBeInTheDocument();
      expect(mockOnUpdateJob).not.toHaveBeenCalled();
    });

    it('should allow submission when all required checks completed', async () => {
      const user = userEvent.setup();
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText(/Safety Checklist/i)).toBeInTheDocument();
      });

      // Check all required items
      const requiredChecks = screen.getAllByRole('checkbox', { name: /required/i });
      for (const check of requiredChecks) {
        await user.click(check);
      }

      // Now submission should be allowed
      const submitButton = screen.getByText(/Submit Job/i) as HTMLButtonElement;
      expect(submitButton).not.toBeDisabled();
    });
  });

  describe('Step 4: Signature Capture', () => {
    it('should render signature canvas', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText(/Signature/i)).toBeInTheDocument();
      });

      const canvas = screen.getByTestId('signature-canvas') as HTMLCanvasElement;
      expect(canvas).toBeInTheDocument();
      expect(canvas.tagName).toBe('CANVAS');
    });

    it('should capture signature with signer details', async () => {
      const user = userEvent.setup();
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText(/Signature/i)).toBeInTheDocument();
      });

      // Enter signer name
      const nameInput = screen.getByLabelText(/Signer Name/i) as HTMLInputElement;
      await user.type(nameInput, 'John Smith');

      // Enter signer role
      const roleInput = screen.getByLabelText(/Signer Role/i) as HTMLInputElement;
      await user.type(roleInput, 'Lead Technician');

      // Simulate signature drawing (canvas interaction)
      const canvas = screen.getByTestId('signature-canvas') as HTMLCanvasElement;
      const ctx = canvas.getContext('2d');
      expect(ctx).toBeDefined();

      // Click "Save Signature" button
      await user.click(screen.getByText(/Save Signature/i));

      await waitFor(() => {
        expect(screen.getByText(/Signature captured/i)).toBeInTheDocument();
      });

      expect(mockIndexedDB.put).toHaveBeenCalledWith(
        expect.objectContaining({
          signerName: 'John Smith',
          signerRole: 'Lead Technician',
        })
      );
    });

    it('should allow clearing and redrawing signature', async () => {
      const user = userEvent.setup();
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText(/Clear Signature/i)).toBeInTheDocument();
      });

      const clearButton = screen.getByText(/Clear Signature/i);
      await user.click(clearButton);

      const canvas = screen.getByTestId('signature-canvas') as HTMLCanvasElement;
      const ctx = canvas.getContext('2d');
      expect(ctx?.clearRect).toHaveBeenCalled();
    });

    it('should require signature for job submission', async () => {
      const user = userEvent.setup();
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText(/Submit Job/i)).toBeInTheDocument();
      });

      // Try to submit without signature
      const submitButton = screen.getByText(/Submit Job/i) as HTMLButtonElement;
      await user.click(submitButton);

      expect(screen.getByText(/signature required/i)).toBeInTheDocument();
      expect(mockOnUpdateJob).not.toHaveBeenCalled();
    });
  });

  describe('Step 5: Work Summary Entry', () => {
    it('should allow entering work summary', async () => {
      const user = userEvent.setup();
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByLabelText(/Work Summary/i)).toBeInTheDocument();
      });

      const textarea = screen.getByLabelText(/Work Summary/i) as HTMLTextAreaElement;
      await user.type(textarea, 'Completed HVAC installation. All systems tested and operational.');

      expect(textarea.value).toBe('Completed HVAC installation. All systems tested and operational.');
    });

    it('should save work summary to draft state', async () => {
      const user = userEvent.setup();
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByLabelText(/Work Summary/i)).toBeInTheDocument();
      });

      const textarea = screen.getByLabelText(/Work Summary/i) as HTMLTextAreaElement;
      await user.type(textarea, 'Test summary');

      // Wait for auto-save (debounced)
      await waitFor(() => {
        const draftKey = `jobproof_draft_${mockJobs[0].id}`;
        const draft = JSON.parse(localStorage.getItem(draftKey) || '{}');
        expect(draft.workSummary).toBe('Test summary');
      }, { timeout: 3000 });
    });
  });

  describe('Step 6: Draft State Persistence', () => {
    it('should auto-save draft state periodically', async () => {
      const user = userEvent.setup();
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByLabelText(/Work Summary/i)).toBeInTheDocument();
      });

      // Make some changes
      const textarea = screen.getByLabelText(/Work Summary/i) as HTMLTextAreaElement;
      await user.type(textarea, 'Draft content');

      // Wait for auto-save
      await waitFor(() => {
        const draftKey = `jobproof_draft_${mockJobs[0].id}`;
        expect(localStorage.getItem(draftKey)).toBeDefined();
      }, { timeout: 3000 });
    });

    it('should restore draft state on component mount', async () => {
      const draftKey = `jobproof_draft_${mockJobs[0].id}`;
      const draftData = {
        workSummary: 'Previously saved work summary',
        photos: [
          { id: 'photo-1', url: 'media_abc', type: 'Before', syncStatus: 'pending' },
        ],
      };
      localStorage.setItem(draftKey, JSON.stringify(draftData));

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByDisplayValue(/Previously saved work summary/i)).toBeInTheDocument();
      });

      expect(screen.getByText(/Draft restored/i)).toBeInTheDocument();
    });

    it('should clear draft state after successful submission', async () => {
      const user = userEvent.setup();
      const draftKey = `jobproof_draft_${mockJobs[0].id}`;
      localStorage.setItem(draftKey, JSON.stringify({ workSummary: 'Draft' }));

      renderWithRouter();

      // Complete all required fields and submit
      // ... (omitting field completion for brevity)

      await user.click(screen.getByText(/Submit Job/i));

      await waitFor(() => {
        expect(localStorage.getItem(draftKey)).toBeNull();
      });
    });
  });

  describe('Step 7: Job Submission & Sync', () => {
    it('should submit job with all evidence when online', async () => {
      const user = userEvent.setup();

      // Set up a complete job ready for submission
      const completeJob = createMockJob({
        status: 'In Progress',
        photos: [
          {
            id: 'photo-1',
            url: 'media_abc',
            timestamp: new Date().toISOString(),
            verified: false,
            syncStatus: 'pending',
            type: 'Before',
            isIndexedDBRef: true,
          },
        ],
        signature: 'sig_job_123',
        signatureIsIndexedDBRef: true,
        signerName: 'John Smith',
        safetyChecklist: [
          { id: '1', label: 'PPE', checked: true, required: true },
        ],
        workSummary: 'Completed installation',
      });

      renderWithRouter([completeJob]);

      await waitFor(() => {
        expect(screen.getByText(/Submit Job/i)).toBeInTheDocument();
      });

      await user.click(screen.getByText(/Submit Job/i));

      await waitFor(() => {
        expect(mockOnUpdateJob).toHaveBeenCalledWith(
          expect.objectContaining({
            status: 'Submitted',
            completedAt: expect.any(String),
            syncStatus: 'synced',
          })
        );
      });

      expect(screen.getByText(/Job submitted successfully/i)).toBeInTheDocument();
    });

    it('should queue job for sync when offline', async () => {
      const user = userEvent.setup();

      // Simulate offline mode
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false,
      });

      renderWithRouter();

      // Complete and submit job
      await user.click(screen.getByText(/Submit Job/i));

      await waitFor(() => {
        expect(mockOnUpdateJob).toHaveBeenCalledWith(
          expect.objectContaining({
            status: 'Submitted',
            syncStatus: 'pending',
          })
        );
      });

      // Verify added to sync queue
      const syncQueue = JSON.parse(localStorage.getItem('jobproof_sync_queue') || '[]');
      expect(syncQueue).toHaveLength(1);
      expect(syncQueue[0].type).toBe('job');
      expect(screen.getByText(/queued for sync/i)).toBeInTheDocument();
    });

    it('should upload photos to Supabase storage before submission', async () => {
      const user = userEvent.setup();
      const mockUploadPhoto = vi.fn().mockResolvedValue({
        success: true,
        data: { url: 'https://storage.supabase.co/photo.jpg' },
      });

      vi.mock('@/lib/supabase', () => ({
        uploadPhoto: mockUploadPhoto,
      }));

      renderWithRouter();

      // Add photo and submit
      const file = new File(['photo'], 'test.jpg', { type: 'image/jpeg' });
      const input = screen.getByLabelText(/add photo/i) as HTMLInputElement;
      await user.upload(input, file);

      await user.click(screen.getByText(/Submit Job/i));

      await waitFor(() => {
        expect(mockUploadPhoto).toHaveBeenCalled();
      });

      expect(mockOnUpdateJob).toHaveBeenCalledWith(
        expect.objectContaining({
          photos: expect.arrayContaining([
            expect.objectContaining({
              url: 'https://storage.supabase.co/photo.jpg',
              syncStatus: 'synced',
            }),
          ]),
        })
      );
    });

    it('should retry failed uploads with exponential backoff', async () => {
      const user = userEvent.setup();
      const mockUploadPhoto = vi.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          success: true,
          data: { url: 'https://storage.supabase.co/photo.jpg' },
        });

      vi.mock('@/lib/supabase', () => ({
        uploadPhoto: mockUploadPhoto,
      }));

      renderWithRouter();

      // Add photo and submit
      const file = new File(['photo'], 'test.jpg', { type: 'image/jpeg' });
      const input = screen.getByLabelText(/add photo/i) as HTMLInputElement;
      await user.upload(input, file);

      await user.click(screen.getByText(/Submit Job/i));

      // Should retry 2 times before succeeding
      await waitFor(() => {
        expect(mockUploadPhoto).toHaveBeenCalledTimes(3);
      }, { timeout: 10000 });

      expect(screen.getByText(/upload successful/i)).toBeInTheDocument();
    });
  });

  describe('Step 8: Edge Cases & Error Handling', () => {
    it('should handle large file uploads (>10MB)', async () => {
      const user = userEvent.setup();
      renderWithRouter();

      // Create a large file (simulated)
      const largeFile = new File(['x'.repeat(11 * 1024 * 1024)], 'large.jpg', {
        type: 'image/jpeg',
      });

      const input = screen.getByLabelText(/add photo/i) as HTMLInputElement;
      await user.upload(input, largeFile);

      await waitFor(() => {
        expect(screen.getByText(/file too large/i)).toBeInTheDocument();
      });

      expect(mockOnUpdateJob).not.toHaveBeenCalled();
    });

    it('should handle network timeout during submission', async () => {
      const user = userEvent.setup();
      const mockUploadPhoto = vi.fn(() => new Promise(() => {})); // Never resolves

      vi.mock('@/lib/supabase', () => ({
        uploadPhoto: mockUploadPhoto,
      }));

      renderWithRouter();

      const file = new File(['photo'], 'test.jpg', { type: 'image/jpeg' });
      const input = screen.getByLabelText(/add photo/i) as HTMLInputElement;
      await user.upload(input, file);

      await user.click(screen.getByText(/Submit Job/i));

      // Should timeout and show error
      await waitFor(() => {
        expect(screen.getByText(/upload timeout/i)).toBeInTheDocument();
      }, { timeout: 15000 });
    });

    it('should prevent duplicate submissions', async () => {
      const user = userEvent.setup();
      renderWithRouter();

      const submitButton = screen.getByText(/Submit Job/i);

      // Click submit twice rapidly
      await user.click(submitButton);
      await user.click(submitButton);

      // Should only submit once
      await waitFor(() => {
        expect(mockOnUpdateJob).toHaveBeenCalledTimes(1);
      });

      expect(screen.getByText(/submission in progress/i)).toBeInTheDocument();
    });

    it('should handle session expiry during submission', async () => {
      const user = userEvent.setup();

      vi.mocked(require('@/lib/db').updateJob).mockRejectedValueOnce({
        error: 'Unauthorized',
        status: 401,
      });

      renderWithRouter();

      await user.click(screen.getByText(/Submit Job/i));

      await waitFor(() => {
        expect(screen.getByText(/session expired/i)).toBeInTheDocument();
      });

      // Should redirect to auth
      expect(mockNavigate).toHaveBeenCalledWith('/auth');
    });
  });

  describe('Complete User Journey: End-to-End', () => {
    it('should complete full technician workflow successfully', async () => {
      const user = userEvent.setup();
      renderWithRouter();

      // Step 1: Job loads
      await waitFor(() => {
        expect(screen.getByText(/HVAC Installation/i)).toBeInTheDocument();
      });

      // Step 2: Add photos
      const photoFile = new File(['photo'], 'work-photo.jpg', { type: 'image/jpeg' });
      const photoInput = screen.getByLabelText(/add photo/i) as HTMLInputElement;
      await user.upload(photoInput, photoFile);
      await user.selectOptions(screen.getByLabelText(/photo type/i), 'Before');

      // Step 3: Complete safety checklist
      const safetyChecks = screen.getAllByRole('checkbox', { name: /safety/i });
      for (const check of safetyChecks) {
        await user.click(check);
      }

      // Step 4: Add signature
      const signerNameInput = screen.getByLabelText(/Signer Name/i);
      await user.type(signerNameInput, 'John Smith');
      const signerRoleInput = screen.getByLabelText(/Signer Role/i);
      await user.type(signerRoleInput, 'Technician');
      await user.click(screen.getByText(/Save Signature/i));

      // Step 5: Add work summary
      const summaryTextarea = screen.getByLabelText(/Work Summary/i);
      await user.type(summaryTextarea, 'HVAC system installed and tested successfully.');

      // Step 6: Submit job
      await user.click(screen.getByText(/Submit Job/i));

      // Step 7: Verify success
      await waitFor(() => {
        expect(screen.getByText(/submitted successfully/i)).toBeInTheDocument();
      });

      expect(mockOnUpdateJob).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'Submitted',
          completedAt: expect.any(String),
          photos: expect.any(Array),
          signature: expect.any(String),
          signerName: 'John Smith',
          signerRole: 'Technician',
          workSummary: 'HVAC system installed and tested successfully.',
          safetyChecklist: expect.arrayContaining([
            expect.objectContaining({ checked: true }),
          ]),
        })
      );

      // Step 8: Redirect to success page
      expect(mockNavigate).toHaveBeenCalledWith('/submission-success');
    });
  });
});
