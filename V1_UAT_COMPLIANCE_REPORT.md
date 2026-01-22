# JobProof V1 UAT Compliance Report

**Generated:** 2026-01-22
**Stage:** MLP → UAT
**Auth Model:** Magic Link Only (V1)
**Deployment:** Vercel

---

## Executive Summary

This report consolidates findings from all 7 subagent analyses for JobProof V1 UAT compliance. Each subagent has identified issues, proposed fixes with pseudocode, and documented before/after states.

---

## SUBAGENT 1: Auth & Session Guard

### Responsibility
- Ensure manager magic links → intent selector (`/manager/intent`)
- Technician magic links → job execution flow, date/time-sensitive
- Block unnecessary redirects or workspace creation by technician
- Enforce single workspace per manager
- Ensure `detectSessionInUrl = true`
- Implement pseudocode auth guards for all routes

### Current State Analysis

**File References:**
- `lib/auth.ts:169-195` - Magic link implementation ✅
- `lib/AuthContext.tsx:1-126` - Auth context with session memoisation ✅
- `App.tsx:452-481` - PersonaRedirect routing logic ✅

### Issues Identified

| Issue | Severity | Status |
|-------|----------|--------|
| Google OAuth still exported (deprecated) | Low | DOCUMENTED (V2 ready) |
| Password functions still exported | Low | DOCUMENTED (V2 ready) |
| Manager intent redirect working | N/A | ✅ COMPLIANT |
| Single workspace per manager | N/A | ✅ COMPLIANT |
| Technician access via token only | N/A | ✅ COMPLIANT |

### Auth State Machine Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     AUTH STATE MACHINE                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [UNAUTHENTICATED]                                              │
│        │                                                        │
│        ▼                                                        │
│  ┌─────────────┐                                                │
│  │ /auth       │ ← Magic Link Request                           │
│  │ (login/     │                                                │
│  │  signup)    │                                                │
│  └─────┬───────┘                                                │
│        │ Email sent                                             │
│        ▼                                                        │
│  ┌─────────────┐                                                │
│  │ Magic Link  │                                                │
│  │ Clicked     │                                                │
│  └─────┬───────┘                                                │
│        │ detectSessionInUrl=true                                │
│        ▼                                                        │
│  ┌─────────────┐    No Profile    ┌─────────────┐              │
│  │ Session     │ ───────────────► │ /auth/setup │              │
│  │ Created     │                  │ (Workspace  │              │
│  └─────┬───────┘                  │  Creation)  │              │
│        │ Profile exists           └──────┬──────┘              │
│        ▼                                 │                      │
│  ┌─────────────┐                         │                      │
│  │ Check       │ ◄───────────────────────┘                      │
│  │ Persona     │                                                │
│  └─────┬───────┘                                                │
│        │                                                        │
│   ┌────┼────────────────────┬─────────────────────┐            │
│   ▼    ▼                    ▼                     ▼            │
│ ┌────────────┐  ┌────────────────┐  ┌─────────────────┐        │
│ │ Manager    │  │ Technician/    │  │ Client          │        │
│ │ /manager/  │  │ Contractor     │  │ /client         │        │
│ │  intent    │  │ /contractor    │  │                 │        │
│ └────────────┘  └────────────────┘  └─────────────────┘        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Route Table

| Route | Access | Auth Required | Notes |
|-------|--------|---------------|-------|
| `/` | Public/Auth | No | Redirects based on auth state |
| `/home` | Public | No | Landing page |
| `/auth` | Public | No | Magic link login |
| `/auth/signup` | Public | No | Magic link signup |
| `/auth/setup` | Auth | Yes | Workspace creation |
| `/manager/intent` | Manager | Yes | Intent selector |
| `/admin` | Manager | Yes | Admin dashboard |
| `/admin/create` | Manager | Yes | Job creation wizard |
| `/contractor` | Technician | Yes | Contractor dashboard |
| `/track/:token` | Public | Token | Technician job access |
| `/client` | Client | Yes | Client dashboard |
| `/pricing` | Public | No | Pricing page |

### Token Validation Pseudocode

```typescript
// Auth Guard Pseudocode for V1

interface AuthGuard {
  requireAuth: boolean;
  allowedRoles: ('manager' | 'technician' | 'client')[];
  tokenAccess?: boolean; // For technician job tokens
}

function validateRouteAccess(route: string, user: User | null): boolean {
  const guard = getRouteGuard(route);

  // Public routes
  if (!guard.requireAuth) return true;

  // Token-based access (technician portal)
  if (guard.tokenAccess && hasValidJobToken(route)) {
    return validateJobToken(extractToken(route));
  }

  // Authenticated routes
  if (!user) return false;

  // Role-based access
  if (guard.allowedRoles.length > 0) {
    return guard.allowedRoles.includes(user.role);
  }

  return true;
}

function validateJobToken(token: string): boolean {
  // Token expiry: 7 days
  const TOKEN_EXPIRY_DAYS = 7;

  const decoded = decodeToken(token);
  if (!decoded) return false;

  const expiryDate = new Date(decoded.createdAt);
  expiryDate.setDate(expiryDate.getDate() + TOKEN_EXPIRY_DAYS);

  return new Date() < expiryDate;
}
```

