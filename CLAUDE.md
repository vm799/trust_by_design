# CLAUDE.md - JobProof Shared UI Patterns

## Project Overview
JobProof is a field service evidence management application built with:
- **Frontend**: Vite + React 18 + TypeScript
- **Styling**: Tailwind CSS 3.4 with CSS variable theming
- **Animations**: Framer Motion
- **Auth**: Supabase Auth
- **Database**: Supabase + Dexie (offline IndexedDB)
- **Testing**: Vitest (unit) + Playwright (e2e)

## Dark Mode System

### Theme Provider (`lib/theme.tsx`)
Four theme modes available:
- `light` - Manual light mode
- `dark` - Manual dark mode
- `auto` - **Default** - Time-based (6 PM - 6 AM = dark)
- `system` - Follows OS preference

```tsx
// Usage
import { useTheme } from '../lib/theme';

const {
  theme,           // Current mode: 'light' | 'dark' | 'auto' | 'system'
  setTheme,        // Set theme mode
  resolvedTheme,   // Actual applied: 'light' | 'dark'
  isEvening,       // Boolean: is it evening (6PM-6AM)?
  toggleDayNight   // Quick toggle between light/dark
} = useTheme();
```

### Tailwind Configuration
```js
// tailwind.config.js
darkMode: ["class"]  // Uses .dark class on <html>
```

### Theme-Aware Components Pattern
Always use conditional classes based on `resolvedTheme`:

```tsx
const { resolvedTheme } = useTheme();
const isDark = resolvedTheme === 'dark';

<div className={`
  ${isDark
    ? 'bg-slate-900 text-white'
    : 'bg-white text-slate-900'
  }
`}>
```

## CSS Variables (`src/styles/theme.css`)

### Light Mode Colors
```css
:root {
  --background: 0 0% 98%;
  --foreground: 222.2 84% 4.9%;
  --primary: 221 83% 53%;        /* Industrial Blue */
  --accent: 14 91% 60%;          /* Safety Orange */
  --success: 142 76% 36%;
  --warning: 38 92% 50%;
  --danger: 0 84.2% 60.2%;
}
```

### Dark Mode Colors
```css
.dark {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
  --primary: 217.2 91.2% 59.8%;  /* Brighter for dark bg */
  --accent: 14 91% 65%;
}
```

## Component Library

### UI Components (`components/ui/`)
- `ActionButton.tsx` - Primary buttons with press-spring animation
- `Card.tsx` - Container with glassmorphism support
- `Modal.tsx` - Dialog overlay
- `Tooltip.tsx` - Smart tooltips with Radix UI (see Tooltip System below)
- `StatusBadge.tsx` - Status indicators
- `LoadingSkeleton.tsx` - Loading placeholders

## Tooltip System (Phase 2)

### Components (`components/ui/Tooltip.tsx`)
Built on Radix UI for accessibility:
- `Tooltip` - Main component with all options
- `SimpleTooltip` - Quick usage for basic hints
- `InfoTooltip` - For form fields (auto-dismiss + close button)
- `HelpTooltip` - Standalone help icon with tooltip

### Usage
```tsx
import { Tooltip, SimpleTooltip, InfoTooltip, HelpTooltip } from '../components/ui';

// Basic tooltip (300ms delay, high-contrast)
<Tooltip content="Helpful hint" position="top">
  <button>Hover me</button>
</Tooltip>

// Simple tooltip shorthand
<SimpleTooltip content="Quick tip">
  <span>Info</span>
</SimpleTooltip>

// Form field with auto-dismiss (60s) and close button
<InfoTooltip content="This field is required">
  <input type="text" />
</InfoTooltip>

// Help icon that shows tooltip
<HelpTooltip content="Click here for more info" />
```

### Props
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| content | ReactNode | - | Tooltip content |
| position | 'top' \| 'bottom' \| 'left' \| 'right' | 'top' | Position |
| variant | 'default' \| 'highlighted' \| 'warning' \| 'success' \| 'info' | 'default' | Color scheme |
| showClose | boolean | false | Show X button |
| autoDismiss | boolean | false | Auto-hide after delay |
| autoDismissDelay | number | 60000 | Auto-hide delay (ms) |
| delayDuration | number | 300 | Show delay (ms) |

### Variants
- `default` - High-contrast (dark bg in light mode, white bg in dark mode)
- `highlighted` - Amber/orange for important hints
- `warning` - Orange for warnings
- `success` - Emerald for success messages
- `info` - Blue for informational tooltips

