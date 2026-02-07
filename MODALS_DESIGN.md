# Inline Action Modals: Design & Architecture (Days 6-10)

## Overview

**Objective:** Build 3 lightweight, delightful modal overlays for quick actions from the dashboard.
- Inline, no page navigation
- Real-time validation & feedback
- Full keyboard support
- WCAG 2.1 AA accessible
- Zero mock data (real DataContext)

---

## Modal 1: QuickAssign

### Purpose
Assign an unassigned job to a technician without leaving the dashboard.

### UX Flow
```
Dashboard → [Unassigned Job Alert] → [Click/Keyboard Shortcut]
  → QuickAssign Modal → Select Technician → [Assign]
  → Optimistic update → Success toast → Close modal
```

### Component Structure
```
QuickAssignModal/
├── index.tsx (main component, 180 lines)
├── TechnicianSelector.tsx (dropdown/list, 120 lines)
├── AssignmentForm.tsx (form + submit, 100 lines)
└── useAssignmentLogic.ts (custom hook, 80 lines)
```

### Features
- **Technician Selector:**
  - List/dropdown of available technicians
  - Filter by status (Available, On Site)
  - Show current workload (active jobs count)
  - Click/keyboard to select
  - Visual highlight of current selection

- **Real-Time Validation:**
  - Prevent assigning to offline technician
  - Prevent assigning if technician has > 5 active jobs
  - Show clear error messages

- **Optimistic Updates:**
  - Update DataContext immediately on assign click
  - Show success state
  - Rollback on error

- **Keyboard Support:**
  - `Ctrl+A` to open from dashboard
  - Arrow Up/Down to navigate technicians
  - Enter to select
  - Esc to close
  - Tab to cycle options

- **Animations:**
  - Modal: Scale 0.95 → 1.0 + fade (150ms)
  - Technician list: Stagger children (50ms)
  - Success: Pulse on confirm button
  - Exit: Fade out + scale 0.9 (100ms)

### Error States
```
- Technician offline: "Cannot assign to offline technician"
- Too many jobs: "This technician has reached max assignments (5)"
- Assignment failed: "Failed to assign. Retry?" [Retry button]
- Network error: "Connection lost. Try again?" [Retry button]
```

### Success State
```
✓ Assigned to [Technician Name]
Job [ID] is now assigned
Closing in 2 seconds... [Dismiss]
```

---

## Modal 2: QuickInvoice

### Purpose
Create invoice for completed job without leaving dashboard.

### UX Flow
```
Dashboard → [Ready to Invoice Alert] → [Click Modal]
  → QuickInvoice Modal → Review Job Details → Confirm Rate
  → [Create Invoice] → Optimistic update → Success toast → Close
```

### Component Structure
```
QuickInvoiceModal/
├── index.tsx (main component, 200 lines)
├── JobReview.tsx (job details, 90 lines)
├── RateEditor.tsx (rate input, 80 lines)
├── InvoicePreview.tsx (invoice summary, 100 lines)
└── useInvoiceLogic.ts (custom hook, 100 lines)
```

### Features
- **Job Review:**
  - Display job ID, client name, technician, date
  - Show evidence count (photos/signature)
  - Display calculated rate (from job record)
  - Show total job duration (if available)

- **Rate Editing:**
  - Allow override of default rate (manual entry)
  - Real-time calculation of total
  - Input validation (positive number, 2 decimal places)
  - Currency symbol formatting ($)

- **Invoice Preview:**
  - Job Details summary
  - Rate: $XXX.XX
  - Subtotal
  - Tax calculation (if applicable)
  - Total: $XXX.XX
  - Invoice date (today)

- **Real-Time Validation:**
  - Prevent rate < $0
  - Prevent empty rate
  - Show calculation errors
  - Clear error messages

- **Optimistic Updates:**
  - Update job.invoiceId immediately
  - Show success state
  - Rollback on error

- **Keyboard Support:**
  - `Ctrl+I` to open from dashboard
  - Tab to cycle rate/confirm
  - Enter to create invoice
  - Esc to close

- **Animations:**
  - Modal: Scale 0.95 → 1.0 + fade
  - Job details: Slide in from top
  - Rate editor: Focus highlight + subtle shake on error
  - Preview: Fade in when rate changes
  - Success: Checkmark animation

### Calculation Logic
```typescript
// Real-time calculation
const subtotal = rate; // rate is total for job
const tax = subtotal * 0.08; // 8% tax (configurable)
const total = subtotal + tax;

// Display
Invoice Total: $[total.toFixed(2)]
```

### Error States
```
- Rate missing: "Please enter a rate"
- Rate invalid: "Rate must be a positive number"
- Creation failed: "Failed to create invoice. Retry?" [Retry]
- Network error: "Connection lost. Try again?" [Retry]
```