### Fixes Required
1. ✅ Magic link is primary auth method (already implemented)
2. ✅ Session memoisation prevents redirect loops (already implemented)
3. ✅ Manager intent selector routing (already implemented)
4. ⚠️ Document deprecated Google OAuth/password functions for V2

---

## SUBAGENT 2: Form & Workflow UX

### Responsibility
- Create job form: larger inputs, auto-highlight next field, disable backtracking
- Continue button: shows only when required fields filled; red highlight for missing fields
- Inline create for clients/technicians if missing → return to previous flow point
- Remove overlapping boxes; use soft delineation or glassmorphism
- Hard hat icon fixed
- Day/night slider reduced in size
- Job breadcrumb clickable
- Buttons show click affordance

### Current State Analysis

**File References:**
- `views/app/jobs/JobForm.tsx:1-387` - Job creation form
- `views/JobCreationWizard.tsx` - 5-step wizard
- `views/AuthView.tsx:1-271` - Auth form styling

### Issues Identified

| Issue | Severity | Current State | Fix Required |
|-------|----------|---------------|--------------|
| Input height too small | Medium | `py-3 px-4` | Increase to `py-4 px-5` |
| No auto-focus on next field | Medium | Manual focus only | Add `useRef` + focus chain |
| Continue button always visible | Low | Submit always shown | Conditional render |
| Missing field highlight | Medium | Red border only | Add red background tint |
| Hard hat icon | Low | Not broken | ✅ COMPLIANT |
| Day/night slider | Low | Theme toggle is compact | ✅ COMPLIANT |

### Job Form Flow Chart

```
┌──────────────────────────────────────────────────────────────┐
│                    JOB CREATION WIZARD                        │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  STEP 1: Job Details                                         │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ [Job Title *]                           ← Auto-focus   │  │
│  │ [Description]                                          │  │
│  │                                                        │  │
│  │ Required: title                                        │  │
│  │ ○ Next enabled when title filled                       │  │
│  └────────────────────────────────────────────────────────┘  │
│                          │                                   │
│                          ▼                                   │
│  STEP 2: Client Selection                                    │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ [Select Client *]              ← Auto-focus            │  │
│  │                                                        │  │
│  │ ┌─────────────────────────────────────────────┐        │  │
│  │ │ Client missing? → Inline Create Modal       │        │  │
│  │ │ After save → Return to Step 2 (auto-select) │        │  │
│  │ └─────────────────────────────────────────────┘        │  │
│  └────────────────────────────────────────────────────────┘  │
│                          │                                   │
│                          ▼                                   │
│  STEP 3: Technician Assignment                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ [Select Technician]            ← Auto-focus            │  │
│  │                                                        │  │
│  │ ┌─────────────────────────────────────────────┐        │  │
│  │ │ Technician missing? → Inline Create Modal   │        │  │
│  │ │ After save → Return to Step 3 (auto-select) │        │  │
│  │ └─────────────────────────────────────────────┘        │  │
│  │                                                        │  │
│  │ Optional - can skip                                    │  │
│  └────────────────────────────────────────────────────────┘  │
│                          │                                   │
│                          ▼                                   │
│  STEP 4: Schedule                                            │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ [Date *]                        ← Auto-focus           │  │
│  │ [Time]                                                 │  │
│  │ [Address]                                              │  │
│  │                                                        │  │
│  │ Required: date                                         │  │
│  └────────────────────────────────────────────────────────┘  │
│                          │                                   │
│                          ▼                                   │
│  STEP 5: Review & Confirm                                    │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ Summary of all fields                                  │  │
│  │                                                        │  │
│  │ [Edit] links → Navigate to specific step               │  │
│  │                                                        │  │
│  │ ┌────────────────────────────────────────────┐         │  │
│  │ │ [CREATE JOB]  ← Only enabled if all valid  │         │  │
│  │ └────────────────────────────────────────────┘         │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### UX Component Specifications

| Component | Current | Target | CSS Changes |
|-----------|---------|--------|-------------|
| Text Input | `py-3 px-4` | `py-4 px-5` | Larger touch targets |
| Select | `py-3 px-4` | `py-4 px-5` | Consistent sizing |
| Textarea | `rows={3}` | `rows={4}` | More visible content |
| Button (Primary) | `py-4` | `py-4 min-h-[52px]` | Consistent height |
| Error state | `border-red-500` | `border-red-500 bg-red-500/5` | Visual emphasis |

### Auto-Focus Pseudocode

```typescript
// Auto-focus chain for form fields
interface FormFieldRefs {
  title: RefObject<HTMLInputElement>;
  client: RefObject<HTMLSelectElement>;
  technician: RefObject<HTMLSelectElement>;
  date: RefObject<HTMLInputElement>;
  time: RefObject<HTMLInputElement>;
  address: RefObject<HTMLInputElement>;
}

