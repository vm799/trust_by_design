# Production-Ready Implementation Plan
**Date:** 2026-01-22
**Status:** ACTIVE EXECUTION
**Objective:** Get JobProof production-ready with all critical gaps closed

---

## Executive Summary

Based on comprehensive codebase analysis, JobProof is **75% production-ready** with strong foundations but **3 CRITICAL blockers** and **6 HIGH-priority gaps**:

### Critical Blockers (MUST FIX BEFORE PRODUCTION):
1. 🔴 **RSA-2048 Not Deployed** - Using insecure HMAC fallback with hardcoded secret
2. 🔴 **W3W Mock Data** - Fake random words instead of real What3Words API
3. 🔴 **Missing Data Model** - 6 essential tables not implemented

### Current State Summary:
- ✅ **Excellent:** RLS policies (14 tables, 60+ policies, fully hardened)
- ✅ **Excellent:** Cryptographic sealing code (RSA-2048 ready, just needs keys)
- ✅ **Good:** Offline-first architecture, 758 test cases, UX 100/100
- ❌ **Critical:** Running HMAC fallback with `'default-secret-key-CHANGE-IN-PRODUCTION'`
- ❌ **Critical:** W3W generating random words like `///index.engine.logic`
- ❌ **High:** Missing client_signoffs, job_status_history, notifications, etc.

---

## Part 1: Critical Analysis Results

### 1.1 Cryptographic Sealing Status

**Current State: HMAC FALLBACK ACTIVE**

| Component | Status | Details |
|-----------|--------|---------|
| Edge Function Code | ✅ Complete | RSA-2048 implementation ready |
| Environment Variables | ❌ Missing | SEAL_PRIVATE_KEY, SEAL_PUBLIC_KEY not set |
| Algorithm in Use | ❌ HMAC-SHA256 | Should be SHA256-RSA2048 |
| Hardcoded Fallback | ❌ CRITICAL | `'default-secret-key-CHANGE-IN-PRODUCTION'` |
| Database Schema | ✅ Complete | evidence_seals table with immutability triggers |

**Files:**
- `supabase/functions/seal-evidence/index.ts` (lines 198-240) - RSA signing ready
- `supabase/functions/verify-evidence/index.ts` (lines 113-163) - RSA verification ready

### 1.2 RLS Policies Status

**Current State: EXCELLENT ✅**

| Aspect | Status | Details |
|--------|--------|---------|
| Tables Covered | ✅ 14/14 | All tables have RLS enabled |
| Policy Count | ✅ 60+ | Comprehensive coverage |
| Workspace Isolation | ✅ Complete | Users cannot access other workspaces |
| Magic Link Tokens | ✅ Complete | Token-based access with SHA-256 hashing |
| Sealed Job Immutability | ✅ Complete | Triggers prevent updates/deletes |
| Audit Logs | ✅ Complete | Append-only, immutable |
| Recent Fixes | ✅ Applied | Infinite recursion, permissions, auth.uid() normalization |

**No action required** - RLS is production-ready.

### 1.3 W3W Integration Status

**Current State: MOCK DATA ONLY ❌**

| Component | Status | Details |
|-----------|--------|---------|
| API Integration | ❌ Missing | No API calls to What3Words |
| Mock Generation | ❌ Active | Random words like `///index.engine.logic` |
| API Key Config | ⚠️ Defined | `VITE_W3W_API_KEY` empty in .env |
| Data Storage | ✅ Ready | Both per-photo and per-job W3W fields exist |
| Validation | ⚠️ Format only | Doesn't verify real W3W addresses |

**Files:**
- `views/TechnicianPortal.tsx` (lines 293-336) - Mock generation
- `lib/utils.ts` (lines 68-70) - Format validation only

### 1.4 Database Schema Gaps

**Missing Tables (ALL 6):**

1. ❌ **client_signoffs** - Client signatures, satisfaction ratings, feedback
2. ❌ **job_status_history** - Audit trail of status changes
3. ❌ **job_dispatches** - Magic link dispatch tracking, delivery status
4. ❌ **job_time_entries** - Granular time tracking (work/break/travel)
5. ❌ **notifications** - Multi-channel notification management
6. ❌ **sync_queue** - Server-side sync queue persistence

**Missing Photo Fields (ALL 6):**

