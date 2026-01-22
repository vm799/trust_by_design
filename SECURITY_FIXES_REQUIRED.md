# SECURITY FIXES REQUIRED - TRACK 3 AUDIT

**Date:** 2026-01-22
**Priority:** MEDIUM
**Estimated Effort:** 1-2 hours

---

## MEDIUM PRIORITY: Sanitize Production Logging

### Issue
Edge Functions log sensitive error details that could leak information in production Supabase logs.

### Risk
- **Severity:** MEDIUM
- **Impact:** Sensitive data (job IDs, user emails, database errors) exposed in logs
- **Likelihood:** HIGH (errors occur in normal operation)
- **Exploitability:** LOW (requires Supabase dashboard access)

### Affected Files
1. `/supabase/functions/seal-evidence/index.ts` (4 instances)
2. `/supabase/functions/verify-evidence/index.ts` (2 instances)

### Required Fix

Create a secure logging utility:

```typescript
// File: supabase/functions/_shared/secureLogger.ts
export const logError = (context: string, error: any) => {
  console.error(`[${context}]`, {
    error_code: error.code || 'UNKNOWN',
    error_name: error.name || 'Error',
    timestamp: new Date().toISOString(),
    // DO NOT log: job_id, user_id, email, workspace_id, etc.
  });
};

export const logInfo = (context: string, message: string) => {
  console.log(`[${context}] ${message}`);
};
```

### Implementation Steps

1. **Create shared logger** (`supabase/functions/_shared/secureLogger.ts`)

2. **Update seal-evidence/index.ts:**

```typescript
import { logError, logInfo } from '../_shared/secureLogger.ts';

// Replace line 223:
// console.error('RSA Signing failed:', e);
logError('seal-evidence:rsa-signing', e);

// Replace line 275:
// console.error('Failed to insert seal:', sealError);
logError('seal-evidence:insert-seal', sealError);

// Replace line 289:
// console.error('Failed to update job seal status:', updateError);
logError('seal-evidence:update-job', updateError);

// Replace line 315:
// console.error('Sealing error:', error);
logError('seal-evidence:general', error);
```

3. **Update verify-evidence/index.ts:**

```typescript
import { logError, logInfo } from '../_shared/secureLogger.ts';

// Replace line 139:
// console.error('RSA Verification failed:', e);
logError('verify-evidence:rsa-verification', e);

// Replace line 208:
// console.error('Verification error:', error);
logError('verify-evidence:general', error);
```

4. **Test locally:**
```bash
# Test seal-evidence function
supabase functions serve seal-evidence

# Test verify-evidence function
supabase functions serve verify-evidence
```

5. **Deploy to production:**
```bash
supabase functions deploy seal-evidence
supabase functions deploy verify-evidence
```

### Testing Checklist

- [ ] Logger successfully sanitizes error objects
- [ ] No job_id, user_id, or email appears in logs
- [ ] Error codes and timestamps are still captured
- [ ] seal-evidence function logs correctly
- [ ] verify-evidence function logs correctly
- [ ] Production deployment successful

### Acceptance Criteria

✅ **PASS:** Logs contain only error codes, timestamps, and generic messages
❌ **FAIL:** Logs contain job IDs, user IDs, emails, or sensitive data

### Example Log Output

**BEFORE (insecure):**
```
Failed to insert seal: {
  code: 'PGRST116',
  message: 'Row not found',
  details: 'job_id: abc-123-def, user_id: 456-xyz-789, email: john@example.com'
}
```

**AFTER (secure):**
```
[seal-evidence:insert-seal] {
  error_code: 'PGRST116',
  error_name: 'PostgrestError',
  timestamp: '2026-01-22T12:34:56.789Z'
}
```

---

## Additional Recommendations (Low Priority)

### 1. Remove Plaintext Token Column

**Effort:** 30 minutes

After verifying all active tokens have `token_hash` populated:

```sql
-- Verify migration complete
SELECT COUNT(*) FROM job_access_tokens WHERE token_hash IS NULL;

-- If result is 0, drop plaintext column
ALTER TABLE job_access_tokens DROP COLUMN IF EXISTS token;
```

---

### 2. Add HMAC Deprecation Warning

**Effort:** 15 minutes

In `seal-evidence/index.ts`:

```typescript
if (!rsaPrivateKeyPem) {
  console.warn('DEPRECATION WARNING: HMAC sealing will be removed in 6 months. Please configure SEAL_PRIVATE_KEY for RSA-2048.');
  // Proceed with HMAC fallback...
}
```

---

### 3. Add Security Headers to Edge Functions

**Effort:** 30 minutes

In both Edge Functions, update CORS headers:

```typescript
const securityHeaders = {
  ...corsHeaders,
  'Content-Security-Policy': "default-src 'self'; script-src 'none'; object-src 'none';",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
};

// Use securityHeaders in all Response objects
return new Response(JSON.stringify(data), {
  status: 200,
  headers: { ...securityHeaders, 'Content-Type': 'application/json' }
});
```

---

## Deployment Checklist

- [ ] Secure logger implemented and tested
- [ ] seal-evidence function updated
- [ ] verify-evidence function updated
- [ ] Local testing passed
- [ ] Deployed to Supabase production
- [ ] Post-deployment verification (check logs)
- [ ] Security audit report reviewed by team
- [ ] Remaining low-priority items scheduled

---

## Sign-Off

**Security Audit Completed:** 2026-01-22
**Fixes Required:** 1 MEDIUM priority issue
**Recommended Timeline:** Complete within 7 days
**Next Review:** 2026-04-22 (90 days)

---

**For Questions:** Contact security team or refer to full audit report: `SECURITY_AUDIT_TRACK3_REPORT.md`
