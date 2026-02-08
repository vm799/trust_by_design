# 🗺️ Implementation Roadmap - Remaining UAT Work

**Current Date:** February 2026
**Status:** Ready for implementation
**Tests Passing:** 966 ✅
**Build Status:** SUCCESS ✅

---

## 📋 Three Features to Implement

### Feature 1: Data Cleanup ✨ **START HERE**
**Purpose:** Remove test data to prepare for fresh UAT with proper UUID IDs
**Complexity:** LOW
**Time Estimate:** 1-2 hours
**Risk:** MEDIUM-HIGH (permanent deletion)

**Steps:**
1. Open `/home/user/trust_by_design/DATA_CLEANUP_GUIDE.md`
2. Go to Supabase SQL Editor
3. Run Phase 1 (verify test data counts)
4. Screenshot results for audit trail
5. Run Phase 2 (delete test data)
6. Run Phase 3 (verify cleanup)
7. Test app: create/delete technician (should work with new UUID IDs)

**Why This First:**
- Existing test data has text IDs ("tech-5") that won't work with new UUID generation
- Cleanup enables fresh start with proper data
- Unblocks UAT testing

**Files Modified:**
- None (pure SQL execution in Supabase)
- Document: `DATA_CLEANUP_GUIDE.md` ✅ READY

---

### Feature 2: Dark Mode Email Reports
**Purpose:** Support light/dark email themes based on user preference
**Complexity:** MEDIUM
**Time Estimate:** 2-3 days
**Risk:** LOW

**Changes Required:**
1. **lib/notificationService.ts** - Add theme-aware colour palettes
   - Detect user theme preference from localStorage
   - Generate HTML with light or dark CSS
   - Ensure WCAG AA contrast in both modes

2. **lib/theme.tsx** (if needed) - Create theme detection hook
   - Export `useThemePreference()` hook
   - Subscribe to theme changes

3. **Tests** - Add theme testing
   - Unit tests: colour palette validation
   - Integration tests: email generation with themes
   - Manual tests: Gmail, Outlook, Apple Mail rendering

**Email Color Palettes:**

Dark Mode (Current):
- BG: `#0f172a` (slate-900)
- Text: `#f1f5f9` (slate-100)
- Borders: `#334155` (slate-700)

Light Mode (New):
- BG: `#ffffff` (white)
- Text: `#0f172a` (slate-950)
- Borders: `#e2e8f0` (slate-200)

**Priority Badge Colors:**

| Priority | Light Mode | Dark Mode |
|----------|-----------|----------|
| High | `#dc2626` | `#ef4444` |
| Normal | `#2563eb` | `#3b82f6` |
| Low | `#059669` | `#10b981` |

**Status:** Design phase complete, ready for implementation

---

### Feature 3: Canvas Improvements
**Purpose:** Make signature canvas work in dark mode + add quality enhancements
**Complexity:** MEDIUM-HIGH
**Time Estimate:** 3-4 days
**Risk:** MEDIUM

**Changes Required:**

1. **Create useCanvasTheme.ts hook**
   ```typescript
   // lib/useCanvasTheme.ts
   export function useCanvasTheme() {
     // Detect theme from:
     // 1. data-theme attribute on root
     // 2. prefers-color-scheme media query
     // 3. localStorage: jobproof-theme-mode

     // Return colours based on theme
     return {
       bgColor: isDark ? '#1e293b' : '#f8fafc',
       strokeColor: isDark ? '#f1f5f9' : '#0f172a',
       lineColor: isDark ? '#64748b' : '#cbd5e1'
     }
   }
   ```

2. **Update ClientConfirmationCanvas.tsx**
   - Import `useCanvasTheme()`
   - Add MutationObserver to detect theme changes
   - Redraw canvas when theme toggles
   - Preserve signature state during redraw
   - Add theme badge ("Dark" / "Light")

3. **Add Enhancement Features**
   - Zoom/pan for large canvases on mobile
   - Undo/redo stack (maintain state in useRef)
   - Clear confirmation modal
   - Metadata display (GPS accuracy, W3W status, sealed photo count)

4. **Tests**
   - Canvas renders correct colours in both modes
   - Theme toggle preserves signature
   - Touch events work on mobile/tablet
   - Redraw completes in <100ms
   - No memory leaks on repeated toggles

**Status:** Design phase complete, ready for implementation

---

## 🎯 Execution Sequence

**Recommended Order (dependencies considered):**

```
WEEK 1:
├─ Day 1: Data Cleanup (SQL execution)
├─ Day 2-3: Dark Mode Email Reports (parallel with canvas if team allows)
└─ Day 4-5: Canvas Improvements

WEEK 2:
├─ Day 1-2: Testing (manual E2E, email clients, touch devices)
├─ Day 3-4: Bug fixes from testing
└─ Day 5: Full UAT verification + documentation
```

**Parallel Work Options (if you have multiple developers):**
- Developer A: Dark Mode Email Reports
- Developer B: Canvas Improvements
- Both can run tests simultaneously after implementation

---

## ✅ Pre-Implementation Checklist