1. ❌ **w3w_verified** - W3W API confirmation flag
2. ❌ **photo_hash** - SHA-256 hash for integrity
3. ❌ **photo_hash_algorithm** - Algorithm used (sha256)
4. ❌ **exif_data** - JSONB full EXIF for audit
5. ❌ **device_info** - JSONB device make/model/OS
6. ❌ **w3w_address** - (Note: `w3w` field exists but not named `w3w_address`)

---

## Part 2: Implementation Plan

### Priority Order: CRITICAL → HIGH → MEDIUM

**Total Estimated Time:** 3-4 days intensive work

---

### PHASE 1: CRITICAL SECURITY (Priority 1) - 4 hours

#### Task 1.1: Generate and Deploy RSA-2048 Keys
**Blocker for Production: YES**
**Estimated Time:** 1 hour

**Actions:**
```bash
# 1. Generate RSA-2048 keypair
openssl genrsa -out seal_private_key.pem 2048
openssl rsa -in seal_private_key.pem -pubout -out seal_public_key.pem

# 2. Verify keys
openssl rsa -in seal_private_key.pem -check
openssl rsa -pubin -in seal_public_key.pem -text -noout

# 3. Convert to base64 for environment variables
cat seal_private_key.pem | base64 -w 0 > seal_private_key_base64.txt
cat seal_public_key.pem | base64 -w 0 > seal_public_key_base64.txt

# 4. Set in .env for local development
echo "SEAL_PRIVATE_KEY=$(cat seal_private_key_base64.txt)" >> .env
echo "SEAL_PUBLIC_KEY=$(cat seal_public_key_base64.txt)" >> .env
```

**For Production (Supabase):**
```bash
supabase secrets set SEAL_PRIVATE_KEY="$(cat seal_private_key_base64.txt)"
supabase secrets set SEAL_PUBLIC_KEY="$(cat seal_public_key_base64.txt)"
supabase functions deploy seal-evidence
supabase functions deploy verify-evidence
```

**Verification:**
```sql
-- After sealing a test job, verify algorithm
SELECT algorithm, COUNT(*) FROM evidence_seals GROUP BY algorithm;
-- Expected: SHA256-RSA2048 (NOT SHA256-HMAC)
```

**Success Criteria:**
- ✅ Private/public keypair generated (2048 bits)
- ✅ Keys stored in environment variables (NOT in code)
- ✅ Edge functions deployed with keys
- ✅ New seals use `SHA256-RSA2048` algorithm
- ✅ Hardcoded fallback secret no longer used

#### Task 1.2: Remove Hardcoded Fallback Secret
**Blocker for Production: YES**
**Estimated Time:** 30 minutes

**Files to Update:**
- `supabase/functions/seal-evidence/index.ts` (line 228)
- `supabase/functions/verify-evidence/index.ts` (line 144)

**Changes:**
```typescript
// OLD (INSECURE):
const secretKey = Deno.env.get('SEAL_SECRET_KEY') || 'default-secret-key-CHANGE-IN-PRODUCTION'

// NEW (SECURE):
const secretKey = Deno.env.get('SEAL_SECRET_KEY');
if (!secretKey) {
  throw new Error('SEAL_SECRET_KEY not configured - HMAC fallback disabled');
}
```

**Success Criteria:**
- ✅ Hardcoded default removed
- ✅ Edge function throws error if keys missing
- ✅ No HMAC seals created in production

#### Task 1.3: Verify RSA-2048 Deployment
**Blocker for Production: YES**
**Estimated Time:** 30 minutes

**Test Procedure:**
1. Seal a test job via UI
2. Check database: `SELECT * FROM evidence_seals ORDER BY sealed_at DESC LIMIT 1;`
3. Verify `algorithm = 'SHA256-RSA2048'`
4. Verify signature is base64 RSA (not HMAC)
5. Run verification: `SELECT * FROM verify_evidence_seal('job_id');`
6. Check logs for any fallback warnings

**Success Criteria:**
- ✅ Algorithm is SHA256-RSA2048
- ✅ Signature verifies with public key
- ✅ No HMAC fallback warnings in logs

---

### PHASE 2: W3W REAL API INTEGRATION (Priority 1) - 3 hours

#### Task 2.1: Create W3W API Service
**Blocker for Production: NO (but critical for accuracy)**
**Estimated Time:** 1 hour

**Create:** `lib/services/what3words.ts`

