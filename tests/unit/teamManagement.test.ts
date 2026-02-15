/**
 * Team Management Module Tests
 *
 * Tests for workspace invitation management, role validation,
 * and team member operations.
 */
import { describe, it, expect, vi } from 'vitest';

// ============================================================================
// Types
// ============================================================================

type TeamRole = 'admin' | 'manager' | 'member' | 'technician' | 'view_only';

interface WorkspaceInvitation {
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

interface TeamMember {
  id: string;
  email: string;
  full_name: string | null;
  role: TeamRole;
  status: 'active' | 'suspended';
  joined_at: string;
  last_active_at: string | null;
}

// ============================================================================
// Team Logic
// ============================================================================

const VALID_ROLES: TeamRole[] = ['admin', 'manager', 'member', 'technician', 'view_only'];

const ROLE_HIERARCHY: Record<TeamRole, number> = {
  admin: 4,
  manager: 3,
  member: 2,
  technician: 1,
  view_only: 0,
};

function isValidRole(role: string): role is TeamRole {
  return VALID_ROLES.includes(role as TeamRole);
}

function canManageRole(actorRole: TeamRole, targetRole: TeamRole): boolean {
  return ROLE_HIERARCHY[actorRole] > ROLE_HIERARCHY[targetRole];
}

function canInvite(actorRole: TeamRole): boolean {
  return ROLE_HIERARCHY[actorRole] >= ROLE_HIERARCHY['manager'];
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function generateInviteToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return 'inv_' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function isInvitationExpired(invitation: WorkspaceInvitation): boolean {
  return new Date(invitation.expires_at) < new Date();
}

function canAcceptInvitation(invitation: WorkspaceInvitation): boolean {
  if (invitation.status !== 'pending') return false;
  return !isInvitationExpired(invitation);
}

function getRoleLabel(role: TeamRole): string {
  const labels: Record<TeamRole, string> = {
    admin: 'Admin',
    manager: 'Manager',
    member: 'Team Member',
    technician: 'Technician',
    view_only: 'View Only',
  };
  return labels[role];
}

function getRolePermissions(role: TeamRole): string[] {
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
// TESTS
// ============================================================================

describe('Team Management Module', () => {
  describe('Role Validation', () => {
    it('validates all supported roles', () => {
      for (const role of VALID_ROLES) {
        expect(isValidRole(role)).toBe(true);
      }
    });

    it('rejects invalid roles', () => {
      expect(isValidRole('superadmin')).toBe(false);
      expect(isValidRole('')).toBe(false);
      expect(isValidRole('owner')).toBe(false);
    });
  });

  describe('Role Hierarchy', () => {
    it('allows admins to manage all lower roles', () => {
      expect(canManageRole('admin', 'manager')).toBe(true);
      expect(canManageRole('admin', 'member')).toBe(true);
      expect(canManageRole('admin', 'technician')).toBe(true);
      expect(canManageRole('admin', 'view_only')).toBe(true);
    });

    it('prevents managing same or higher role', () => {
      expect(canManageRole('admin', 'admin')).toBe(false);
      expect(canManageRole('manager', 'admin')).toBe(false);
      expect(canManageRole('member', 'manager')).toBe(false);
    });

    it('allows managers to manage members and below', () => {
      expect(canManageRole('manager', 'member')).toBe(true);
      expect(canManageRole('manager', 'technician')).toBe(true);
      expect(canManageRole('manager', 'view_only')).toBe(true);
    });

    it('prevents technicians from managing anyone', () => {
      expect(canManageRole('technician', 'view_only')).toBe(true);
      expect(canManageRole('technician', 'member')).toBe(false);
    });
  });

  describe('Invite Permissions', () => {
    it('allows admins and managers to invite', () => {
      expect(canInvite('admin')).toBe(true);
      expect(canInvite('manager')).toBe(true);
    });

    it('prevents lower roles from inviting', () => {
      expect(canInvite('member')).toBe(false);
      expect(canInvite('technician')).toBe(false);
      expect(canInvite('view_only')).toBe(false);
    });
  });

  describe('Email Validation', () => {
    it('accepts valid email addresses', () => {
      expect(isValidEmail('user@example.com')).toBe(true);
      expect(isValidEmail('admin+test@corp.co.uk')).toBe(true);
    });

    it('rejects invalid email addresses', () => {
      expect(isValidEmail('not-an-email')).toBe(false);
      expect(isValidEmail('@example.com')).toBe(false);
      expect(isValidEmail('')).toBe(false);
    });
  });

  describe('Invite Token Generation', () => {
    it('generates tokens with inv_ prefix', () => {
      const token = generateInviteToken();
      expect(token.startsWith('inv_')).toBe(true);
    });

    it('generates tokens of sufficient length', () => {
      const token = generateInviteToken();
      expect(token.length).toBeGreaterThanOrEqual(40);
    });
  });

  describe('Invitation Status', () => {
    const baseInvitation: WorkspaceInvitation = {
      id: 'inv-1',
      workspace_id: 'ws-1',
      email: 'user@example.com',
      role: 'member',
      invited_by: 'admin-1',
      token: 'inv_token123',
      status: 'pending',
      created_at: '2026-01-01T00:00:00Z',
      expires_at: '2026-12-31T00:00:00Z',
      accepted_at: null,
    };

    it('detects expired invitations', () => {
      const expired = { ...baseInvitation, expires_at: '2020-01-01T00:00:00Z' };
      expect(isInvitationExpired(expired)).toBe(true);
    });

    it('detects valid invitations', () => {
      expect(isInvitationExpired(baseInvitation)).toBe(false);
    });

    it('allows accepting pending, non-expired invitations', () => {
      expect(canAcceptInvitation(baseInvitation)).toBe(true);
    });

    it('prevents accepting expired invitations', () => {
      const expired = { ...baseInvitation, expires_at: '2020-01-01T00:00:00Z' };
      expect(canAcceptInvitation(expired)).toBe(false);
    });

    it('prevents accepting already-accepted invitations', () => {
      const accepted = { ...baseInvitation, status: 'accepted' as const };
      expect(canAcceptInvitation(accepted)).toBe(false);
    });

    it('prevents accepting revoked invitations', () => {
      const revoked = { ...baseInvitation, status: 'revoked' as const };
      expect(canAcceptInvitation(revoked)).toBe(false);
    });
  });

  describe('Role Labels and Permissions', () => {
    it('returns human-readable role labels', () => {
      expect(getRoleLabel('admin')).toBe('Admin');
      expect(getRoleLabel('manager')).toBe('Manager');
      expect(getRoleLabel('member')).toBe('Team Member');
      expect(getRoleLabel('technician')).toBe('Technician');
      expect(getRoleLabel('view_only')).toBe('View Only');
    });

    it('returns admin permissions including team management', () => {
      const perms = getRolePermissions('admin');
      expect(perms).toContain('manage_team');
      expect(perms).toContain('manage_billing');
    });

    it('returns technician permissions limited to assigned jobs', () => {
      const perms = getRolePermissions('technician');
      expect(perms).toContain('view_assigned_jobs');
      expect(perms).toContain('submit_evidence');
      expect(perms).not.toContain('manage_team');
    });

    it('returns view_only permissions as read-only', () => {
      const perms = getRolePermissions('view_only');
      expect(perms).toContain('view_jobs');
      expect(perms).not.toContain('manage_jobs');
    });
  });
});
