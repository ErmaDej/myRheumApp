
# myRheumApp — Master Product, UX, Engineering & Clinical-Safety Specification

## 1. Your role

Act as a senior product architect, healthcare UX designer, full-stack TypeScript engineer, Supabase/PostgreSQL specialist, accessibility engineer, and QA lead.

Build **myRheumApp**, a secure, visually exceptional, mobile-first personal rheumatology health-management Progressive Web App (PWA).

The first deployment is for a single patient living with long-standing ankylosing spondylitis (axial spondyloarthritis), who is preparing to begin or has recently begun a long-term treatment plan at Rheum Clinic in Addis Ababa, Ethiopia.

The application must preserve a reliable pretreatment baseline and help the patient and treating clinician understand changes across months and years.

Architect the software so that a future, separately authorized multi-patient clinic edition is possible. Do not prematurely implement a public patient registry, multi-tenant administration, or unnecessary enterprise complexity.

## 2. Non-negotiable operating rules

1. Connect to my existing, dedicated Supabase project. Do not create a different backend, switch to a proprietary hosted backend, or overwrite existing resources without inspection and explicit approval.
2. Inspect the repository, current dependencies, environment variables, and Supabase configuration before changing anything.
3. Work incrementally. First produce a concise implementation plan, proposed database schema, route map, security model, and UI design plan. Then implement in testable milestones.
4. Ask only questions that materially affect safety, architecture, or correctness. Clearly identify assumptions instead of inventing patient information, medical history, clinic contact details, medications, diagnoses, or laboratory values.
5. Use synthetic demonstration data only in previews. Never seed fictional medical records into the actual patient account.
6. Keep all secrets server-side. Never expose a Supabase service-role key, database password, private signing key, or third-party secret in client code.
7. Build functional workflows, not static mockups. Every primary action must work, persist data correctly, and provide loading, success, empty, validation, and error states.
8. Do not claim that the application is clinically validated, HIPAA compliant, or compliant with any other regulation without an actual documented assessment.

## 3. Product principles

- Patient-controlled longitudinal health records.
- Privacy and security by default.
- Clinician-friendly, evidence-aware reporting.
- Clear separation of observations, imported clinical results, calculated scores, and professional diagnoses.
- Honest treatment progress without unsupported claims of cure or structural reversal.
- Offline-aware design with visible synchronization status.
- Accessible, responsive, fast, maintainable, and exportable.
- Free-tier-first implementation, avoiding paid APIs and unnecessary subscriptions.

## 4. Recommended technical architecture

Frontend:
- React, TypeScript, Vite.
- Tailwind CSS and shadcn/ui.
- React Router.
- TanStack Query for remote data fetching and caching.
- React Hook Form and Zod for form validation.
- Recharts for clinical trend charts.
- Motion for React for restrained UI animations.
- Three.js / React Three Fiber for optional anatomical visualization.
- A maintained PWA plugin and service worker.
- IndexedDB, using a library such as Dexie, for carefully scoped offline data.

Backend:
- Existing Supabase project.
- PostgreSQL relational schema with version-controlled SQL migrations.
- Supabase Auth for authentication and account recovery.
- Row Level Security on every patient-owned table.
- Private Supabase Storage buckets for laboratory documents, photographs, and reports.
- Supabase Edge Functions only for tasks requiring trusted server-side execution.
- Scheduled server-side jobs only when a verified scheduler is available.

Engineering:
- GitHub source control.
- Environment variables with a documented `.env.example` containing placeholders only.
- Vitest for unit tests and Playwright for critical end-to-end workflows.
- Clear separation between UI, domain logic, database access, validation, and reporting.

Use current, stable, mutually compatible package versions. Avoid unnecessary dependencies and deprecated APIs. Document installation, configuration, migration, deployment, backup, and recovery procedures.

## 5. Visual identity and design system

Create a premium, calm, editorial-grade digital health experience.