```typescript
/**
 * What3Words API Service
 * Converts GPS coordinates to W3W addresses and vice versa
 */

const W3W_API_KEY = import.meta.env.VITE_W3W_API_KEY;
const W3W_BASE_URL = 'https://api.what3words.com/v3';

export interface W3WResult {
  words: string; // e.g., "filled.count.soap"
  country: string;
  nearestPlace: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  language: string;
}

/**
 * Convert GPS coordinates to W3W address
 */
export async function convertToW3W(
  lat: number,
  lng: number
): Promise<W3WResult | null> {
  if (!W3W_API_KEY) {
    console.warn('W3W API key not configured');
    return null;
  }

  try {
    const response = await fetch(
      `${W3W_BASE_URL}/convert-to-3wa?coordinates=${lat},${lng}&key=${W3W_API_KEY}&format=json`
    );

    if (!response.ok) {
      console.error('W3W API error:', response.status);
      return null;
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('W3W API call failed:', error);
    return null;
  }
}

/**
 * Convert W3W address to GPS coordinates
 */
export async function convertToCoordinates(
  w3wAddress: string
): Promise<{ lat: number; lng: number } | null> {
  if (!W3W_API_KEY) {
    console.warn('W3W API key not configured');
    return null;
  }

  try {
    const response = await fetch(
      `${W3W_BASE_URL}/convert-to-coordinates?words=${w3wAddress}&key=${W3W_API_KEY}&format=json`
    );

    if (!response.ok) {
      console.error('W3W API error:', response.status);
      return null;
    }

    const data = await response.json();
    return data.coordinates;
  } catch (error) {
    console.error('W3W reverse lookup failed:', error);
    return null;
  }
}

/**
 * Validate W3W address format and existence
 */
export async function validateW3W(w3wAddress: string): Promise<boolean> {
  const coords = await convertToCoordinates(w3wAddress);
  return coords !== null;
}

/**
 * Cache layer for W3W lookups (24-hour TTL)
 */
const w3wCache = new Map<string, { result: W3WResult; expiry: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function convertToW3WCached(
  lat: number,
  lng: number
): Promise<W3WResult | null> {
  const key = `${lat.toFixed(6)},${lng.toFixed(6)}`;

  // Check cache
  const cached = w3wCache.get(key);
  if (cached && cached.expiry > Date.now()) {
    return cached.result;
  }

  // API call
  const result = await convertToW3W(lat, lng);

  // Cache result
  if (result) {
    w3wCache.set(key, {
      result,
      expiry: Date.now() + CACHE_TTL_MS
    });
  }

  return result;
}

/**
 * Generate mock W3W for offline/testing
 */
export function generateMockW3W(): string {
  const words = ['index', 'engine', 'logic', 'rugged', 'field', 'safe', 'audit', 'track', 'proof'];
  const pick = () => words[Math.floor(Math.random() * words.length)];
  return `///${pick()}.${pick()}.${pick()}`;
}
```

**Success Criteria:**
- ✅ W3W API service created
- ✅ Caching layer implemented (reduce API calls)
- ✅ Error handling for API failures
- ✅ Fallback to mock for offline/testing

#### Task 2.2: Replace Mock W3W in TechnicianPortal
**Blocker for Production: NO (but critical for accuracy)**
**Estimated Time:** 1 hour

**File:** `views/TechnicianPortal.tsx`

**Changes at lines 293-336 (captureLocation function):**

```typescript
import { convertToW3WCached, generateMockW3W } from '../lib/services/what3words';