### Behavior
- **300ms hover delay** before showing
- **60s auto-dismiss** when `autoDismiss` is enabled
- **Slide-out-right** animation on dismiss
- **Keyboard accessible** (focus triggers tooltip)

## InfoBox Component (Phase 2.1)

Compact, dismissible callout boxes for hints and notices. Uses cyan/teal (not primary blue) to visually distinguish from active UI states.

### Usage
```tsx
import { InfoBox } from '../components/ui';

// Basic info box with dismiss button
<InfoBox title="Tip" variant="info">
  This is helpful information you can dismiss.
</InfoBox>

// Persistent dismissal (saved to localStorage)
<InfoBox
  icon="lightbulb"
  title="Pro Tip"
  variant="tip"
  persistKey="feature_tip_shown"
>
  Once dismissed, this won't show again.
</InfoBox>

// Non-dismissible warning
<InfoBox
  title="Warning"
  variant="warning"
  dismissible={false}
>
  This cannot be dismissed.
</InfoBox>
```

### Props
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| children | ReactNode | - | Box content |
| icon | string | auto | Material symbol icon name |
| title | string | - | Optional bold title |
| variant | 'info' \| 'warning' \| 'success' \| 'tip' | 'info' | Color scheme |
| dismissible | boolean | true | Show X close button |
| onDismiss | () => void | - | Callback when dismissed |
| persistKey | string | - | localStorage key for persistent dismissal |

### Variants
- `info` - Cyan/teal (distinct from primary blue)
- `warning` - Amber/orange
- `success` - Emerald green
- `tip` - Violet/purple for helpful tips

### Navigation Components
- `Breadcrumbs.tsx` - Navigation breadcrumbs with theme support
- `BackButton` - Quick "back to X" navigation

### Layout Components (`components/layout/`)
- `AppShell.tsx` - Main app container
- `BottomNav.tsx` - Mobile bottom navigation
- `PageHeader.tsx` - Page header with title/actions
- `Sidebar.tsx` - Desktop sidebar navigation

### Theme Components
- `ThemeToggle.tsx` - Full day/night toggle with mode selector
- `ThemeToggleCompact.tsx` - Navbar-friendly single button
- `DayNightCarousel.tsx` - Feature carousel with alternating aesthetics

## Job Creation Guards (Phase 3)

### useJobGuard Hook (`hooks/useJobGuard.ts`)
Enforces client-first flow for job creation:

```tsx
import { useJobGuard } from '../hooks/useJobGuard';

// In job creation page
const {
  isLoading,
  clients,
  technicians,
  hasClients,
  hasTechnicians,
  canCreateJob,
  checkAndRedirect,
  showClientRequiredToast,
  showNoTechnicianWarning,
  refresh
} = useJobGuard(redirectOnFail);

// Auto-redirect mode: pass true to automatically redirect when no clients
const guard = useJobGuard(true);

// Manual check mode: validate before action
const handleCreateJob = async () => {
  const canProceed = await guard.checkAndRedirect();
  if (canProceed) {
    // Proceed with job creation
  }
};
```

### Guard Behavior
- **Client required**: Redirects to `/admin/clients/new` with returnTo param
- **Technician optional**: Shows info toast, allows unassigned jobs
- **Toast messages**: "Create a client first before adding jobs"

### Breadcrumbs (`components/ui/Breadcrumbs.tsx`)
Navigation breadcrumbs with theme-aware styling:

```tsx
import { Breadcrumbs, BackButton, JobCreationBreadcrumbs } from '../components/ui';

// Custom breadcrumbs
<Breadcrumbs
  items={[
    { label: 'Jobs', href: '/admin/jobs', icon: 'work' },
    { label: 'New Job' }
  ]}
  separator="chevron"  // 'chevron' | 'slash' | 'arrow'
  showHome={true}      // Adds Dashboard link
/>

// Preset breadcrumbs
<JobCreationBreadcrumbs currentStep="Select Client" />
<ClientCreationBreadcrumbs currentStep="Details" />
<TechnicianCreationBreadcrumbs />

// Back button
<BackButton to="/admin/jobs" label="Back to Jobs" />
```

## Glassmorphism Pattern
Standard glassmorphism container:

```tsx
<div className={`
  backdrop-blur-xl rounded-2xl border transition-all
  ${isDark
    ? 'bg-slate-900/50 border-white/10'
    : 'bg-white/50 border-slate-200/50'
  }
`}>
```

## Animation Patterns

### Framer Motion Entry
```tsx
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.5, delay: 0.1 }}
>
```