Visual direction:
- Deep midnight navy: #101C2B.
- Soft teal: #75D8C5.
- Clean warm-white surfaces.
- Muted lavender for secondary data visualization.
- Restrained amber for attention-required states.
- Red only for genuinely important warnings.
- Strong typography, generous spacing, refined cards, subtle borders, elegant data visualizations, and excellent mobile ergonomics.

Offer light and dark themes. Persist the theme preference.

The interface should feel like a high-end personal health command center, not a generic hospital administration template.

Animation:
- Smooth page transitions and contextual shared-element motion.
- Subtle card entrance animations.
- Animated chart drawing when appropriate.
- Gentle loading skeletons and progress indicators.
- Interactive date and timeline navigation.
- Optional scroll-based storytelling on the health journey page.
- Respect reduced-motion settings and support keyboard navigation.
- Avoid excessive parallax, constant movement, distracting effects, and long blocking animations.

3D:
- Include a dedicated optional spine and pelvis anatomy explorer.
- Load an appropriately licensed GLB model on demand.
- Support rotation, zoom, touch gestures, and accessible region selection.
- Provide labels and a static fallback image.
- Do not represent the 3D model as a scan of the patient's body.
- Do not infer spinal fusion, inflammation, damage, or reversal from photographs or symptoms.
- Keep 3D assets out of the critical initial page bundle.

## 6. Application navigation

Build the following pages and routes:

1. `/login` — secure sign-in and account recovery.
2. `/onboarding` — consent, timezone, units, preferences, and baseline setup.
3. `/dashboard` — today's health overview.
4. `/health-journal` — daily symptoms and functional observations.
5. `/measurements` — structured clinical scores and mobility measurements.
6. `/laboratory` — lab records, uploaded reports, reference ranges, and trends.
7. `/medical-records` — diagnoses, clinical notes, imaging reports, prescriptions, and documents.
8. `/medications` — prescribed treatment plans, schedules, adherence, and side-effect logs.
9. `/appointments` — calendar, visit history, preparation, and follow-up tasks.
10. `/progress` — longitudinal trends and pretreatment-versus-follow-up comparisons.
11. `/photo-journal` — private, dated photographs and standardized comparisons.
12. `/reports` — printable and downloadable patient summaries.
13. `/anatomy` — optional interactive anatomical explorer.
14. `/settings` — account, privacy, reminders, export, and application preferences.

Use a responsive sidebar on desktop and a compact bottom navigation on mobile, with secondary pages accessible through an organized menu.

## 7. Dashboard requirements

The dashboard should present:

- Greeting and current date.
- Next appointment and time until the visit.
- Today's prescribed medication schedule.
- Medication doses marked as pending, taken, skipped, or not recorded.
- Quick symptom check-in.
- Latest laboratory results with collection dates.
- Pain and stiffness trends.
- Most recent functional assessment.
- Recent journal entries and side-effect reports.
- A treatment timeline with major milestones.
- Outstanding follow-up tasks.
- A weekly summary based on recorded data.
- A visible last-synchronized timestamp and offline indicator.

Never fabricate scores, events, appointments, or completed medication doses.

When data is absent, use helpful empty states and a clear call to action to add the first record.

## 8. Baseline and pretreatment records

Create a guided baseline workflow that can be completed gradually.

Capture only information the patient actually supplies or imports:

- Diagnosis and diagnosis date, if documented.
- Relevant medical history.
- Current symptoms and their duration.
- Existing diagnoses and comorbidities, if the patient chooses to record them.
- Current medications, previous treatments, and documented treatment dates.
- Allergies and adverse drug reactions, if known.
- Previous imaging reports and available clinical assessments.
- Pretreatment laboratory tests.
- Baseline pain, stiffness, fatigue, sleep, and functional limitations.
- Patient-selected mobility measurements.
- Standardized baseline photographs.
- Baseline questionnaire scores, where completed and calculated correctly.
- Date of baseline assessment and date of treatment initiation, when known.

