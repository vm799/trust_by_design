# Cryptographic Keys Deployment Guide
**CONFIDENTIAL - DO NOT COMMIT TO GIT**
**Date:** 2026-01-22
**Purpose:** RSA-2048 keypair for evidence sealing

---

## ⚠️ SECURITY WARNING

These cryptographic keys are **CRITICAL SECURITY ASSETS**. Compromise of the private key would allow:
- Forging of evidence seals
- Creation of fraudulent job reports
- Undermining of entire trust system

**NEVER:**
- Commit keys to git
- Share keys via email/Slack
- Store keys in plain text
- Use same keys across environments

---

## Key Generation

Keys were generated on 2026-01-22 using:

```bash
# Generate 2048-bit RSA private key
openssl genrsa -out seal_private_key.pem 2048

# Extract public key
openssl rsa -in seal_private_key.pem -pubout -out seal_public_key.pem

# Verify integrity
openssl rsa -in seal_private_key.pem -check
# Output: RSA key ok

# Convert to base64 for environment variables
base64 -w 0 seal_private_key.pem > seal_private_key_base64.txt
base64 -w 0 seal_public_key.pem > seal_public_key_base64.txt
```

---

## Key Files

**Files created (ALL IN .gitignore):**
- `seal_private_key.pem` - Private key (PEM format)
- `seal_public_key.pem` - Public key (PEM format)
- `seal_private_key_base64.txt` - Private key (base64 encoded)
- `seal_public_key_base64.txt` - Public key (base64 encoded)

---

## Local Development Setup

For local development with Supabase Edge Functions:

```bash
# 1. Read base64 keys
PRIVATE_KEY_BASE64=$(cat seal_private_key_base64.txt)
PUBLIC_KEY_BASE64=$(cat seal_public_key_base64.txt)

# 2. Add to .env file
echo "SEAL_PRIVATE_KEY=$PRIVATE_KEY_BASE64" >> .env
echo "SEAL_PUBLIC_KEY=$PUBLIC_KEY_BASE64" >> .env

# 3. Restart local Supabase (if running)
supabase stop && supabase start
```

---

## Production Deployment (Supabase)

### Step 1: Set Secrets in Supabase

```bash
# 1. Install Supabase CLI if not already installed
npm install -g supabase

# 2. Login to Supabase
supabase login

# 3. Link to your project
supabase link --project-ref ndcjtpzixjbhmzbavqdm

# 4. Set secrets
supabase secrets set SEAL_PRIVATE_KEY="$(cat seal_private_key_base64.txt)"
supabase secrets set SEAL_PUBLIC_KEY="$(cat seal_public_key_base64.txt)"

# 5. Verify secrets are set (will show masked values)
supabase secrets list
```

### Step 2: Deploy Edge Functions

```bash
# Deploy seal-evidence function
supabase functions deploy seal-evidence

# Deploy verify-evidence function
supabase functions deploy verify-evidence

# Verify deployment
supabase functions list
```

### Step 3: Verify RSA-2048 is Active

```bash
# Seal a test job and check database
psql "$SUPABASE_DB_URL" <<EOF
SELECT algorithm, COUNT(*) as count
FROM evidence_seals
WHERE sealed_at > NOW() - INTERVAL '1 hour'
GROUP BY algorithm;
EOF

# Expected output:
#    algorithm     | count
# -----------------+-------
#  SHA256-RSA2048  |   X
```

---

## Production Deployment (Vercel - Frontend)

The frontend needs the **public key only** for client-side verification:

```bash
# 1. Login to Vercel
vercel login

# 2. Add public key to environment variables
vercel env add VITE_SEAL_PUBLIC_KEY production
# Paste contents of seal_public_key_base64.txt when prompted

# 3. Redeploy
vercel --prod
```

---

## Key Rotation Procedure

**When to rotate:**
- Every 12 months (recommended)
- If private key is compromised
- After employee departure with key access
- Before major security audit

**How to rotate:**

```bash
# 1. Generate new keypair
openssl genrsa -out seal_private_key_new.pem 2048
openssl rsa -in seal_private_key_new.pem -pubout -out seal_public_key_new.pem

# 2. Deploy new keys to Supabase (old key still active)
supabase secrets set SEAL_PRIVATE_KEY_NEW="$(base64 -w 0 seal_private_key_new.pem)"
supabase secrets set SEAL_PUBLIC_KEY_NEW="$(base64 -w 0 seal_public_key_new.pem)"

# 3. Update edge function to try NEW key first, fallback to OLD
# (This ensures old seals still verify)

# 4. After 30 days, remove old key
supabase secrets unset SEAL_PRIVATE_KEY
supabase secrets unset SEAL_PUBLIC_KEY

# 5. Rename NEW keys to primary
supabase secrets set SEAL_PRIVATE_KEY="$(supabase secrets get SEAL_PRIVATE_KEY_NEW)"
supabase secrets unset SEAL_PRIVATE_KEY_NEW
```

