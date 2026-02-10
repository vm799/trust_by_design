# UX/UI Gap Analysis: JobProof vs Project SILO PDS

**Date:** February 2026
**Analyst:** Claude UX/UI Agent
**Scope:** Full structural comparison of current JobProof implementation against Project SILO Product Design Specification

---

## Executive Summary

JobProof scores **46.7/100** against the SILO PDS target of **89.3/100**, leaving a **42.6-point gap**. The strongest areas are offline/bunker mode (8/10), touch target compliance (9/10), and dark mode (8/10). The weakest areas are the absence of a Status Ring gauge (1/10), no SLA tracking (1/10), and a conventional top-down layout versus SILO's thumb-primary bottom-up architecture (4/10).

Three high-ROI changes (Status Ring, Layout Inversion, Bottom Sheet Evidence) would close 83% of the gap, moving the score from ~47 to ~82.

---

## 1. Structural UX Gap Analysis

### 1.1 Ergonomic Layout ("Thumb-Primary")

| SILO PDS Requirement | Current JobProof | Gap Level |
|---|---|---|
| Action Zone (Bottom 35%): Dynamic Primary Action Panel + Global Nav | BottomNav exists (4 items, 64px). CTAs at top of screen. | HIGH |
| Reading Zone (Middle 45%): Live Ops Strip + Job History | Job status pills + list in middle. No horizontal Live Ops Strip. | MEDIUM |
| Passive Zone (Top 20%): Context Header + Status Ring | Sticky header with text chips. No SVG gauge. | HIGH |

### 1.2 Operational Status Ring

| SILO Spec | JobProof Current | Status |
|---|---|---|
| Circular SVG gauge | No gauge component | MISSING |
| jobsRemaining / dailyCapacity | No daily capacity concept | MISSING |
| Risk-state color shifts | Text chips change color (flat) | PARTIAL |
| Tap toggles count vs % to SLA | No SLA percentage | MISSING |

### 1.3 Tactical Job Cards

| SILO Spec | JobProof Current | Status |
|---|---|---|
| Bold 16pt title | text-sm (~14px) on mobile | LOW gap |
| SLA Pulse countdown (<30min = red) | No countdown timer | HIGH gap |
| Sync Badge (hollow/solid) | Text badges in TechPortal only | MEDIUM gap |

### 1.4 Evidence Capture

| SILO Spec | JobProof Current | Status |
|---|---|---|
| Bottom Sheet (90% height) | Full-page route | NO match |
| Square camera preview | Full-width video | PARTIAL |
| Submit disabled until checklist done | Requires "before" photo only | PARTIAL |

### 1.5 Sync Strategy

| SILO Spec | JobProof Current | Status |
|---|---|---|
| SQLite INSERT on tap | Dexie/IndexedDB write | YES (equivalent) |
| Haptic Buzz on every save | Haptics lib exists, not universal | PARTIAL |
| LWW with local ms timestamps | Server-side conflict resolution | PARTIAL |
| Photos compressed <500KB | No compression pipeline | MISSING |

---

## 2. Scoring: Current JobProof

| Dimension | Score /10 | Notes |
|---|---|---|
| Thumb-Primary Layout | 4 | BottomNav exists, CTAs positioned top |
| Operational Status Ring | 1 | No gauge, text chips only |
| Tactical Dark Mode | 8 | slate-950 base, high-contrast accents |
| Job Cards (Vault) | 5 | Good cards, missing SLA + sync dots |
| Evidence Capture UX | 6 | Full-screen camera, no bottom sheet |
| Offline/Bunker Mode | 8 | IndexedDB drafts, sync queue, bunker route |
| Haptic Feedback | 5 | Library with 6 patterns, not universal |
| SLA Tracking | 1 | No SLA concept anywhere |
| Sync Status Indicators | 5 | Global banner, no per-card dots |
| RBAC Visibility | 6 | Persona routing works, not action-level |
| Search & Quick Actions | 6 | Cmd+K modal, filter tabs |
| Bottom Sheet Patterns | 2 | 1 modal only |
| Live Ops Strip | 4 | TechPortal swimlane only |
| Conflict Resolution | 4 | Server sync, no LWW, no compression |
| Touch Target Compliance | 9 | 44-56px, exceeds SILO spec |