Allow the patient to label records as self-reported, imported from a report, or entered from a clinician's documented assessment.

Never automatically classify a self-reported condition as a verified clinical diagnosis.

Preserve the original source document and original reported value when extracting or entering data.

## 9. Symptom journal and clinical measurements

Provide a fast daily check-in with the option to skip any question.

Track:
- Overall pain, 0–10.
- Morning stiffness duration, in minutes.
- Patient-reported fatigue, 0–10.
- Sleep quality, 0–10, with clearly defined scale anchors.
- Patient-reported functional difficulty, 0–10.
- Self-reported mobility limitations.
- Exercise or physiotherapy activity, if applicable.
- Mood or general well-being, optional.
- Potential triggers or contextual notes, optional.
- Medication side effects.
- Free-text notes and timestamps.

Use clear, consistent scales with explanations. Store the original response and measurement timestamp.

Support validated clinical instruments where appropriate:
- BASDAI.
- BASFI.
- ASDAS, only when all required inputs are present and the validated calculation is implemented correctly.

Document score algorithms, versions, input requirements, missing-data handling, and test cases. Distinguish patient-entered questionnaire answers from calculated results and clinician assessments.

Do not invent diagnostic cutoffs or interpret a score as a substitute for medical review.

Plot daily, weekly, and monthly trends with filters and date ranges. Show gaps in recorded data rather than filling them with invented values.

## 10. Laboratory and medical-record management

Create a normalized laboratory result model.

Each result should support:
- Test name and standardized identifier where available.
- Numeric or qualitative result.
- Original displayed value.
- Unit exactly as reported.
- Laboratory-specific reference interval, if supplied.
- Collection date and time, if known.
- Reporting laboratory.
- Source document.
- Date entered and last updated.
- Patient-entered or imported provenance.
- Optional clinician interpretation.

Support common tests relevant to the patient's actual care, such as CRP, ESR, CBC, renal and liver function, and other tests only when ordered or documented.

Do not assume all tests are required for every patient or medication.

Never silently convert units or compare values with incompatible units. If conversion is implemented, preserve the original value, document the conversion, and test it.

Graph repeated measurements over time. Display the laboratory's reference interval when available and label out-of-range values as requiring interpretation, not as an automatic diagnosis.

Allow uploads of PDF reports and photographs of paper reports. Make extraction optional, reviewable, and editable. Never treat OCR or AI extraction as verified until the user confirms it.

Support clinical notes, imaging reports, referral letters, prescriptions, discharge documents, and other relevant files.

## 11. Private photograph journal

Support baseline and follow-up photographs with:

- Original image preserved.
- Capture date and upload date recorded separately where possible.
- Optional front, side, and rear views.
- Consistent, user-configurable capture instructions.
- Optional height or posture notes, if relevant.
- Side-by-side comparison and a date slider.
- Notes describing pain, posture, movement, or other observed changes.
- Original image download and deletion controls.
- Clear privacy warnings before upload.

Never automatically beautify, reshape, regenerate, or modify clinical comparison photographs. Do not infer vertebral alignment, inflammation, or structural reversal from an image.

Store photographs in a private bucket with restrictive policies and short-lived signed URLs where necessary. Do not place sensitive images in publicly accessible storage, public URLs, analytics events, or application logs.

## 12. Medication management

Support multiple prescribed medications with independent schedules.

Each medication record should include:
- Medication name and, where available, active ingredient.
- Prescribed dose and unit.
- Route and frequency.
- Scheduled times or administration instructions.
- Start date and planned end date, if applicable.
- Prescribing clinician, if known.
- Prescription document or source.
- Status: active, paused by clinician, completed, or discontinued.
- Patient-reported adherence.
- Side effects and notes.
- Reminder preferences.

The patient must be able to record taken, skipped, or uncertain doses, with timestamps.