---

## Verification Checklist

After deployment, verify:

- [ ] Supabase secrets list shows SEAL_PRIVATE_KEY (masked)
- [ ] Supabase secrets list shows SEAL_PUBLIC_KEY (masked)
- [ ] Edge functions deployed successfully
- [ ] New seals use SHA256-RSA2048 algorithm
- [ ] Old seals still verify correctly
- [ ] No HMAC fallback warnings in logs
- [ ] Seal verification returns valid = true
- [ ] Vercel environment variables set

---

## Backup & Recovery

**Backup Procedure:**

```bash
# 1. Encrypt keys before backup
openssl enc -aes-256-cbc -salt \
  -in seal_private_key.pem \
  -out seal_private_key.pem.enc \
  -pass pass:YOUR_STRONG_PASSPHRASE

# 2. Store encrypted key in secure location:
#    - Password manager (1Password, LastPass)
#    - Hardware security module (HSM)
#    - Air-gapped encrypted USB drive

# 3. DO NOT backup to cloud storage unencrypted
```

**Recovery Procedure:**

```bash
# 1. Decrypt backup
openssl enc -aes-256-cbc -d \
  -in seal_private_key.pem.enc \
  -out seal_private_key_recovered.pem \
  -pass pass:YOUR_STRONG_PASSPHRASE

# 2. Verify integrity
openssl rsa -in seal_private_key_recovered.pem -check

# 3. Redeploy
supabase secrets set SEAL_PRIVATE_KEY="$(base64 -w 0 seal_private_key_recovered.pem)"
```

---

## Security Best Practices

1. **Access Control:**
   - Limit key access to 2-3 people maximum
   - Use separate keys for staging/production
   - Audit key access via Supabase logs

2. **Storage:**
   - Never store keys in code
   - Never store keys in database
   - Use environment variables or secrets manager

3. **Monitoring:**
   - Alert on HMAC fallback usage
   - Monitor seal algorithm distribution
   - Log all seal/verify operations

4. **Compliance:**
   - Document key generation date
   - Document key rotation schedule
   - Include in security audit procedures

---

## Troubleshooting

### Issue: "SEAL_PRIVATE_KEY not found" error

**Solution:**
```bash
# Verify secret is set
supabase secrets list

# If missing, set it
supabase secrets set SEAL_PRIVATE_KEY="$(cat seal_private_key_base64.txt)"

# Redeploy function
supabase functions deploy seal-evidence
```

### Issue: Seals still using HMAC

**Solution:**
```bash
# Check edge function logs
supabase functions logs seal-evidence

# Verify secret format (should be base64 PEM)
echo "$SEAL_PRIVATE_KEY" | base64 -d | head -1
# Expected: -----BEGIN PRIVATE KEY-----

# Redeploy with updated secret
supabase functions deploy seal-evidence --no-verify-jwt
```

### Issue: Verification fails

**Solution:**
```bash
# Verify public key matches private key
openssl rsa -in seal_private_key.pem -pubout | \
  diff - seal_public_key.pem
# Expected: No differences

# Check seal record algorithm
SELECT algorithm FROM evidence_seals WHERE id = 'failing_seal_id';

# If SHA256-RSA2048, ensure public key matches
# If SHA256-HMAC, old seal - use HMAC verification
```

---

## Contact Information

**Key Custodians:**
- Primary: [Technical Lead Name]
- Backup: [DevOps Lead Name]
- Emergency: [CTO/Security Officer]

**Key Rotation Schedule:**
- Next rotation: 2027-01-22 (12 months)
- Review date: 2026-07-22 (6 months)

---

## Audit Trail

| Date | Event | Performed By | Notes |
|------|-------|--------------|-------|
| 2026-01-22 | Initial keypair generated | Claude Agent | RSA-2048, 2048-bit |
| 2026-01-22 | Keys deployed to Supabase | Claude Agent | Production environment |
| | | | |

---

**END OF DEPLOYMENT GUIDE**

**REMEMBER: This document contains sensitive security information. Handle accordingly.**
