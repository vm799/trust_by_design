// =====================================================================
// SUPABASE EDGE FUNCTION: REST API v1
// =====================================================================
// Purpose: Public REST API for third-party integrations
// Auth: API key (jp_ prefix) with workspace-scoped RLS
// Endpoints: /api/v1/{jobs,clients,technicians,invoices,photos,webhooks}
// =====================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// =====================================================================
// TYPES
// =====================================================================

interface ApiKey {
  id: string
  workspace_id: string
  key_hash: string
  name: string
  scopes: string[]
  rate_limit: number
  is_active: boolean
  expires_at: string | null
}

interface ApiResponse<T = unknown> {
  data?: T
  meta?: {
    page: number
    per_page: number
    total: number
    timestamp: string
  }
  error?: {
    status: number
    code: string
    message: string
  }
}

// =====================================================================
// CONSTANTS
// =====================================================================

const SUPPORTED_RESOURCES = ['jobs', 'clients', 'technicians', 'invoices', 'photos', 'webhooks'] as const
type ApiResource = typeof SUPPORTED_RESOURCES[number]

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-API-Key',
  'Access-Control-Max-Age': '86400',
  'Content-Type': 'application/json',
}

// =====================================================================
// HELPERS
// =====================================================================

function parseRoute(url: string): { resource: string; id: string | null; valid: boolean } {
  try {
    const pathname = new URL(url).pathname
    // Edge function path: /api-v1/{resource}/{id?}
    const match = pathname.match(/^\/api-v1\/([a-z_]+)(?:\/([a-zA-Z0-9_-]+))?$/)
    if (!match) return { resource: '', id: null, valid: false }
    return { resource: match[1], id: match[2] || null, valid: true }
  } catch {
    return { resource: '', id: null, valid: false }
  }
}

function isValidResource(resource: string): resource is ApiResource {
  return (SUPPORTED_RESOURCES as readonly string[]).includes(resource)
}

function methodToOperation(method: string): 'read' | 'write' | 'delete' {
  switch (method.toUpperCase()) {
    case 'GET': return 'read'
    case 'POST': return 'write'
    case 'PUT': return 'write'
    case 'PATCH': return 'write'
    case 'DELETE': return 'delete'
    default: return 'read'
  }
}

function hasScope(scopes: string[], resource: string, operation: string): boolean {
  const scope = `${resource}:${operation}`
  const wildcard = `${resource}:*`
  const globalWildcard = '*:*'
  return scopes.includes(scope) || scopes.includes(wildcard) || scopes.includes(globalWildcard)
}

function respond(body: ApiResponse, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: CORS_HEADERS })
}

function errorResponse(status: number, code: string, message: string): Response {
  return respond({ error: { status, code, message } }, status)
}

// Simple SHA-256 hash for API key verification
async function sha256(message: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(message)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

// =====================================================================
// MAIN HANDLER
// =====================================================================

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  // Validate environment
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !supabaseServiceKey) {
    return errorResponse(500, 'SERVER_ERROR', 'Server configuration error')
  }

  // Extract API key from header
  const apiKey = req.headers.get('X-API-Key') || req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!apiKey) {
    return errorResponse(401, 'UNAUTHORIZED', 'Missing API key. Provide X-API-Key header or Bearer token.')
  }

  // Validate API key format
  if (!apiKey.startsWith('jp_') || apiKey.length < 40) {
    return errorResponse(401, 'INVALID_KEY', 'Invalid API key format. Keys must start with jp_ prefix.')
  }

  // Parse route
  const route = parseRoute(req.url)
  if (!route.valid) {
    return errorResponse(404, 'NOT_FOUND', 'Invalid API path. Use /api-v1/{resource}/{id?}')
  }

  if (!isValidResource(route.resource)) {
    return errorResponse(404, 'INVALID_RESOURCE', `Resource '${route.resource}' not found. Available: ${SUPPORTED_RESOURCES.join(', ')}`)
  }

  // Initialize Supabase client with service role (RLS bypassed, we enforce workspace isolation manually)
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // Look up API key
  const keyHash = await sha256(apiKey)
  const { data: keyData, error: keyError } = await supabase
    .from('api_keys')
    .select('*')
    .eq('key_hash', keyHash)
    .eq('is_active', true)
    .single()

  if (keyError || !keyData) {
    return errorResponse(401, 'INVALID_KEY', 'API key not found or inactive')
  }

  const apiKeyRecord = keyData as ApiKey

  // Check key expiration
  if (apiKeyRecord.expires_at && new Date(apiKeyRecord.expires_at) < new Date()) {
    return errorResponse(401, 'KEY_EXPIRED', 'API key has expired')
  }

  // Check scope
  const operation = methodToOperation(req.method)
  if (!hasScope(apiKeyRecord.scopes, route.resource, operation)) {
    return errorResponse(403, 'INSUFFICIENT_SCOPE', `API key lacks ${route.resource}:${operation} scope`)
  }

  // Update last_used_at
  await supabase
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', apiKeyRecord.id)

  // Route to resource handler
  const workspaceId = apiKeyRecord.workspace_id

  try {
    switch (req.method.toUpperCase()) {
      case 'GET':
        return await handleGet(supabase, route.resource, route.id, workspaceId, req)

      case 'POST':
        return await handlePost(supabase, route.resource, workspaceId, req)

      case 'PUT':
      case 'PATCH':
        if (!route.id) {
          return errorResponse(400, 'MISSING_ID', 'Resource ID required for update operations')
        }
        return await handleUpdate(supabase, route.resource, route.id, workspaceId, req)

      case 'DELETE':
        if (!route.id) {
          return errorResponse(400, 'MISSING_ID', 'Resource ID required for delete operations')
        }
        return await handleDelete(supabase, route.resource, route.id, workspaceId)

      default:
        return errorResponse(405, 'METHOD_NOT_ALLOWED', `Method ${req.method} not allowed`)
    }
  } catch (err) {
    console.error(`API v1 error [${route.resource}]:`, err)
    return errorResponse(500, 'INTERNAL_ERROR', 'Internal server error')
  }
})