Do not silently mark a dose as taken because a reminder was delivered or opened.

Provide a medication schedule with day, week, and list views.

Allow reminders to be disabled or snoozed without changing the underlying prescription.

Never recommend starting, stopping, increasing, decreasing, rescheduling, or substituting a prescription medication. Never generate a dose from a medication name alone. Changes must come from the treating clinician or an explicitly documented prescription.

For potentially important side effects, provide a prompt to contact the treating clinician. For urgent symptoms, provide a clear instruction to seek appropriate urgent medical care rather than waiting for an app notification.

## 13. Appointments and calendar

Create appointment management with:

- Date, time, timezone, location, clinician, and appointment type.
- Scheduled, completed, cancelled, and rescheduled statuses.
- Reminder preferences, such as one day and two hours before.
- Appointment notes and questions for the clinician.
- A preparation checklist.
- Follow-up tasks and requested tests.
- Visit summary and next steps.
- Recurring appointments only when explicitly configured.

Use Africa/Addis_Ababa as the initial suggested timezone, editable in settings.

Support exporting appointments as ICS files for external calendars.

Provide a clear distinction between local reminders, browser notifications, server-delivered push notifications, and external calendar events.

Do not promise that browser notifications or offline reminders will always fire on time. Explain permission requirements and platform limitations.

## 14. Weekly and appointment reports

Generate a weekly personal health summary using only recorded data.

Include:
- Number of completed symptom check-ins.
- Pain and stiffness summaries with date ranges.
- Fatigue and sleep trends.
- Medication adherence based on recorded events, including unknown doses.
- Side effects reported.
- Newly added laboratory results.
- Appointments and upcoming tasks.
- Functional score changes, where comparable.
- Patient-written notes and questions for the doctor.

Show sample counts, missing-data warnings, and comparison periods.

Clearly distinguish measured facts from observations and calculated summaries. Do not claim that a medication caused an improvement simply because the scores changed after treatment started.

Provide a concise, printable PDF suitable for consultation and a CSV export of structured data.

Reports must be generated on demand initially. Automated weekly delivery can be added later with an explicit opt-in, verified scheduling infrastructure, and privacy-conscious delivery.

## 15. Treatment timeline and progress analytics

Build an interactive chronological timeline containing:

- Baseline assessment.
- Treatment start and clinician-documented changes.
- Laboratory tests.
- Clinical visits.
- Patient-reported symptom milestones.
- Questionnaire assessments.
- Imaging or medical-report dates.
- Medication side effects.
- Major functional observations.

Allow filtering by event type and comparing predefined periods, such as pretreatment baseline and the latest 30 or 90 days.

Show actual dates and sample counts. Do not imply comparability when instruments, scales, or units differ.

Separate symptom relief, functional improvement, inflammatory marker changes, and structural imaging findings. These are different dimensions and should not be collapsed into one invented health score.

## 16. Supabase data model

Design normalized, relational tables with UUID primary keys, foreign keys, timestamps, indexes, and explicit ownership.

At minimum consider:

- `profiles`
- `consents`
- `medical_conditions`
- `medication_plans`
- `medication_schedules`
- `medication_events`
- `side_effect_reports`
- `symptom_entries`
- `measurement_entries`
- `questionnaire_assessments`
- `lab_reports`
- `lab_results`
- `medical_documents`
- `clinical_visits`
- `appointments`
- `appointment_tasks`
- `progress_photos`
- `timeline_events`
- `reminder_preferences`
- `push_subscriptions`, if push notifications are implemented
- `audit_events`, where appropriate

Use `auth.uid()`-based ownership policies for patient-owned records.

Create strict SELECT, INSERT, UPDATE, and DELETE policies for every exposed table. Verify that one authenticated user cannot read, modify, or delete another user's data by changing an identifier in an API request.

Storage policies must enforce user ownership for every private file. Do not assume that hiding a URL or button is sufficient security.