const captureLocation = async () => {
  setLocationStatus('Capturing location...');

  try {
    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      });
    });

    const { latitude: lat, longitude: lng, accuracy } = position.coords;

    // Real W3W API call with caching
    let w3wAddress = null;
    try {
      const w3wResult = await convertToW3WCached(lat, lng);
      w3wAddress = w3wResult ? `///${w3wResult.words}` : null;
    } catch (error) {
      console.warn('W3W API failed, using mock:', error);
    }

    // Fallback to mock if API failed
    if (!w3wAddress) {
      w3wAddress = generateMockW3W();
    }

    setW3w(w3wAddress);
    setLocationStatus('Location captured successfully');

    writeLocalDraft({
      w3w: w3wAddress,
      lat,
      lng,
      gps_accuracy: accuracy
    });

  } catch (error) {
    console.error('Geolocation error:', error);
    setLocationStatus('Location capture failed - using manual entry');
  }
};
```

**Success Criteria:**
- ✅ Real W3W API calls replace mock generation
- ✅ Fallback to mock if API unavailable
- ✅ GPS accuracy stored
- ✅ Error handling for geolocation failures

#### Task 2.3: Update Environment Configuration
**Blocker for Production: YES (need API key)**
**Estimated Time:** 15 minutes

**File:** `.env`

```bash
# What3Words API Configuration
VITE_W3W_API_KEY=your_actual_api_key_here
```

**Get API Key:**
1. Sign up at https://accounts.what3words.com/register
2. Free tier: 25,000 requests/month
3. Add key to `.env` (local) and Vercel environment variables (production)

**Success Criteria:**
- ✅ W3W API key obtained
- ✅ Key added to .env
- ✅ Key added to Vercel production environment

#### Task 2.4: Test W3W Integration
**Estimated Time:** 30 minutes

**Test Cases:**
1. Capture location with GPS → verify real W3W address returned
2. Check format: `///word.word.word`
3. Verify reverse lookup (W3W to coords) matches GPS
4. Test offline mode → verify mock fallback
5. Test API failure → verify graceful degradation

**Success Criteria:**
- ✅ Real W3W addresses appear in job reports
- ✅ W3W addresses validate via reverse lookup
- ✅ Fallback works when offline
- ✅ No breaking errors on API failure

---

### PHASE 3: DATABASE SCHEMA EXTENSIONS (Priority 2) - 4 hours

#### Task 3.1: Create Migration for 6 New Tables
**Blocker for Production: NO (but needed for complete features)**
**Estimated Time:** 2 hours

**Create:** `supabase/migrations/20260122_production_schema_extensions.sql`

