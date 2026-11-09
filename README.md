# myRheumApp

A mobile-first, installable Progressive Web App for personal rheumatology tracking:
symptoms, validated BASDAI/BASFI/ASDAS scores, medication events, laboratory trends,
appointments, private photographs, clinician-ready reports and an optional 3D anatomy
explorer.

The default build runs in **local demo mode** with clearly labelled synthetic data, so you
can review every workflow without a backend. Adding Supabase credentials enables private
accounts, cross-device sync and server-enforced Row Level Security.

## Quick start

```bash
npm install
cp .env.example .env.local   # optional: add VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
npm run dev                  # http://localhost:5173
```

Demo credentials are prefilled on the sign-in screen (`demo@myrheum.app` / `demo1234`).
Any valid email with a 6+ character password also opens a device-only demo journal.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Vite development server |
| `npm run typecheck` | TypeScript project build (no emit) |
| `npm run build` | Typecheck + production build + PWA service worker |
| `npm run preview` | Serve the production build locally |
| `npm test` | Vitest unit/integration suite (79 tests) |
| `npm run test:e2e` | Playwright end-to-end + axe accessibility suite |
| `npm run lint` | oxlint |
| `./scripts/db-test.sh` | Apply every migration to a clean local database, then run both SQL suites |

## Architecture

```
src/
  app/            providers, routes, lazy page loading
  components/     ui primitives, layout shell, charts, anatomy viewer
  data/           domain types, synthetic seed, offline store, Supabase adapter, auth
  hooks/          theme, toasts, PWA install prompt
  lib/
    clinical/     BASDAI, BASFI, ASDAS algorithms (pure, versioned)
    reports/      summary builder, CSV, PDF, ICS calendar export
    clinic/       least-privilege access rules for the future clinic edition
    reminders/    timezone-aware quiet-hours and due-time helpers
  pages/          dashboard, journal, measurements, laboratory, medications,
                  appointments, progress, records, photos, reports, anatomy, settings
supabase/
  migrations/     schema, RLS, clinic isolation, private storage policies, cron schedule
  functions/      send-reminders scheduled Edge Function
  tests/          executable SQL suites (RLS isolation, reminder workflow)
```

### Offline-first data

- Every mutation is written to an observable in-memory store and persisted to Dexie
  (IndexedDB) immediately; the UI is never blocked on the network.
- A durable outbox queues mutations when Supabase is configured. Failed uploads stay
  queued with an attempt count; nothing is silently dropped.
- Sensitive photographs are deliberately **never** queued or uploaded in this build.
- Revoke/clear local data from Settings; the policy is documented in the UI.

### Clinical calculations

- **BASDAI**: `(Q1+Q2+Q3+Q4 + (Q5+Q6)/2) / 5`; all six items required.
- **BASFI**: mean of ten items; all ten required.
- **ASDAS-CRP**: `0.121·backPain + 0.110·stiffness + 0.073·peripheral + 0.058·fatigue + 0.579·ln(CRP+1)`.
- Missing or out-of-range answers return the exact missing/invalid items instead of a
  score. Results carry an algorithm version and are stored separately from answers.
- ASDAS reference bands are labelled as reference information, never a diagnosis.

## Supabase setup

1. Link the project and push the migrations:
   ```bash
   supabase link --project-ref <project-ref>
   supabase db push            # applies 0001 … 0005 in order
   ```
   `0005_scheduled_reminders.sql` enables `pg_cron`/`pg_net` and registers the
   `myrheum-send-reminders` job every five minutes. It is guarded: if an extension is
   unavailable the migration still succeeds and only a notice is raised.
2. Enable Email auth. The `handle_new_user` trigger creates a profile row automatically.
3. Put the project URL and **publishable/anon** key in `.env.local`.
4. Deploy the reminder function and give the schedule its secret:
   ```bash
   supabase functions deploy send-reminders --no-verify-jwt
   supabase secrets set CRON_SECRET="$(openssl rand -hex 32)"
   ```
   Then store the same value plus the project URL in Vault so the cron job can call it:
   ```sql
   select vault.create_secret('<CRON_SECRET>', 'myrheum_cron_secret');
   select vault.create_secret('https://<project-ref>.supabase.co', 'myrheum_functions_url');
   ```
   Database settings (`alter database postgres set myrheum.cron_secret = ...`) are also
   honoured. Until a secret exists the job is a no-op, so nothing is sent by accident.
5. Never place a service-role key, database password or Vercel token in the client,
   repository or chat. The service role is used only inside the Edge Function.

### Security model

- RLS is enabled and forced on every patient table; ownership is `auth.uid()`.
- A clinician gets **read** access only through an active, unrevoked consent held by an
  organisation they belong to. **Write** additionally requires read-write scope and a
  writing role (viewer can never write). Membership changes are service-role only.
- Every clinical table has an audit trigger writing actor/entity/time to `audit_events`
  (no clinical values). Patients see their own events; org auditors see their org.
- Storage buckets are private; object paths are `<patient uuid>/<file>` and policies check
  the folder owner (plus consented clinician read for documents).
- Reminder text is deliberately discreet: no medicine names or diagnoses on lock screens.

## Testing

```bash
npm test                 # 79 unit/integration tests
npx playwright install chromium   # once
npm run test:e2e         # builds, serves preview, runs desktop + mobile Chromium
./scripts/db-test.sh     # migrations + RLS isolation + reminder workflow (needs Docker)
```

Coverage includes clinical algorithms, timezone/DST conversion, ICS folding, CSV formula
injection, reminder quiet hours, store/outbox behaviour, clinic permission boundaries and
axe audits of login/dashboard. End-to-end tests cover demo sign-in, journal saving,
medication reminders, anatomy regions, real JSON/CSV/PDF downloads, offline app-shell
reload and WCAG 2.2 AA checks.

## Backup / export drill

- In-app: **Reports** → JSON backup, symptom/lab/dose CSVs, PDF summary.
- Verify and archive an export:
  ```bash
  node scripts/backup.mjs path/to/myrheum-backup-YYYY-MM-DD.json
  ```
  The script validates the schema, writes CSV copies and a SHA-256 manifest, and refuses
  malformed input. Encrypt archives at rest and store them away from the device.

## Assets and licences

- 3D model: `public/models/human_anatomy.glb` (generic educational asset supplied with the
  project). It loads on demand, is cached after first use and falls back to a static image.
- PWA icons are generated from `public/icons/logo.svg`.
- The anatomy viewer is explicitly **not** a scan and never infers fusion/inflammation.

## Known limitations

- Not a medical device; not clinically validated, HIPAA-certified or a substitute for care.
- Demo mode stores data only in this browser.
- Browser/PWA reminders are best-effort and may be delayed when the app is closed.
- PDF/CSV exports reflect only recorded data; gaps are shown, never estimated.
- The clinic edition has schema, RLS and UI groundwork but no clinician invitation/admin UI;
  that requires a separate security and privacy review.
