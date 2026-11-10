# User Manual - myRheumApp

## Welcome to myRheumApp

myRheumApp is a personal Progressive Web App (PWA) for tracking rheumatology symptoms, laboratory results, medications, appointments, and other health records. The app runs offline-first with optional Supabase sync for cross-device access.

## Getting Started

### Quick Setup

1. **Install the app**: Open the app in your browser and use the "Install app" option from the browser menu to add myRheumApp to your home screen.

2. **Sign in**: 
   - Use demo credentials: `demo@myrheum.app` / `demo1234`
   - Or any valid email with a 6+ character password to open a device-only demo journal

3. **Optional**: Add Supabase credentials in Settings → Sync & storage to enable cross-device sync

### Dashboard Overview

The dashboard is your main health overview page. Key elements:

- **Greeting and current date** at the top
- **Next appointment** countdown and details
- **Medication schedule** for today's prescribed doses
- **Quick symptom check-in** - tap to record pain, stiffness, fatigue, sleep quality, and functional difficulty
- **Latest laboratory results** with collection dates and reference ranges
- **Pain and stiffness trends** showing daily values over time
- **Most recent functional assessment** (BASFI score)
- **Recent journal entries** and side-effect reports
- **Treatment timeline** with major milestones
- **Outstanding follow-up tasks**
- **Weekly summary** based on recorded data
- **Last-synchronized timestamp** and offline indicator

## Daily Check-in (Health Journal)

### Recording Symptoms

1. Navigate to the **Journal** tab in the bottom navigation
2. Record your daily symptoms:
   - **Pain**: 0–10 scale (0 = no pain, 10 = worst imaginable)
   - **Morning stiffness**: Duration in minutes
   - **Fatigue**: 0–10 scale
   - **Sleep quality**: 0–10 scale
   - **Functional difficulty**: 0–10 scale
3. Add optional notes about triggers, context, or mood
4. Save the entry

### Mobility Measurements

The app now supports tracking head deviation from wall measurements:

- **Head deviation from wall**: Measured in centimeters (0–30 cm range)
- Record this when completing your daily check-in using the range slider or numeric input
- This metric helps monitor posture changes and progress over time
- Data is stored per account and included in JSON exports

## Questionnaires and Scores

### BASDAI (Bath Ankylosing Spondylitis Disease Activity Index)

- Six items about the last week, all required for a valid score
- Calculated as: `(Q1+Q2+Q3+Q4 + (Q5+Q6)/2) / 5`
- Items: fatigue, back pain, peripheral pain, enthesitis, stiffness severity, stiffness duration

### BASFI (Bath Ankylosing Spondylitis Functional Index)

- Ten items about daily function, all required for a valid score
- Mean of all ten items, 0 (no difficulty) to 10 (unable to perform)

### ASDAS (AS Disease Activity Score)

- Four symptom items plus a CRP value from a laboratory result
- Formula: `0.121·backPain + 0.110·stiffness + 0.073·peripheral + 0.058·fatigue + 0.579·ln(CRP+1)`

Scores are stored separately from answers and include algorithm version information.

## Laboratory Results

### Recording Lab Results

1. Navigate to the **Laboratory** tab
2. Enter results as they were reported by the laboratory:
   - Test name (e.g., C-reactive protein, ESR, hemoglobin)
   - Value and unit exactly as reported
   - Reference range (low/high values)
   - Collection date and laboratory name
   - Source (patient-entered or imported from report)

3. Optionally attach the original PDF report
4. Save the result

### Reference Ranges

Each test displays the laboratory's reference interval. Values outside this range are labeled as "Requires interpretation" but are not a diagnosis.

## Medication Management

### Adding Medications

1. Navigate to the **Medications** tab
2. Track prescribed medications:
   - Medication name (e.g., Adalimumab, Naproxen)
   - Dose and route (e.g., 40 mg Subcutaneous)
   - Frequency (e.g., Every 2 weeks, Twice daily)
   - Start date
   - Status: active, paused, completed, or discontinued

### Dose Tracking

- Record each dose as: taken, skipped, uncertain, or pending
- Timestamps are recorded for each dose
- Reminders can be enabled for medication appointments
- Never mark a dose as taken just because a reminder was delivered

### Adherence

- The app shows medication adherence percentage based on recorded events
- Gaps in recording are shown honestly, never estimated

## Appointments

### Creating Appointments

1. Navigate to the **Appointments** tab
2. Add appointment details:
   - Date, time, and timezone
   - Clinician name and location
   - Appointment type (initial, follow-up, review, infusion, other)
   - Status: scheduled, completed, cancelled, or rescheduled
   - Notes and preparation checklist
   - Follow-up tasks and requested tests

### Calendar Export

- Appointments can be exported as ICS files for external calendars
- This creates a calendar-compatible file with all appointment details

## Medical Records

### Documents and Reports

- Import diagnoses, clinical notes, imaging reports, prescriptions, and referrals
- Upload PDF documents or photographs of paper reports
- Each record includes source provenance (patient-entered, imported, clinician-documented)
- Original wording and labels are preserved

### Photograph Journal

- Store private, dated photographs
- Capture front, side, and rear views optionally
- Add notes describing pain, posture, movement, or other changes
- Download and delete controls are available
- Privacy warnings are shown before upload