- [x] UUID generation implemented for new records ✅
- [x] Database schema supports UUID format ✅
- [x] Error handling added for delete operations ✅
- [x] All tests passing (966/966) ✅
- [x] Build succeeds with no errors ✅
- [x] Git branch ready (`claude/fix-technician-deletion-I2pBT`) ✅

**Next Steps:**
- [ ] Execute data cleanup (via SQL Editor)
- [ ] Start Feature 2 or Feature 3 implementation
- [ ] Create feature branches or continue on current branch

---

## 📊 Feature Breakdown with File Changes

### Feature 2: Dark Mode Email Reports

**Files to Modify:**
```
lib/notificationService.ts (1 file, ~50 lines changed)
  - Function: generateNotificationEmailHtml()
  - Add theme parameter
  - Conditional CSS for light/dark
  - Update colour variables

lib/theme.tsx (if new hook needed)
  - Export useThemePreference()
  - Detect localStorage/media query

tests/unit/notificationService.test.ts (NEW)
  - Light mode colour tests
  - Dark mode colour tests
  - WCAG contrast tests
  - Email structure tests
```

**Commits:**
1. "Add theme detection for email notifications"
2. "Update email templates with light/dark palettes"
3. "Add WCAG contrast validation tests for email"

---

### Feature 3: Canvas Improvements

**Files to Modify:**
```
hooks/useCanvasTheme.ts (NEW FILE, ~40 lines)
  - Theme detection
  - MutationObserver
  - Colour calculation

components/ClientConfirmationCanvas.tsx (1 file, ~60 lines changed)
  - Import useCanvasTheme
  - Add theme effect
  - Conditional canvas colours
  - Redraw on toggle
  - Add theme badge

tests/unit/views/ClientConfirmationCanvas.test.tsx (NEW)
  - Theme detection tests
  - Colour calculation tests
  - Theme toggle tests
  - Signature preservation tests
```

**Commits:**
1. "Create useCanvasTheme hook for theme detection"
2. "Update ClientConfirmationCanvas with dark mode support"
3. "Add canvas theme toggle and redraw functionality"
4. "Add canvas quality improvements (zoom, undo, metadata)"

---

## 🧪 Testing Strategy Summary

### Feature 2 Testing (Email)
```bash
# Unit tests
npm test -- notificationService.test.ts

# Manual tests
# 1. Send email to yourself in dark mode
# 2. Send email to yourself in light mode
# 3. Open in Gmail, Outlook, Apple Mail
# 4. Verify colours are correct in each client
# 5. Verify WCAG AA contrast in both modes
```

### Feature 3 Testing (Canvas)
```bash
# Unit tests
npm test -- ClientConfirmationCanvas.test.tsx

# Manual tests
# 1. Open canvas in light mode
# 2. Draw signature
# 3. Toggle to dark mode
# 4. Verify signature is visible
# 5. Toggle back to light mode
# 6. Verify signature still visible
# 7. Try on mobile/tablet
# 8. Try with touch stylus (if available)
```

---

## 🚀 Deployment Checklist

Before pushing to production:

- [ ] All 966 tests pass: `npm test -- --run`
- [ ] Build succeeds: `npm run build`
- [ ] No TypeScript errors: `npm run type-check`
- [ ] No linting errors: `npm run lint`
- [ ] New clients can be created (UUID format)
- [ ] New clients can be deleted (no 400 errors)
- [ ] New technicians can be created
- [ ] New technicians can be deleted
- [ ] Emails render correctly in dark mode
- [ ] Emails render correctly in light mode
- [ ] Canvas works in light mode
- [ ] Canvas works in dark mode
- [ ] Canvas theme toggle preserves signature
- [ ] All tests for new features pass
- [ ] No regressions in existing UAT features

---

## 📞 Help & Questions

### For Data Cleanup
→ See `DATA_CLEANUP_GUIDE.md` for step-by-step SQL instructions

### For Dark Mode Email
→ Check `lib/notificationService.ts` for email template structure
→ Reference: WCAG AA contrast checker (WebAIM)

### For Canvas Improvements
→ Check `components/ClientConfirmationCanvas.tsx` for current implementation
→ HTML5 Canvas API reference: MDN Web Docs

### Architecture Questions
→ Review `CLAUDE.md` for patterns and rules
→ Check existing implementations in similar components

---

## 🎯 Success Metrics

**After completing all features, verify:**

| Metric | Target | Status |
|--------|--------|--------|
| Tests passing | 966+ | ✅ |
| Build succeeds | 100% | ✅ |
| Clients create with UUID | 100% | ⏳ |
| Clients delete without error | 100% | ⏳ |
| Email renders in dark mode | 5+ clients | ⏳ |
| Email renders in light mode | 5+ clients | ⏳ |
| Canvas works in dark mode | 100% | ⏳ |
| Canvas works in light mode | 100% | ⏳ |
| Full UAT test completed | 8/8 issues fixed | ⏳ |

---

**Ready to begin?** Start with the Data Cleanup Guide: `DATA_CLEANUP_GUIDE.md`

Last Updated: 2026-02-08