### Success State
```
✓ Invoice Created
Job [ID] for [Client]
Invoice Total: $[amount]
Closing in 2 seconds... [Dismiss]
```

---

## Modal 3: QuickSearch

### Purpose
Global search modal - find jobs/clients quickly without navigating.

### UX Flow
```
Dashboard → [Keyboard: Cmd/Ctrl + K] → QuickSearch Modal
  → Type query → Real-time results → Click result
  → Navigate to job/client detail page
```

### Component Structure
```
QuickSearchModal/
├── index.tsx (main component, 150 lines)
├── SearchInput.tsx (search field, 60 lines)
├── SearchResults.tsx (result list, 120 lines)
├── ResultItem.tsx (individual result, 80 lines)
└── useQuickSearch.ts (custom hook, 100 lines)
```

### Features
- **Search Behavior:**
  - Real-time search on keystroke (debounced 200ms)
  - Search across: Job ID, Job Title, Client Name
  - Show match highlights (bold query text)
  - Show match type badge (Job | Client)

- **Results Display:**
  - Up to 8 results shown (scrollable)
  - Sort by: Relevance (ID match first, then contains)
  - Show:
    - Job: [ID] - [Title] @ [Client] | [Status]
    - Client: [Name] | [Email] | X jobs

- **Keyboard Navigation:**
  - `Cmd+K` / `Ctrl+K` to open/focus
  - Arrow Up/Down to navigate results
  - Enter to select result
  - Esc to close
  - Type to filter
  - Number keys 1-8 to quick-select top results

- **Result Actions:**
  - Click or Enter to navigate to detail page
  - Show loading state while navigating
  - Preserve search history (show recent 5 searches)

- **Visual Feedback:**
  - Highlight current result (blue background)
  - Show keyboard hint for Enter
  - Show result count ("6 jobs, 2 clients")
  - Empty state: "No results matching '...'"

- **Animations:**
  - Modal: Slide down from top (200ms)
  - Results: Stagger in (30ms each)
  - Highlight: Smooth color transition
  - Exit: Fade + slide up (100ms)

### Debounce Strategy
```typescript
// Don't search too frequently
const debouncedSearch = useMemo(
  () => debounce((term: string) => {
    // Search jobs and clients
  }, 200),
  []
);
```

---

## Shared Modal Architecture

### Base Modal Component
```
<ModalProvider>
  <ModalOverlay onClick={handleDismiss}>
    <ModalContent
      role="dialog"
      aria-labelledby="modal-title"
      aria-describedby="modal-description"
    >
      {/* Modal header + content + actions */}
    </ModalContent>
  </ModalOverlay>
</ModalProvider>
```

### Modal Container CSS
```
Position: fixed (full screen)
Z-index: 1000 (above dashboard)
Background: rgba(0, 0, 0, 0.5) with blur
Overlay click: Close modal
Esc key: Close modal
Focus trap: Keep focus inside modal
```

### Modal Animations
```
Enter:
- Overlay: opacity 0 → 1 (150ms)
- Content: scale 0.95 → 1.0, opacity 0 → 1 (150ms)

Exit:
- Content: scale 1.0 → 0.9, opacity 1 → 0 (100ms)
- Overlay: opacity 1 → 0 (100ms)
```

---

## DataContext Integration

### All 3 Modals Use Real Data
```typescript
// QuickAssignModal
const { jobs, technicians, updateJob, refresh } = useData();

// QuickInvoiceModal
const { jobs, clients, updateJob, refresh } = useData();

// QuickSearchModal
const { jobs, clients, technicians } = useData();
```

### Optimistic Updates Pattern
```typescript
// 1. Update local state immediately
updateJob({ ...job, technicianId: selectedTech.id });

// 2. Show success
setSuccessMessage('Assigned!');

// 3. On error, rollback
.catch(error => {
  // Revert optimistic update
  updateJob(originalJob);
  setError('Failed to assign');
});
```

---

## Accessibility (WCAG 2.1 AA)

### All Modals Must Have
- ✅ `role="dialog"` on modal container
- ✅ `aria-labelledby="modal-title"`
- ✅ `aria-describedby="modal-description"`
- ✅ `aria-modal="true"`
- ✅ Focus trap (focus stays inside modal)
- ✅ Esc key closes modal
- ✅ Focus returns to trigger on close
- ✅ Semantic HTML (buttons, inputs, labels)
- ✅ Color contrast ≥ 4.5:1
- ✅ Touch targets ≥ 44px
- ✅ Keyboard navigation fully supported

