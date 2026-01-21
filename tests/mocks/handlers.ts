import { http, HttpResponse } from 'msw';
import { mockJobs, mockClients, mockTechnicians, mockUser } from './mockData';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://test.supabase.co';

export const handlers = [
  // Auth endpoints
  http.post(`${SUPABASE_URL}/auth/v1/signup`, async ({ request }) => {
    const body = await request.json() as any;
    return HttpResponse.json({
      user: {
        id: 'user-123',
        email: body.email,
        created_at: new Date().toISOString(),
      },
      session: {
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token',
      },
    });
  }),

  http.post(`${SUPABASE_URL}/auth/v1/token`, async ({ request }) => {
    const params = new URLSearchParams(await request.text());
    const grantType = params.get('grant_type');

    if (grantType === 'password') {
      return HttpResponse.json({
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token',
        user: mockUser,
      });
    }

    return HttpResponse.json(
      { error: 'invalid_grant' },
      { status: 401 }
    );
  }),

  http.post(`${SUPABASE_URL}/auth/v1/signout`, () => {
    return HttpResponse.json({}, { status: 204 });
  }),

  // Jobs endpoint
  http.get(`${SUPABASE_URL}/rest/v1/jobs`, ({ request }) => {
    const url = new URL(request.url);
    const workspaceId = url.searchParams.get('workspace_id');

    if (!workspaceId) {
      return HttpResponse.json(
        { message: 'workspace_id required' },
        { status: 400 }
      );
    }

    return HttpResponse.json(mockJobs);
  }),

  http.post(`${SUPABASE_URL}/rest/v1/jobs`, async ({ request }) => {
    const body = await request.json() as any;
    const newJob = {
      ...body,
      id: `job-${Date.now()}`,
      created_at: new Date().toISOString(),
    };

    return HttpResponse.json(newJob, { status: 201 });
  }),

  http.patch(`${SUPABASE_URL}/rest/v1/jobs`, async ({ request }) => {
    const url = new URL(request.url);
    const jobId = url.searchParams.get('id');
    const body = await request.json() as any;

    if (!jobId) {
      return HttpResponse.json(
        { message: 'job id required' },
        { status: 400 }
      );
    }

    // Simulate sealed job protection
    const job = mockJobs.find((j) => j.id === jobId);
    if (job?.sealedAt) {
      return HttpResponse.json(
        { message: 'Cannot modify sealed job' },
        { status: 403 }
      );
    }

    return HttpResponse.json({ ...job, ...body });
  }),

  http.delete(`${SUPABASE_URL}/rest/v1/jobs`, ({ request }) => {
    const url = new URL(request.url);
    const jobId = url.searchParams.get('id');

    if (!jobId) {
      return HttpResponse.json(
        { message: 'job id required' },
        { status: 400 }
      );
    }

    return HttpResponse.json({}, { status: 204 });
  }),

  // Clients endpoint
  http.get(`${SUPABASE_URL}/rest/v1/clients`, () => {
    return HttpResponse.json(mockClients);
  }),

  http.post(`${SUPABASE_URL}/rest/v1/clients`, async ({ request }) => {
    const body = await request.json() as any;
    return HttpResponse.json({
      ...body,
      id: `client-${Date.now()}`,
      created_at: new Date().toISOString(),
    }, { status: 201 });
  }),

  // Technicians endpoint
  http.get(`${SUPABASE_URL}/rest/v1/technicians`, () => {
    return HttpResponse.json(mockTechnicians);
  }),

  http.post(`${SUPABASE_URL}/rest/v1/technicians`, async ({ request }) => {
    const body = await request.json() as any;
    return HttpResponse.json({
      ...body,
      id: `tech-${Date.now()}`,
      created_at: new Date().toISOString(),
    }, { status: 201 });
  }),

  // RPC endpoints
  http.post(`${SUPABASE_URL}/rest/v1/rpc/generate_job_access_token`, async ({ request }) => {
    const body = await request.json() as any;
    return HttpResponse.json({
      token: 'mock-token-123',
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });
  }),

  http.post(`${SUPABASE_URL}/rest/v1/rpc/validate_job_access_token`, async ({ request }) => {
    const body = await request.json() as any;
    const token = body.p_token;

    if (token === 'expired-token') {
      return HttpResponse.json(
        { message: 'Token expired' },
        { status: 401 }
      );
    }

    if (token === 'invalid-token') {
      return HttpResponse.json(
        { message: 'Invalid token' },
        { status: 404 }
      );
    }

    return HttpResponse.json({
      job_id: 'job-123',
      workspace_id: 'workspace-123',
      is_valid: true,
    });
  }),

  // Storage upload endpoint
  http.post(`${SUPABASE_URL}/storage/v1/object/job-photos/*`, () => {
    return HttpResponse.json({
      Key: 'job-photos/mock-photo.jpg',
      Bucket: 'job-photos',
    });
  }),

  http.post(`${SUPABASE_URL}/storage/v1/object/job-signatures/*`, () => {
    return HttpResponse.json({
      Key: 'job-signatures/mock-signature.png',
      Bucket: 'job-signatures',
    });
  }),

  // Edge Functions
  http.post(`${SUPABASE_URL}/functions/v1/seal-evidence`, async ({ request }) => {
    const body = await request.json() as any;
    const jobId = body.jobId;

    return HttpResponse.json({
      success: true,
      data: {
        evidenceHash: 'mock-sha256-hash',
        signature: 'mock-rsa-signature',
        sealedAt: new Date().toISOString(),
      },
    });
  }),

  http.post(`${SUPABASE_URL}/functions/v1/verify-evidence`, async ({ request }) => {
    const body = await request.json() as any;
    const jobId = body.jobId;

    return HttpResponse.json({
      success: true,
      data: {
        isValid: true,
        message: 'Evidence integrity verified',
        evidenceHash: 'mock-sha256-hash',
        sealedAt: '2024-01-15T10:30:00Z',
      },
    });
  }),

  // Network error simulation handlers (for testing error states)
  http.get(`${SUPABASE_URL}/rest/v1/jobs-network-error`, () => {
    return HttpResponse.error();
  }),

  http.post(`${SUPABASE_URL}/rest/v1/jobs-timeout`, () => {
    return new Promise(() => {
      // Never resolves - simulates timeout
    });
  }),

  http.post(`${SUPABASE_URL}/rest/v1/jobs-500`, () => {
    return HttpResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }),
];

// Specialized handlers for edge case testing
export const errorHandlers = {
  networkError: [
    http.post(`${SUPABASE_URL}/rest/v1/jobs`, () => HttpResponse.error()),
  ],
  serverError: [
    http.post(`${SUPABASE_URL}/rest/v1/jobs`, () =>
      HttpResponse.json({ error: 'Internal server error' }, { status: 500 })
    ),
  ],
  unauthorized: [
    http.get(`${SUPABASE_URL}/rest/v1/jobs`, () =>
      HttpResponse.json({ error: 'Unauthorized' }, { status: 401 })
    ),
  ],
  rateLimited: [
    http.post(`${SUPABASE_URL}/rest/v1/jobs`, () =>
      HttpResponse.json({ error: 'Too many requests' }, { status: 429 })
    ),
  ],
};
