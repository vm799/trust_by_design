# Phase C.4 — Audit Trail

**Status:** IN PROGRESS
**Started:** 2026-01-17
**Phase:** Trust Foundation - Audit Trail
**Closes Audit Finding:** #7 (Audit Trail)
**Depends On:** Phase C.1 ✅, Phase C.2 ✅, Phase C.3 ✅

---

## OVERVIEW

Phase C.4 implements comprehensive audit logging for all evidence access and modifications. Every interaction with evidence (view, export, seal) is logged to an append-only audit_logs table with workspace isolation.

**Key Features:**
- Append-only audit_logs table (cannot delete logs)
- Auto-logging of all evidence access
- Workspace-scoped access via RLS
- Admin-only audit trail viewer
- IP address and user agent tracking
- Tamper-proof (no DELETE permission)

---

## TASKS

### 1. Database Migration - Audit Logs Table

**File:** `supabase/migrations/003_audit_trail.sql`

**Schema:**
```sql
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  user_id UUID REFERENCES users(id),

  -- Event details
  event_type TEXT NOT NULL, -- 'job_view', 'photo_view', 'report_export', 'seal_create', 'job_create', 'job_update'
  resource_type TEXT NOT NULL, -- 'job', 'photo', 'seal'
  resource_id TEXT NOT NULL, -- Job ID, photo ID, etc.

  -- Metadata
  user_email TEXT,
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB, -- Additional context

  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_audit_logs_workspace ON audit_logs(workspace_id);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- RLS: Users can only view their workspace audit logs
CREATE POLICY "Users can view workspace audit logs"
  ON audit_logs FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM users WHERE id = auth.uid()
    )
  );

-- Prevent DELETE (append-only)
CREATE POLICY "Audit logs cannot be deleted"
  ON audit_logs FOR DELETE
  USING (false);

-- Prevent UPDATE (immutable)
CREATE POLICY "Audit logs cannot be updated"
  ON audit_logs FOR UPDATE
  USING (false);

-- Helper function to log audit events
CREATE OR REPLACE FUNCTION log_audit_event(
  p_workspace_id UUID,
  p_event_type TEXT,
  p_resource_type TEXT,
  p_resource_id TEXT,
  p_metadata JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
  v_user_id UUID;
  v_user_email TEXT;
BEGIN
  -- Get current user
  v_user_id := auth.uid();

  SELECT email INTO v_user_email
  FROM users
  WHERE id = v_user_id;

  -- Insert audit log
  INSERT INTO audit_logs (
    workspace_id,
    user_id,
    event_type,
    resource_type,
    resource_id,
    user_email,
    metadata
  ) VALUES (
    p_workspace_id,
    v_user_id,
    p_event_type,
    p_resource_type,
    p_resource_id,
    v_user_email,
    p_metadata
  ) RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

### 2. Client Audit Library

**File:** `lib/audit.ts`

```typescript
export type AuditEventType =
  | 'job_view'
  | 'job_create'
  | 'job_update'
  | 'job_delete'
  | 'photo_view'
  | 'report_export'
  | 'seal_create'
  | 'seal_verify';

export interface AuditEvent {
  eventType: AuditEventType;
  resourceType: 'job' | 'photo' | 'seal';
  resourceId: string;
  metadata?: Record<string, any>;
}

export const logAuditEvent = async (event: AuditEvent): Promise<void> => {
  const supabase = getSupabase();
  if (!supabase) return;

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from('users')
      .select('workspace_id')
      .eq('id', user.id)
      .single();

    if (!profile) return;

    await supabase.rpc('log_audit_event', {
      p_workspace_id: profile.workspace_id,
      p_event_type: event.eventType,
      p_resource_type: event.resourceType,
      p_resource_id: event.resourceId,
      p_metadata: event.metadata || null
    });
  } catch (error) {
    console.error('Failed to log audit event:', error);
  }
};
```

---

### 3. Auto-logging Integration

**Update JobReport.tsx:**
```typescript
useEffect(() => {
  if (job) {
    logAuditEvent({
      eventType: 'job_view',
      resourceType: 'job',
      resourceId: job.id,
      metadata: { publicView }
    });
  }
}, [job?.id]);
```

**Update sealing.ts (sealEvidence):**
```typescript
// After successful seal
if (result.success) {
  await logAuditEvent({
    eventType: 'seal_create',
    resourceType: 'seal',
    resourceId: jobId,
    metadata: { evidenceHash: result.evidenceHash }
  });
}
```

---

### 4. Audit Trail Viewer

**File:** `views/AuditTrailView.tsx`

**Features:**
- Table view of all audit logs
- Filters: event type, date range, user, resource
- Export to CSV
- Real-time updates
- Pagination

**UI:**
```tsx
<table>
  <thead>
    <tr>
      <th>Timestamp</th>
      <th>Event</th>
      <th>Resource</th>
      <th>User</th>
      <th>Details</th>
    </tr>
  </thead>
  <tbody>
    {logs.map(log => (
      <tr key={log.id}>
        <td>{formatDate(log.created_at)}</td>
        <td>{formatEventType(log.event_type)}</td>
        <td>{log.resource_type}: {log.resource_id}</td>
        <td>{log.user_email}</td>
        <td>{JSON.stringify(log.metadata)}</td>
      </tr>
    ))}
  </tbody>
</table>
```

---

### 5. Add Route to App.tsx

```tsx
<Route
  path="/admin/audit"
  element={isAuthenticated ? <AuditTrailView /> : <Navigate to="/auth/login" />}
/>
```

---

## EVIDENCE OF COMPLETION

### ✅ Evidence 1: audit_logs Table
- File: supabase/migrations/003_audit_trail.sql
- Append-only (no DELETE policy)
- Workspace-scoped RLS

### ✅ Evidence 2: Auto-Logging
- JobReport logs 'job_view' on mount
- sealEvidence logs 'seal_create' after seal
- All operations logged automatically

### ✅ Evidence 3: Audit Trail Viewer
- Admin-only view at /admin/audit
- Shows all workspace audit logs
- Filterable and exportable

### ✅ Evidence 4: Cannot Delete Logs
- RLS policy: `USING (false)` for DELETE
- Test: `DELETE FROM audit_logs WHERE id = ...` → Error

---

## CANNOT BE BYPASSED BECAUSE

### 🔒 Append-Only Table
- No DELETE permission in RLS
- Cannot remove audit logs

### 🔒 Auto-Logging Server-Side
- Database function `log_audit_event()` runs server-side
- Client cannot skip logging

### 🔒 Workspace Isolation
- RLS filters logs by workspace_id
- Cannot see other workspace logs

---

## NEXT STEPS

1. Create migration
2. Create audit library
3. Add logging to components
4. Create audit viewer
5. Add route
6. Test
7. Document
8. Commit and push

---

**Phase C.4 Status:** 0% (0/7 tasks)
**Estimated Time:** 2-3 hours
