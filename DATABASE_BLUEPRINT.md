# DATABASE_BLUEPRINT

This document serves as the comprehensive database schema blueprint for the Job Proof MLP. It is aligned with the existing **Supabase Schema**, enforces **Multi-tenancy (Workspaces)**, and defines the missing **RLS Policies**.

## Section A: Table Definitions (SQL-like Syntax)

### 1. **users**
Existing table in `public` schema, synced with `auth.users`.

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL, -- Critical for Tenant Isolation
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL CHECK (role IN ('manager', 'technician', 'client')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2. **technicians**
Profiles for field staff. Renamed from `contractors` to match existing codebase.

```sql
CREATE TABLE technicians (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL, -- Tenant Scoped
  user_id UUID REFERENCES users(id) ON DELETE SET NULL, -- specific user linkage
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  specialty TEXT,
  status TEXT DEFAULT 'available', -- available, on_job, offline
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 3. **clients**
Represents the customers.

```sql
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL, -- Tenant Scoped
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 4. **jobs**
The central entity. Includes existing location/status fields and strict workspace scoping.

```sql
CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL, -- Tenant Scoped
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  technician_id UUID REFERENCES technicians(id) ON DELETE SET NULL,
  
  -- Core Fields
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  
  -- Location (Dual Signal)
  address TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  w3w TEXT,
  
  -- Offline/Sync
  sync_status TEXT DEFAULT 'pending', 
  
  -- Timestamps
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Sealing Linkage (One-to-One mostly, but kept separate for security)
  sealed_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 5. **photos**
Use `photos` (not `proof_photos`).

```sql
CREATE TABLE photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL, -- Tenant Scoped (Denormalized for RLS performance)
  
  url TEXT NOT NULL,
  type TEXT NOT NULL, -- Before, During, After, Evidence
  
  -- Verification
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  timestamp TIMESTAMPTZ,
  verified BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 6. **evidence_seals**
Immutable record of the cryptographic seal.

```sql
CREATE TABLE evidence_seals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL,
  
  evidence_hash TEXT NOT NULL,
  signature TEXT NOT NULL,
  algorithm TEXT NOT NULL,
  sealed_at TIMESTAMPTZ DEFAULT NOW(),
  sealed_by_user_id UUID,
  
  evidence_json JSONB NOT NULL -- Snapshot of data at time of seal
);
```

### 7. **job_access_tokens**
Magic link tokens for simplified technician access.

```sql
CREATE TABLE job_access_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Section B: Table Relationships (Foreign Keys)

| Source Table | Source Column | Target Table | Target Column | Type |
| :--- | :--- | :--- | :--- | :--- |
| `technicians` | `user_id` | `users` | `id` | One-to-One (Optional) |
| `jobs` | `client_id` | `clients` | `id` | One-to-Many |
| `jobs` | `technician_id` | `technicians` | `id` | One-to-Many |
| `photos` | `job_id` | `jobs` | `id` | One-to-Many |
| `evidence_seals` | `job_id` | `jobs` | `id` | One-to-One |

## Section C: Row-Level Security (RLS) Policy Requirements

**Critical Implementation Note:**
Current `auth.uid()` maps to `public.users.id`.
`workspace_id` is NOT in the JWT default claims.
**Strategy:** We will use a Helper Function or a nested Select for policies.
*Recommended:* Function `auth.workspace_id()` for cleaner SQL.

#### Helper Function
```sql
CREATE OR REPLACE FUNCTION auth.workspace_id() RETURNS UUID AS $$
  SELECT workspace_id FROM public.users WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;
```

#### Policies

| Persona | Table | Policy Name | Definition (Pseudo-SQL) |
| :--- | :--- | :--- | :--- |
| **Manager** | `jobs` | `manager_read_all` | `auth.workspace_id() = workspace_id` |
| **Manager** | `jobs` | `manager_write_all` | `auth.workspace_id() = workspace_id` |
| **Technician** | `jobs` | `tech_read_own` | `auth.uid() = (select user_id from technicians where id = jobs.technician_id)` |
| **Technician** | `jobs` | `tech_update_status` | `(Using separate Update policy on specific cols if possible, else check ID match)` |
| **Public** | `jobs` | `magic_link_access` | `id = (select job_id from job_access_tokens where token = current_setting('app.current_token'))` (Advanced) <br> OR <br> Use Helper Function `verify_job_token(token)` |
| **Client** | `jobs` | `client_read_own` | `auth.email() = (select email from clients where id = jobs.client_id)` (If Client Auth exists) |

## Section D: Offline-First Sync Fields

| Table | Field Name | Data Type | Purpose |
| :--- | :--- | :--- | :--- |
| `jobs` | `onboarding_steps` | `jsonb` | (Existing) Tracks local state. |
| `jobs` | `sync_status` | `text` | 'pending', 'synced', 'conflict'. |
| `photos` | `url` | `text` | Stores `media_idx_...` reference key when local, replaced by URL on sync. |
| `photos` | `is_indexeddb_ref` | `boolean` | Flag to indicate image blob is in IndexedDB. |
