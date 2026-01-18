# API Contracts - Jobproof.pro

**Version:** 1.0.0  
**Date:** 2026-01-18  
**Status:** Production

This document defines all API contracts for Jobproof's backend services.

---

## RPC Functions

### create_workspace_with_owner

**Purpose:** Atomically creates workspace + owner user

**Signature:**
```sql
create_workspace_with_owner(
  p_user_id uuid,
  p_workspace_name text,
  p_full_name text,
  p_email text
) RETURNS uuid
```

**Parameters:**
- `p_user_id` (uuid, required): Auth user ID
- `p_workspace_name` (text, required): Company name
- `p_full_name` (text, required): User's full name
- `p_email` (text, required): Verified email

**Returns:** Workspace ID (uuid)

**Security:** SECURITY DEFINER, authenticated only

---

## Edge Functions

### 1. seal-evidence

**Endpoint:** `POST /functions/v1/seal-evidence`

**Request:**
```json
{ "jobId": "uuid", "workspaceId": "uuid" }
```

**Response (200):**
```json
{
  "success": true,
  "sealId": "uuid",
  "evidenceHash": "sha256-hex",
  "signature": "hmac-hex",
  "algorithm": "SHA256-HMAC",
  "timestamp": "ISO-8601"
}
```

**Process:** SHA-256 hash → HMAC-SHA256 sign → Insert seal → Update job status

---

### 2. verify-evidence

**Endpoint:** `POST /functions/v1/verify-evidence`

**Request:**
```json
{ "sealId": "uuid" }
```

**Response (200):**
```json
{
  "valid": true,
  "seal": { "id": "uuid", "evidence_hash": "hex", "...": "..." },
  "verification": {
    "computed_hash": "hex",
    "stored_hash": "hex",
    "hash_match": true,
    "signature_valid": true
  }
}
```

**Public:** No auth required (audit verification is public)

---

### 3. stripe-checkout

**Endpoint:** `POST /functions/v1/stripe-checkout`

**Request:**
```json
{ "priceId": "price_xxx" }
```

**Response (200):**
```json
{ "url": "https://checkout.stripe.com/xxx" }
```

**Auth:** Supabase JWT required

**Process:** Create Stripe Checkout Session → Return redirect URL

---

### 4. stripe-webhook

**Endpoint:** `POST /functions/v1/stripe-webhook`

**Events:**
- `checkout.session.completed` → Create subscription in DB
- `customer.subscription.updated` → Update subscription
- `customer.subscription.deleted` → Mark canceled

**Auth:** Stripe signature verification (STRIPE_WEBHOOK_SECRET)

**Security:** Uses SERVICE_ROLE_KEY (bypasses RLS)

---

## Database Schema

### user_subscriptions

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| user_id | uuid | FK to auth.users (UNIQUE) |
| tier | text | 'solo', 'team', 'agency' |
| status | text | 'active', 'canceled', 'past_due', 'trialing' |
| stripe_customer_id | text | cus_xxx |
| stripe_subscription_id | text | sub_xxx (UNIQUE) |
| current_period_end | timestamptz | Renewal date |

**RLS:** Users view own subscription only

**Trigger:** Auto-creates 'solo' for new users

---

### seals

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| job_id | uuid | FK to jobs |
| evidence_hash | text | SHA-256 (hex) |
| signature | text | HMAC-SHA256 (hex) |
| algorithm | text | 'SHA256-HMAC' |
| sealed_at | timestamptz | Seal timestamp |
| sealed_by | uuid | FK to users |

**RLS:** Public read, workspace write

---

## Authentication

**Provider:** Supabase Auth  
**Token:** JWT in `Authorization: Bearer <token>` header  
**Expiry:** 1 hour (auto-refreshed)

**RLS Enforcement:**
```sql
auth.uid() = user_id  -- User-level policies
workspace_id IN (SELECT workspace_id FROM users WHERE id = auth.uid())  -- Workspace-level
```

---

## Error Codes

| HTTP | Meaning |
|------|---------|
| 200 | Success |
| 400 | Bad request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not found |
| 500 | Server error |

**Format:**
```json
{ "error": "Human message", "code": "ERROR_CODE" }
```

---

## Known Limitations

1. **HMAC Placeholder:** Using HMAC-SHA256 instead of RSA-2048 (Phase D.2 upgrade planned)
2. **No Rate Limiting:** Relying on Supabase defaults (500 req/min)
3. **No API Versioning:** Breaking changes will bump major version

---

**Last Updated:** 2026-01-18  
**Contact:** support@jobproof.io
