<div align="center">

# JobProof

**Offline-First Field Service Evidence Platform**

*Cryptographic proof of work for field service professionals in poor-connectivity environments*

[![TypeScript](https://img.shields.io/badge/TypeScript-5.8_strict-blue?logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.2-61DAFB?logo=react)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-6.2-646CFF?logo=vite)](https://vitejs.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL_17-3ECF8E?logo=supabase)](https://supabase.com/)
[![Tests](https://img.shields.io/badge/Tests-1488_passing-success)](./tests)

[Features](#features) | [Architecture](#architecture) | [Quick Start](#quick-start) | [Enterprise](#enterprise-features) | [Security](#security)

</div>

---

## Overview

JobProof is a production-ready field evidence platform built for field workers in remote sites, underground environments, and areas with zero connectivity. Every piece of evidence is cryptographically sealed, GPS-verified, and tamper-evident.

- **Offline-First** - Full functionality without internet. Data survives airplane mode + app restart.
- **Cryptographic Sealing** - RSA-2048 + SHA-256 digital signatures for legally defensible records.
- **Bunker Mode** - No-auth public job runner for zero-service environments. No login required.
- **Enterprise Ready** - API keys, webhooks, team management, audit logging, SSO infrastructure.
- **Multi-Persona** - Contractors, agency owners, technicians, clients, site supervisors.

---

## Features

### Core Platform

- **Evidence Capture** - Photos, signatures, timestamps with GPS + what3words metadata
- **Cryptographic Sealing** - RSA-2048 signatures with SHA-256 evidence hashing
- **Offline-First Storage** - Dexie/IndexedDB v6 with automatic sync queue
- **Location Verification** - GPS coordinates + what3words addresses
- **Role-Based Access** - Admin, manager, technician, and client portals
- **Job Reports** - PDF-ready reports with embedded evidence
- **Safety Checklists** - Enforced compliance before job completion
- **Magic Links** - Passwordless technician access (no app install required)

### Bunker Mode

Zero-connectivity job capture for field workers in basements, tunnels, and remote sites:

- No authentication required - job ID in URL is the permission
- 4-step wizard: Before Photo > After Photo > Signature > Sync
- Own IndexedDB database (survives app restarts)
- Auto-sync when connectivity returns
- Email handshake for manager/client notifications

### User Portals

**Admins/Managers** - Create jobs, assign technicians, review evidence, generate reports, manage teams, seal completed work.

**Field Technicians** - Access jobs via magic links, capture photos/signatures offline, submit from any location, GPS + what3words verification.

**Clients** - View job progress, provide digital signatures, review completed evidence, track job history.

---

## Architecture

### Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React 18 + TypeScript 5.8 (strict) | Type-safe UI components |
| **Build** | Vite 6.2 + Terser | Fast builds, code splitting, tree shaking |
| **Styling** | Tailwind CSS 3.4 | Utility-first responsive design |
| **Animation** | Framer Motion 12.x | Shared animation constants |
| **Routing** | React Router 6.22 | Hash-based client-side navigation |
| **State** | React Context (DataContext) | Single source of truth for all data |
| **Offline** | Dexie v4 (IndexedDB v6 schema) | 8-table client-side database |
| **Backend** | Supabase | PostgreSQL + Auth + Storage + Edge Functions |
| **Database** | PostgreSQL 17 | 39 migrations, RLS on all tables |
| **Auth** | Supabase Auth | Email/password + Google OAuth + Magic Links |
| **Edge Functions** | Deno (10 functions) | Sealing, verification, payments, API |
| **Payments** | Stripe | Checkout, portal, webhooks |
| **Testing** | Vitest + Playwright | 1488 unit/integration/E2E tests |
| **Deployment** | Vercel | Serverless hosting with preview deploys |

### Project Structure

```
trust_by_design/
├── components/                 # React UI components
│   ├── ui/                    # ActionButton, Card, Modal, StatusBadge, Tooltip
│   ├── layout/                # AppShell, BottomNav, PageHeader, Sidebar
│   ├── dashboard/             # MetricsCard, TeamStatusBar, ProofGapBar
│   ├── evidence/              # ForensicPhotoCard, ProofPairCard, SealingAnimation
│   ├── modals/                # ModalBase, QuickAssignModal, QuickSearchModal
│   ├── branding/              # Logo & brand assets
│   ├── ProtectedRoute.tsx     # Auth guard wrapper
│   └── RouteErrorBoundary.tsx # Route-level error boundary
│
├── views/                     # Page-level components
│   ├── app/                   # Admin routes
│   │   ├── jobs/              # JobsList, JobDetail, JobForm, EvidenceReview
│   │   ├── clients/           # ClientForm
│   │   ├── technicians/       # TechnicianForm
│   │   ├── ManagerFocusDashboard.tsx
│   │   └── SoloContractorDashboard.tsx
│   ├── tech/                  # Technician portal
│   │   ├── TechPortal.tsx     # Technician home
│   │   ├── TechJobDetail.tsx  # Job detail view
│   │   ├── EvidenceCapture.tsx # Photo/signature capture
│   │   └── TechEvidenceReview.tsx
│   ├── bunker/                # Offline-first bunker mode
│   │   └── JobRunner.tsx      # Self-contained job evidence capture
│   ├── BunkerRun.tsx          # Public bunker entry point
│   ├── AuthView.tsx           # Email + magic link auth
│   ├── OAuthSetup.tsx         # New user setup + persona selection
│   ├── LandingPage.tsx        # Public marketing page
│   ├── Settings.tsx           # Workspace settings
│   └── ...                    # 20+ additional views
│
├── lib/                       # Core business logic
│   ├── DataContext.tsx        # Centralized data state (single source of truth)
│   ├── AuthContext.tsx        # Auth state with session memoization
│   ├── db.ts                  # Supabase database operations
│   ├── sealing.ts             # RSA-2048 evidence sealing
│   ├── encryption.ts          # AES-256-GCM encryption
│   ├── syncQueue.ts           # Offline sync with exponential backoff
│   ├── auditLog.ts            # Tamper-evident audit logging
│   ├── apiKeys.ts             # API key management (HMAC-SHA256)
│   ├── webhookDispatcher.ts   # Webhook delivery with retry
│   ├── ssoConfig.ts           # SAML 2.0 + OIDC SSO
│   ├── teamManagement.ts      # Team roles and invitations
│   ├── featureFlags.ts        # 10 feature flags with rollout control
│   ├── animations.ts          # Shared Framer Motion constants
│   ├── offline/               # Offline subsystem
│   │   ├── db.ts              # Dexie IndexedDB v6 schema (8 tables)
│   │   ├── sync.ts            # Conflict resolution
│   │   ├── archive.ts         # Auto-archive sealed jobs >180 days
│   │   └── cleanup.ts         # Storage quota management
│   └── services/              # External service integrations
│
├── hooks/                     # Custom React hooks
│   ├── useJobGuard.ts         # Client-first validation
│   └── useAuthFlow.ts         # Auth state machine
│
├── supabase/
│   ├── migrations/            # 39 SQL migrations (RLS policies)
│   └── functions/             # 10 Edge Functions
│       ├── seal-evidence/     # RSA-2048 cryptographic sealing
│       ├── verify-evidence/   # Evidence integrity verification
│       ├── api-v1/            # REST API with scoped access
│       ├── rate-limiter/      # Request rate limiting
│       ├── stripe-checkout/   # Stripe payment sessions
│       ├── stripe-portal/     # Customer billing portal
│       ├── stripe-webhook/    # Stripe event handling
│       ├── send-magic-link/   # Technician magic links
│       ├── send-email/        # Notification emails
│       └── generate-report/   # PDF report generation
│
├── tests/
│   ├── unit/                  # 76 test files, 1488 tests
│   └── e2e/                   # Playwright E2E tests
│
├── types.ts                   # TypeScript type definitions
├── App.tsx                    # Root app with lazy-loaded routes
└── vite.config.ts             # Build config (18 manual chunks, Terser)
```

### Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     JobProof Architecture                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────┐    ┌─────────────┐    ┌───────────────────────┐   │
│  │ Browser  │───>│ DataContext  │───>│ Supabase (PostgreSQL) │   │
│  │ (React)  │    │ (source of  │    │ + RLS + Edge Funcs    │   │
│  └──────────┘    │  truth)     │    └───────────────────────┘   │
│       │          └─────────────┘              │                  │
│       │                │                     │                  │
│       v                v                     v                  │
│  ┌──────────┐    ┌─────────────┐    ┌───────────────────────┐   │
│  │ IndexedDB│<──>│ Sync Queue  │───>│ Edge Functions (Deno) │   │
│  │ (Dexie)  │    │ (offline →  │    │ seal / verify / api   │   │
│  │ 8 tables │    │   online)   │    │ stripe / email        │   │
│  └──────────┘    └─────────────┘    └───────────────────────┘   │
│                                              │                  │
│  ┌──────────┐    ┌─────────────┐             │                  │
│  │ Bunker   │───>│ BunkerRunDB │    ┌────────┴──────────────┐   │
│  │ Mode     │    │ (separate   │    │ Webhooks / API Keys   │   │
│  │ (no auth)│    │  Dexie DB)  │    │ Audit Log / SSO       │   │
│  └──────────┘    └─────────────┘    └───────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Offline-First Architecture

1. **Capture** - All data stored in IndexedDB immediately (every keystroke)
2. **Queue** - Changes added to sync queue with exponential backoff (7 retries)
3. **Sync** - Background sync when network available (real ping test, not just `navigator.onLine`)
4. **Resolve** - Conflict detection with last-write-wins + telemetry
5. **Seal** - Jobs sealed server-side with RSA-2048 + SHA-256

### Sync Queue Retry Strategy

```
Retry 1: 2s → Retry 2: 4s → Retry 3: 8s → Retry 4: 15s
→ Retry 5: 30s → Retry 6: 60s → Retry 7: 60s
Total window: ~3 minutes before failure
```

---

## Enterprise Features

### API Keys (REST API v1)

Scoped API access for third-party integrations:

- **HMAC-SHA256** key hashing (keys never stored in plaintext)
- **Resource:operation** scoping (jobs:read, clients:write, etc.)
- **Rate limiting** per key (default 1000 req/min)
- **Expiration** support with auto-revocation
- **Max 10 keys** per workspace

### Webhook System

Real-time event notifications with 13 event types:

- `job.created`, `job.updated`, `job.completed`, `job.sealed`, `job.deleted`
- `client.created`, `client.updated`
- `technician.assigned`, `technician.completed`
- `invoice.created`, `invoice.paid`
- `evidence.sealed`, `evidence.verified`
- **HMAC-SHA256** signature verification on every delivery
- **Exponential backoff** retry (5s to 1h)
- **Auto-disable** endpoints after repeated failures

### Team Management

- 5-tier role hierarchy: admin > manager > member > technician > view_only
- Email-based invitations with 7-day expiry
- Role enforcement with `canManageRole()` / `canInvite()` guards
- Last-active tracking for team members

### Audit Logging

Tamper-evident audit trail with 20+ event types:

- Job lifecycle, photo capture/deletion, signature events
- Location capture, safety checklist, sync events
- **Hash chaining** - each event references the previous event's hash
- Device metadata (userAgent, platform, online status)
- GPS accuracy and source tracking

### SSO (Feature-Flagged)

Enterprise SSO infrastructure ready for activation:

- SAML 2.0 and OIDC protocol support
- Okta, Azure AD, OneLogin provider configurations
- Domain-based enforcement
- Magic link fallback for non-SSO users

### Feature Flags

10 flags with deterministic rollout control:

| Flag | Rollout | Description |
|------|---------|-------------|
| `REST_API_V1` | 100% (paid) | REST API with scoped access |
| `WEBHOOK_SYSTEM` | 100% (paid) | Real-time event notifications |
| `TEAM_MANAGEMENT` | 100% | Team roles and invitations |
| `PUSH_NOTIFICATIONS` | 100% | Push notification infrastructure |
| `TEAM_STATUS_BAR` | 100% | Real-time team status UI |
| `READY_TO_INVOICE_SECTION` | 100% | Invoice-ready job section |
| `SEAL_ON_DISPATCH` | 100% | Auto-seal when dispatched |
| `EDGE_FUNCTION_RATE_LIMITER` | 100% | API rate limiting |
| `SSO_ENTERPRISE` | 0% (staging) | Enterprise SSO |
| `WORKSPACE_ISOLATED_STORAGE` | 0% | Per-workspace storage isolation |

---

## Quick Start

### Prerequisites

- **Node.js** 18+ (LTS recommended)
- **npm** 9+
- **Supabase** account (for backend services)

### Installation

```bash
git clone https://github.com/vm799/trust_by_design.git
cd trust_by_design
npm install
```

### Environment Variables

```bash
cp .env.example .env
```

```env
# Required
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_APP_URL=https://yourapp.vercel.app

# Optional
VITE_W3W_API_KEY=your-w3w-api-key
VITE_GOOGLE_CLIENT_ID=your-google-client-id
```

### Supabase Setup

```bash
npm install -g supabase
supabase login
supabase link --project-ref your-project-ref
supabase db push
supabase functions deploy
```

### RSA-2048 Key Generation

```bash
openssl genrsa -out seal_private_key.pem 2048
openssl rsa -in seal_private_key.pem -pubout -out seal_public_key.pem

base64 -w 0 seal_private_key.pem > seal_private_key_base64.txt
base64 -w 0 seal_public_key.pem > seal_public_key_base64.txt

supabase secrets set SEAL_PRIVATE_KEY="$(cat seal_private_key_base64.txt)"
supabase secrets set SEAL_PUBLIC_KEY="$(cat seal_public_key_base64.txt)"

# Delete local private key after upload
rm seal_private_key.pem seal_private_key_base64.txt
```

### Development

```bash
npm run dev              # Dev server (http://localhost:3000)
npm test                 # Unit tests (watch mode)
npm test -- --run        # Run tests once (1488 tests)
npm run lint             # ESLint check
npm run type-check       # TypeScript validation
npm run build            # Production build
```

### Full Verification

```bash
npm test -- --run && npm run lint && npm run type-check && npm run build
```

### Deploy

```bash
vercel deploy            # Preview deployment
vercel --prod            # Production deployment
```

---

## Security

### Authentication

- **Email/Password** - Supabase Auth with secure password hashing
- **Magic Links** - Passwordless technician access (7-day expiry)
- **Google OAuth** - OAuth 2.0 with PKCE flow
- **Session Management** - JWT tokens with memoized refresh (prevents auth loops)

### Authorization

- **Row-Level Security** - Enforced on all database tables
- **Workspace Isolation** - Users access only their workspace data
- **Role Hierarchy** - admin > manager > member > technician > view_only
- **Sealed Immutability** - Database triggers prevent modification of sealed jobs
- **Bunker Mode** - Offline universal access with audit trail for later review

### Cryptography

| Layer | Algorithm | Purpose |
|-------|-----------|---------|
| Evidence Sealing | RSA-2048 + SHA-256 | Tamper-evident digital signatures |
| Encryption at Rest | AES-256-GCM | Sensitive field encryption |
| In Transit | TLS 1.3 | Transport security (Supabase default) |
| API Keys | HMAC-SHA256 | Key hashing (never stored plaintext) |
| Webhooks | HMAC-SHA256 | Delivery signature verification |
| Keys | In-memory, NON-EXTRACTABLE | Web Crypto API key management |

### Data Protection

- **RLS Policies** on all tables - `auth.uid()` scoped, never trust client
- **No `service_role`** keys in frontend code
- **Sealed jobs** cannot be deleted (`sealedAt` present)
- **Invoiced jobs** cannot be deleted (`invoiceId` present)
- **Offline audit trail** - all bunker mode actions logged with timestamp + user

---

## Testing

### Coverage

- **1488 tests** across 76 test files
- **76/76 test files passing**
- **Vitest** for unit and integration tests
- **Playwright** for E2E cross-browser tests

### Test Categories

| Category | Count | Coverage |
|----------|-------|----------|
| Unit tests | 1400+ | Components, business logic, utilities |
| Architecture tests | 30+ | Pattern enforcement (DataContext, auth, animations) |
| Integration tests | 30+ | Database, sync queue, offline behavior |
| E2E tests | 20+ | Magic links, cross-browser, technician flows |

### Architecture Tests Enforce

- No `supabase.auth.getUser()` in components (use AuthContext)
- No `useState` for jobs/clients/technicians (use DataContext)
- All routes lazy-loaded
- Animation constants from `lib/animations.ts` (no inline objects)
- Stable React keys (no array index)

---

## Job Lifecycle

```
Draft → Dispatched → In Progress → Complete → Submitted → Sealed → Invoiced
         |              |            |          |           |
    (needs tech)   (tech working) (evidence)  (review)   (locked)
```

**Deletion rules:**
- `sealedAt` present = cannot delete (evidence preserved)
- `invoiceId` present = cannot delete (delete invoice first)

---

## Configuration

### Client Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | Yes | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase anonymous key |
| `VITE_APP_URL` | Yes | Production app URL for redirects |
| `VITE_W3W_API_KEY` | No | what3words API key |
| `VITE_GOOGLE_CLIENT_ID` | No | Google OAuth client ID |

### Supabase Secrets (Server-Side Only)

| Secret | Required | Description |
|--------|----------|-------------|
| `SEAL_PRIVATE_KEY` | Yes | RSA-2048 private key (base64) |
| `SEAL_PUBLIC_KEY` | Yes | RSA-2048 public key (base64) |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Auto-configured by Supabase |

---

## Contributing

### Before Every Commit

```bash
npm test -- --run && npm run build
```

### Code Standards

- **DataContext** is the only source of truth for jobs/clients/technicians
- **AuthContext** for all authentication (never direct `supabase.auth.getUser()`)
- **Full Job objects** passed to `updateJob()` (not partial updates)
- **44px minimum** touch targets (WCAG accessibility)
- **Delete legacy code** (never comment out)
- **Error states** with retry via `DataContext.refresh()`
- **Memoize** derived state with `useMemo`
- **Animation constants** from `lib/animations.ts`

---

## License

Copyright 2026 JobProof. All rights reserved.

---

<div align="center">

**Built for field workers in poor-service environments**

</div>