## Reports and Exports

### JSON Backup

1. Navigate to **Reports** → **JSON backup**
2. Download a complete export of your records
3. The backup includes:
   - Profile information
   - Symptom entries and assessments
   - Medication plans and dose events
   - Laboratory results and reports
   - Appointments and documents
   - Tracking preferences (including head deviation data)
   - Reminders
   - Photos are intentionally excluded due to size and sensitivity

### PDF Summary

1. Navigate to **Reports** → **PDF summary**
2. Generate a printable consultation summary
3. Includes:
   - Symptom summaries with sample counts
   - Medication adherence
   - Laboratory results with reference ranges
   - Side effects reported
   - Recent appointments and tasks
   - Missing-data warnings

### CSV Exports

- Symptoms CSV: Every check-in with scales and notes
- Laboratory CSV: Results, units and reference ranges
- Dose events CSV: Taken, skipped, uncertain and pending doses

## Settings

### Profile

- Display name and email (managed by account provider)
- Date of birth (stays on this device)
- Sex (optional)
- Height in cm (optional)
- Timezone (select from IANA timezone list)
- Units: Metric (cm, kg, °C) or Imperial (in, lb, °F)

### Diagnosis and Timeline

- Documented diagnosis (as provided by clinician)
- Diagnosis date
- Baseline assessment date (used for baseline comparisons)
- Treatment start date (only if clinician-documented)

### Tracking Preferences

#### Symptom Metrics

Choose which scales reflect your case. All recorded values remain in exports. Default metrics:
- Pain (0–10 scale)
- Morning stiffness (minutes)
- Fatigue (0–10 scale)
- Sleep quality (0–10 scale)
- Functional difficulty (0–10 scale)
- Mood (0–10 scale)
- **Head deviation from wall (cm)** ← New

#### Questionnaires

Choose which questionnaires are available:
- BASDAI (Disease activity, 6 items)
- BASFI (Daily function, 10 items)
- ASDAS (Activity plus CRP)

#### Report Sections

Choose which sections appear in consultation reports:
- Symptom summary
- Medication adherence
- New laboratory results
- Reported side effects

#### Laboratory Tests

Track which laboratory tests appear as shortcuts when adding results. Default tests include CRP, ESR, hemoglobin, ALT, creatinine, ferritin.

#### Medications

Add only prescribed medications. Shortcuts never create prescriptions or doses.

#### Biodata

- Date of birth (stays on this device)
- Sex (optional: female, male, intersex, prefer-not-to-say)
- Height in cm (optional)
- **Head deviation from wall in cm** ← New (stays on this device)

### Reminders & Notifications

- **Medication reminders**: Scheduled dose times
- **Appointment reminders**: Lead-time notification before scheduled visits
- **Check-in nudges**: Gentle daily prompt to complete your journal

Quiet hours can be set to suppress notifications during sleeping hours. Browser notification permission can be requested for in-app notifications.

### Data Control

- **Export data**: JSON backup, CSV exports, PDF summary
- **Restore demo data**: Replace local data with synthetic demo record
- **Clear local data**: Remove all local entries and sign out
- All data is stored locally first; Supabase sync is optional

## Synchronization

### Offline-First

- Every change is saved to local IndexedDB immediately; the UI is never blocked on the network
- A durable outbox queues mutations when Supabase is configured
- Failed uploads stay queued with an attempt count; nothing is silently dropped
- Sensitive photographs are deliberately never queued or uploaded

### Cross-Device Sync (with Supabase)

1. Add Supabase credentials in Settings → Sync & storage
2. Sign in with your Supabase account
3. Your data syncs across devices when online
4. Offline changes are queued and synced when back online

### Last Synced

- The dashboard shows when data was last synced
- Manual sync can be triggered from Settings → Sync & storage
- Sync status is visible in the bottom navigation bar

## Security and Privacy

### Data Storage

- All data is stored locally first on this device
- With Supabase sync, data is stored in your secure Supabase account
- Row Level Security ensures you can only access your own data
- Private Storage buckets protect photographs and documents

### What Data is Not Sent

- Service-role keys and database passwords never leave the server
- Vercel tokens are not stored in the client
- Real patient information should not be entered during development
- Photos are excluded from JSON backups due to size and sensitivity

### Your Control

- Clear local data anytime from Settings
- Export your data before clearing
- Revoke Supabase connection if needed
- Manage browser notification permissions

## Known Limitations

- Not a medical device; not clinically validated, HIPAA-certified, or a substitute for care
- Demo mode stores data only in this browser
- Browser/PWA reminders are best-effort and may be delayed when the app is closed
- PDF/CSV exports reflect only recorded data; gaps are shown, never estimated
- The clinic edition requires separate security and privacy review
- Head deviation data is stored per device and not synced unless Supabase is configured

## Getting Help

- **In-app**: Use the help/icon buttons on each page
- **Documentation**: See the full user manual and runbook
- **Export**: Always download JSON backups before making major changes
- **Clinician**: Share exported reports with your treating physician

---

*Version 1.0.0 · myRheumApp*

If you experience any issues or have questions, refer to the troubleshooting section of the user manual or contact support.