```sql
-- Migration: Production Schema Extensions
-- Date: 2026-01-22
-- Purpose: Add 6 missing tables for production completeness

-- ============================================================================
-- 1. CLIENT SIGNOFFS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS client_signoffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,

  -- Signature & Verification
  signature_url TEXT, -- Supabase Storage URL
  signature_data TEXT, -- Base64 PNG (fallback)
  signature_verified BOOLEAN DEFAULT false,
  signer_name TEXT NOT NULL,
  signer_email TEXT,

  -- Satisfaction & Feedback
  satisfaction_rating INTEGER CHECK (satisfaction_rating BETWEEN 1 AND 5),
  feedback_text TEXT,
  would_recommend BOOLEAN,

  -- Timestamps
  signed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Sync Status
  sync_status TEXT DEFAULT 'pending' CHECK (sync_status IN ('pending', 'synced', 'failed')),

  CONSTRAINT one_signoff_per_job UNIQUE (job_id)
);

-- Indexes
CREATE INDEX idx_client_signoffs_job_id ON client_signoffs(job_id);
CREATE INDEX idx_client_signoffs_workspace_id ON client_signoffs(workspace_id);
CREATE INDEX idx_client_signoffs_signed_at ON client_signoffs(signed_at);

-- RLS Policies
ALTER TABLE client_signoffs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view workspace signoffs"
  ON client_signoffs FOR SELECT
  TO authenticated
  USING (workspace_id IN (SELECT user_workspace_ids()));

CREATE POLICY "Users can create signoffs"
  ON client_signoffs FOR INSERT
  TO authenticated
  WITH CHECK (workspace_id IN (SELECT user_workspace_ids()));

CREATE POLICY "Token holders can create signoffs"
  ON client_signoffs FOR INSERT
  TO anon
  WITH CHECK (
    job_id IN (
      SELECT job_id FROM job_access_tokens
      WHERE token_hash = encode(sha256(get_request_job_token()::bytea), 'hex')
      AND expires_at > NOW()
      AND revoked_at IS NULL
    )
  );

-- ============================================================================
-- 2. JOB STATUS HISTORY TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS job_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL,

  previous_status TEXT,
  new_status TEXT NOT NULL,
  changed_by_user_id UUID,
  changed_by_email TEXT,
  reason TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_job_status_history_job_id ON job_status_history(job_id);
CREATE INDEX idx_job_status_history_created_at ON job_status_history(created_at);

-- RLS Policies
ALTER TABLE job_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view workspace status history"
  ON job_status_history FOR SELECT
  TO authenticated
  USING (workspace_id IN (SELECT user_workspace_ids()));

CREATE POLICY "History entries cannot be deleted"
  ON job_status_history FOR DELETE
  TO authenticated
  USING (false);

CREATE POLICY "History entries cannot be updated"
  ON job_status_history FOR UPDATE
  TO authenticated
  USING (false);

-- Trigger: Auto-log status changes
CREATE OR REPLACE FUNCTION log_job_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO job_status_history (
      job_id,
      workspace_id,
      previous_status,
      new_status,
      changed_by_user_id,
      changed_by_email
    ) VALUES (
      NEW.id,
      NEW.workspace_id,
      OLD.status,
      NEW.status,
      auth.uid(),
      (SELECT email FROM auth.users WHERE id = auth.uid())
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER job_status_change_trigger
  AFTER UPDATE ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION log_job_status_change();

-- ============================================================================
-- 3. JOB DISPATCHES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS job_dispatches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL,

  sent_by_user_id UUID NOT NULL,
  sent_by_email TEXT,
  sent_to_technician_id UUID REFERENCES technicians(id) ON DELETE SET NULL,
  sent_to_email TEXT,
  sent_to_phone TEXT,

  -- Channel & Link
  dispatch_channel TEXT NOT NULL CHECK (dispatch_channel IN ('sms', 'email', 'qr', 'direct_link', 'in_app')),
  magic_link_token TEXT,
  magic_link_url TEXT,
  qr_code_url TEXT,

  -- Delivery Status
  delivery_status TEXT DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'sent', 'delivered', 'opened', 'failed', 'bounced')),
  opened_at TIMESTAMPTZ,
  error_message TEXT,

  -- Retry Logic
  attempt_number INTEGER DEFAULT 1,
  last_attempt_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_job_dispatches_job_id ON job_dispatches(job_id);
CREATE INDEX idx_job_dispatches_workspace_id ON job_dispatches(workspace_id);
CREATE INDEX idx_job_dispatches_delivery_status ON job_dispatches(delivery_status);

-- RLS Policies
ALTER TABLE job_dispatches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view workspace dispatches"
  ON job_dispatches FOR SELECT
  TO authenticated
  USING (workspace_id IN (SELECT user_workspace_ids()));

CREATE POLICY "Users can create dispatches"
  ON job_dispatches FOR INSERT
  TO authenticated
  WITH CHECK (workspace_id IN (SELECT user_workspace_ids()));

-- ============================================================================
-- 4. JOB TIME ENTRIES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS job_time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL,
  user_id UUID,

  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,

  activity_type TEXT DEFAULT 'work' CHECK (activity_type IN ('work', 'break', 'travel', 'waiting', 'other')),
  notes TEXT,
  location_lat DECIMAL,
  location_lng DECIMAL,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_job_time_entries_job_id ON job_time_entries(job_id);
CREATE INDEX idx_job_time_entries_started_at ON job_time_entries(started_at);

-- RLS Policies
ALTER TABLE job_time_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view workspace time entries"
  ON job_time_entries FOR SELECT
  TO authenticated
  USING (workspace_id IN (SELECT user_workspace_ids()));

CREATE POLICY "Users can create time entries"
  ON job_time_entries FOR INSERT
  TO authenticated
  WITH CHECK (workspace_id IN (SELECT user_workspace_ids()));

-- ============================================================================
-- 5. NOTIFICATIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  type TEXT NOT NULL CHECK (type IN (
    'job_assigned', 'job_started', 'job_completed', 'job_sealed',
    'signature_needed', 'sync_complete', 'sync_failed',
    'client_feedback', 'admin_alert', 'system_notification'
  )),
  title TEXT NOT NULL,
  message TEXT,
  related_job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,

  -- Delivery Status
  delivery_status TEXT DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'sent', 'read', 'failed', 'dismissed')),
  sent_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,

  -- Channels
  channels JSONB DEFAULT '["in_app"]'::jsonb, -- ['in_app', 'email', 'push', 'sms']

  -- Priority
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),

  -- Action
  action_url TEXT,
  action_label TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_workspace_id ON notifications(workspace_id);
CREATE INDEX idx_notifications_delivery_status ON notifications(delivery_status);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);

-- RLS Policies
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- ============================================================================
-- 6. SYNC QUEUE TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS sync_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  user_id UUID NOT NULL,

  operation_type TEXT NOT NULL CHECK (operation_type IN ('create', 'update', 'delete')),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('job', 'photo', 'safety_check', 'signature', 'signoff', 'time_entry')),
  entity_id UUID,

  payload JSONB NOT NULL,
  sync_status TEXT DEFAULT 'pending' CHECK (sync_status IN ('pending', 'synced', 'failed', 'conflict')),
  error_message TEXT,
  conflict_resolution TEXT,

  attempt_count INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  last_attempt_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_sync_queue_workspace_id ON sync_queue(workspace_id);
CREATE INDEX idx_sync_queue_user_id ON sync_queue(user_id);
CREATE INDEX idx_sync_queue_sync_status ON sync_queue(sync_status);
CREATE INDEX idx_sync_queue_next_retry_at ON sync_queue(next_retry_at) WHERE sync_status = 'pending';

-- RLS Policies
ALTER TABLE sync_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own sync queue"
  ON sync_queue FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can manage their own sync queue"
  ON sync_queue FOR ALL
  TO authenticated
  USING (user_id = auth.uid());

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
```

