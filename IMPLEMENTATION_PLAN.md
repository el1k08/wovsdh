# Admin Page Refactoring Plan

**Goal:** Break `app/admin/page.tsx` (3,342 lines) into focused, single-responsibility components.

**Target structure:** `components/admin/` with each component in its own file. Main page reduced to <200 lines (imports + state + layout only).

---

## Identified Components to Extract

| Component | Lines (approx) | Target file |
|---|---|---|
| Utility functions | 32–71 | `components/admin/utils.ts` |
| Shared types | 77–83 | `components/admin/types.ts` |
| `LangTabs` | 92–111 | `components/admin/LangTabs.tsx` |
| Constants (`LOCALES`, `TIME_OPTIONS`, `DURATION_OPTIONS`, `formatDuration`) | 90, 113–127 | `components/admin/constants.ts` |
| `AuthGate` | 133–174 | `components/admin/AuthGate.tsx` |
| `StatusBadge` | 180–206 | `components/admin/StatusBadge.tsx` |
| `BookingStatusBadge` | 212–238 | `components/admin/BookingStatusBadge.tsx` |
| `ServicesTab` | 244–768 | `components/admin/ServicesTab.tsx` |
| `StudioServicesAssignmentTab` | 773–941 | `components/admin/StudioServicesAssignmentTab.tsx` |
| `ScheduleRow` types + helpers | 946–982 | already in `ScheduleTab.tsx` |
| `ScheduleTab` | 983–1600 | `components/admin/ScheduleTab.tsx` |
| `ScheduleEditor` (sub-component of StudiosTab) | 1624–1685 | `components/admin/ScheduleEditor.tsx` |
| `StudiosTab` | 1686–2225 | `components/admin/StudiosTab.tsx` |
| `ClientsSection` + its DTOs | 2230–2776 | `components/admin/ClientsSection.tsx` |
| Bookings panel (inline in AdminPage) | 2893–3342 | `components/admin/BookingsPanel.tsx` |

---

## Stage 1: Foundation — Types, Constants, Utils

**Goal:** Create shared files that all components depend on.
**Files to create:**
- `components/admin/types.ts` — `AdminTab`, `SettingsSubTab`, `InlineMessage`, `AdminServiceDTO`, `AdminClientDTO`, `ClientBookingDTO`, `ScheduleRow`
- `components/admin/constants.ts` — `LOCALES`, `TIME_OPTIONS`, `DURATION_OPTIONS`, `formatDuration`
- `components/admin/utils.ts` — `generateTimeOptions`, `todayString`, `addDays`, `formatLocalTime`, `formatLocalDate`, `buildDefaultSchedule`, `templateToRows`, `buildStudioDefaultSchedule`
**Status:** Complete

---

## Stage 2: Small Atomic Components

**Goal:** Extract self-contained UI components with no cross-dependencies.
**Files to create:**
- `components/admin/LangTabs.tsx`
- `components/admin/AuthGate.tsx`
- `components/admin/StatusBadge.tsx`
- `components/admin/BookingStatusBadge.tsx`
**Status:** Complete

---

## Stage 3: Large Feature Components

**Goal:** Extract the major feature tabs. Each component owns its own state and API calls; receives `apiFetch` and `onUnauth` as props.
**Files to create:**
- `components/admin/ServicesTab.tsx` (lines 244–768)
- `components/admin/StudioServicesAssignmentTab.tsx` (lines 773–941)
- `components/admin/ScheduleTab.tsx` (lines 946–1600, includes `ScheduleRow` type and helpers)
- `components/admin/ScheduleEditor.tsx` (lines 1624–1685, used inside StudiosTab)
- `components/admin/StudiosTab.tsx` (lines 1686–2225)
- `components/admin/ClientsSection.tsx` (lines 2230–2776) ✓
**Status:** Complete

---

## Stage 4: BookingsPanel

**Goal:** Extract bookings list + generate slots UI from the main AdminPage.
**Files to create:**
- `components/admin/BookingsPanel.tsx` — receives `studio`, `apiFetch`, `onUnauth`, `editingBooking`, `onEditBooking` as props
**Status:** Not Started

---

## Stage 5: Slim Main Page + Barrel Export

**Goal:** Replace `app/admin/page.tsx` body with just: localStorage bootstrap, `apiFetch` helper, studio/tab state, and composed layout. Add index barrel.
**Files to create/update:**
- `components/admin/index.ts` — re-exports all components
- `app/admin/page.tsx` — reduced to <200 lines
**Status:** Not Started

---

## Agent Assignment

| Stage | Agent | Notes |
|---|---|---|
| 1 (types/constants/utils) | `typescript-pro` | Parallel with Stage 2 |
| 2 (atomic components) | `frontend-developer` | Parallel with Stage 1 |
| 3 (feature tabs) | `react-pro` + `frontend-developer` | Sequential after Stage 1+2 |
| 4 (BookingsPanel) | `frontend-developer` | Sequential after Stage 3 |
| 5 (slim page + barrel) | `react-pro` | Sequential after Stage 4 |

---

## Success Criteria

- [ ] `app/admin/page.tsx` ≤ 200 lines
- [ ] All existing functionality preserved (no behavioral changes)
- [ ] TypeScript compiles with zero errors (`npx tsc --noEmit`)
- [ ] No circular dependencies between component files
- [ ] All imports use `@/components/admin/...` alias