Avoid storing duplicate data unnecessarily. For calculated scores, preserve inputs and algorithm version. For clinical documents, retain provenance and original files.

Add indexes for owner IDs, timestamps, appointment dates, medication schedule queries, and laboratory test/date queries.

Use migrations rather than undocumented manual database edits. Test migrations on a safe development environment before applying them to real records.

## 17. Security, privacy, and account control

Treat all records as highly sensitive personal health information.

Implement:
- Authenticated access and secure account recovery.
- Least-privilege access.
- Row Level Security and private storage.
- Safe session handling.
- Input validation on the client and server.
- Secure upload validation and file-size limits.
- Rate limiting or abuse controls where appropriate.
- Protection against unauthorized record enumeration.
- No patient data in public URLs, client-side logs, analytics, or error reports.
- No unnecessary third-party trackers.
- User-controlled exports and account deletion workflows.
- A clear privacy notice and consent record.
- An auditable distinction between patient and clinician entries in any future shared-care model.

Use synthetic data during development. Do not put real patient information into prompts, source code, test fixtures, public repositories, or AI coding tools unnecessarily.

Explain the limitations of free-tier infrastructure, backup retention, recovery, and regional data hosting. Document a practical export and backup procedure before real clinical use.

## 18. Offline-first behavior

Implement a PWA manifest, install instructions, service worker, and clear offline status.

Offline functionality should initially include:
- Opening the app shell.
- Viewing explicitly selected, non-sensitive cached summaries where safe.
- Recording symptom journal entries.
- Drafting notes and checklists.
- Viewing cached appointment information when the user has opted in.

Use IndexedDB for structured local drafts and a reliable synchronization queue.

Each queued mutation should have a unique identifier, timestamp, ownership context, and retry status. Implement idempotent synchronization and explicit conflict handling.

Do not silently overwrite newer server data. Show pending, synchronized, failed, and conflict states.

Sensitive laboratory reports and photographs must not be cached offline by default. If sensitive local caching is later enabled, make it opt-in, minimize stored content, explain device risks, and provide a reliable local-data clearing mechanism.

On logout, clear account-specific cached data and drafts according to a documented policy. Never sync one account's queued data into another account.

Do not claim complete offline functionality for authentication, remote file access, server-side reminders, or cross-device synchronization.

## 19. Notifications and reminders

Implement progressively:

Phase 1:
- In-app reminders.
- Appointment countdowns.
- Upcoming medication schedule.
- Browser-local reminders where supported.
- ICS calendar export.

Phase 2:
- Optional web push notifications through a secure server-side workflow.
- Store push subscriptions only for authenticated users.
- Provide permission prompts, subscription management, and unsubscribe functionality.
- Validate scheduled jobs, timezones, and duplicate prevention.

Phase 3:
- Optional integration with a reliable external calendar or native mobile notification system if needed.

Make clear that web push requires support and permission, and local reminders may be unreliable if the app or browser is closed.

Never display sensitive medication names or diagnoses in lock-screen notifications by default. Use discreet wording such as "You have a scheduled health reminder."

## 20. Future clinic edition

Keep the initial deployment single-patient and private.

Design the data layer so a future clinic edition can introduce:
- A separate organization and patient membership model.
- Explicit patient consent and revocation.
- Clinician invitations and verified roles.
- Least-privilege, patient-scoped clinician access.
- Audit logs for record viewing and modification.
- Separate clinic and personal records.
- Secure sharing of selected reports.
- Data retention and deletion policies.
- Administrative controls and documented incident response.

Do not simply disable RLS or expose all patient records to clinic staff. Any future multi-patient release requires a separate security review, threat model, privacy assessment, and appropriate professional and legal review.

## 21. Quality requirements

