# JobProof API Contracts & Database Specification

**Version:** 1.0.0
**Status:** Production Ready
**Last Updated:** 2026-01-20

---

## 📚 Table of Contents

1. [Database Schema](#database-schema)
2. [Row Level Security (RLS)](#row-level-security-rls)
3. [Edge Functions](#edge-functions)
4. [RPC Functions](#rpc-functions)
5. [Storage Buckets](#storage-buckets)

---

## 🗄️ Database Schema

### `workspaces`
Top-level tenant container. All data is scoped to a workspace.

| Column | Type | Description |
|:---|:---|:---|
| `id` | `uuid` | Primary Key |
| `name` | `text` | Workspace display name |
| `slug` | `text` | Unique URL-friendly identifier |
| `created_at` | `timestamptz` | Creation timestamp |

### `users`
Authenticated users, linked to Supabase Auth.

| Column | Type | Description |
|:---|:---|:---|
| `id` | `uuid` | Primary Key (matches `auth.users.id`) |
| `email` | `text` | User email |
| `full_name` | `text` | Display name |
| `workspace_id` | `uuid` | Foreign Key -> `workspaces.id` |
| `role` | `text` | 'admin', 'technician', 'manager' |
| `avatar_url` | `text` | Profile picture URL |

### `jobs`
Core work order entity.

| Column | Type | Description |
|:---|:---|:---|
| `id` | `text` | Primary Key (e.g., "JOB-1234") |
| `workspace_id` | `uuid` | Foreign Key -> `workspaces.id` |
| `title` | `text` | Job title |
| `status` | `text` | 'Pending', 'In Progress', 'Submitted' |
| `client_name` | `text` | Denormalized client name |
| `technician_id` | `uuid` | Assigned technician |
| `sync_status` | `text` | 'synced', 'pending' |
| `sealed_at` | `timestamptz` | Timestamp of evidence sealing |
| `evidence_hash` | `text` | Cryptographic hash of evidence |

### `user_subscriptions`
Stripe subscription mapping.

| Column | Type | Description |
|:---|:---|:---|
| `user_id` | `uuid` | Primary Key -> `users.id` |
| `stripe_customer_id` | `text` | Stripe Customer ID |
| `stripe_subscription_id` | `text` | Stripe Subscription ID |
| `tier` | `text` | 'solo', 'team', 'agency' |
| `status` | `text` | 'active', 'past_due', 'canceled' |

---

## 🔒 Row Level Security (RLS)

All tables have RLS enabled. Policies strictly enforce `workspace_id` isolation.

**General Policy Pattern:**
```sql
CREATE POLICY "Users can view data from their workspace"
ON table_name
USING (workspace_id IN (
  SELECT workspace_id FROM users WHERE id = auth.uid()
));
```

**Specific Policies:**
- **`user_subscriptions`**: Users can only view their own subscription. Service role can view all.

---

## ⚡ Edge Functions

### `seal-evidence`
Cryptographically seals a job's evidence bundle.

- **URL:** `POST /functions/v1/seal-evidence`
- **Auth:** Required (Bearer Token)
- **Body:** `{ "jobId": "JOB-123" }`
- **Response:**
  ```json
  {
    "success": true,
    "sealedAt": "2026-01-20T10:00:00Z",
    "evidenceHash": "sha256-..."
  }
  ```

### `verify-evidence`
Verifies the integrity of a sealed job.

- **URL:** `POST /functions/v1/verify-evidence`
- **Auth:** Public
- **Body:** `{ "jobId": "JOB-123", "evidenceHash": "..." }`
- **Response:** `{ "verified": true, "tampered": false }`

### `stripe-checkout`
Creates a Stripe Checkout session.

- **URL:** `POST /functions/v1/stripe-checkout`
- **Auth:** Required
- **Body:** `{ "priceId": "price_..." }`
- **Response:** `{ "url": "https://checkout.stripe.com/..." }`

---

## 🛠️ RPC Functions

### `create_workspace_with_owner`
Transactional workspace creation.

- **Params:** `p_user_id`, `p_email`, `p_workspace_name`
- **Returns:** `workspace_id`

### `generate_job_access_token`
Creates a time-limited magic link for a job.

- **Params:** `p_job_id`
- **Returns:** `{ "token": "...", "expires_at": "..." }`

---

## 📦 Storage Buckets

### `job-photos`
- **Public:** Yes
- **RLS:** Authenticated users can upload. Public read access.
- **Path structure:** `{workspace_id}/{job_id}/{filename}`

### `job-signatures`
- **Public:** Yes
- **RLS:** Authenticated users can upload. Public read access.
- **Path structure:** `{workspace_id}/{job_id}/signature.png`