**Success Criteria:**
- ✅ All 6 tables created
- ✅ Indexes added for performance
- ✅ RLS policies enabled and tested
- ✅ Triggers created for auto-logging

#### Task 3.2: Extend Photos Table with Missing Fields
**Estimated Time:** 30 minutes

**Add to migration:** `supabase/migrations/20260122_production_schema_extensions.sql`

```sql
-- ============================================================================
-- EXTEND PHOTOS TABLE
-- ============================================================================

ALTER TABLE photos ADD COLUMN IF NOT EXISTS w3w_verified BOOLEAN DEFAULT false;
ALTER TABLE photos ADD COLUMN IF NOT EXISTS photo_hash TEXT;
ALTER TABLE photos ADD COLUMN IF NOT EXISTS photo_hash_algorithm TEXT DEFAULT 'sha256';
ALTER TABLE photos ADD COLUMN IF NOT EXISTS exif_data JSONB;
ALTER TABLE photos ADD COLUMN IF NOT EXISTS device_info JSONB;
ALTER TABLE photos ADD COLUMN IF NOT EXISTS gps_accuracy DECIMAL;

-- Index for photo integrity verification
CREATE INDEX IF NOT EXISTS idx_photos_photo_hash ON photos(photo_hash);

COMMENT ON COLUMN photos.photo_hash IS 'SHA-256 hash of photo blob for integrity verification';
COMMENT ON COLUMN photos.exif_data IS 'Full EXIF metadata from photo for audit trail';
COMMENT ON COLUMN photos.device_info IS 'Device make, model, OS version for forensics';
COMMENT ON COLUMN photos.gps_accuracy IS 'GPS accuracy in meters';
```

**Success Criteria:**
- ✅ 6 new fields added to photos table
- ✅ Indexes created
- ✅ Column comments added

#### Task 3.3: Run Migration
**Estimated Time:** 15 minutes

```bash
# 1. Test migration locally (if Supabase local dev setup)
supabase db reset

# 2. Deploy to production
supabase db push

# 3. Verify tables created
supabase db inspect
```

**Success Criteria:**
- ✅ Migration runs without errors
- ✅ All tables created in database
- ✅ RLS policies active

---

### PHASE 4: UPDATE TYPESCRIPT TYPES (Priority 2) - 1 hour

#### Task 4.1: Add New Table Types
**File:** `types.ts`

**Add at end of file:**

