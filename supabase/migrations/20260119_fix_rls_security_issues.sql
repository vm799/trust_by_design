-- Migration: Fix RLS Security Issues
-- Date: 2026-01-19
--
-- Fixes:
-- 1. Enable RLS on public.user_subscriptions (has policies but RLS disabled)
-- 2. Create RLS policies for public.technicians (has RLS enabled but no policies)

-- ============================================================================
-- FIX 1 & 2: Enable RLS on user_subscriptions
-- ============================================================================

ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- FIX 3: Create RLS policies for technicians table
-- ============================================================================

-- Policy: Allow workspace members to view technicians in their workspace
CREATE POLICY "Users can view technicians in their workspace"
ON public.technicians
FOR SELECT
USING (
  workspace_id IN (
    SELECT workspace_id
    FROM public.users
    WHERE id = auth.uid()
  )
);

-- Policy: Allow workspace members to insert technicians in their workspace
CREATE POLICY "Users can create technicians in their workspace"
ON public.technicians
FOR INSERT
WITH CHECK (
  workspace_id IN (
    SELECT workspace_id
    FROM public.users
    WHERE id = auth.uid()
  )
);

-- Policy: Allow workspace members to update technicians in their workspace
CREATE POLICY "Users can update technicians in their workspace"
ON public.technicians
FOR UPDATE
USING (
  workspace_id IN (
    SELECT workspace_id
    FROM public.users
    WHERE id = auth.uid()
  )
)
WITH CHECK (
  workspace_id IN (
    SELECT workspace_id
    FROM public.users
    WHERE id = auth.uid()
  )
);

-- Policy: Allow workspace members to delete technicians in their workspace
CREATE POLICY "Users can delete technicians in their workspace"
ON public.technicians
FOR DELETE
USING (
  workspace_id IN (
    SELECT workspace_id
    FROM public.users
    WHERE id = auth.uid()
  )
);
