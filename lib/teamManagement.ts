/**
 * Team Management
 *
 * Workspace team member management with invitation workflows.
 * Supports:
 * - Role-based access control (admin, manager, member, technician, view_only)
 * - Email-based invitations with 7-day expiry
 * - Invitation acceptance/revocation
 * - Role hierarchy enforcement
 * - Workspace isolation via RLS
 */

import { getSupabase, isSupabaseAvailable } from './supabase';

// ============================================================================
// TYPES
// ============================================================================

export type TeamRole = 'admin' | 'manager' | 'member' | 'technician' | 'view_only';

export interface WorkspaceInvitation {
  id: string;
  workspace_id: string;
  email: string;
  role: TeamRole;
  invited_by: string;
  token: string;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
}

export interface TeamMember {
  id: string;
  email: string;
  full_name: string | null;
  role: TeamRole;
  joined_at: string;
  last_active_at: string | null;
}

export interface InviteRequest {
  email: string;
  role: TeamRole;
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const VALID_ROLES: TeamRole[] = ['admin', 'manager', 'member', 'technician', 'view_only'];

export const ROLE_HIERARCHY: Record<TeamRole, number> = {
  admin: 4,
  manager: 3,
  member: 2,
  technician: 1,
  view_only: 0,
};

const MAX_INVITATIONS_PER_WORKSPACE = 50;
const INVITATION_EXPIRY_DAYS = 7;

// ============================================================================
// VALIDATION
// ============================================================================

export function isValidRole(role: string): role is TeamRole {
  return VALID_ROLES.includes(role as TeamRole);
}

export function canManageRole(actorRole: TeamRole, targetRole: TeamRole): boolean {
  return ROLE_HIERARCHY[actorRole] > ROLE_HIERARCHY[targetRole];
}

export function canInvite(actorRole: TeamRole): boolean {
  return ROLE_HIERARCHY[actorRole] >= ROLE_HIERARCHY['manager'];
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isInvitationExpired(invitation: WorkspaceInvitation): boolean {
  return new Date(invitation.expires_at) < new Date();
}

export function canAcceptInvitation(invitation: WorkspaceInvitation): boolean {
  if (invitation.status !== 'pending') return false;
  return !isInvitationExpired(invitation);
}

// ============================================================================
// DISPLAY HELPERS
// ============================================================================

export function getRoleLabel(role: TeamRole): string {
  const labels: Record<TeamRole, string> = {
    admin: 'Admin',
    manager: 'Manager',
    member: 'Team Member',
    technician: 'Technician',
    view_only: 'View Only',
  };
  return labels[role];
}

export function getRolePermissions(role: TeamRole): string[] {
  const permissions: Record<TeamRole, string[]> = {
    admin: ['manage_team', 'manage_settings', 'manage_billing', 'manage_jobs', 'manage_clients', 'view_reports'],
    manager: ['manage_jobs', 'manage_clients', 'assign_technicians', 'view_reports'],
    member: ['manage_jobs', 'manage_clients', 'view_reports'],
    technician: ['view_assigned_jobs', 'submit_evidence', 'update_job_status'],
    view_only: ['view_jobs', 'view_reports'],
  };
  return permissions[role];
}

// ============================================================================
// TOKEN GENERATION
// ============================================================================

export function generateInviteToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return 'inv_' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ============================================================================
// CRUD OPERATIONS
// ============================================================================

export async function inviteTeamMember(
  workspaceId: string,
  invitedBy: string,
  request: InviteRequest
): Promise<WorkspaceInvitation> {
  if (!isSupabaseAvailable()) {
    throw new Error('Database not available');
  }

  if (!isValidEmail(request.email)) {
    throw new Error('Invalid email address');
  }

  if (!isValidRole(request.role)) {
    throw new Error(`Invalid role: ${request.role}`);
  }

  const supabase = getSupabase()!;

  // Check invitation limit
  const { count } = await supabase
    .from('workspace_invitations')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .eq('status', 'pending');

  if ((count ?? 0) >= MAX_INVITATIONS_PER_WORKSPACE) {
    throw new Error(`Maximum ${MAX_INVITATIONS_PER_WORKSPACE} pending invitations per workspace`);
  }

  const token = generateInviteToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + INVITATION_EXPIRY_DAYS);

  const record = {
    workspace_id: workspaceId,
    email: request.email.toLowerCase(),
    role: request.role,
    invited_by: invitedBy,
    token,
    status: 'pending',
    expires_at: expiresAt.toISOString(),
  };

  const { data, error } = await supabase
    .from('workspace_invitations')
    .upsert(record, { onConflict: 'workspace_id,email' })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create invitation: ${error.message}`);
  }

  return data as WorkspaceInvitation;
}

export async function listInvitations(workspaceId: string): Promise<WorkspaceInvitation[]> {
  if (!isSupabaseAvailable()) return [];

  const supabase = getSupabase()!;
  const { data, error } = await supabase
    .from('workspace_invitations')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });

  if (error) return [];
  return (data || []) as WorkspaceInvitation[];
}

export async function revokeInvitation(
  invitationId: string,
  workspaceId: string
): Promise<void> {
  if (!isSupabaseAvailable()) {
    throw new Error('Database not available');
  }

  const supabase = getSupabase()!;
  const { error } = await supabase
    .from('workspace_invitations')
    .update({ status: 'revoked' })
    .eq('id', invitationId)
    .eq('workspace_id', workspaceId);

  if (error) {
    throw new Error(`Failed to revoke invitation: ${error.message}`);
  }
}

export async function acceptInvitation(token: string): Promise<WorkspaceInvitation> {
  if (!isSupabaseAvailable()) {
    throw new Error('Database not available');
  }

  const supabase = getSupabase()!;

  // Find invitation by token
  const { data: invitation, error: findError } = await supabase
    .from('workspace_invitations')
    .select('*')
    .eq('token', token)
    .eq('status', 'pending')
    .single();

  if (findError || !invitation) {
    throw new Error('Invitation not found or already used');
  }

  const inv = invitation as WorkspaceInvitation;

  if (!canAcceptInvitation(inv)) {
    throw new Error('Invitation has expired or is no longer valid');
  }

  // Mark as accepted
  const { data: updated, error: updateError } = await supabase
    .from('workspace_invitations')
    .update({ status: 'accepted', accepted_at: new Date().toISOString() })
    .eq('id', inv.id)
    .select()
    .single();

  if (updateError) {
    throw new Error(`Failed to accept invitation: ${updateError.message}`);
  }

  return updated as WorkspaceInvitation;
}

export async function listTeamMembers(workspaceId: string): Promise<TeamMember[]> {
  if (!isSupabaseAvailable()) return [];

  const supabase = getSupabase()!;
  const { data, error } = await supabase
    .from('users')
    .select('id, email, full_name, role, created_at, last_sign_in_at')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: true });

  if (error) return [];

  return (data || []).map((user: any) => ({
    id: user.id,
    email: user.email,
    full_name: user.full_name,
    role: user.role || 'member',
    joined_at: user.created_at,
    last_active_at: user.last_sign_in_at,
  }));
}

export async function updateMemberRole(
  userId: string,
  workspaceId: string,
  newRole: TeamRole
): Promise<void> {
  if (!isSupabaseAvailable()) {
    throw new Error('Database not available');
  }

  if (!isValidRole(newRole)) {
    throw new Error(`Invalid role: ${newRole}`);
  }

  const supabase = getSupabase()!;
  const { error } = await supabase
    .from('users')
    .update({ role: newRole })
    .eq('id', userId)
    .eq('workspace_id', workspaceId);

  if (error) {
    throw new Error(`Failed to update member role: ${error.message}`);
  }
}

export async function removeMember(
  userId: string,
  workspaceId: string
): Promise<void> {
  if (!isSupabaseAvailable()) {
    throw new Error('Database not available');
  }

  const supabase = getSupabase()!;

  // Remove workspace association (don't delete the user account)
  const { error } = await supabase
    .from('users')
    .update({ workspace_id: null, role: null })
    .eq('id', userId)
    .eq('workspace_id', workspaceId);

  if (error) {
    throw new Error(`Failed to remove member: ${error.message}`);
  }
}