```typescript
// ============================================================================
// PRODUCTION SCHEMA EXTENSIONS
// ============================================================================

export interface ClientSignoff {
  id: string;
  job_id: string;
  workspace_id: string;
  client_id?: string;

  signature_url?: string;
  signature_data?: string;
  signature_verified: boolean;
  signer_name: string;
  signer_email?: string;

  satisfaction_rating?: number; // 1-5
  feedback_text?: string;
  would_recommend?: boolean;

  signed_at?: string;
  created_at: string;
  updated_at: string;

  sync_status: 'pending' | 'synced' | 'failed';
}

export interface JobStatusHistoryEntry {
  id: string;
  job_id: string;
  workspace_id: string;

  previous_status?: string;
  new_status: string;
  changed_by_user_id?: string;
  changed_by_email?: string;
  reason?: string;
  metadata: Record<string, any>;

  created_at: string;
}

export interface JobDispatch {
  id: string;
  job_id: string;
  workspace_id: string;

  sent_by_user_id: string;
  sent_by_email?: string;
  sent_to_technician_id?: string;
  sent_to_email?: string;
  sent_to_phone?: string;

  dispatch_channel: 'sms' | 'email' | 'qr' | 'direct_link' | 'in_app';
  magic_link_token?: string;
  magic_link_url?: string;
  qr_code_url?: string;

  delivery_status: 'pending' | 'sent' | 'delivered' | 'opened' | 'failed' | 'bounced';
  opened_at?: string;
  error_message?: string;

  attempt_number: number;
  last_attempt_at?: string;

  created_at: string;
}

export interface JobTimeEntry {
  id: string;
  job_id: string;
  workspace_id: string;
  user_id?: string;

  started_at: string;
  ended_at?: string;
  duration_seconds?: number;

  activity_type: 'work' | 'break' | 'travel' | 'waiting' | 'other';
  notes?: string;
  location_lat?: number;
  location_lng?: number;

  created_at: string;
}

export interface Notification {
  id: string;
  workspace_id: string;
  user_id: string;

  type: 'job_assigned' | 'job_started' | 'job_completed' | 'job_sealed' |
        'signature_needed' | 'sync_complete' | 'sync_failed' |
        'client_feedback' | 'admin_alert' | 'system_notification';
  title: string;
  message?: string;
  related_job_id?: string;

  delivery_status: 'pending' | 'sent' | 'read' | 'failed' | 'dismissed';
  sent_at?: string;
  read_at?: string;
  dismissed_at?: string;

  channels: ('in_app' | 'email' | 'push' | 'sms')[];

  priority: 'low' | 'normal' | 'high' | 'urgent';

  action_url?: string;
  action_label?: string;

  created_at: string;
}

export interface SyncQueueEntry {
  id: string;
  workspace_id: string;
  user_id: string;

  operation_type: 'create' | 'update' | 'delete';
  entity_type: 'job' | 'photo' | 'safety_check' | 'signature' | 'signoff' | 'time_entry';
  entity_id?: string;

  payload: Record<string, any>;
  sync_status: 'pending' | 'synced' | 'failed' | 'conflict';
  error_message?: string;
  conflict_resolution?: string;

  attempt_count: number;
  max_attempts: number;
  last_attempt_at?: string;
  next_retry_at?: string;

  created_at: string;
  updated_at: string;
}

// Update Photo interface with new fields
export interface Photo {
  id: string;
  job_id: string;
  url: string;
  type: 'Before' | 'During' | 'After' | 'Evidence' | 'Safety' | 'Client';
  timestamp: string;
  verified: boolean;

  // Location data
  lat?: number;
  lng?: number;
  w3w?: string;
  w3w_verified?: boolean;
  gps_accuracy?: number;

  // Integrity & Audit
  photo_hash?: string;
  photo_hash_algorithm?: string;
  exif_data?: Record<string, any>;
  device_info?: {
    make?: string;
    model?: string;
    os?: string;
    os_version?: string;
    app_version?: string;
  };

  sync_status: 'pending' | 'synced' | 'failed';
}
```

**Success Criteria:**
- ✅ All new types defined
- ✅ Photo interface updated with new fields
- ✅ No TypeScript errors

---

### PHASE 5: TESTING & VALIDATION (Priority 3) - 2 hours

#### Task 5.1: Test RSA-2048 Sealing
```bash
npm run test:unit -- sealing.test.ts
```

**Manual test:**
1. Create test job
2. Seal job
3. Verify algorithm is SHA256-RSA2048
4. Verify signature validates
5. Attempt to modify sealed job → should fail

#### Task 5.2: Test W3W Integration
```bash
npm run test:unit -- what3words.test.ts
```

**Manual test:**
1. Capture photo with GPS
2. Verify real W3W address appears
3. Test offline mode → verify mock fallback
4. Test API failure → verify graceful degradation

#### Task 5.3: Test New Tables
```sql
-- Test client_signoffs
INSERT INTO client_signoffs (job_id, workspace_id, signer_name, satisfaction_rating)
VALUES ('test-job-id', 'test-workspace-id', 'Test Client', 5);

-- Test job_status_history trigger
UPDATE jobs SET status = 'completed' WHERE id = 'test-job-id';
SELECT * FROM job_status_history WHERE job_id = 'test-job-id';

-- Test notifications
INSERT INTO notifications (workspace_id, user_id, type, title, message)
VALUES ('test-workspace-id', 'test-user-id', 'job_completed', 'Job Complete', 'Test job is done');

-- Test sync_queue
INSERT INTO sync_queue (workspace_id, user_id, operation_type, entity_type, entity_id, payload)
VALUES ('test-workspace-id', 'test-user-id', 'create', 'job', 'job-id', '{"title":"Test"}'::jsonb);
```

