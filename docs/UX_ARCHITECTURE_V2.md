# JobProof UX Architecture v2.0
## Construction Reality Model & Dashboard Redesign

**Date:** February 2026
**Standard Applied:** "Would this survive a freezing site at 6:30am with gloves on?"

---

## 1. Construction Reality Model

### What Construction Managers Actually Care About

| Priority | Reality | SaaS Misconception |
|----------|---------|-------------------|
| **1** | "Is this job defensible if client disputes?" | "Analytics and KPIs" |
| **2** | "Will I get paid for this work?" | "Dashboard widgets" |
| **3** | "Where are my technicians right now?" | "Status filters" |
| **4** | "What's not done that should be?" | "Multi-section navigation" |

**Truth:** Construction managers don't "manage" from dashboards. They fight fires, chase payments, and cover their liability.

### What Technicians Will and Will Not Tolerate

| Will Tolerate | Will NOT Tolerate |
|---------------|-------------------|
| One big button that starts their job | Form-first thinking |
| Auto-capturing location/time | Manually entering metadata |
| "Done" button that seals evidence | Multi-step submission flows |
| Offline that actually works | "Please reconnect" errors |

**Truth:** Technicians are paid per job, not per screen tap. Every extra tap costs them money.

### Where Disputes, Delays, and Payment Failures Originate

| Failure Point | Root Cause | Evidence Gap |
|---------------|-----------|--------------|
| "We never did that work" | No timestamped photos | Before/after missing |
| "You were only there 20 mins" | No arrival/departure proof | GPS + timestamp gap |
| "Materials weren't installed" | No material photos | Serial numbers not captured |
| "Wrong technician showed up" | No identity proof | Face photo missing |

**Truth:** 90% of payment disputes are evidence gaps, not actual disputes about work quality.

---

## 2. Dashboard Autopsy (Current State)

### views/app/Dashboard.tsx (Manager Dashboard)

| Component | Lines | Cognitive Load | Verdict |
|-----------|-------|----------------|---------|
| Quick Stats Grid (4 tiles) | 43-72 | Forces counting, not action | **DELETE** |
| Needs Your Attention Section | 75-125 | Good intent, bad execution | **SIMPLIFY** |
| Today's Schedule | 129-143 | Useful but buried | **ELEVATE** |
| Show Incomplete Only Toggle | 269-278 | Adds decision point | **DELETE** |
| Quick Actions Grid (4 tiles) | 337-380 | Icon hunting, not workflow | **DELETE** |
| Greeting + Date | 146-159 | Decorative noise | **DELETE** |

**Problems:**
- 387 lines for a dashboard = feature creep
- 4 different sections competing for attention
- Uses deprecated `useWorkspaceData` hook
- "Quick Actions" are not quick if you have to find them

### views/AdminDashboard.tsx (Legacy Feature-Rich)

| Component | Lines | Cognitive Load | Verdict |
|-----------|-------|----------------|---------|
| Email Verification Banner | 347-349 | Necessary evil | KEEP |
| Offline Indicator | 352-358 | Critical for field | KEEP |
| Unopened Links Alerts | 423-521 | Good but verbose | **SIMPLIFY** |
| Tech-Created Jobs Notifications | 523-608 | Manager-specific | KEEP |
| Attention Required Panel | 611-667 | Redundant with alerts | **MERGE** |
| Compact Metrics (4 cards) | 669-699 | Vanity metrics | **DELETE** |
| Workforce Status Panel | 701-761 | Manager-specific luxury | DEMOTE |
| Mobile Job Cards | 764-776 | Good | KEEP |
| Desktop Operations Table | 778-894 | Overbuilt | **SIMPLIFY** |

**Problems:**
- 1,101 lines = enterprise bloat
- 6+ competing visual hierarchies
- Managers don't need "Operations Hub Log"
- Too many ways to see the same information

### views/tech/TechPortal.tsx (Technician)

| Component | Lines | Cognitive Load | Verdict |
|-----------|-------|----------------|---------|
| Tabs (Jobs/History/Profile) | 21, 409-441 | Forces categorization | **REMOVE TABS** |
| Today's Jobs Section | 152-225 | Good, but tab-hidden | **ELEVATE** |
| Upcoming Jobs | 227-277 | Secondary concern | KEEP COLLAPSED |
| Floating Action Button | 397-406 | Correct pattern | KEEP |
| Profile Tab | 351-393 | Not job-relevant | MOVE TO SETTINGS |

**Problems:**
- History tab is not an action
- Profile is not daily workflow
- Primary action (start job) requires mental parsing

---

## 3. Cold War UX Scoring

### Scoring Criteria

| Metric | Definition | Weight |
|--------|-----------|--------|
| Cognitive Load (CL) | Mental effort to understand | 30% |
| Time-to-Action (TTA) | Seconds to primary action | 30% |
| Error Risk (ER) | Likelihood of wrong action | 20% |
| Legal/Operational Value (LOV) | Contribution to evidence defensibility | 20% |

### Dashboard.tsx Scores

