# 🗺️ Trust by Design — Product Roadmap

**Last Updated:** 2026-01-16
**Current Phase:** Phase C - Trust Foundation (In Progress)

---

## ✅ COMPLETED

### Core Evidence Capture
- ✅ Offline photo storage (IndexedDB)
- ✅ GPS location capture (browser API)
- ✅ Canvas signature capture
- ✅ Sync queue with retry logic
- ✅ Job status workflow
- ✅ Client/technician management
- ✅ Report PDF generation (print)

---

## 🚧 IN DEVELOPMENT

### Phase C: Trust Foundation (Weeks 1-4) — CURRENT

**Authentication & Authorization**
- 🚧 Real authentication system (Supabase Auth)
- 🚧 Email/password login
- 🚧 Google OAuth (optional)
- 🚧 Multi-factor authentication (MFA)
- 🚧 Workspace isolation
- 🚧 Tokenized magic links
- 🚧 Row-level security (RLS) policies

**Cryptographic Sealing**
- 🚧 Hash-based evidence sealing
- 🚧 Server-side digital signatures
- 🚧 Trusted timestamps
- 🚧 Tamper detection
- 🚧 Immutable sealed records

**Audit & Compliance**
- 🚧 Audit trail logging
- 🚧 Access tracking
- 🚧 Legal disclaimers
- 🚧 GDPR-compliant data handling

---

## 📅 PLANNED

### Phase D: Verification & Integrity (Weeks 5-7)

**Location Verification**
- 📅 GPS validation against job address (Mapbox integration)
- 📅 Distance calculation and confidence scoring
- 📅 IP-based geolocation fallback
- 📅 Location confidence indicators

**Evidence Integrity**
- 📅 Photo hashing (SHA-256)
- 📅 Hash verification on display
- 📅 Storage encryption at rest
- 📅 Tamper detection alerts

**Identity & Signatures**
- 📅 Signature binding to account ID
- 📅 Technician assignment verification
- 📅 Identity level metadata display

**Protocol System**
- 📅 Protocol builder UI (admin)
- 📅 Configurable validation rules
- 📅 Required inputs enforcement
- 📅 Safety checklist enforcement
- 📅 Protocol versioning

---

### Phase E: Business Systems (Weeks 8-10)

**Subscription Management**
- 📅 Stripe integration (basic)
- 📅 Tiered pricing (Free/Pro/Team/Enterprise)
- 📅 Usage tracking (real metrics)
- 📅 Hard limit enforcement
- 📅 Upgrade prompts

**Data Retention & GDPR**
- 📅 Automated retention policies (30d/1y/3y/7y)
- 📅 Right to erasure (GDPR Article 17)
- 📅 Data export (GDPR Article 15)
- 📅 Retention by subscription tier

**Invoicing**
- 📅 Manual CSV export
- 📅 Invoice tracking dashboard

---

## 🔮 FUTURE FEATURES

### Advanced Location
- 🔮 **what3words integration** — Dual-location verification with what3words API
- 🔮 GPS spoofing detection
- 🔮 Cell tower cross-validation

### Advanced Authentication
- 🔮 Biometric authentication
- 🔮 Hardware security keys (WebAuthn)
- 🔮 Single Sign-On (SSO) for Enterprise

### Verification Enhancements
- 🔮 External timestamp authority (TSA)
- 🔮 Advanced verification options
- 🔮 Enhanced audit capabilities

### Integrations
- 🔮 **QuickBooks API** — Automated invoice sync
- 🔮 Salesforce CRM integration
- 🔮 ServiceTitan field service platform
- 🔮 Zapier/Make automation
- 🔮 Google Calendar scheduling

### Advanced Features
- 🔮 Video evidence capture
- 🔮 Voice notes
- 🔮 Real-time collaboration
- 🔮 Advanced analytics dashboard
- 🔮 Custom report templates
- 🔮 White-label solution
- 🔮 Multi-language support
- 🔮 Mobile native apps (iOS/Android)

### Legal & Compliance
- 🔮 SOC 2 Type II certification
- 🔮 ISO 27001 compliance
- 🔮 Industry-specific compliance packages
- 🔮 Legal expert verification partnerships
- 🔮 Insurance company integrations

---

## 📊 TIMELINE

| Phase | Duration | Start | End | Status |
|-------|----------|-------|-----|--------|
| **Phase C** | 4 weeks | Week 1 | Week 4 | 🚧 In Progress |
| **Phase D** | 3 weeks | Week 5 | Week 7 | 📅 Planned |
| **Phase E** | 3 weeks | Week 8 | Week 10 | 📅 Planned |
| **Beta Launch** | - | - | Week 10 | 🎯 Target |
| **Future Features** | Ongoing | Week 11+ | - | 🔮 Roadmap |

---

## 🎯 MILESTONES

### Week 4: Trust Foundation Complete
- ✅ Real authentication
- ✅ Cryptographic sealing
- ✅ Audit trail
- ✅ False UI claims removed

### Week 7: Verification Complete
- ✅ GPS validation
- ✅ Photo hashing
- ✅ Protocol system
- ✅ Safety enforcement

### Week 10: Beta Ready
- ✅ Subscription tiers live
- ✅ Usage limits enforced
- ✅ GDPR compliant
- ✅ All critical audit findings closed

---

## 📝 RELEASE NOTES

### Version 2.0 (Target: Week 10)
**"Trust Foundation"**

Major security overhaul transforming the application from UI prototype to production trust system.

**Security:**
- Real authentication (Supabase Auth)
- Cryptographic evidence sealing
- Audit trail logging
- Workspace isolation

**Verification:**
- GPS location validation
- Photo integrity hashing
- Signature binding to identity
- Protocol-driven workflows

**Business:**
- Subscription tiers (Free/Pro/Team/Enterprise)
- Usage tracking and limits
- GDPR compliance
- Data retention policies

**Breaking Changes:**
- Mock authentication removed
- All users must create real accounts
- Sealed evidence is immutable
- Usage limits enforced per tier

---

## 🔔 REQUEST A FEATURE

Want to see a feature prioritized? Contact us:
- Email: roadmap@trustbydesign.app
- GitHub Issues: [Link to repo issues]

---

**Legend:**
- ✅ Completed and deployed
- 🚧 Currently in development
- 📅 Planned (scheduled)
- 🔮 Future (not scheduled)
