# Business Requirements Document (BRD)

**Product:** JobProof v2
**Owner:** Product Team
**Version:** 1.0
**Last Updated:** 2024-01-16

---

## 1. Executive Summary

### Business Problem
Field service companies (electricians, plumbers, HVAC, construction, property maintenance) lose significant revenue because:

- Technicians forget to capture evidence
- Clients dispute work quality or completion
- Admins lack structured proof for invoicing
- Evidence is scattered across WhatsApp, SMS, and camera rolls
- No audit trail for safety compliance or legal disputes

This results in **delayed payments, lost invoices, insurance claim rejections, and operational chaos**.

### Solution Overview
JobProof provides a **zero-friction proof-of-work system** that:

- Admins create and dispatch jobs
- Technicians receive magic links (no login required)
- Technicians capture photos, signatures, and notes
- System creates secure evidence bundle
- Admins receive structured reports
- Clients receive verifiable proof

Everything is timestamped, geolocated, and exportable.

---

## 2. Business Goals

### Primary Goals
1. **Reduce invoice disputes by 80%** through verifiable evidence
2. **Enable same-day invoicing** with instant professional reports
3. **Provide comprehensive audit trail** for compliance and documentation
4. **Build sustainable SaaS business** targeting $10K-50K MRR

### Secondary Goals
- Lower insurance premiums for customers (demonstrable risk reduction)
- Reduce technician training time (from hours to minutes)
- Enable integration ecosystem (CRM, accounting, insurance)
- Create switching costs through historical job archives

---

## 3. Target Users

### Primary Users

**1. Field Service Technicians**
- Demographics: Ages 25-55, mobile-first users
- Pain Points: Forgot to take photos, phone storage full, can't find job details
- Needs: Simple interface, works offline, fast photo capture

**2. Admin/Office Managers**
- Demographics: Ages 30-60, desktop + mobile
- Pain Points: Chasing techs for evidence, manual report creation, invoice disputes
- Needs: Job dispatch, evidence review, PDF export, client management

**3. Small Agency Owners**
- Demographics: Ages 35-65, business owners
- Pain Points: Cash flow issues, legal liability, insurance costs
- Needs: Complete oversight, financial tracking, compliance documentation

### Secondary Users

**4. Clients (Homeowners/Property Managers)**
- Needs: View completed work, download reports, verify quality

**5. Accountants/Invoicing Teams**
- Needs: Structured data export, QuickBooks integration

---

## 4. Business Requirements

### 4.1 Core Business Workflows

#### A. Job Dispatch Flow (Admin)
**Goal:** Create and assign work with minimal friction

**Requirements:**
1. Admin must be able to create job in <60 seconds
2. System must generate unique magic link automatically
3. Admin must be able to send link via SMS/email/copy
4. Admin must be able to track job status in real-time
5. System must support recurring jobs (future)

**Success Metrics:**
- Time to dispatch: <2 minutes
- Dispatch success rate: >98%

#### B. Evidence Capture Flow (Technician)
**Goal:** Capture verifiable proof with zero training

**Requirements:**
1. Technician must access job without login
2. System must capture GPS + what3words location automatically
3. Technician must be able to take unlimited photos
4. System must work offline (no internet required)
5. Technician must be able to get client signature on screen
6. System must prevent editing after submission
7. System must sync to cloud when online

**Success Metrics:**
- Job completion rate: >95%
- Photos per job: Avg 5-10
- Submission time: <5 minutes
- Sync success rate: >99%

#### C. Report Generation Flow (Admin)
**Goal:** Professional reports for invoicing and client delivery

**Requirements:**
1. Admin must be able to view completed job within 10 seconds
2. System must generate PDF-ready report
3. Report must include: photos, timestamps, location, signature
4. Admin must be able to export to QuickBooks
5. Admin must be able to share report link with client

**Success Metrics:**
- Report generation: <5 seconds
- PDF export success: >99%
- Client report views: >80%

---

### 4.2 Functional Requirements by Role

#### Technician Portal
**Must Have:**
- ✅ Open job via magic link (no login)
- ✅ View job details (client, address, notes)
- ✅ Capture location (GPS + what3words)
- ✅ Capture photos (with timestamps)
- ✅ Categorize photos (before/during/after/evidence)
- ✅ Capture signature on canvas
- ✅ Add text notes
- ✅ Complete safety checklist
- ✅ Submit job (triggers seal)
- ✅ Work offline
- ✅ Auto-save progress

**Nice to Have:**
- Voice notes
- Video capture
- PDF attachment upload

#### Admin Dashboard
**Must Have:**
- ✅ Login with email/password
- ✅ Create job
- ✅ Assign technician
- ✅ Generate magic link
- ✅ View job list (active/completed)
- ✅ View job details (photos, signature, notes)
- ✅ Export PDF report
- ✅ Manage clients (CRUD)
- ✅ Manage technicians (CRUD)
- ✅ View job history
- ✅ Generate invoices

**Nice to Have:**
- Dashboard analytics
- Calendar view
- Recurring jobs
- Team management
- Custom report templates

