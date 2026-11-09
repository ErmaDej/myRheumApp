# myRheumApp — implementation report

## Delivered

A mobile-first, installable React 19 + TypeScript PWA with:

- **Dashboard** — greeting, today's doses with manual taken/skipped/uncertain recording,
  next appointment countdown, 7-day stats, pain/fatigue trend, latest labs with range
  interpretation, recent check-ins, treatment timeline, weekly summary, sync status.
- **Daily journal** — fast check-in with 0–10 pain/fatigue/sleep/function/mood,
  stiffness minutes, triggers, side effects, notes; edit and delete; offline-first saves.
- **Measurements** — validated BASDAI, BASFI and ASDAS-CRP with missing-item reporting,
  algorithm versioning, saved history and trend charts.
- **Laboratory** — original value/unit/reference interval preserved, per-test trends,
  CSV export, out-of-range interpretation warnings.
- **Medications** — prescribed plans, schedules, dose events, 14-day adherence including
  "not recorded", reminder toggles and side-effect logging with urgent-care guidance.
- **Appointments** — timezone-correct scheduling (`Africa/Addis_Ababa` default), prep
  questions/tasks, ICS export with discreet alarms.
- **Progress** — baseline vs recent comparisons with sample counts, separated symptom /
  function / laboratory dimensions, filterable treatment timeline.
- **Medical records** — diagnoses, notes, imaging, prescriptions with provenance.
- **Photo journal** — private on-device photographs, capture date/view, comparison slider,
  no beautification or structural interpretation.
- **Reports** — data-driven weekly summary, jsPDF consultation PDF, symptom/lab/dose CSVs,
  JSON backup, print styles.
- **Anatomy** — lazy-loaded React Three Fiber GLB viewer with region focus, accessible
  labels, WebGL fallback image and explicit non-diagnostic disclaimers.
- **Settings** — profile/timezone/units, theme, reminder quiet hours, install prompt,
  sync status, clinic access explanation, export/reset/clear-local-data controls.

## Backend

- `supabase/migrations/0001_core_schema.sql` — normalised schema, constraints, indexes,
  updated_at triggers, notification queue.
- `0002_rls.sql` — RLS enabled and forced on every patient table, owner policies,
  restrictive cross-table checks, no anon grants.
- `0003_clinic_edition.sql` — organisations, memberships, patient consents, audit events,
  security-definer consent helpers, clinician read/write policies, audit triggers.
- `0004_storage_policies.sql` — private document/photo buckets, owner-folder policies,
  consented clinician read.
- `0005_scheduled_reminders.sql` — enables `pg_cron`/`pg_net`, adds
  `dispatch_due_reminders()` + `reminder_config()`, and schedules the reminder job every
  five minutes idempotently. Guarded so a database without those extensions still migrates.
- `supabase/functions/send-reminders` — scheduled service-role function with constant-time
  secret check, timezone quiet hours, idempotent dedupe keys and discreet payloads.
- `supabase/tests/` — executable SQL suites: clinic RLS isolation (12 checks) and the full
  reminder workflow (10 checks incl. 401, dedupe and quiet hours). Run with
  `./scripts/db-test.sh`.

## Verification

- `npm run typecheck` — passes.
- `npm run build` — passes; 47 precached assets, ~2.8 MiB precache; 3D/PDF/Recharts chunks
  are route- or interaction-loaded.
- `npm test` — 79 tests: clinical formulas, missing/invalid inputs, DST-safe timezone
  conversion, ICS folding/escaping, CSV injection, reminder quiet hours, store/outbox,
  clinic permission boundaries, remote mapping, report gaps, axe audits.
- `./scripts/db-test.sh` — 5 migrations applied from scratch to a real Postgres, then both
  SQL suites pass; the reminder suite goes cron → pg_net → Edge Function → queue and gets
  HTTP 200 with a discreet payload.
- Environment drift removed from `index.html`: no hand-written manifest/service-worker links
  (Vite PWA injects them), and pinch-zoom is no longer disabled.
- Playwright end-to-end suite in `e2e/` covers demo auth, journal saving, medication
  reminders, anatomy regions, real JSON/CSV/PDF downloads, offline reload and WCAG 2.2 AA
  axe audits on desktop and mobile Chromium.
- `scripts/backup.mjs` validates an export, writes CSV copies plus SHA-256 manifest and
  refuses malformed input.

## Limitations

- Demo mode is device-only; Supabase tables require applying the migrations.
- Reminder delivery is queued, not guaranteed; push delivery is future work.
- No clinician invitation/admin UI; clinic access groundwork requires a separate security
  and privacy review before multi-patient use.
- Not a medical device. Scores, trends and reports are patient-recorded information, not
  diagnoses or treatment recommendations.