| Element | CL | TTA | ER | LOV | Weighted | Verdict |
|---------|-----|-----|-----|-----|----------|---------|
| Quick Stats Grid | 3 | 2 | 5 | 2 | **2.9** | DELETE |
| Needs Attention | 6 | 6 | 6 | 7 | **6.2** | SIMPLIFY |
| Today's Schedule | 7 | 5 | 8 | 6 | **6.4** | ELEVATE |
| Incomplete Toggle | 4 | 3 | 6 | 3 | **3.9** | DELETE |
| Quick Actions Grid | 4 | 4 | 5 | 4 | **4.2** | DELETE |
| Greeting Banner | 2 | 1 | 9 | 1 | **2.9** | DELETE |

### AdminDashboard.tsx Scores

| Element | CL | TTA | ER | LOV | Weighted | Verdict |
|---------|-----|-----|-----|-----|----------|---------|
| Offline Indicator | 9 | 8 | 9 | 10 | **8.9** | KEEP |
| Unopened Links Alert | 6 | 5 | 6 | 8 | **6.1** | SIMPLIFY |
| Attention Panel | 5 | 5 | 6 | 7 | **5.6** | MERGE |
| Compact Metrics | 3 | 2 | 5 | 2 | **2.9** | DELETE |
| Workforce Status | 5 | 3 | 7 | 4 | **4.5** | DEMOTE |
| Desktop Table | 4 | 4 | 5 | 6 | **4.7** | SIMPLIFY |

### TechPortal.tsx Scores

| Element | CL | TTA | ER | LOV | Weighted | Verdict |
|---------|-----|-----|-----|-----|----------|---------|
| Tab Navigation | 4 | 3 | 5 | 2 | **3.4** | DELETE |
| Today's Jobs | 8 | 7 | 9 | 9 | **8.1** | ELEVATE |
| FAB (Add Job) | 8 | 9 | 8 | 8 | **8.4** | KEEP |
| Profile Tab | 3 | 2 | 7 | 1 | **2.9** | MOVE |

**Threshold:** < 7/10 = REDESIGN or DELETE

---

## 4. New Dashboard Architecture

### The Only Dashboard Question

> "Which job needs proof right now?"

### Manager Dashboard Structure

```
+--------------------------------------------------+
|  [Offline]  JobProof              [+ Start Job]  |  <- Sticky header
+--------------------------------------------------+

+--------------------------------------------------+
|  NEEDS PROOF NOW                        [3 jobs] |  <- Primary section
|  ------------------------------------------------|
|  Job #A1B2C3 - Smith Residence                   |
|  No evidence captured | Assigned: Mike           |
|  [CAPTURE NOW]                                   |
|  ------------------------------------------------|
|  Job #D4E5F6 - ABC Corp Office                   |
|  Photos only, no signature | Assigned: Sarah     |
|  [GET SIGNATURE]                                 |
+--------------------------------------------------+

+--------------------------------------------------+
|  READY TO SEAL                          [2 jobs] |  <- Secondary section
|  ------------------------------------------------|
|  Job #G7H8I9 - Downtown Project                  |
|  Evidence complete | Ready for seal              |
|  [SEAL EVIDENCE]                                 |
+--------------------------------------------------+

+--------------------------------------------------+
|  RECENT ACTIVITY                     [View All]  |  <- Tertiary (collapsed)
+--------------------------------------------------+
```

### Technician Dashboard Structure

```
+--------------------------------------------------+
|  JobProof                         [Sync: OK]     |  <- Minimal header
+--------------------------------------------------+

+--------------------------------------------------+
|  +------------------------------------------+    |
|  |                                          |    |
|  |         CONTINUE CURRENT JOB             |    |  <- If active job exists
|  |         Smith Residence                  |    |
|  |         Started 2:15 PM                  |    |
|  |                                          |    |
|  |              [TAP TO CONTINUE]           |    |
|  |                                          |    |
|  +------------------------------------------+    |
+--------------------------------------------------+

+--------------------------------------------------+
|  TODAY'S JOBS                           [3]      |
|  ------------------------------------------------|
|  2:00 PM  ABC Corp - Install unit               |
|  4:30 PM  XYZ Inc - Inspection                  |
+--------------------------------------------------+

+--------------------------------------------------+
|       [+ START NEW JOB]                          |  <- Secondary action
+--------------------------------------------------+
```

### Information Hierarchy

| Level | Manager View | Technician View |
|-------|-------------|-----------------|
| **Primary** | Jobs needing proof | Current job (if active) |
| **Secondary** | Jobs ready to seal | Today's jobs |
| **Tertiary** | Recent activity | Start new job |
| **Hidden** | History, Settings, Reports | History, Profile |

---

## 5. Frictionless Evidence Flow

### Minimum Path: Arrive → Defensible