Target:
- Responsive layouts from small Android phones to desktop monitors.
- WCAG 2.2 AA accessibility as a design and testing target.
- Keyboard navigation, visible focus, semantic headings, and accessible forms.
- Reduced-motion support.
- Fast initial loading and lazy-loaded 3D assets.
- Graceful degradation when WebGL or network access is unavailable.
- Consistent date, time, unit, and number formatting.
- Clear errors and recovery instructions.
- No broken routes, inert buttons, fake charts, or fabricated clinical data.

Add automated tests for:
- Authentication and protected routes.
- RLS ownership boundaries.
- Medication schedule calculations.
- Timezone and daylight-saving edge cases.
- Reminder duplication and missed synchronization.
- Questionnaire calculations and invalid/missing inputs.
- Laboratory units and reference ranges.
- Photo access permissions.
- Offline queue conflicts.
- PDF/CSV export accuracy.
- Account deletion and cached-data clearing.

## 22. Implementation phases

Phase 0 — Discovery:
Inspect the repository and Supabase project. Return the proposed architecture, routes, schema, RLS policy plan, dependencies, risks, and a milestone checklist.

Phase 1 — Design foundation:
Implement design tokens, responsive layout, navigation, theme switching, accessible components, onboarding, and dashboard empty states using synthetic preview data.

Phase 2 — Secure core:
Implement authentication, database migrations, RLS, private storage, profile management, medical-record metadata, and verified ownership tests.

Phase 3 — Clinical tracking:
Implement baseline records, symptom journal, measurements, questionnaires, laboratory management, photo journal, and treatment timeline.

Phase 4 — Treatment workflow:
Implement prescribed medication schedules, dose-event logging, side effects, appointments, calendar export, and reminders.

Phase 5 — Reports and offline:
Implement weekly summaries, PDF/CSV exports, PWA installation, offline drafts, synchronization, and conflict handling.

Phase 6 — Visual excellence:
Add carefully optimized anatomy visualization, chart animations, transitions, polished empty/loading/error states, and responsive refinement.

Phase 7 — Hardening:
Run security tests, RLS tests, accessibility checks, performance audits, backup/export drills, and end-to-end workflows. Fix critical and high-severity findings before real use.

Do not implement every phase in one uncontrolled generation. Finish each phase, report what changed, run relevant tests, and identify remaining limitations before continuing.

## 23. Definition of done

The MVP is complete only when:

- A patient can sign in and access only their own records.
- Pretreatment baseline information can be saved and retrieved.
- Lab results and original documents can be recorded and compared.
- Symptoms and functional measurements can be tracked over time.
- Original photographs can be privately stored and compared by date.
- Prescribed medication schedules and adherence events can be managed.
- Appointments can be created and exported to an external calendar.
- Reminders have honest capability and reliability disclosures.
- Reports accurately reflect recorded data.
- Offline drafts synchronize without silent data loss.
- The PWA is installable on supported devices.
- Critical workflows and ownership boundaries have automated tests.
- The project includes setup instructions, migrations, environment documentation, and a backup/export guide.

## 24. Your first response

Before writing application code, inspect the existing project and available Supabase configuration.

Then return:
1. A concise architecture and implementation plan.
2. The proposed relational schema and ownership model.
3. A route and component map.
4. A security and privacy risk checklist.
5. A phased task list ordered by dependency.
6. The smallest set of essential clarifying questions.

Do not expose, request, or print secrets. Do not invent medical data. Wait for approval of the proposed foundation before making destructive database changes or using real patient records. But for now, you may start with sample data which should be easy to replace later at production stage.


Note that to use my backend supabase database, github repo with dev and main branches and eventually, a new vercel project via:
project url = https://zmfrtizptjhugxghzypk.supabase.co

publishable key = sb_publishable_<REDACTED>

direct connection string  =  postgresql://postgres:<REDACTED>@<project-ref>.supabase.co:5432/postgres

my fresh GitHub Repo : https://github.com/ErmaDej/myRheumApp.git

Vercel Token = "vcp_<REDACTED>"
