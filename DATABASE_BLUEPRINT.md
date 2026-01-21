# DATABASE_BLUEPRINT

This document serves as the comprehensive database schema blueprint for the Job Proof MLP. It is inferred directly from `PROJECT_SPEC_V3.md` and designed for the Supabase SQL AI Editor.

## Section A: Table Definitions (SQL-like Syntax)

### 1. **users**
Stores user profiles linked to Supabase Auth. Segments users by role (Manager, Contractor, Client) to drive RLS.

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL CHECK (role IN ('manager', 'contractor', 'client')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2. **clients**
Represents the customers (homeowners/businesses) issuing the jobs.

```sql
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 3. **contractors**
Profiles for the field technicians. Can be linked to a user account for login or managed as resources.

```sql
CREATE TABLE contractors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL, -- specific user linkage
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 4. **jobs**
The central entity for the application. Tracks the lifecycle of a request from dispatch to sealing.

```sql
CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  contractor_id UUID REFERENCES contractors(id) ON DELETE SET NULL,
  
  -- Job Details
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'completed', 'sealed')),
  
  -- Offline-First / Sync Fields
  local_id TEXT, -- Generated on device
  sync_status TEXT DEFAULT 'pending' CHECK (sync_status IN ('pending', 'synced', 'conflict')),
  
  -- Cryptographic Sealing (Server-Side Source of Truth)
  seal_signature TEXT, -- RSA-2048 signature
  seal_public_key_id TEXT, -- Reference to the key used for sealing
  sealed_at TIMESTAMPTZ,
  
  -- Timestamps
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 5. **proof_photos**
Immutable evidence captured by technicians. Must enable integrity verification.

```sql
CREATE TABLE proof_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  
  -- Asset storage
  storage_path TEXT NOT NULL, -- Path in Supabase Storage
  
  -- Metadata (Source of Truth for verification)
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  accuracy DOUBLE PRECISION, -- GPS accuracy radius
  captured_at TIMESTAMPTZ, -- Client-side timestamp
  
  -- Offline-First
  local_id TEXT,
  
  -- Integrity
  immutable_hash TEXT NOT NULL, -- SHA-256 hash of photo + metadata
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 6. **invoices**
generated billing documents for completed jobs, requiring client signature.

```sql
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  
  amount NUMERIC(10, 2) NOT NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid')),
  
  -- Client Interaction
  client_signature TEXT, -- SVG path or Base64 signature data
  signed_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Section B: Table Relationships (Foreign Keys)

| Source Table | Source Column | Target Table | Target Column | Relationship Type |
| :--- | :--- | :--- | :--- | :--- |
| `contractors` | `user_id` | `users` | `id` | One-to-One (Optional) |
| `jobs` | `client_id` | `clients` | `id` | One-to-Many |
| `jobs` | `contractor_id` | `contractors` | `id` | One-to-Many |
| `proof_photos` | `job_id` | `jobs` | `id` | One-to-Many |
| `invoices` | `job_id` | `jobs` | `id` | One-to-One |

## Section C: Row-Level Security (RLS) Policy Requirements

| Persona | Table | Policy Requirement (Who can do what) |
| :--- | :--- | :--- |
| **Contractor** | `jobs` | **SELECT:** jobs where `contractor_id` matches their profile.<br>**UPDATE:** Only `status`, `started_at`, `completed_at`, `sync_status`. |
| **Contractor** | `proof_photos` | **INSERT:** Allow if linked to a job assigned to them.<br>**SELECT:** Allow if linked to a job assigned to them. |
| **Client** | `invoices` | **SELECT:** Invoices linked to jobs they requested (via `client_id`).<br>**UPDATE:** `client_signature`, `signed_at` (only if currently null). |
| **Manager** | **All Users** | **FULL ACCESS**: SELECT/INSERT/UPDATE/DELETE on all tables. |
| **Manager** | **All Data** | **FULL ACCESS**: SELECT/INSERT/UPDATE/DELETE on all tables. |

## Section D: Offline-First Sync Fields

| Table | Field Name | Data Type | Purpose |
| :--- | :--- | :--- | :--- |
| `jobs` | `local_id` | `text` | Temporary UUID generated on mobile device to identify record before server sync. |
| `jobs` | `sync_status` | `text` | Tracks sync state (`pending`, `synced`, `conflict`) to manage background processes. |
| `proof_photos` | `local_id` | `text` | Temporary UUID for linking photos to `local_id` jobs before full sync. |
| `proof_photos` | `immutable_hash`| `text` | Client-generated cryptographic hash of the photo blob + metadata. Used to verify integrity post-sync. |