#### Task 5.4: Run Full Test Suite
```bash
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test:coverage
```

**Success Criteria:**
- ✅ All tests pass
- ✅ Test coverage > 80%
- ✅ No TypeScript errors

---

## Part 3: Deployment Checklist

### Pre-Deployment Verification

- [ ] RSA-2048 keys generated and deployed
- [ ] W3W API key configured
- [ ] All 6 tables created with RLS policies
- [ ] Photos table extended with 6 new fields
- [ ] TypeScript types updated
- [ ] All tests passing
- [ ] No hardcoded secrets in code
- [ ] Environment variables set in production

### Production Deployment Steps

```bash
# 1. Commit all changes
git add .
git commit -m "feat: Production-ready with RSA-2048, W3W API, complete schema"

# 2. Push to remote
git push origin claude/jobproof-audit-spec-PEdmd

# 3. Deploy database migrations
supabase db push

# 4. Deploy edge functions
supabase functions deploy seal-evidence
supabase functions deploy verify-evidence

# 5. Set production environment variables
vercel env add VITE_W3W_API_KEY production
supabase secrets set SEAL_PRIVATE_KEY "..."
supabase secrets set SEAL_PUBLIC_KEY "..."

# 6. Deploy frontend
vercel --prod
```

### Post-Deployment Verification

```sql
-- 1. Verify RSA-2048 active
SELECT algorithm, COUNT(*) FROM evidence_seals
WHERE sealed_at > NOW() - INTERVAL '1 day'
GROUP BY algorithm;
-- Expected: SHA256-RSA2048 only

-- 2. Verify RLS policies
SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public';
-- Expected: 60+ policies

-- 3. Verify new tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
  'client_signoffs', 'job_status_history', 'job_dispatches',
  'job_time_entries', 'notifications', 'sync_queue'
);
-- Expected: 6 rows
```

---

## Part 4: Success Metrics

### Critical Success Criteria

- ✅ **No HMAC seals in production** - All seals use SHA256-RSA2048
- ✅ **Real W3W addresses** - No more mock data like `///index.engine.logic`
- ✅ **Complete schema** - All 6 tables created and operational
- ✅ **RLS verified** - All 14 tables have working RLS policies
- ✅ **Tests passing** - >80% coverage, all critical paths tested

### Performance Metrics

- API response time < 200ms (p95)
- Photo upload time < 3 seconds
- Seal generation < 1 second
- W3W lookup < 500ms (with caching)
- Offline sync success rate > 95%

### Security Metrics

- 0 high/critical npm vulnerabilities
- 0 hardcoded secrets in code
- 100% tables with RLS enabled
- 100% seals using RSA-2048
- Token expiry < 7 days

---

## Part 5: Risk Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| RSA key generation fails | Low | High | Test in staging first, document process |
| W3W API quota exceeded | Medium | Medium | Implement caching (24hr TTL), monitor usage |
| Migration fails | Low | Critical | Test locally first, have rollback plan |
| TypeScript errors | Low | Medium | Run type-check before commit |
| RLS policy gaps | Low | Critical | Test with multiple user roles |

---

## Timeline

**Total: 3-4 days (24-32 hours)**

| Phase | Time | Priority |
|-------|------|----------|
| Phase 1: RSA-2048 | 4 hours | CRITICAL |
| Phase 2: W3W API | 3 hours | CRITICAL |
| Phase 3: Schema | 4 hours | HIGH |
| Phase 4: Types | 1 hour | HIGH |
| Phase 5: Testing | 2 hours | MEDIUM |
| **Total** | **14 hours** | **Active work** |

Plus 2-3 days for testing, QA, and deployment preparation.

---

## Next Steps

**IMMEDIATE ACTIONS:**
1. Start Phase 1: Generate RSA-2048 keys
2. Get W3W API key
3. Create database migration
4. Test everything
5. Deploy to production

**EXECUTOR:** Start with Phase 1, Task 1.1 (RSA key generation)

---

**END OF IMPLEMENTATION PLAN**