### Testing Checklist
```
□ VoiceOver/NVDA reads modal title
□ Tab navigation cycles through controls
□ Enter/Space activates buttons
□ Esc key closes modal
□ Focus returns to dashboard on close
□ All text has 4.5:1 contrast
□ All interactive elements ≥ 44px
□ Error messages announced to screen reader
□ Success messages announced to screen reader
```

---

## Implementation Order

### Week 1 (Days 6-7): QuickAssign
1. Create modal container component
2. Build TechnicianSelector
3. Implement assignment logic
4. Add error handling & retry
5. Add animations
6. Write comprehensive tests
7. Accessibility audit

### Week 2 (Days 8-9): QuickInvoice
1. Build JobReview component
2. Create RateEditor with validation
3. Build InvoicePreview with real calculations
4. Implement invoice creation logic
5. Add error handling & rollback
6. Add animations
7. Write comprehensive tests
8. Accessibility audit

### Week 3 (Days 9-10): QuickSearch
1. Create SearchInput with debounce
2. Build SearchResults list
3. Implement search logic (jobs + clients)
4. Add keyboard navigation
5. Add animations
6. Write comprehensive tests
7. Accessibility audit

### Final (Day 10): Integration & Polish
1. Connect modals to dashboard (click handlers)
2. Add keyboard shortcuts (Ctrl+A, Ctrl+I, Ctrl+K)
3. Test all 3 modals together
4. Final accessibility audit
5. Performance optimization
6. Build & test verification

---

## Testing Strategy

### Each Modal Needs
- **Unit Tests:** Component rendering, prop handling
- **Integration Tests:** DataContext interaction, real data handling
- **Accessibility Tests:** Keyboard nav, ARIA labels, screen readers
- **E2E Tests:** Full user flow (optional, covered by integration)

### Test Data (Real, Not Mocked)
```typescript
// Use test factories
const jobs = [createTestJob(), createTestJob()];
const technicians = [createTestTechnician(), ...];
const clients = [createTestClient(), ...];

// Render with real DataContext
<DataContext.Provider value={{ jobs, technicians, clients, ... }}>
  <QuickAssignModal />
</DataContext.Provider>
```

### Required Tests Per Modal
```
QuickAssignModal: 15 tests
- Rendering (2)
- Technician selection (4)
- Assignment logic (3)
- Error handling (3)
- Keyboard navigation (2)
- Accessibility (1)

QuickInvoiceModal: 15 tests
- Rendering (2)
- Rate editing (3)
- Calculation (3)
- Invoice creation (3)
- Error handling (2)
- Accessibility (2)

QuickSearchModal: 12 tests
- Rendering (2)
- Search debounce (2)
- Results filtering (3)
- Navigation (2)
- Keyboard shortcuts (2)
- Accessibility (1)
```

---

## Success Metrics

### Code Quality
```
✅ 641 + 42 = 683 tests passing (100%)
✅ 0 TypeScript errors
✅ 0 accessibility violations
✅ Build time < 15 seconds
```

### User Experience
```
✅ Modals open instantly (< 200ms)
✅ Keyboard shortcuts work (Ctrl+A, Ctrl+I, Ctrl+K)
✅ Real-time validation shows clear feedback
✅ Success/error messages appear immediately
✅ Animations feel smooth (60fps)
```

### Accessibility
```
✅ WCAG 2.1 AA compliant
✅ Keyboard navigation complete
✅ Screen reader compatible
✅ Color contrast ≥ 4.5:1
✅ Touch targets ≥ 44px
```

---

## Dependencies

### Already Available
- React Router (useNavigate)
- Framer Motion (animations)
- DataContext (state management)
- Tailwind CSS (styling)
- TypeScript (type safety)

### No New Dependencies Required ✅

---

## Timeline

```
Days 6-7 (12 hours): QuickAssign modal
  - Core component (4h)
  - Logic & validation (3h)
  - Tests (3h)
  - Accessibility audit (2h)

Days 8-9 (12 hours): QuickInvoice modal
  - Core component (4h)
  - Logic & calculations (3h)
  - Tests (3h)
  - Accessibility audit (2h)

Days 9-10 (10 hours): QuickSearch modal
  - Core component (3h)
  - Search logic (2h)
  - Tests (3h)
  - Accessibility audit (2h)

Day 10 (4 hours): Integration & Polish
  - Connect to dashboard (1h)
  - Keyboard shortcuts (1h)
  - Final testing (1h)
  - Build verification (1h)
```

**Total: 38 hours across 5 calendar days**

---

**This design ensures each modal is:**
- ✅ Robust (full error handling)
- ✅ Delightful (smooth animations, instant feedback)
- ✅ Intuitive (keyboard shortcuts, clear affordances)
- ✅ Accessible (WCAG 2.1 AA, keyboard nav, screen readers)
- ✅ Well-tested (comprehensive test suite, no mock data)