### Press Spring (CSS)
```css
.press-spring {
  transition: transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.press-spring:active {
  transform: scale(0.95);
}
```

### Hover Lift
```tsx
whileHover={{ y: -5, transition: { duration: 0.2 } }}
```

## Icon System
Uses Google Material Symbols Outlined:
```tsx
<span className="material-symbols-outlined">icon_name</span>

// Filled variant
<span
  className="material-symbols-outlined"
  style={{ fontVariationSettings: "'FILL' 1" }}
>
  icon_name
</span>
```

## Accessibility Requirements (WCAG AAA)

### Touch Targets
- Minimum 44x44px for all interactive elements
- 56x56px for field worker buttons (gloved hands)

### Focus Indicators
```css
:focus-visible {
  outline: 2px solid hsl(var(--ring));
  outline-offset: 2px;
}
```

### High Contrast Support
```css
@media (prefers-contrast: high) {
  :root {
    --foreground: 0 0% 0%;
    --background: 0 0% 100%;
  }
}
```

## File Structure
```
/home/user/trust_by_design/
├── components/
│   ├── ui/              # Reusable UI components
│   ├── layout/          # Layout components
│   ├── branding/        # Logo & brand assets
│   └── *.tsx            # Feature components
├── views/               # Page-level components
├── lib/
│   ├── theme.tsx        # Theme provider
│   ├── supabase.ts      # Supabase client
│   └── db.ts            # Dexie local database
├── src/styles/
│   └── theme.css        # CSS variables & utilities
├── tests/
│   ├── unit/            # Vitest unit tests
│   └── e2e/             # Playwright e2e tests
├── tailwind.config.js   # Tailwind configuration
└── vite.config.ts       # Vite configuration
```

## Testing Commands
```bash
npm test              # Run Vitest unit tests
npm run test:e2e      # Run Playwright e2e tests
npm run test:coverage # Run with coverage report
```

## Development Commands
```bash
npm run dev           # Start dev server (port 3000)
npm run build         # Production build
npm run preview       # Preview production build
npm run lint          # ESLint check
npm run type-check    # TypeScript check
```

## Phase Implementation Status

### Phase 1: Core UI Foundation ✅
- [x] Landing page glassmorphism design
- [x] Day/Night carousel (Framer Motion, accessible)
- [x] Auto-dark mode (time-based 6PM-6AM default)
- [x] Global theme with Tailwind dark:`class`
- [x] Theme persisted in localStorage

### Phase 2: Tooltip UX Polish ✅
- [x] Radix UI tooltips with accessibility
- [x] High-contrast variants (dark bg/white text or inverse)
- [x] 300ms hover delay to show
- [x] 60s auto-dismiss option
- [x] Close button (X) option
- [x] Slide-out-right animation

### Phase 3: Job Creation Guards ✅
- [x] useJobGuard hook for client-first validation
- [x] Auto-redirect to client creation when no clients exist
- [x] Toast notifications for guard warnings
- [x] Breadcrumbs component with theme support
- [x] Preset breadcrumbs (Job, Client, Technician creation)

### Phase 4: Job Flexibility (pending)
### Phase 5: Job Lifecycle + Navbar (pending)
### Phase 6: Polish + Integrations (pending)

---

## Architecture Guidelines (CRITICAL - Do Not Violate)

These patterns were established during the 14-item architecture remediation.
**All future code MUST follow these patterns to prevent regressions.**

### 1. State Management - Use DataContext

**DO NOT** create new useState for jobs/clients/technicians in components.
**ALWAYS** use the centralized DataContext.

```tsx
// ✅ CORRECT
import { useData } from '../lib/DataContext';
const { jobs, clients, addJob, updateJob } = useData();

// ❌ WRONG - Creates duplicate state
const [jobs, setJobs] = useState<Job[]>([]);
```

### 2. Authentication - Use AuthContext

**DO NOT** call `supabase.auth.getUser()` directly in components.
**ALWAYS** use AuthContext for auth state.

```tsx
// ✅ CORRECT
import { useAuth } from '../lib/AuthContext';
const { isAuthenticated, userId, session } = useAuth();

// ❌ WRONG - Causes excessive API calls
const { data } = await supabase.auth.getUser();
```

### 3. Protected Routes - Use ProtectedRoute Wrapper

**ALWAYS** wrap authenticated routes with error boundaries.

```tsx
// ✅ CORRECT
import { ProtectedRoute } from '../components/ProtectedRoute';

<ProtectedRoute sectionName="Dashboard" fallbackRoute="/home">
  <Dashboard />
</ProtectedRoute>

// ❌ WRONG - No error isolation
<Route path="/admin" element={isAuthenticated ? <Dashboard /> : <Navigate to="/auth" />} />
```

