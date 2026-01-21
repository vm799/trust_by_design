-- Migration: 001_initial_rls.sql
-- Description: Enables RLS, adds Helper Functions, and enforces Business Rules via Triggers.
-- Strategy: Deny All by default, Allow via Policies.

-- ============================================================================
-- 1. HELPER FUNCTIONS (Schema: auth)
-- ============================================================================

-- Function: auth.workspace_id()
-- Returns: UUID of the user's workspace or NULL
CREATE OR REPLACE FUNCTION auth.workspace_id() 
RETURNS UUID AS $$
  SELECT workspace_id FROM public.users WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Function: auth.is_manager()
-- Returns: Boolean
CREATE OR REPLACE FUNCTION auth.is_manager() 
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = 'manager'
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Function: auth.technician_id()
-- Returns: UUID of the technician profile linked to the user
CREATE OR REPLACE FUNCTION auth.technician_id() 
RETURNS UUID AS $$
  SELECT id FROM public.technicians WHERE user_id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================================
-- 2. ENABLE RLS (All Tables)
-- ============================================================================

ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.technicians ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence_seals ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY; -- Uncomment if audit_logs exists

-- ============================================================================
-- 3. RLS POLICIES
-- ============================================================================

-- ---- TABLE: JOBS ----

-- Policy: Managers can do everything in their workspace
CREATE POLICY "Managers can manage all jobs in workspace"
  ON public.jobs
  FOR ALL
  TO authenticated
  USING ( auth.workspace_id() = workspace_id );

-- Policy: Technicians can VIEW jobs assigned to them
CREATE POLICY "Technicians can view assigned jobs"
  ON public.jobs
  FOR SELECT
  TO authenticated
  USING ( technician_id = auth.technician_id() );

-- Policy: Technicians can UPDATE jobs assigned to them (Column limits via Trigger)
CREATE POLICY "Technicians can update assigned jobs"
  ON public.jobs
  FOR UPDATE
  TO authenticated
  USING ( technician_id = auth.technician_id() );

-- ---- TABLE: PHOTOS ----

-- Policy: Managers can do everything
CREATE POLICY "Managers can manage all photos"
  ON public.photos
  FOR ALL
  TO authenticated
  USING ( auth.workspace_id() = workspace_id );

-- Policy: Technicians can VIEW photos for their jobs
CREATE POLICY "Technicians can view photos for assigned jobs"
  ON public.photos
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.jobs 
      WHERE jobs.id = photos.job_id AND jobs.technician_id = auth.technician_id()
    )
  );

-- Policy: Technicians can INSERT photos for their jobs
CREATE POLICY "Technicians can insert photos for assigned jobs"
  ON public.photos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.jobs 
      WHERE jobs.id = job_id AND jobs.technician_id = auth.technician_id()
    )
  );

-- ---- TABLE: CLIENTS ----

CREATE POLICY "Managers can manage clients"
  ON public.clients
  FOR ALL
  TO authenticated
  USING ( auth.workspace_id() = workspace_id );

CREATE POLICY "Technicians can view clients"
  ON public.clients
  FOR SELECT
  TO authenticated
  USING ( auth.workspace_id() = workspace_id );

-- ---- TABLE: TECHNICIANS ----

CREATE POLICY "Managers can manage technicians"
  ON public.technicians
  FOR ALL
  TO authenticated
  USING ( auth.workspace_id() = workspace_id );

CREATE POLICY "Technicians can view own profile"
  ON public.technicians
  FOR SELECT
  TO authenticated
  USING ( user_id = auth.uid() );

-- ============================================================================
-- 4. TRIGGERS (Enforcement)
-- ============================================================================

-- Trigger Function: Enforce Field Permissions for Technicians
CREATE OR REPLACE FUNCTION public.enforce_technician_limits()
RETURNS TRIGGER AS $$
BEGIN
  -- Bypass if Manager
  IF auth.is_manager() THEN
    RETURN NEW;
  END IF;

  -- If Technician, restrict changes
  -- Allowed: status, notes, safety_checklist, photos, signature, sync_status, updated_at
  -- Forbidden: title, client_id, price, seal status
  
  IF (NEW.title IS DISTINCT FROM OLD.title) OR
     (NEW.client_id IS DISTINCT FROM OLD.client_id) OR
     (NEW.price IS DISTINCT FROM OLD.price) OR
     (NEW.sealed_at IS DISTINCT FROM OLD.sealed_at) THEN
      RAISE EXCEPTION 'Permission Denied: You cannot modify core job details.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply Trigger
CREATE TRIGGER tr_enforce_tech_limits
  BEFORE UPDATE ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_technician_limits();


-- Trigger Function: Prevent Modifying Sealed Jobs
CREATE OR REPLACE FUNCTION public.freeze_sealed_jobs()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.sealed_at IS NOT NULL THEN
    -- Allow Sync Status updates only (for background sync)
    IF (NEW.sync_status IS DISTINCT FROM OLD.sync_status) AND 
       (NEW.sealed_at = OLD.sealed_at) THEN
      RETURN NEW;
    END IF;
    
    RAISE EXCEPTION 'Job is Sealed: No further modifications allowed.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply Trigger
CREATE TRIGGER tr_freeze_sealed_jobs
  BEFORE UPDATE OR DELETE ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.freeze_sealed_jobs();

