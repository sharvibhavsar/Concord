---
name: Cycle-aware features
description: How menstrual cycle phase tracking is implemented in Concord
---

## Architecture
- `lib/db/src/schema/user_profiles.ts` — `user_profiles` table with gender, lastPeriodDate, cycleLength (default 28), lutealPhaseLength (default 14), profileCompleted
- `artifacts/api-server/src/routes/profile.ts` — GET/PATCH /profile (upserts on first access), GET /cycle (phase calculation)
- Phase calculation: dayInCycle = (daysSinceLastPeriod % cycleLength) + 1
  - Menstrual: days 1–5 → 40% efficiency, shouldReschedule: true
  - Follicular: days 6 to (cycleLength - lutealPhaseLength - 1) → 80%
  - Ovulatory: day (cycleLength - lutealPhaseLength) → 100%
  - Luteal: remaining days → 60%, shouldReschedule: true
- needsPeriodUpdate: true when lastPeriodUpdatedAt is > cycleLength days ago

## Frontend
- `AuthProvider` → `ProfileProvider` → `CycleProvider` wrapping the app
- Auth gate: unauthenticated → LoginPage; profile not completed → ProfileSetup wizard
- `ProfileSetup` — 3-step wizard: name → gender → (if female) period date
- `PhaseBanner` — colored banner on dashboard showing current phase + efficiency bar
- `PeriodUpdateDialog` — auto-opens when needsPeriodUpdate is true (once per session)
- `RescheduleDialog` — auto-opens in luteal/menstrual phases when low-priority pending tasks exist; pushes deadline +7 days; dismissed per-phase per-day via sessionStorage

## Auth
Replit Auth (OIDC). Tasks and chat are scoped by userId. Seed data (userId=null) is visible to unauthenticated requests only.

**Why:** User specifically requested cycle phase awareness, per-user data persistence, and rescheduling in low-energy phases.