// =====================================================================
// RESOURCE HANDLERS
// =====================================================================

async function handleGet(
  supabase: any,
  resource: string,
  id: string | null,
  workspaceId: string,
  req: Request
): Promise<Response> {
  const url = new URL(req.url)
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'))
  const perPage = Math.min(100, Math.max(1, parseInt(url.searchParams.get('per_page') || '25')))
  const offset = (page - 1) * perPage

  const table = resourceToTable(resource)

  if (id) {
    // Single resource
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .single()

    if (error || !data) {
      return errorResponse(404, 'NOT_FOUND', `${resource} with id '${id}' not found`)
    }

    return respond({
      data,
      meta: { page: 1, per_page: 1, total: 1, timestamp: new Date().toISOString() },
    }, 200)
  }

  // Collection with pagination
  const { count } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)

  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .range(offset, offset + perPage - 1)

  if (error) {
    return errorResponse(500, 'QUERY_ERROR', 'Failed to fetch resources')
  }

  return respond({
    data: data || [],
    meta: { page, per_page: perPage, total: count || 0, timestamp: new Date().toISOString() },
  }, 200)
}

async function handlePost(
  supabase: any,
  resource: string,
  workspaceId: string,
  req: Request
): Promise<Response> {
  let body: Record<string, any>
  try {
    body = await req.json()
  } catch {
    return errorResponse(400, 'INVALID_BODY', 'Request body must be valid JSON')
  }

  const table = resourceToTable(resource)

  // Add workspace_id to the record
  const record = { ...body, workspace_id: workspaceId }

  const { data, error } = await supabase
    .from(table)
    .insert(record)
    .select()
    .single()

  if (error) {
    return errorResponse(422, 'CREATE_ERROR', `Failed to create ${resource}: ${error.message}`)
  }

  return respond({
    data,
    meta: { page: 1, per_page: 1, total: 1, timestamp: new Date().toISOString() },
  }, 201)
}

async function handleUpdate(
  supabase: any,
  resource: string,
  id: string,
  workspaceId: string,
  req: Request
): Promise<Response> {
  let body: Record<string, any>
  try {
    body = await req.json()
  } catch {
    return errorResponse(400, 'INVALID_BODY', 'Request body must be valid JSON')
  }

  const table = resourceToTable(resource)

  // Prevent workspace_id modification
  delete body.workspace_id
  delete body.id

  const { data, error } = await supabase
    .from(table)
    .update(body)
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .select()
    .single()

  if (error) {
    return errorResponse(422, 'UPDATE_ERROR', `Failed to update ${resource}: ${error.message}`)
  }

  if (!data) {
    return errorResponse(404, 'NOT_FOUND', `${resource} with id '${id}' not found`)
  }

  return respond({
    data,
    meta: { page: 1, per_page: 1, total: 1, timestamp: new Date().toISOString() },
  }, 200)
}

async function handleDelete(
  supabase: any,
  resource: string,
  id: string,
  workspaceId: string
): Promise<Response> {
  const table = resourceToTable(resource)

  // Check for sealed/invoiced jobs (cannot delete)
  if (resource === 'jobs') {
    const { data: job } = await supabase
      .from(table)
      .select('sealed_at, invoice_id')
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .single()

    if (job?.sealed_at) {
      return errorResponse(409, 'SEALED_JOB', 'Cannot delete sealed jobs. Evidence has been cryptographically preserved.')
    }
    if (job?.invoice_id) {
      return errorResponse(409, 'INVOICED_JOB', 'Cannot delete invoiced jobs. Delete the invoice first.')
    }
  }

  const { error } = await supabase
    .from(table)
    .delete()
    .eq('id', id)
    .eq('workspace_id', workspaceId)

  if (error) {
    return errorResponse(422, 'DELETE_ERROR', `Failed to delete ${resource}: ${error.message}`)
  }

  return respond({ data: { id, deleted: true } }, 200)
}

// =====================================================================
// UTILS
// =====================================================================

function resourceToTable(resource: string): string {
  const mapping: Record<string, string> = {
    jobs: 'jobs',
    clients: 'clients',
    technicians: 'technicians',
    invoices: 'invoices',
    photos: 'photos',
    webhooks: 'webhook_endpoints',
  }
  return mapping[resource] || resource
}