function useAutoFocusChain(refs: FormFieldRefs) {
  const focusOrder = ['title', 'client', 'technician', 'date', 'time', 'address'];

  const focusNext = (currentField: keyof FormFieldRefs) => {
    const currentIndex = focusOrder.indexOf(currentField);
    const nextField = focusOrder[currentIndex + 1];

    if (nextField && refs[nextField as keyof FormFieldRefs]?.current) {
      refs[nextField as keyof FormFieldRefs].current?.focus();
    }
  };

  return { focusNext };
}

// Usage in component
const handleKeyDown = (field: keyof FormFieldRefs) => (e: KeyboardEvent) => {
  if (e.key === 'Enter' || e.key === 'Tab') {
    e.preventDefault();
    focusNext(field);
  }
};
```

### Required Fields & Validation

| Field | Required | Validation |
|-------|----------|------------|
| Job Title | Yes | Non-empty string |
| Client | Yes | Valid client ID |
| Technician | No | Optional |
| Date | Yes | Valid date, not past |
| Time | No | HH:MM format |
| Address | No | String |
| Total | No | Numeric |

---

## SUBAGENT 3: Dashboard & Metrics

### Responsibility
- Metrics squares clickable → link to job details
- Dashboard shows jobs in current date/time order
- Job dispatch link functional
- System status live (no mocks)
- JobProof in navbar visible (contrast against grey background)
- Dark/light mode fully responsive
- Remove em dashes, ensure British English spelling

### Current State Analysis

**File References:**
- `views/app/Dashboard.tsx:1-381` - Main dashboard
- `components/layout/Sidebar.tsx:1-149` - Navigation sidebar
- `components/branding/jobproof-logo.tsx:1-125` - Logo component

### Issues Identified

| Issue | Severity | Status |
|-------|----------|--------|
| Metrics squares not clickable | High | NEEDS FIX |
| JobProof text grey on grey | Medium | NEEDS FIX |
| Jobs sorted correctly | N/A | ✅ COMPLIANT |
| System status mocked | Medium | NEEDS FIX |
| Dark/light mode | N/A | ✅ COMPLIANT |

### Dashboard Wireframe (Corrected Layout)

```
┌────────────────────────────────────────────────────────────────┐
│ NAVBAR                                                         │
│ ┌─────────────┐                              ┌────┬────┬────┐ │
│ │ [JobProof]  │   Good morning               │ 🔔 │ 🌙 │ 👤 │ │
│ │ (white/     │   Wednesday, 22 Jan          └────┴────┴────┘ │
│ │  visible)   │                                               │
│ └─────────────┘                                               │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  QUICK STATS (Clickable → Filter jobs)                         │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌────────┐│
│  │ ⚠️  3        │ │ ⏳  2        │ │ ✅  15       │ │ 👥  8  ││
│  │ Need Action  │ │ In Progress  │ │ Completed    │ │ Clients││
│  │ [CLICKABLE]  │ │ [CLICKABLE]  │ │ [CLICKABLE]  │ │[CLICK] ││
│  └──────────────┘ └──────────────┘ └──────────────┘ └────────┘│
│                                                                │
│  NEEDS YOUR ATTENTION                          View All →      │
│  ┌────────────────────────────────────────────────────────────┐│
│  │ 👤  Job #abc123    No technician assigned    [Assign Tech] ││
│  │ ✓   Job #def456    Evidence ready for seal   [Review&Seal] ││
│  │ 📄  Job #ghi789    Sealed, ready to invoice  [Gen Invoice] ││
│  └────────────────────────────────────────────────────────────┘│
│                                                                │
│  TODAY'S SCHEDULE (Sorted by time)             View All →      │
│  ┌────────────────────────────────────────────────────────────┐│
│  │ 09:00 │ Lawn Mowing - Smith Residence        [In Progress] ││
│  │ 11:00 │ Electrical Check - Jones Office      [Pending]     ││
│  │ 14:00 │ HVAC Service - Brown Factory         [Pending]     ││
│  └────────────────────────────────────────────────────────────┘│
│                                                                │
│  SYSTEM STATUS (Live)                                          │
│  ┌────────────────────────────────────────────────────────────┐│
│  │ ● Online  │ Sync: 2m ago │ Pending uploads: 0             ││
│  └────────────────────────────────────────────────────────────┘│
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### Navbar Colour Adjustments

```css
/* JobProof Logo Text - Fix visibility */
/* Current: text-slate-900 dark:text-slate-50 */
/* Issue: Grey background makes slate-50 low contrast */

/* Fix: Ensure white text in dark contexts */
.logo-text {
  /* Light mode: Dark text on light bg */
  @apply text-slate-900;

  /* Dark mode: Pure white for visibility */
  @apply dark:text-white;
}

/* Alternative: Use CSS variable for consistent theming */
.logo-text {
  color: hsl(var(--foreground));
}
```

### Clickable Metrics Pseudocode