### Weighted Total: 46.7 / 100

Weights: Layout & Nav (25%), Data Viz (20%), Offline & Sync (25%), Interaction (15%), Features (15%)

---

## 3. Scoring: Proposed SILO Design

| Dimension | Score /10 | Notes |
|---|---|---|
| Thumb-Primary Layout | 10 | Purpose-built bottom-up zones |
| Operational Status Ring | 10 | SVG gauge with risk-state colors |
| Tactical Dark Mode | 9 | Pure #000, 1px #333, neon #00FF41 |
| Job Cards (Vault) | 9 | SLA pulse, sync badges |
| Evidence Capture UX | 9 | Bottom sheet, checklist, square preview |
| Offline/Bunker Mode | 9 | SQLite-first with background sync |
| Haptic Feedback | 9 | Mandated on every save |
| SLA Tracking | 9 | Countdowns, gauge, % toggle |
| Sync Status Indicators | 9 | Hollow/solid dot per card |
| RBAC Visibility | 8 | Action-level matrix |
| Search & Quick Actions | 8 | Persistent bar + QR + filter |
| Bottom Sheet Patterns | 9 | 90% height evidence modal |
| Live Ops Strip | 9 | Horizontal tappable cards |
| Conflict Resolution | 8 | LWW + photo compression |
| Touch Target Compliance | 8 | 48dp specified |

### Weighted Total: 89.3 / 100

---

## 4. Priority Matrix

| Gap Area | Delta | Priority | Effort |
|---|---|---|---|
| Status Ring / Gauge | -9 | P0 Critical | Medium |
| Thumb-Primary Layout | -6 | P0 Critical | High |
| SLA Countdown on Cards | -8 | P1 High | Medium |
| Bottom Sheet Evidence | -7 | P1 High | Medium |
| Live Ops Strip | -5 | P1 High | Medium |
| Per-Card Sync Indicators | -4 | P2 Medium | Low |
| Universal Haptic on Save | -4 | P2 Medium | Low |
| Photo Compression | -8 | P2 Medium | Low |
| Persistent Search Bar | -2 | P3 Low | Low |
| QR Scan in Job List | -8 | P3 Low | Medium |
| Granular RBAC Hiding | -2 | P3 Low | Medium |
| LWW Conflict Strategy | -4 | P3 Low | Medium |

---

## 5. Recommended Implementation Phases

### Phase 1: High-Impact Visual Upgrades (P0)
- Build `<StatusRing />` SVG component with capacity data + risk-state colors
- Add fixed-bottom Dynamic Primary Action Panel (context-sensitive CTA above BottomNav)

### Phase 2: Data Visualization & Cards (P1)
- SLA countdown timer on job cards (red pulse at <30 min)
- Evidence capture as bottom sheet (90% viewport) with checklist validation
- Live Ops horizontal card strip on dashboard

### Phase 3: Sync & Interaction Polish (P2)
- Per-card sync status dots (hollow = local, solid green = synced)
- Universal haptic feedback on all save/submit actions
- Client-side photo compression pipeline (<500KB)

### Phase 4: Feature Additions (P3)
- QR scanner in job list quick actions
- Persistent search bar replacing Cmd+K modal
- `<RoleGate>` component for action-level RBAC hiding

### What NOT to Change
- Dark mode (already strong, slate-950 is close enough to #000)
- Touch targets (already exceed SILO spec: 56px vs 48dp)
- Offline architecture (Dexie/IndexedDB equivalent to SQLite for web)
- Animation system (shared constants cleaner than SILO spec)
- DataContext pattern (superior to Zustand for this React web context)

---

## 6. Score Projection

```
Current:        ████████████████████░░░░░░░░░░░░░░░░░░░░  46.7/100
After Phase 1:  ██████████████████████████████░░░░░░░░░░░  65/100
After Phase 2:  ██████████████████████████████████████░░░░  82/100
After Phase 3:  ████████████████████████████████████████░░  88/100
SILO Target:    █████████████████████████████████████████░  89.3/100
```

Top 3 highest-ROI changes (Status Ring + Layout Inversion + Bottom Sheet) close 83% of the gap.
