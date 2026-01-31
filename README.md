<div align="center">

# JobProof

**Professional Field Evidence Management System**

*Professional job management and secure evidence tracking for field service professionals*

[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue?logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.2-61DAFB?logo=react)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-6.2-646CFF?logo=vite)](https://vitejs.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-Backend-3ECF8E?logo=supabase)](https://supabase.com/)
[![Tests](https://img.shields.io/badge/Tests-758%20cases-success)](./tests)

[Features](#features) • [Architecture](#architecture) • [Quick Start](#quick-start) • [Documentation](#documentation) • [Security](#security)

</div>

---

## Overview

JobProof is a production-ready field service evidence management platform that provides:

- **Cryptographic Sealing** - RSA-2048 digital signatures for verifiable records
- **Offline-First** - Full functionality without internet connectivity
- **GPS Verification** - Precise location tracking with what3words integration
- **Multi-Persona** - Support for contractors, technicians, and clients
- **Audit Trail** - Complete job lifecycle tracking with immutable logs

---

## Features

### Core Capabilities

- 📸 **Evidence Capture** - Photos, signatures, timestamps with GPS metadata
- 🔒 **Cryptographic Sealing** - RSA-2048 signatures for tamper-evident evidence
- 🌐 **Offline-First** - IndexedDB storage with automatic sync when online
- 📍 **Location Accuracy** - GPS coordinates + what3words addresses
- 👥 **Role-Based Access** - Admin, technician, and client portals
- 📊 **Instant Reports** - PDF job reports with embedded evidence
- 🔐 **Enterprise Security** - Row-level security (RLS) policies on all tables

### User Experiences

#### Contractors/Admins
- Create and assign jobs to technicians
- Track job status in real-time
- Review completed work with evidence
- Generate client reports instantly
- Manage team and workspace settings

#### Field Technicians
- Access jobs via magic links (no login required)
- Capture photos and signatures offline
- Submit completed work from any location
- GPS + what3words location verification
- Safety checklist enforcement

#### Clients
- View job details and progress
- Provide digital signatures
- Review completed work evidence
- Track job history

---

## Architecture

### Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React 18 + TypeScript | Type-safe UI components |
| **Build Tool** | Vite 6.2 | Fast dev server & optimized builds |
| **Styling** | Tailwind CSS 3.4 | Utility-first responsive design |
| **Routing** | React Router 6.22 | Client-side navigation |
| **State** | React Context + Hooks | Global state management |
| **Offline Storage** | Dexie (IndexedDB) | Client-side database |
| **Backend** | Supabase | Postgres + Auth + Edge Functions |
| **Database** | PostgreSQL 15 | Production-grade relational DB |
| **Authentication** | Supabase Auth | Email/password + Google OAuth + Magic Links |
| **File Storage** | Supabase Storage | Photo and signature uploads |
| **Edge Functions** | Deno | Cryptographic sealing/verification |
| **Security** | Row-Level Security (RLS) | Database-level access control |
| **Testing** | Vitest + Playwright | Unit + integration + E2E tests |
| **Deployment** | Vercel | Serverless frontend hosting |

### Project Structure

```
trust_by_design/
├── components/          # React UI components
│   ├── Layout.tsx      # App shell with navigation
│   ├── OnboardingFlow.tsx
│   ├── JobCard.tsx
│   ├── SealBadge.tsx
│   └── ...
├── views/              # Page-level components
│   ├── AdminDashboard.tsx
│   ├── TechnicianPortal.tsx
│   ├── JobReport.tsx
│   ├── CreateJob.tsx
│   └── ...
├── lib/                # Core business logic
│   ├── auth.ts         # Authentication helpers
│   ├── db.ts           # Database operations (IndexedDB + Supabase)
│   ├── sealing.ts      # Cryptographic evidence sealing
│   ├── syncQueue.ts    # Offline sync management
│   ├── onboarding.ts   # User onboarding flows
│   └── utils.ts        # Shared utilities
├── supabase/
│   ├── migrations/     # Database schema versions
│   └── functions/      # Edge Functions (Deno)
│       ├── seal-evidence/      # RSA-2048 signing
│       └── verify-evidence/    # Signature verification
├── tests/
│   ├── unit/           # Component & function tests
│   ├── integration/    # API integration tests
│   └── e2e/            # End-to-end Playwright tests
├── App.tsx             # Root application component
├── types.ts            # TypeScript type definitions
├── db.ts               # Dexie IndexedDB schema
└── index.tsx           # Application entry point
```

### Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                      JobProof Architecture                   │
└─────────────────────────────────────────────────────────────┘

┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│   Browser    │────────▶│  React App   │────────▶│  Supabase    │
│  (offline)   │         │   (Vite)     │         │   (online)   │
└──────────────┘         └──────────────┘         └──────────────┘
       │                        │                        │
       │                        │                        │
       ▼                        ▼                        ▼
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│  IndexedDB   │◀────────│ Sync Queue   │────────▶│  PostgreSQL  │
│   (Dexie)    │         │  (offline→   │         │  + Storage   │
│              │         │    online)   │         │              │
└──────────────┘         └──────────────┘         └──────────────┘
                                │
                                │
                                ▼
                         ┌──────────────┐
                         │ Edge Function│
                         │  (seal/      │
                         │   verify)    │
                         └──────────────┘
```

### Offline-First Architecture

1. **Capture** - All data stored in IndexedDB immediately
2. **Queue** - Changes added to sync queue with retry logic
3. **Sync** - Background sync when network available
4. **Verify** - Conflict resolution with last-write-wins
5. **Seal** - Jobs sealed server-side with RSA-2048 signature

---

## Quick Start

### Prerequisites

- **Node.js** 18+ (LTS recommended)
- **npm** 9+ or **pnpm** 8+
- **Supabase Account** (for backend services)
- **Git** for version control

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/trust_by_design.git
   cd trust_by_design
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```

   Edit `.env` with your credentials:
   ```env
   # Supabase Configuration
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key

   # what3words API
   VITE_W3W_API_KEY=your-w3w-api-key

   # Optional: Google OAuth
   VITE_GOOGLE_CLIENT_ID=your-google-client-id
   ```

4. **Set up Supabase backend**
   ```bash
   # Install Supabase CLI
   npm install -g supabase

   # Login to Supabase
   supabase login

   # Link to your project
   supabase link --project-ref your-project-ref

   # Run migrations
   supabase db push

   # Deploy Edge Functions
   supabase functions deploy seal-evidence
   supabase functions deploy verify-evidence
   ```

5. **Generate RSA-2048 keys for cryptographic sealing**
   ```bash
   # Generate keypair
   openssl genrsa -out seal_private_key.pem 2048
   openssl rsa -in seal_private_key.pem -pubout -out seal_public_key.pem

   # Convert to base64 for environment variables
   base64 -w 0 seal_private_key.pem > seal_private_key_base64.txt
   base64 -w 0 seal_public_key.pem > seal_public_key_base64.txt

   # Set Supabase secrets
   supabase secrets set SEAL_PRIVATE_KEY="$(cat seal_private_key_base64.txt)"
   supabase secrets set SEAL_PUBLIC_KEY="$(cat seal_public_key_base64.txt)"

   # SECURITY: Delete local private key after upload
   rm seal_private_key.pem seal_private_key_base64.txt
   ```

### Development

```bash
# Start development server (http://localhost:3000)
npm run dev

# Run type checking
npm run type-check

# Run linter
npm run lint

# Fix linting issues
npm run lint:fix
```

### Testing

```bash
# Unit tests (watch mode)
npm run test

# Run all unit tests once
npm run test:unit

# Integration tests
npm run test:integration

# Test coverage report
npm run test:coverage

# E2E tests with Playwright
npm run test:e2e

# E2E with UI
npm run test:e2e:ui

# E2E debugging
npm run test:e2e:debug
```

### Security & Performance Auditing

Automated audit scripts implementing [JOBPROOF_AUDIT_SPECIFICATION.md](./JOBPROOF_AUDIT_SPECIFICATION.md):

```bash
# Security audit (RLS policies, cryptographic sealing, data integrity)
npm run audit:security

# Detailed security audit with verbose output
npm run audit:security:verbose

# Performance audit (query benchmarks, load testing)
npm run audit:performance

# Production monitoring (daily checks, real-time alerts)
npm run audit:monitor

# Run all audits
npm run audit:all

# Deployment verification
npm run verify:deployment
```

**Audit Scripts Features:**
- ✅ RLS policy verification (workspace isolation)
- ✅ Cryptographic sealing audit (100% RSA-2048 required)
- ✅ Data integrity checks (GPS, signatures, timestamps)
- ✅ Performance benchmarking (p50, p95, p99 percentiles)
- ✅ Production monitoring with webhook alerts
- ✅ CI/CD integration ready
- ✅ Exit codes for deployment gates (0=pass, 1=critical, 2=high, 3=medium)

See [scripts/README.md](./scripts/README.md) for detailed documentation.

### Build & Deploy

```bash
# Production build
npm run build

# Preview production build locally
npm run preview

# Deploy to Vercel
vercel --prod
```

---

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | ✅ | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | ✅ | Supabase anonymous key (public) |
| `VITE_W3W_API_KEY` | ✅ | what3words API key |
| `VITE_GOOGLE_CLIENT_ID` | ⚠️ | Google OAuth client ID (optional) |
| `VITE_APP_URL` | ⚠️ | Production app URL for redirects |

### Supabase Secrets (Server-side)

| Secret | Required | Description |
|--------|----------|-------------|
| `SEAL_PRIVATE_KEY` | ✅ | RSA-2048 private key (base64) |
| `SEAL_PUBLIC_KEY` | ✅ | RSA-2048 public key (base64) |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Service role key (auto-configured) |

---

## Security

### Authentication

- **Email/Password** - Supabase Auth with secure password hashing
- **Magic Links** - Passwordless email authentication (7-day expiry)
- **Google OAuth** - OAuth 2.0 with PKCE flow
- **Session Management** - JWT tokens (60min access, 30-day refresh)

### Authorization

- **Row-Level Security (RLS)** - Enforced on all 14 database tables
- **Workspace Isolation** - Users can only access their workspace data
- **Role-Based Access** - Admin, member, and token-based permissions
- **Sealed Job Immutability** - Database triggers prevent modifications

### Cryptographic Sealing

- **Algorithm** - RSA-2048 with SHA-256 hashing
- **Evidence Bundle** - JSON canonical serialization
- **Signature** - Digital signature stored in `evidence_seals` table
- **Verification** - Cryptographic proof of tampering detection
- **Key Management** - Private key in Supabase secrets (never in code)

### Data Protection

- **Encryption at Rest** - Supabase encrypts all stored data
- **Encryption in Transit** - HTTPS/TLS 1.3 required
- **Offline Data** - IndexedDB encrypted by browser sandbox
- **File Uploads** - Content-type validation, size limits, virus scanning

---

## Documentation

### Key Documents

- [**Audit Specification**](./JOBPROOF_AUDIT_SPECIFICATION.md) - Complete audit framework and procedures
- [**Production Implementation Plan**](./PRODUCTION_READY_IMPLEMENTATION_PLAN.md) - Deployment roadmap
- [**Testing Guide**](./TESTING_IMPLEMENTATION_GUIDE.md) - Test strategy and coverage
- [**Deployment Guide**](./DEPLOYMENT_GUIDE.md) - Step-by-step deployment instructions
- [**Auth Documentation**](./AUTH.md) - Authentication implementation details
- [**UX Audit**](./FINAL_UX_AUDIT_100.md) - UX score 100/100 achievement report

### Architecture Documents

- [**Business Overview**](./BUSINESS_OVERVIEW.md) - Product vision and market fit
- [**Domain Analysis**](./DOMAIN_ANALYSIS.md) - Business domain modeling
- [**Trust System Audit**](./TRUST_SYSTEM_AUDIT.md) - Security architecture review
- [**Backend Audit**](./BACKEND_AUDIT.md) - Database and API design review

### API Reference

Supabase Edge Functions:

- **POST** `/functions/v1/seal-evidence` - Seal job evidence with RSA-2048
- **POST** `/functions/v1/verify-evidence` - Verify evidence integrity

---

## Testing

### Test Coverage

- **758 Total Test Cases** across unit, integration, and E2E tests
- **80%+ Code Coverage** for critical paths
- **100% RLS Policy Coverage** - All tables tested for security

### Test Suites

1. **Unit Tests** (Vitest)
   - Component rendering
   - Business logic functions
   - Utility functions
   - Mock sealing/verification

2. **Integration Tests** (Vitest)
   - Database operations
   - Authentication flows
   - Sync queue operations
   - Offline-first behavior

3. **E2E Tests** (Playwright)
   - Complete user workflows
   - Cross-browser testing
   - Mobile viewport testing
   - Offline scenario testing

---

## Performance

### Metrics

- **Lighthouse Score** - Performance: 90+, Accessibility: 95+, Best Practices: 90+
- **Core Web Vitals**
  - LCP (Largest Contentful Paint): < 2.5s
  - FID (First Input Delay): < 100ms
  - CLS (Cumulative Layout Shift): < 0.1
- **Bundle Size** - < 500KB gzipped
- **Database Queries** - 95% execute in < 100ms

---

## Contributing

### Development Workflow

1. Create feature branch from `main`
2. Implement changes with tests
3. Run full test suite (`npm run test && npm run test:e2e`)
4. Type check (`npm run type-check`)
5. Lint code (`npm run lint`)
6. Commit with descriptive message
7. Push and create pull request

### Code Standards

- **TypeScript** - Strict mode enabled, no `any` types
- **ESLint** - Enforce code quality rules
- **Prettier** - Consistent code formatting
- **Husky** - Pre-commit hooks for quality gates

---

## License

Copyright © 2026 JobProof. All rights reserved.

---

## Support

- **Documentation** - See [/docs](./docs) folder
- **Issues** - [GitHub Issues](https://github.com/yourusername/trust_by_design/issues)
- **Security** - Report vulnerabilities to security@jobproof.pro

---

<div align="center">

**Built with ❤️ for field service professionals**

</div>