| Step | Action | User Effort | Auto-Captured |
|------|--------|-------------|---------------|
| 1 | Open app | 1 tap | - |
| 2 | Tap "Continue Job" or select job | 1 tap | GPS arrival time |
| 3 | Tap "Capture Before" | 1 tap | - |
| 4 | Camera fires | 0 taps | Timestamp, GPS, device ID |
| 5 | Photo saved | 0 taps | EXIF preserved |
| 6 | [Do the work] | - | - |
| 7 | Tap "Capture After" | 1 tap | - |
| 8 | Camera fires | 0 taps | Timestamp, GPS, device ID |
| 9 | Tap "Complete Job" | 1 tap | Departure time |
| 10 | Signature prompt | 1 gesture | Signature coordinates |
| 11 | Job sealed | 0 taps | Hash generated |

**Total User Actions:** 6 taps + 1 signature = **7 interactions**

### Auto-Captured Metadata (Zero Effort)

| Field | Source | Legal Value |
|-------|--------|-------------|
| Timestamp | Device clock | Proves when |
| GPS coordinates | Device location | Proves where |
| Device ID | Hardware signature | Proves who |
| Photo hash | SHA-256 | Proves unaltered |
| Network status | Connection state | Proves offline capability |
| Battery level | System | Proves device was operational |

### Proof Assembly Logic

```
defensible_job = {
  has_before_photo: boolean,      // Required
  has_after_photo: boolean,       // Required
  has_signature: boolean,         // Required
  timestamps_sequential: boolean, // Auto-validated
  gps_consistent: boolean,        // Auto-validated
  photos_unaltered: boolean       // Hash-verified
}

is_defensible = all(defensible_job.values())
```

---

## 6. Delight Without Playfulness

### Powerful, Not Cute

| Wrong | Right |
|-------|-------|
| Animated confetti on completion | Solid green "SEALED" badge |
| "Great job!" messages | "Evidence secured. Job defensible." |
| Gamification points | Sync status indicator |
| Colorful illustrations | Minimal iconography |
| Progress bars | Binary states (Done/Not Done) |

### Confidence Signals

| Signal | Implementation |
|--------|---------------|
| "You are protected" | Green lock icon when evidence complete |
| "Action required" | Red indicator with specific action |
| "Offline and working" | Amber sync icon, not error state |
| "Evidence sealed" | Timestamp + hash visible (not hidden) |

### Visual Language

```
DANGER:  Red    = Action required NOW (evidence gap)
WARNING: Amber  = Action required SOON (pending sync)
SUCCESS: Green  = Protected (evidence complete)
NEUTRAL: Slate  = Informational only
```

No gradients. No shadows for decoration. No animation for animation's sake.

---

## 7. Final Verdict

### Cut Immediately

| Component | File | Why |
|-----------|------|-----|
| Quick Stats Grid | Dashboard.tsx | Vanity metrics, no action |
| Greeting Banner | Dashboard.tsx | Decorative noise |
| Quick Actions Grid | Dashboard.tsx | Icon hunting |
| Incomplete Toggle | Dashboard.tsx | Adds decision point |
| Compact Metrics | AdminDashboard.tsx | Redundant with job list |
| Workforce Status Panel | AdminDashboard.tsx | Manager luxury, not core |
| Tab Navigation | TechPortal.tsx | Forces categorization |
| Profile Tab | TechPortal.tsx | Move to settings |
| Desktop Operations Table | AdminDashboard.tsx | Overbuilt, simplify to cards |

### Non-Negotiable

| Requirement | Why |
|-------------|-----|
| Single primary action | Reduces cognitive load to zero |
| Offline indicator | Field reality |
| "Needs proof" as primary view | Core value proposition |
| Auto-captured metadata | Evidence without effort |
| Binary states (defensible/not) | No ambiguity |
| 44px+ touch targets | Glove compatibility |

### What Turns JobProof Into Infrastructure

1. **Stop being an app, start being a shield**
   - Every screen should answer: "Is this job defensible?"
   - Remove anything that doesn't contribute to that answer

2. **Evidence capture is inevitable, not optional**
   - No "skip" buttons on photo capture
   - No "complete without signature" option
   - Incomplete jobs cannot be sealed

3. **Metadata is automatic, never manual**
   - User types job title and client
   - Everything else is captured silently

4. **Offline is the default assumption**
   - Design for airplane mode first
   - Online sync is a bonus, not a requirement

5. **One job = one evidence trail = one outcome**
   - Job is either defensible or not
   - No partial states, no "almost ready"

---

## Implementation Roadmap

### Phase 1: Dashboard Simplification (This PR)

- [x] Create architecture document
- [ ] Implement `ActionDashboard.tsx` (manager view)
- [ ] Simplify `TechPortal.tsx` (remove tabs, action-first)
- [ ] Add evidence status indicators
- [ ] Update routes to use new dashboard

### Phase 2: Evidence Flow Hardening (Next PR)

- [ ] Auto-capture GPS on job start
- [ ] Enforce before/after photo requirement
- [ ] Block seal without signature
- [ ] Add defensibility indicator to job cards

### Phase 3: Legal Infrastructure (V2)

- [ ] Audit trail for all evidence
- [ ] Tamper detection
- [ ] Export for litigation
- [ ] Chain of custody documentation

---

*This document is the source of truth for JobProof UX decisions. Every component must justify its existence against these standards.*
