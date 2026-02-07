# Sprint 1 Days 2-5: Component Implementation Guide

## 🎯 MISSION
Transform component **shells** → **production-ready** with real data, error handling, loading states, animations, and zero legacy code.

---

## 📋 COMPONENT IMPLEMENTATION CHECKLIST

### 1️⃣ TeamStatusHero.tsx (Currently: Skeleton)

**What to Add:**
```typescript
// ✅ DO: Real calculations from DataContext
const metrics = useMemo(() => {
  const activeTechs = technicians.filter(t => t.status === 'active').length;
  const totalJobs = jobs.length;
  const activeCount = jobs.filter(j => ['In Progress', 'Dispatched'].includes(j.status)).length;
  const overdueCount = jobs.filter(j =>
    new Date(j.dueDate) < new Date() &&
    !['Complete', 'Submitted'].includes(j.status)
  ).length;
  return { activeTechs, totalJobs, activeCount, overdueCount };
}, [jobs, technicians]);

// ✅ DO: Loading skeleton (no mock data)
if (isLoading) return <TeamStatusHeroSkeleton />;

// ✅ DO: Error state with retry
if (error) return <ErrorState message={error} onRetry={refresh} />;

// ✅ DO: Color-coded status
const status = overdueCount > 0 ? 'critical' : activeTechs === 0 ? 'caution' : 'operational';

// ✅ DO: Animations on metrics
<motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3 }}>
```

**Error Handling:**
- Network error → Show "Failed to load team status" + [Retry] button
- Empty data → Show "No team data" with helpful message
- All mutations → Try/catch with user-friendly errors

**Tests to Add:**
```typescript
// Test real data calculations
expect(metrics.overdueCount).toBe(2);
expect(metrics.activeTechs).toBe(3);

// Test color status change
expect(statusColor).toBe('critical'); // when overdue > 0
```

---

### 2️⃣ AlertStack.tsx (Currently: Skeleton)

**What to Add:**
```typescript
// ✅ DO: Calculate alerts from REAL data
const alerts = useMemo(() => {
  const alertList = [];

  // Only add if overdue jobs exist
  const overdueJobs = jobs.filter(j =>
    new Date(j.dueDate) < new Date() &&
    !['Complete', 'Submitted'].includes(j.status)
  ).length;
  if (overdueJobs > 0) {
    alertList.push({
      type: 'overdue',
      count: overdueJobs,
      color: 'red',
      icon: 'schedule',
      cta: 'View Overdue →'
    });
  }

  // Only add if unassigned jobs exist
  const unassignedJobs = jobs.filter(j =>
    !j.technicianId &&
    ['Dispatched', 'In Progress'].includes(j.status)
  ).length;
  if (unassignedJobs > 0) {
    alertList.push({ /* unassigned alert */ });
  }

  return alertList;
}, [jobs]);

// ✅ DO: Don't render if no alerts
if (alerts.length === 0) return null;

// ✅ DO: Each alert is clickable and actionable
<button onClick={() => navigate(`/admin?filter=${alert.type}`)}>
  {alert.label} → {alert.cta}
</button>
```

**Error Handling:**
- Data load error → Show inline error
- Click action fails → Show toast error + [Retry]

---

### 3️⃣ QuickWinsGrid.tsx (Currently: Skeleton)

**What to Add:**
```typescript
// ✅ DO: Real calculations
const readyToInvoice = jobs.filter(j =>
  j.status === 'Complete' && !j.invoiceId
).length;

const activeJobs = jobs.filter(j =>
  ['In Progress', 'Dispatched'].includes(j.status)
).length;

const revenuePending = readyToInvoice * estimatedJobValue; // Real calculation

// ✅ DO: Trend calculation (compare to last week)
const completedThisWeek = jobs.filter(j => {
  const jobDate = new Date(j.updatedAt);
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  return j.status === 'Complete' && jobDate > weekAgo;
}).length;

// ✅ DO: Full card click navigation
<button onClick={() => navigate('/admin/invoices?create=true')}>
  Entire card is clickable
</button>

// ✅ DO: Animations on load
<motion.div
  initial={{ opacity: 0, scale: 0.95 }}
  animate={{ opacity: 1, scale: 1 }}
  transition={{ duration: 0.3, delay: index * 0.1 }} // Stagger
>
```

**Tests:**
- Verify ready-to-invoice count matches actual complete jobs without invoice
- Verify trends calculate correctly
- Verify click navigates correctly

---

### 4️⃣ MetricsCard.tsx (Currently: Basic)

**What to Add:**
```typescript
// ✅ DO: Support optional click handler
interface MetricsCardProps {
  title: string;
  value: string | number;
  trend?: {
    label: string;
    direction: 'up' | 'down' | 'neutral';
    percentage?: number;
  };
  onClick?: () => void;
  isLoading?: boolean;
}

// ✅ DO: Loading skeleton
if (isLoading) return <MetricsCardSkeleton />;

// ✅ DO: Trend color coding
const trendColor = trend?.direction === 'up' ? 'text-green-600' : 'text-amber-600';

// ✅ DO: Clickable with affordance
<button onClick={onClick} disabled={!onClick} className="hover:shadow-md hover:-translate-y-1">
```

---

### 5️⃣ ActiveJobsTable.tsx (Currently: Skeleton)