### 4. Animation Objects - Use Shared Constants

**DO NOT** define animation objects inline in JSX.
**ALWAYS** use constants from `lib/animations.ts`.

```tsx
// ✅ CORRECT
import { fadeInUp, hoverLiftQuick } from '../lib/animations';
<motion.div variants={fadeInUp} whileHover={hoverLiftQuick}>

// ❌ WRONG - Creates new object every render
<motion.div animate={{ opacity: 1 }} whileHover={{ y: -5 }}>
```

### 5. List Keys - Use Stable IDs

**DO NOT** use array index as React key.
**ALWAYS** use stable identifiers (id, url, timestamp).

```tsx
// ✅ CORRECT
{photos.map(photo => <img key={photo.id} src={photo.url} />)}

// ❌ WRONG - Causes re-render issues
{photos.map((photo, index) => <img key={index} src={photo.url} />)}
```

### 6. Expensive Computations - Use useMemo

**ALWAYS** memoize expensive list operations and lookups.

```tsx
// ✅ CORRECT
const clientsById = useMemo(() =>
  new Map(clients.map(c => [c.id, c])),
  [clients]
);

// ❌ WRONG - Recomputes every render
const clientsById = new Map(clients.map(c => [c.id, c]));
```

### 7. Navigation Components - Use React.memo

**ALWAYS** wrap navigation components (Sidebar, BottomNav, PageHeader) with memo.

```tsx
// ✅ CORRECT
export const Sidebar = memo(function Sidebar({ ... }) { ... });

// ❌ WRONG - Re-renders on every parent update
export const Sidebar = ({ ... }) => { ... };
```

### 8. Lazy Loading - Use Dynamic Imports

**ALWAYS** lazy-load route components and heavy libraries.

```tsx
// ✅ CORRECT - Route components
const Dashboard = lazy(() => import('./views/Dashboard'));

// ✅ CORRECT - Heavy libraries
const getAuth = () => import('./lib/auth');
const auth = await getAuth();

// ❌ WRONG - Increases initial bundle
import { Dashboard } from './views/Dashboard';
```

### 9. Error Handling - Use ErrorState Component

**ALWAYS** provide retry UI for failed operations.

```tsx
// ✅ CORRECT
import { ErrorState } from '../components/ui/ErrorState';

if (error) {
  return <ErrorState message={error} onRetry={loadData} />;
}

// ❌ WRONG - No recovery option
if (error) return <div>Error: {error}</div>;
```

### 10. Supabase Access - Through Auth Module

**DO NOT** import supabase directly in components.
**ALWAYS** access through lazy-loaded auth module.

```tsx
// ✅ CORRECT
const auth = await import('../lib/auth');
const supabase = auth.getSupabaseClient();

// ❌ WRONG - Breaks code splitting
import { getSupabase } from '../lib/supabase';
```

### 11. Magic Link Auth - Use Callback Route

**ALWAYS** redirect magic links to `/auth/callback`.

```tsx
// ✅ CORRECT (in lib/auth.ts)
emailRedirectTo: getAuthRedirectUrl('/#/auth/callback')

// ❌ WRONG - Race condition with auth state
emailRedirectTo: getAuthRedirectUrl('/#/')
```

### 12. Code Splitting - Check vite.config.ts

When adding new views, **ALWAYS** add them to appropriate chunk in `manualChunks`.

```js
// vite.config.ts - Add new views to appropriate chunks
'admin-routes': ['./views/NewAdminView.tsx', ...],
'public-routes': ['./views/NewPublicView.tsx', ...],
```

---

## Architecture Test Commands

Run these before committing to catch violations:

```bash
# Type check
npm run type-check

# Lint (includes architecture rules)
npm run lint

# Unit tests
npm test

# Build (catches chunk issues)
npm run build
```

---

## PR Checklist for Architecture Compliance

Before merging any PR, verify:

- [ ] No direct `supabase.auth.getUser()` calls in components
- [ ] No `useState` for jobs/clients/technicians (use DataContext)
- [ ] All route components lazy-loaded
- [ ] All protected routes wrapped with ProtectedRoute or RouteErrorBoundary
- [ ] No inline animation objects in Framer Motion
- [ ] No array index as React key
- [ ] New views added to vite.config.ts manualChunks
- [ ] Navigation components wrapped with React.memo
- [ ] Expensive list operations use useMemo
- [ ] Failed operations have ErrorState with retry