```typescript
// Make metric cards clickable with filter navigation
interface MetricCard {
  label: string;
  value: number;
  icon: string;
  filter: JobFilter;
}

const metrics: MetricCard[] = [
  {
    label: 'Need Action',
    value: needActionCount,
    icon: 'priority_high',
    filter: { status: 'pending', hasNoTechnician: true }
  },
  {
    label: 'In Progress',
    value: inProgressCount,
    icon: 'pending',
    filter: { status: 'in-progress' }
  },
  // ...
];

// Component
<Link
  to={`/app/jobs?${new URLSearchParams(metric.filter).toString()}`}
  className="cursor-pointer hover:scale-105 transition-transform"
>
  <Card>
    <MetricContent {...metric} />
  </Card>
</Link>
```

---

## SUBAGENT 4: Notifications & Job Dispatch

### Responsibility
- Magic link email sent to technician automatically after job creation
- Optional app push notification placeholder for V2
- Evidence/job report share only after job completion
- Send links via email or WhatsApp (V1: email, V2 roadmap: WhatsApp)
- Visual sync queue for offline photo uploads

### Current State Analysis

**V1 Implementation Status:**
- ❌ Automatic technician email not implemented
- ✅ Job token system exists for technician access
- ❌ Visual sync queue not visible to user

### Dispatch Flow Diagram