#### Client Portal
**Must Have:**
- ✅ View completed job (via link)
- ✅ Download PDF report
- ✅ View photos in gallery
- ✅ Verify location on map

**Nice to Have:**
- Approve/dispute work
- Request follow-up
- Payment integration

---

### 4.3 Business Rules

#### Evidence Immutability
**Rule:** Once job status = "Submitted", no edits allowed

**Rationale:**
- Professional documentation standards (secure evidence)
- Insurance claim compliance
- Trust signal to clients

**Implementation:**
- Code-level blocks on edit attempts
- Redirect to home if edit attempted
- Audit log of submission timestamp

#### Location Verification
**Rule:** Every photo must have GPS + what3words

**Rationale:**
- Prove technician was on-site
- Higher insurance claim approval
- Prevent fraud (fake photos)

**Implementation:**
- Capture location on portal open
- Fallback to manual entry if permission denied
- Store both signals for dual verification

#### Offline Priority
**Rule:** All core functions must work without internet

**Rationale:**
- Field sites often have poor connectivity
- Basements, tunnels, rural areas have zero signal
- Competitors fail when offline

**Implementation:**
- IndexedDB for photo storage
- LocalStorage for metadata
- Sync queue with exponential backoff

---

## 5. Success Metrics & KPIs

### Product Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Job Completion Rate** | >95% | (Submitted jobs / Created jobs) × 100 |
| **Photo Sync Success** | >99% | (Synced photos / Total photos) × 100 |
| **Page Load Time** | <2s | Vercel Analytics |
| **Offline Functionality** | 100% | Manual testing checklist |
| **Error Rate** | <1% | Sentry error tracking |

### Business Metrics

| Metric | Current | Target (12mo) |
|--------|---------|---------------|
| **MRR** | $0 | $50,000 |
| **Customer Count** | 0 | 500 |
| **ARPU** | N/A | $100 |
| **Churn Rate** | N/A | <5%/month |
| **CAC** | TBD | <$360 |
| **LTV** | TBD | >$2,376 |
| **LTV/CAC Ratio** | TBD | >6x |

### User Satisfaction

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Technician NPS** | >50 | Quarterly survey |
| **Admin NPS** | >40 | Quarterly survey |
| **Support Tickets** | <5/mo per 100 users | Intercom/Zendesk |

---

## 6. Compliance & Trust Requirements

### Legal Defensibility
**Requirement:** Evidence must hold up in court

**Implementation:**
- Immutable job sealing
- Cryptographic timestamps (UTC)
- Audit trail of all actions
- No post-submission editing

### GDPR Compliance
**Requirement:** User data privacy and control

**Implementation:**
- Data export functionality
- Right to deletion
- Consent management
- Privacy policy

### SOC 2 Type II (Future)
**Requirement:** Enterprise security certification

**Timeline:** Q4 2024
**Cost:** $25K-50K audit fees

---

## 7. Integration Requirements

### Phase 1 (Q1 2024)
- ✅ Supabase (database, storage, auth)
- ✅ Vercel (hosting, CDN)
- 🎯 QuickBooks (invoice sync)

### Phase 2 (Q2 2024)
- Salesforce (CRM sync)
- SendGrid/Resend (email notifications)
- Stripe (payment processing)

### Phase 3 (Q3 2024)
- ServiceTitan (field service platform)
- Zapier/Make (no-code automation)
- Google Calendar (scheduling)

---

## 8. Risks & Mitigation

### Risk 1: Low Technician Adoption
**Probability:** Medium
**Impact:** High
**Mitigation:**
- Zero-install magic links
- Mobile-first UI
- <5 minute job completion time
- Real-world beta testing

### Risk 2: Offline Mode Failures
**Probability:** Low
**Impact:** High
**Mitigation:**
- Comprehensive IndexedDB testing
- Retry queue with exponential backoff
- Manual sync button
- Clear sync status indicators

### Risk 3: Insurance Integration Complexity
**Probability:** High
**Impact:** Medium
**Mitigation:**
- Start with manual export
- Partner with insurance tech providers
- API-first architecture

### Risk 4: Competitive Response
**Probability:** High
**Impact:** Medium
**Mitigation:**
- Patent filing for magic link + offline + dual-location combo
- Build integration moat
- Focus on superior UX

---

## 9. Out of Scope (V1)

**Not Included in Initial Launch:**
- ❌ Mobile native app (PWA only)
- ❌ Video capture
- ❌ Real-time dashboard updates
- ❌ Team collaboration features
- ❌ Advanced analytics
- ❌ White-label solution
- ❌ Multi-language support

**Rationale:** Focus on core workflow first, validate market, then expand.

---

## 10. Approvals

**Business Stakeholders:**
- [ ] CEO/Founder
- [ ] Head of Product
- [ ] Head of Sales

**Technical Stakeholders:**
- [ ] CTO/Lead Developer
- [ ] DevOps Lead

**Sign-off Date:** _______________

---

**Next Steps:**
1. Review and approve BRD
2. Create detailed PRD (see docs/02_product/prd.md)
3. Begin technical implementation
4. Set up tracking for success metrics