**What to Add:**
```typescript
// ✅ DO: Real search + filter
const filteredJobs = useMemo(() => {
  let result = [...jobs];

  // Apply filter
  if (filter === 'overdue') {
    result = result.filter(j =>
      new Date(j.dueDate) < new Date()
    );
  }

  // Apply search
  if (searchTerm) {
    result = result.filter(j =>
      j.jobId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      clients.find(c => c.id === j.clientId)?.name.toLowerCase().includes(searchTerm)
    );
  }

  // Smart sort: overdue first
  result.sort((a, b) => {
    const aOverdue = new Date(a.dueDate) < new Date();
    const bOverdue = new Date(b.dueDate) < new Date();
    if (aOverdue && !bOverdue) return -1;
    if (!aOverdue && bOverdue) return 1;
    return new Date(a.dueDate) - new Date(b.dueDate);
  });

  return result;
}, [jobs, clients, filter, searchTerm]);

// ✅ DO: Color-coded by status
const statusColor = getJobStatus(job) === 'overdue'
  ? 'bg-red-50 border-red-200'
  : 'bg-blue-50 border-blue-200';

// ✅ DO: Real-time search without debounce (jobs data is filtered in memory)
onChange={(e) => setSearchTerm(e.target.value)}

// ✅ DO: Pagination
const displayJobs = filteredJobs.slice(0, maxRows);
{displayJobs.length < filteredJobs.length && (
  <button onClick={() => navigate('/admin/jobs')}>
    View all {filteredJobs.length} jobs →
  </button>
)}
```

---

## 🎨 ANIMATIONS (Framer Motion)

Add to **all components**:

```typescript
import { motion, AnimatePresence } from 'framer-motion';
import { designSystem } from '../../lib/designTokens';

// Page load: Stagger children
<motion.div
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  transition={{ staggerChildren: 0.1, delayChildren: 0.2 }}
>

// Card hover: Lift + shadow
<motion.div
  whileHover={{ y: -4, boxShadow: '0 10px 15px rgba(0,0,0,0.1)' }}
  transition={{ duration: 0.2 }}
>

// Alert slide in
<motion.div
  initial={{ opacity: 0, x: 20 }}
  animate={{ opacity: 1, x: 0 }}
  exit={{ opacity: 0, x: -20 }}
  transition={{ duration: 0.3 }}
>

// Success toast
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  exit={{ opacity: 0, y: -20 }}
  transition={{ duration: 0.3 }}
>
```

---

## ❌ LEGACY CODE TO REMOVE

Scan all files for:
- `console.log()` → DELETE
- `// TODO`, `// FIXME` → FIX IMMEDIATELY or DELETE
- Commented-out code → DELETE COMPLETELY
- Mock data variables → DELETE
- Old component versions → DELETE

**Command to find:**
```bash
grep -r "console.log\|TODO\|FIXME\|// " components/dashboard/ lib/designTokens.ts
```

---

## 🧪 TEST STRATEGY (No Mock Data)

```typescript
// ✅ CORRECT: Mock DataContext, use REAL component
import { vi } from 'vitest';

const mockJobs = [
  { id: '1', jobId: 'JP-001', status: 'Complete', dueDate: new Date(), clientId: 'c1' },
  { id: '2', jobId: 'JP-002', status: 'In Progress', dueDate: new Date(), clientId: 'c2' }
];

const { render } = within(
  <DataProvider value={{ jobs: mockJobs, clients: [], ... }}>
    <TeamStatusHero />
  </DataProvider>
);

expect(render.getByText('2')).toBeInTheDocument(); // 2 total jobs
```

**Tests for each component:**
1. Renders with real data
2. Loading state shows skeleton
3. Error state shows message + [Retry]
4. Calculations are correct
5. Clicks navigate correctly
6. Animations don't break rendering
7. Empty state handled gracefully

---

## 🔄 EXECUTION ORDER (Days 2-5)

**Day 2:** TeamStatusHero + AlertStack
- Implement logic
- Add loading/error states
- Add animations
- Write tests

**Day 3:** QuickWinsGrid + MetricsCard
- Implement logic
- Add trend calculations
- Add animations
- Write tests

**Day 4:** ActiveJobsTable
- Real search + filter
- Sorting logic
- Pagination
- Tests
- **Delete all console.log + TODO comments**

**Day 5:** Polish + Cleanup
- Accessibility audit (axe)
- Remove all legacy code
- Verify all tests pass
- Build succeeds
- Commit + push

---

## ✅ DAILY SIGN-OFF

At end of each day:
```bash
# Verify no regressions
npm test -- --run          # All pass ✅
npm run build              # Succeeds ✅
npm run lint               # No issues ✅
npm run type-check         # TypeScript clean ✅

# Verify no legacy
grep -r "console.log\|TODO\|FIXME" components/dashboard/ # = 0
grep -r "mock\|dummy\|fake" components/dashboard/ # = 0

# Commit
git add components/dashboard/ lib/designTokens.ts
git commit -m "Sprint 1 Day X: [description]"
git push origin claude/redesign-dashboard-onboarding-7bXIz
```

---

## 🎯 SUCCESS CRITERIA (End of Day 5)

- [ ] All 5 components have full implementation logic
- [ ] All components have loading skeleton (no mock data)
- [ ] All components have error states with [Retry]
- [ ] All components have Framer Motion animations
- [ ] All components have comprehensive unit tests
- [ ] Zero console.log() statements
- [ ] Zero TODO/FIXME comments
- [ ] Zero commented-out code
- [ ] `npm test -- --run` = all pass ✅
- [ ] `npm run build` = succeeds ✅
- [ ] `npm run lint` = clean ✅
- [ ] All commits pushed to branch ✅

---

*This is the execution guide for Days 2-5. Follow exactly, no shortcuts.*