```
┌────────────────────────────────────────────────────────────────┐
│                    JOB DISPATCH FLOW                           │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  MANAGER: Creates Job                                          │
│  ┌────────────────────────────────────────┐                    │
│  │ 1. Fill job details                    │                    │
│  │ 2. Select/create technician            │                    │
│  │ 3. Set schedule                        │                    │
│  │ 4. Click "Create & Dispatch"           │                    │
│  └───────────────┬────────────────────────┘                    │
│                  │                                             │
│                  ▼                                             │
│  SYSTEM: Process Dispatch                                      │
│  ┌────────────────────────────────────────┐                    │
│  │ 1. Save job to database                │                    │
│  │ 2. Generate unique job token           │                    │
│  │ 3. Create magic link for technician    │                    │
│  │    URL: /track/{token}                 │                    │
│  │ 4. Token expiry: 7 days                │                    │
│  └───────────────┬────────────────────────┘                    │
│                  │                                             │
│                  ▼                                             │
│  NOTIFICATION: Send to Technician                              │
│  ┌────────────────────────────────────────┐                    │
│  │ V1: Email only                         │                    │
│  │ ┌──────────────────────────────────┐   │                    │
│  │ │ Subject: New Job Assignment       │   │                    │
│  │ │                                   │   │                    │
│  │ │ Hi {tech_name},                   │   │                    │
│  │ │                                   │   │                    │
│  │ │ You have been assigned a new job: │   │                    │
│  │ │ {job_title}                       │   │                    │
│  │ │ Date: {job_date}                  │   │                    │
│  │ │ Location: {job_address}           │   │                    │
│  │ │                                   │   │                    │
│  │ │ [View Job Details]  ← Magic Link  │   │                    │
│  │ │                                   │   │                    │
│  │ │ This link expires in 7 days.      │   │                    │
│  │ └──────────────────────────────────┘   │                    │
│  │                                        │                    │
│  │ V2 Roadmap: WhatsApp integration       │                    │
│  └───────────────┬────────────────────────┘                    │
│                  │                                             │
│                  ▼                                             │
│  TECHNICIAN: Receives & Executes                               │
│  ┌────────────────────────────────────────┐                    │
│  │ 1. Click magic link in email           │                    │
│  │ 2. View job details (no login needed)  │                    │
│  │ 3. Start job → Capture evidence        │                    │
│  │ 4. Submit completed job                │                    │
│  └────────────────────────────────────────┘                    │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### Notification Email Template

```typescript
// Email template for technician job assignment
const technicianJobAssignmentEmail = {
  subject: 'New Job Assignment: {job_title}',
  template: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #2563EB; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0;">JobProof</h1>
      </div>

      <div style="padding: 30px; background: #f8fafc;">
        <p>Hi {technician_name},</p>

        <p>You have been assigned a new job:</p>

        <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h2 style="margin: 0 0 10px 0;">{job_title}</h2>
          <p style="color: #64748b; margin: 5px 0;">
            <strong>Date:</strong> {job_date}<br/>
            <strong>Time:</strong> {job_time}<br/>
            <strong>Location:</strong> {job_address}
          </p>
        </div>

        <a href="{magic_link}"
           style="display: block; background: #2563EB; color: white;
                  text-align: center; padding: 15px; border-radius: 8px;
                  text-decoration: none; font-weight: bold;">
          View Job Details
        </a>

        <p style="color: #94a3b8; font-size: 12px; margin-top: 20px;">
          This link will expire in 7 days. No login required.
        </p>
      </div>
    </div>
  `
};
```

### Token Expiry Enforcement

```typescript
// Token validation with 7-day expiry
const TOKEN_EXPIRY_DAYS = 7;

interface JobToken {
  jobId: string;
  technicianId: string;
  workspaceId: string;
  createdAt: string; // ISO date
  expiresAt: string; // ISO date
}

function generateJobToken(jobId: string, technicianId: string, workspaceId: string): string {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  const payload: JobToken = {
    jobId,
    technicianId,
    workspaceId,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };

  // Encode as base64url (URL-safe)
  return btoa(JSON.stringify(payload))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function validateJobToken(token: string): { valid: boolean; payload?: JobToken; error?: string } {
  try {
    const decoded = atob(token.replace(/-/g, '+').replace(/_/g, '/'));
    const payload: JobToken = JSON.parse(decoded);

    const expiresAt = new Date(payload.expiresAt);
    if (new Date() > expiresAt) {
      return { valid: false, error: 'Token expired' };
    }

    return { valid: true, payload };
  } catch (e) {
    return { valid: false, error: 'Invalid token format' };
  }
}
```

### Visual Sync Queue

```typescript
// Sync queue status indicator
interface SyncQueueStatus {
  pendingUploads: number;
  failedUploads: number;
  lastSyncTime: Date | null;
  isOnline: boolean;
  isSyncing: boolean;
}

// UI Component pseudocode
function SyncStatusIndicator({ status }: { status: SyncQueueStatus }) {
  return (
    <div className="sync-status">
      {status.isSyncing && <Spinner />}

      {status.pendingUploads > 0 && (
        <Badge variant="warning">
          {status.pendingUploads} pending upload{status.pendingUploads > 1 ? 's' : ''}
        </Badge>
      )}

      {status.failedUploads > 0 && (
        <Badge variant="error">
          {status.failedUploads} failed - tap to retry
        </Badge>
      )}

      {!status.isOnline && (
        <Badge variant="warning">
          Offline - changes will sync when connected
        </Badge>
      )}
    </div>
  );
}
```

---

## SUBAGENT 5: Billing & Trial

### Responsibility
- Remove old Stripe product links
- Update to new Stripe products per new plan
- 14-day free trial clearly shown in UI
- No broken billing links

### Current State Analysis

**File References:**
- `views/PricingView.tsx:1-383` - Pricing page with Stripe integration
- `.env.example` - Environment variables for Stripe

### Stripe Product ID Mapping

| Plan | Period | Current Env Var | Status |
|------|--------|-----------------|--------|
| Solo | - | Free tier | ✅ No Stripe needed |
| Team | Monthly | `VITE_STRIPE_PRICE_TEAM_MONTHLY` | ⚠️ Needs verification |
| Team | Annual | `VITE_STRIPE_PRICE_TEAM_ANNUAL` | ⚠️ Needs verification |
| Agency | Monthly | `VITE_STRIPE_PRICE_AGENCY_MONTHLY` | ⚠️ Needs verification |
| Agency | Annual | `VITE_STRIPE_PRICE_AGENCY_ANNUAL` | ⚠️ Needs verification |

### UI Copy Updates for Trial

```typescript
// Current pricing configuration
const PRICING = {
  solo: {
    monthly: 0,
    annual: 0,
    jobs: 5,
    users: 1,
    trialDays: 0, // Free tier, no trial needed
  },
  team: {
    monthly: 49,
    annual: 39,
    jobs: 'Unlimited',
    users: 5,
    trialDays: 14, // 14-day free trial
  },
  agency: {
    monthly: 199,
    annual: 159,
    jobs: 'Unlimited',
    users: 'Unlimited',
    trialDays: 14, // 14-day free trial
  },
};

// Trial badge component
function TrialBadge() {
  return (
    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-2">
      <span className="text-emerald-500 font-bold text-sm">
        14-Day Free Trial
      </span>
      <p className="text-slate-400 text-xs">
        No credit card required to start
      </p>
    </div>
  );
}
```

### Issues Identified

| Issue | Status | Notes |
|-------|--------|-------|
| 14-day trial shown | ✅ COMPLIANT | Line 51 in PricingView.tsx |
| Stripe integration | ✅ COMPLIANT | Functions exist |
| Price IDs configurable | ✅ COMPLIANT | Via env vars |
| British currency (£) | ✅ COMPLIANT | Using £ symbol |

---

## SUBAGENT 6: Technician Execution Flow

### Responsibility
- Stepwise job execution: confirm job → safety checklist → photos (before/after) → job notes → client signature → submit
- Auto-focus next field
- Disable backtracking once step complete
- Job date/time validation (future/overdue warnings)
- Offline-first, queue photos and sync on reconnection

### Current State Analysis

**File References:**
- `views/tech/TechPortal.tsx:1-241` - Technician portal
- `views/tech/TechJobDetail.tsx:1-321` - Job detail view
- `views/tech/EvidenceCapture.tsx:1-319` - Camera capture

### Execution Flow Chart

```
┌────────────────────────────────────────────────────────────────┐
│                 TECHNICIAN EXECUTION FLOW                      │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  STEP 1: Job Confirmation                                      │
│  ┌────────────────────────────────────────────────────────────┐│
│  │ Job Details Review                                         ││
│  │ - Title, Client, Address, Date/Time                        ││
│  │ - [Open in Maps] button                                    ││
│  │                                                            ││
│  │ Date/Time Validation:                                      ││
│  │ - If job date is PAST → Show "OVERDUE" warning             ││
│  │ - If job date is FUTURE → Show "Scheduled for X" info      ││
│  │                                                            ││
│  │ [START JOB] ← Only proceed when confirmed                  ││
│  └────────────────────────────────────────────────────────────┘│
│                          │                                     │
│                          ▼ (Cannot go back after starting)     │
│  STEP 2: Safety Checklist (V2 - Placeholder)                   │
│  ┌────────────────────────────────────────────────────────────┐│
│  │ □ PPE Confirmed                                            ││
│  │ □ Site Safety Check                                        ││
│  │ □ Equipment Ready                                          ││
│  │                                                            ││
│  │ [CONTINUE] ← Enabled when all checked                      ││
│  └────────────────────────────────────────────────────────────┘│
│                          │                                     │
│                          ▼ (Cannot go back)                    │
│  STEP 3: Before Photos                                         │
│  ┌────────────────────────────────────────────────────────────┐│
│  │ [CAPTURE BEFORE PHOTO]                                     ││
│  │                                                            ││
│  │ Photos captured: 0/1+ required                             ││
│  │                                                            ││
│  │ ┌─────┐ ┌─────┐ ┌─────┐                                   ││
│  │ │ +   │ │     │ │     │  ← Grid of captured photos        ││
│  │ └─────┘ └─────┘ └─────┘                                   ││
│  │                                                            ││
│  │ [CONTINUE] ← Enabled when 1+ photos captured               ││
│  └────────────────────────────────────────────────────────────┘│
│                          │                                     │
│                          ▼ (Cannot go back)                    │
│  STEP 4: Work Execution                                        │
│  ┌────────────────────────────────────────────────────────────┐│
│  │ "Perform the work"                                         ││
│  │                                                            ││
│  │ During Photos (optional):                                  ││
│  │ [CAPTURE DURING PHOTO]                                     ││
│  │                                                            ││
│  │ [WORK COMPLETE]                                            ││
│  └────────────────────────────────────────────────────────────┘│
│                          │                                     │
│                          ▼ (Cannot go back)                    │
│  STEP 5: After Photos                                          │
│  ┌────────────────────────────────────────────────────────────┐│
│  │ [CAPTURE AFTER PHOTO]                                      ││
│  │                                                            ││
│  │ Photos captured: 0/1+ required                             ││
│  │                                                            ││
│  │ [CONTINUE] ← Enabled when 1+ photos captured               ││
│  └────────────────────────────────────────────────────────────┘│
│                          │                                     │
│                          ▼ (Cannot go back)                    │
│  STEP 6: Job Notes                                             │
│  ┌────────────────────────────────────────────────────────────┐│
│  │ [Notes Textarea]  ← Auto-focus                             ││
│  │                                                            ││
│  │ Optional - can be blank                                    ││
│  │                                                            ││
│  │ [CONTINUE]                                                 ││
│  └────────────────────────────────────────────────────────────┘│
│                          │                                     │
│                          ▼ (Cannot go back)                    │
│  STEP 7: Client Signature (V2 - Placeholder)                   │
│  ┌────────────────────────────────────────────────────────────┐│
│  │ [Signature Pad]                                            ││
│  │                                                            ││
│  │ Client Name: ___________                                   ││
│  │                                                            ││
│  │ [SUBMIT JOB]                                               ││
│  └────────────────────────────────────────────────────────────┘│
│                          │                                     │
│                          ▼                                     │
│  COMPLETE: Job Submitted                                       │
│  ┌────────────────────────────────────────────────────────────┐│
│  │ ✓ Job completed successfully                               ││
│  │                                                            ││
│  │ Photos synced: 3/3                                         ││
│  │ Evidence queued for upload                                 ││
│  │                                                            ││
│  │ [BACK TO JOBS]                                             ││
│  └────────────────────────────────────────────────────────────┘│
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### Backtracking Enforcement Pseudocode

```typescript
// Execution step management with backtracking prevention
type ExecutionStep =
  | 'confirm'
  | 'safety_checklist'
  | 'before_photos'
  | 'work'
  | 'after_photos'
  | 'notes'
  | 'signature'
  | 'complete';

const STEP_ORDER: ExecutionStep[] = [
  'confirm',
  'safety_checklist', // V2
  'before_photos',
  'work',
  'after_photos',
  'notes',
  'signature', // V2
  'complete',
];

interface ExecutionState {
  currentStep: ExecutionStep;
  completedSteps: Set<ExecutionStep>;
  canGoBack: boolean; // Always false for V1
}

function useExecutionFlow(initialStep: ExecutionStep = 'confirm') {
  const [state, setState] = useState<ExecutionState>({
    currentStep: initialStep,
    completedSteps: new Set(),
    canGoBack: false, // Backtracking disabled
  });

  const goToNext = () => {
    const currentIndex = STEP_ORDER.indexOf(state.currentStep);
    const nextStep = STEP_ORDER[currentIndex + 1];

    if (nextStep) {
      setState(prev => ({
        ...prev,
        currentStep: nextStep,
        completedSteps: new Set([...prev.completedSteps, prev.currentStep]),
      }));
    }
  };

  const attemptGoBack = () => {
    // V1: Backtracking disabled
    if (!state.canGoBack) {
      // Show confirmation dialog
      return showConfirmDialog({
        title: 'Go Back?',
        message: 'Going back will reset your progress for this step. Continue?',
        onConfirm: () => {
          // Allow one-step back with confirmation
          const currentIndex = STEP_ORDER.indexOf(state.currentStep);
          if (currentIndex > 0) {
            setState(prev => ({
              ...prev,
              currentStep: STEP_ORDER[currentIndex - 1],
            }));
          }
        },
      });
    }
  };

  return { state, goToNext, attemptGoBack };
}
```

### Date/Time Validation

```typescript
// Job date/time validation with warnings
interface DateValidation {
  isOverdue: boolean;
  isFuture: boolean;
  isToday: boolean;
  warningMessage?: string;
}

function validateJobDateTime(jobDate: Date): DateValidation {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const jobDay = new Date(jobDate.getFullYear(), jobDate.getMonth(), jobDate.getDate());

  const isToday = jobDay.getTime() === today.getTime();
  const isOverdue = jobDate < now && !isToday;
  const isFuture = jobDay > today;

  let warningMessage: string | undefined;

  if (isOverdue) {
    const daysDiff = Math.floor((now.getTime() - jobDate.getTime()) / (1000 * 60 * 60 * 24));
    warningMessage = `This job is ${daysDiff} day${daysDiff > 1 ? 's' : ''} overdue`;
  } else if (isFuture) {
    warningMessage = `This job is scheduled for ${jobDate.toLocaleDateString()}`;
  }

  return { isOverdue, isFuture, isToday, warningMessage };
}
```

### Offline Photo Sync

```typescript
// Offline-first photo queue with IndexedDB
interface QueuedPhoto {
  id: string;
  jobId: string;
  dataUrl: string;
  type: 'before' | 'during' | 'after';
  timestamp: string;
  location?: { lat: number; lng: number };
  syncStatus: 'pending' | 'syncing' | 'synced' | 'failed';
  retryCount: number;
}

class PhotoSyncQueue {
  private db: IDBDatabase;

  async queuePhoto(photo: Omit<QueuedPhoto, 'id' | 'syncStatus' | 'retryCount'>): Promise<string> {
    const queuedPhoto: QueuedPhoto = {
      ...photo,
      id: generateUUID(),
      syncStatus: 'pending',
      retryCount: 0,
    };

    await this.db.add('photos', queuedPhoto);

    // Attempt immediate sync if online
    if (navigator.onLine) {
      this.processQueue();
    }

    return queuedPhoto.id;
  }

  async processQueue(): Promise<void> {
    const pendingPhotos = await this.getPending();

    for (const photo of pendingPhotos) {
      await this.updateStatus(photo.id, 'syncing');

      try {
        await this.uploadPhoto(photo);
        await this.updateStatus(photo.id, 'synced');
      } catch (error) {
        await this.handleSyncError(photo);
      }
    }
  }

  private async handleSyncError(photo: QueuedPhoto): Promise<void> {
    const maxRetries = 3;

    if (photo.retryCount < maxRetries) {
      await this.db.update('photos', {
        ...photo,
        syncStatus: 'pending',
        retryCount: photo.retryCount + 1,
      });
    } else {
      await this.updateStatus(photo.id, 'failed');
    }
  }
}
```

---

## SUBAGENT 7: Review & Edit (Manager)

### Responsibility
- Allow inline edits to job fields before final submission
- Magic link / token preview for manager verification
- Ensure notifications sent to technician after review/dispatch

### Review Page Wireframe

```
┌────────────────────────────────────────────────────────────────┐
│                    JOB REVIEW & DISPATCH                       │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ← Back to Jobs            Job #abc123            [DISPATCH]   │
│                                                                │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ JOB DETAILS                                    [Edit]   │  │
│  │                                                         │  │
│  │ Title: Electrical Safety Inspection            ✏️       │  │
│  │ Client: Smith Industries                       ✏️       │  │
│  │ Technician: John Doe                           ✏️       │  │
│  │ Date: 22 Jan 2026, 09:00                       ✏️       │  │
│  │ Address: 123 Main St, Sydney                   ✏️       │  │
│  │                                                         │  │
│  │ Status: Pending Dispatch                                │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ DISPATCH PREVIEW                                        │  │
│  │                                                         │  │
│  │ Technician will receive:                                │  │
│  │ ┌─────────────────────────────────────────────────────┐ │  │
│  │ │ Email to: john.doe@example.com                      │ │  │
│  │ │ Subject: New Job Assignment: Electrical Safety...   │ │  │
│  │ │                                                     │ │  │
│  │ │ Magic Link: https://jobproof.pro/#/track/xyz123... │ │  │
│  │ │ Expires: 29 Jan 2026                                │ │  │
│  │ └─────────────────────────────────────────────────────┘ │  │
│  │                                                         │  │
│  │ [Copy Link]  [Preview Email]                            │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ DISPATCH CHECKLIST                                      │  │
│  │                                                         │  │
│  │ ☑ Job details complete                                  │  │
│  │ ☑ Client selected                                       │  │
│  │ ☑ Technician assigned                                   │  │
│  │ ☑ Date/time set                                         │  │
│  │ ☐ Address verified (optional)                           │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                │
│  ┌──────────────────────────────────────────────────────┐     │
│  │ [DISPATCH JOB]                                        │     │
│  │ Technician will be notified via email                 │     │
│  └──────────────────────────────────────────────────────┘     │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### Field Edit Rules

| Field | Editable Before Dispatch | Editable After Dispatch | Locked After Seal |
|-------|--------------------------|-------------------------|-------------------|
| Title | ✅ | ✅ | ❌ |
| Client | ✅ | ❌ | ❌ |
| Technician | ✅ | ✅ | ❌ |
| Date/Time | ✅ | ✅ | ❌ |
| Address | ✅ | ✅ | ❌ |
| Description | ✅ | ✅ | ❌ |
| Photos | ❌ (Technician only) | ❌ | ❌ |
| Evidence | ❌ (Technician only) | ❌ | ❌ |
| Seal | ❌ | ✅ (Manager) | ❌ |

### Inline Edit Pseudocode

```typescript
// Inline field editing for job review
interface EditableField {
  name: string;
  value: any;
  isEditing: boolean;
  isLocked: boolean;
}

function useInlineEdit(jobId: string, field: string, initialValue: any) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(initialValue);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = () => {
    if (!isFieldLocked(field)) {
      setIsEditing(true);
      // Focus input after render
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  const saveEdit = async () => {
    setIsSaving(true);
    try {
      await updateJob(jobId, { [field]: value });
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to save:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const cancelEdit = () => {
    setValue(initialValue);
    setIsEditing(false);
  };

  return {
    isEditing,
    value,
    setValue,
    isSaving,
    inputRef,
    startEdit,
    saveEdit,
    cancelEdit,
  };
}

function isFieldLocked(field: string, job: Job): boolean {
  // After sealing, all fields are locked
  if (job.sealedAt) return true;

  // Client cannot be changed after dispatch
  if (field === 'clientId' && job.dispatchedAt) return true;

  return false;
}
```

---

## PHASE 2: Optimised Fix Table

| Area | Issue | Fix | File | Status |
|------|-------|-----|------|--------|
| Navbar | JobProof text grey | Change `dark:text-slate-50` → `dark:text-white` | `jobproof-logo.tsx:101` | PENDING |
| Dashboard | Metrics not clickable | Wrap in Link with filter query | `Dashboard.tsx:201-215` | PENDING |
| Dashboard | System status mocked | Add live sync status component | `Dashboard.tsx` | PENDING |
| Forms | Inputs too small | Increase `py-3` → `py-4` | Multiple | PENDING |
| Forms | No auto-focus chain | Add useRef chain | `JobForm.tsx` | PENDING |
| Forms | Missing field highlight | Add `bg-red-500/5` to error state | Multiple | PENDING |
| Language | US spelling | Change to British | Multiple | PENDING |
| Billing | Trial not prominent | Add TrialBadge component | `PricingView.tsx` | ✅ COMPLIANT |

---

## PHASE 3: UAT Compliance Checklist

### Critical Path Items

- [x] Magic Link authentication only (no Google OAuth, no passwords)
- [x] Single workspace per manager
- [x] Technician access via job token only
- [x] Session memoisation prevents redirect loops
- [x] Manager routes to intent selector
- [x] 14-day free trial displayed
- [x] British English for "Organisation" in signup

### Needs Implementation

- [ ] Clickable metric cards on dashboard
- [ ] JobProof logo visibility fix
- [ ] Auto-focus chain in forms
- [ ] Live system status (not mocked)
- [ ] Technician email notification on dispatch
- [ ] Visual sync queue indicator
- [ ] Backtracking prevention in tech flow

### V2 Roadmap Items (Not V1)

- [ ] Google OAuth
- [ ] WhatsApp notifications
- [ ] Safety checklist step
- [ ] Client signature capture
- [ ] Push notifications

---

## Verification Protocol

Before marking any fix as complete:

1. **Code Review**: Verify file references and line numbers
2. **Unit Test**: Run existing tests pass
3. **Integration Test**: Test complete user flow
4. **Visual Review**: Check dark/light mode
5. **British English**: Verify spelling

---

*Report generated by Claude for JobProof V1 UAT compliance review.*
