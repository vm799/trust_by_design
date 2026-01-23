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
- `Tooltip.tsx` - Hint tooltips
- `StatusBadge.tsx` - Status indicators
- `LoadingSkeleton.tsx` - Loading placeholders

### Layout Components (`components/layout/`)
- `AppShell.tsx` - Main app container
- `BottomNav.tsx` - Mobile bottom navigation
- `PageHeader.tsx` - Page header with title/actions
- `Sidebar.tsx` - Desktop sidebar navigation

### Theme Components
- `ThemeToggle.tsx` - Full day/night toggle with mode selector
- `ThemeToggleCompact.tsx` - Navbar-friendly single button
- `DayNightCarousel.tsx` - Feature carousel with alternating aesthetics

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

### Phase 2: Tooltip UX Polish (pending)
### Phase 3: Job Creation Guards (pending)
### Phase 4: Job Flexibility (pending)
### Phase 5: Job Lifecycle + Navbar (pending)
### Phase 6: Polish + Integrations (pending)
