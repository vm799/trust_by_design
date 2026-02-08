# 🎯 Dashboard Enhancement Roadmap
**Status:** Sprint 1 Started - Manager Dashboard First
**Date:** February 2026
**Tests:** 966/966 ✅
**Build:** SUCCESS ✅

---

## ✅ COMPLETED (This Session)

### All Core Features
- ✅ UUID v4 generation for new records (fixes deletion 400 errors)
- ✅ Dark mode email support (light/dark palettes with WCAG AA compliance)
- ✅ Canvas theme support (dark/light modes with signature preservation)
- ✅ Canvas undo/redo functionality (stroke history)
- ✅ Data cleanup guide (safe SQL for test data removal)

### Dashboard Improvements
- ✅ **Manager Dashboard Feature 1:** Last-seen timestamp for offline technicians
  - Shows "Last seen: 2h ago" format
  - Improves manager awareness of technician availability
  - Non-breaking change (only affects offline status display)
  - **Commit:** 5c8bd7e

---

## 🚀 IN PROGRESS (Next)

### HIGH PRIORITY - Revenue Impact

#### Manager Dashboard (Sprint 1 - Week 1)
1. **Link sync failed jobs to detail view** (IN PROGRESS)
   - Make sync failure badge clickable
   - Navigate to job detail showing error reason
   - Estimated effort: 2 hours
   - Files: `ManagerFocusDashboard.tsx`, `AttentionItem` type

2. **Add auto-assign modal for stuck jobs**
   - Stuck job → "Assign to..." modal
   - Shows available technicians
   - Quick 1-click assignment
   - Estimated effort: 3 hours

3. **Rapid switch detection alerts**
   - Alert if technician switches 3+ jobs/hour
   - Shows potential burnout risk
   - Estimated effort: 2 hours

#### Solo Contractor Dashboard (Sprint 1 - Week 1)
1. **Photo thumbnails in evidence summary**
   - Show 3 photo thumbnails instead of just count
   - Improves visibility of captured evidence
   - Estimated effort: 2 hours
   - Files: `SoloContractorDashboard.tsx`

2. **Job notes display in cards**
   - Show 2-line truncated notes under job title
   - Helps technician understand job context
   - Estimated effort: 1 hour

3. **Evidence review modal**
   - Swipeable photo carousel before submit
   - Lets technician verify before marking complete
   - Estimated effort: 3 hours

#### Technician Portal Dashboard (Sprint 1 - Week 1)
1. **Pre-start safety checklist**
   - Modal confirming location + safety checks
   - Blocks job start until confirmed
   - Compliance requirement
   - Estimated effort: 3 hours
   - Files: `TechPortal.tsx`

2. **Client contact display**
   - Phone/email in hero card header
   - Allows technician to contact client
   - Estimated effort: 1 hour

3. **Job duration estimate**
   - Show "Typical: 1h 15m" based on job type
   - Helps technician plan day
   - Estimated effort: 2 hours

---

## 📊 SPRINT BREAKDOWN

### Sprint 1: Critical Revenue Impact (Week 1)
**Estimated Total:** 22 hours
**Deliverables:**
- [ ] Manager: Last-seen timestamps ✅ DONE
- [ ] Manager: Sync error links
- [ ] Manager: Auto-assign modal
- [ ] Solo: Photo thumbnails
- [ ] Solo: Job notes display
- [ ] Technician: Safety checklist
- [ ] Technician: Client contact
- [ ] Technician: Duration estimate

**Success Criteria:**
- All 966 tests passing
- Build succeeding
- No regressions in existing features
- Each feature independently deployable

### Sprint 2: Operational Excellence (Week 2)
**Estimated Total:** 18 hours
**Deliverables:**
- [ ] Manager: Rapid switch detection
- [ ] Manager: Team utilization heatmap
- [ ] Manager: Team capacity percentage
- [ ] Solo: Job search (for 8+ jobs)
- [ ] Solo: Invoice amount display
- [ ] Solo: Weekly breakdown
- [ ] Technician: Skill-based filtering
- [ ] Technician: Geo-fencing badge
- [ ] Technician: Dispatch time display

### Sprint 3: Polish & Analytics (Week 3)
**Estimated Total:** 16 hours
**Deliverables:**
- [ ] Real-time polling (5-30s refresh rates)
- [ ] Theme toggle UI (explicit dark/light button)
- [ ] User persona badge in header
- [ ] Session timeout warnings
- [ ] Breadcrumb navigation
- [ ] Notification badge
- [ ] Dashboard analytics charts
- [ ] Mobile landscape optimizations

---

## 📋 IMPLEMENTATION STRATEGY

### Approach
1. **Atomic Commits:** Each feature = 1 commit
2. **Tests First:** Add tests before implementation (where applicable)
3. **No Regressions:** Full test suite before each commit
4. **Single File Rule:** Max 1 file changed per feature (when possible)
5. **Backwards Compatible:** No breaking changes to existing APIs

### Testing Protocol
After each feature:
```bash
npm test -- --run           # Run all 966 tests
npm run build              # Verify production build
npm run lint               # Check code quality
npm run type-check         # TypeScript validation
```

### Git Workflow
```bash
# Create feature branch
git checkout -b feature/manager-sync-errors

# Implement, test, commit
git add <file>
git commit -m "Add sync error links to Manager dashboard..."
git push -u origin feature/manager-sync-errors

# Create PR for review
```

---

## 🎯 CURRENT TODOS

**In Progress (Manager Dashboard):**
1. [ ] Link sync failed jobs to detail view
2. [ ] Add auto-assign modal for stuck jobs
3. [ ] Rapid switch detection alerts

**Pending (Solo Contractor):**
4. [ ] Photo thumbnails in evidence
5. [ ] Job notes display
6. [ ] Evidence review modal

**Pending (Technician):**
7. [ ] Pre-start safety checklist
8. [ ] Client contact display
9. [ ] Job duration estimate

**Verification:**
10. [ ] Full UAT testing (all dashboards)

---

## 📊 Revenue Impact Summary

| Feature | Role | Impact | Difficulty |
|---------|------|--------|-----------|
| Last-seen timestamps | Manager | Medium | Low ✅ |
| Sync error links | Manager | High | Medium |
| Auto-assign modal | Manager | High | Medium |
| Photo thumbnails | Solo | Medium | Low |
| Job notes | Solo | Low | Low |
| Evidence review | Solo | High | Medium |
| Safety checklist | Tech | High (Safety) | Medium |
| Client contact | Tech | Medium | Low |
| Duration estimate | Tech | Medium | Low |

**High Impact = Revenue generation or risk reduction**
**Low Difficulty = <2 hours implementation**

---

## 🔄 Next Immediate Steps

**Recommended Order (Next 4 Hours):**
1. **Manager: Sync error links** (2 hours) - Make failures actionable
2. **Solo: Photo thumbnails** (2 hours) - Improves confidence in evidence

**Then (4 hours after):**
3. **Technician: Safety checklist** (3 hours) - Compliance + safety
4. **Solo: Job notes display** (1 hour) - Low effort, improves UX

**Then (4 hours after):**
5. **Manager: Auto-assign modal** (3 hours) - Reduces friction for stuck jobs
6. **Technician: Client contact** (1 hour) - Low effort communication

---

## 📊 Feature Matrix

```
┌─────────────────────┬──────────┬──────────┬──────────────┐
│ Feature             │ Manager  │ Solo     │ Technician   │
├─────────────────────┼──────────┼──────────┼──────────────┤
│ Last-seen time      │ ✅ DONE  │ ❌       │ ❌           │
│ Sync error links    │ 🟡 TODO  │ ❌       │ ❌           │
│ Auto-assign modal   │ 🟡 TODO  │ ❌       │ ❌           │
│ Photo thumbnails    │ ❌       │ 🟡 TODO  │ ✅ (exists)  │
│ Job notes           │ ❌       │ 🟡 TODO  │ ✅ (exists)  │
│ Evidence review     │ ❌       │ 🟡 TODO  │ ✅ (built-in)│
│ Safety checklist    │ ❌       │ ❌       │ 🟡 TODO      │
│ Client contact      │ ❌       │ ❌       │ 🟡 TODO      │
│ Duration estimate   │ ❌       │ ❌       │ 🟡 TODO      │
│ Real-time polling   │ 🟡 TODO  │ 🟡 TODO  │ 🟡 TODO      │
│ Theme toggle UI     │ 🟡 TODO  │ 🟡 TODO  │ 🟡 TODO      │
└─────────────────────┴──────────┴──────────┴──────────────┘

Legend:
✅ = Implemented and working
🟡 = Planned, ready for implementation
❌ = Not applicable/not needed
```

---

## 🚀 Ready to Deploy

**When ready for production:**
```bash
# Ensure all tests pass
npm test -- --run

# Build and verify
npm run build

# Deploy to Vercel
vercel --prod
```

---

## 📝 Notes

- **All implementations follow CLAUDE.md rules:** No useState for shared data, use DataContext
- **Accessibility:** All touch targets ≥ 44px
- **Dark mode:** Full support throughout
- **Offline-first:** All features work offline with sync
- **Type-safe:** Full TypeScript strict mode

---

*Last Updated: 2026-02-08*
*Implementation Status: Sprint 1 Started*
*Next Review: After manager dashboard sync errors link feature*
