import { useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Activity,
  BellRing,
  ClipboardList,
  CloudUpload,
  Download,
  FileText,
  FlaskConical,
  HardDrive,
  LockKeyhole,
  Moon,
  Pill,
  RotateCcw,
  ShieldCheck,
  Smartphone,
  Sun,
  Trash2,
  Users,
} from 'lucide-react'
import { useAuth } from '@/data/auth'
import { useData } from '@/data/DataProvider'
import { clearLocalState } from '@/data/localDb'
import {
  LAB_TESTS,
  MEDICATIONS,
  METRIC_OPTIONS,
  QUESTIONNAIRE_OPTIONS,
  REPORT_SECTIONS,
  type BiologicalSex,
  useTrackingPreferences,
} from '@/data/preferences'
import { supabaseConfigured } from '@/data/remote'
import { usePwaInstall } from '@/hooks/usePwa'
import { useTheme } from '@/hooks/useTheme'
import { useToast } from '@/hooks/useToast'
import type { ReminderPreference, UnitsSystem } from '@/data/types'
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Field,
  InlineAlert,
  Input,
  Modal,
  SectionHeader,
  SegmentedControl,
  Select,
  Switch,
} from '@/components/ui'
import { cn, formatDate, formatRelative, todayInputValue } from '@/lib/utils'

const TIMEZONES = [
  'Africa/Addis_Ababa',
  'Africa/Nairobi',
  'UTC',
  'Europe/London',
  'Europe/Berlin',
  'Asia/Dubai',
  'America/New_York',
  'America/Los_Angeles',
]

const REMINDER_KINDS: Array<{ kind: ReminderPreference['kind']; label: string; description: string }> = [
  { kind: 'medication', label: 'Medication reminders', description: 'Scheduled dose times. A reminder never marks a dose as taken.' },
  { kind: 'appointment', label: 'Appointment reminders', description: 'Lead-time notification before a scheduled visit.' },
  { kind: 'check-in', label: 'Check-in nudges', description: 'A gentle daily prompt to complete your journal.' },
]

const PreferenceChip = ({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className={cn(
      'rounded-full border px-3 py-1.5 text-[11px] font-medium transition',
      active
        ? 'border-teal-500 bg-teal-50 text-teal-800 dark:bg-teal-500/15 dark:text-teal-200'
        : 'border-navy-900/10 text-muted hover:bg-navy-900/5 dark:border-white/10 dark:hover:bg-white/10',
    )}
  >
    {children}
  </button>
)

export const Settings = () => {
  const { state, store } = useData()
  const { signOut, user } = useAuth()
  const { theme, setTheme } = useTheme()
  const { toast } = useToast()
  const { canInstall, isStandalone, promptInstall } = usePwaInstall()
  const navigate = useNavigate()
  const { data } = state
  const tracking = useTrackingPreferences(data.profile.id)
  const { preferences } = tracking
  const [customMedication, setCustomMedication] = useState('')

  const [name, setName] = useState(data.profile.name)
  const [timezone, setTimezone] = useState(data.profile.timezone)
  const [units, setUnits] = useState<UnitsSystem>(data.profile.units)
  const [diagnosis, setDiagnosis] = useState(data.profile.diagnosis ?? '')
  const [diagnosisDate, setDiagnosisDate] = useState(data.profile.diagnosisDate?.slice(0, 10) ?? '')
  const [baselineDate, setBaselineDate] = useState(data.profile.baselineDate?.slice(0, 10) ?? '')
  const [treatmentStartedOn, setTreatmentStartedOn] = useState(data.profile.treatmentStartedOn?.slice(0, 10) ?? '')
  const [clinic, setClinic] = useState(data.profile.clinic ?? '')
  const [permission, setPermission] = useState<string>(() =>
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported',
  )
  const [confirm, setConfirm] = useState<'reset' | 'clear' | null>(null)

  const reminderFor = useMemo(
    () => (kind: ReminderPreference['kind']): ReminderPreference =>
      data.reminders.find((reminder) => reminder.kind === kind) ?? {
        id: `reminder_${kind}`,
        patientId: data.profile.id,
        kind,
        enabled: false,
        quietHoursStart: '22:00',
        quietHoursEnd: '07:00',
        discreetLockScreen: true,
      },
    [data.reminders, data.profile.id],
  )

  const allMedications = useMemo(
    () => [...MEDICATIONS, ...preferences.medications.filter((item) => !MEDICATIONS.includes(item))],
    [preferences.medications],
  )

  const saveProfile = (event: React.FormEvent) => {
    event.preventDefault()
    store.updateProfile({
      name: name.trim() || 'Patient',
      timezone,
      units,
      diagnosis: diagnosis.trim() || undefined,
      diagnosisDate: diagnosisDate ? new Date(`${diagnosisDate}T12:00:00`).toISOString() : undefined,
      baselineDate: baselineDate ? new Date(`${baselineDate}T12:00:00`).toISOString() : undefined,
      treatmentStartedOn: treatmentStartedOn
        ? new Date(`${treatmentStartedOn}T12:00:00`).toISOString()
        : undefined,
      clinic: clinic.trim() || undefined,
    })
    toast({ title: 'Preferences saved', description: 'Timezone and formatting preferences updated.', variant: 'success' })
  }

  const updateReminder = (kind: ReminderPreference['kind'], patch: Partial<ReminderPreference>) => {
    store.saveReminder({ ...reminderFor(kind), ...patch })
    toast({ title: 'Reminder preference saved', variant: 'success' })
  }

  const requestPermission = async () => {
    if (!('Notification' in window)) {
      toast({ title: 'Notifications are not supported in this browser', variant: 'warning' })
      return
    }
    const result = await Notification.requestPermission()
    setPermission(result)
    toast({
      title: result === 'granted' ? 'Notifications allowed' : 'Notifications not allowed',
      description:
        result === 'granted'
          ? 'Delivery is still best-effort and may be delayed while the app is closed.'
          : 'You can change this in browser settings. In-app reminders continue to work.',
      variant: result === 'granted' ? 'success' : 'warning',
    })
  }

  const install = async () => {
    const outcome = await promptInstall()
    if (outcome === 'unavailable') {
      toast({
        title: 'Install prompt unavailable',
        description: 'Use your browser menu: “Install app” or “Add to Home screen”.',
        variant: 'info',
      })
    }
  }

  const doReset = () => {
    store.resetToDemo()
    setConfirm(null)
    toast({ title: 'Demo data restored', variant: 'success' })
  }

  const doClear = async () => {
    await clearLocalState()
    await signOut()
    setConfirm(null)
    navigate('/login', { replace: true })
  }

  const addCustomMedication = () => {
    const medicine = customMedication.trim()
    if (!medicine) return
    tracking.update({
      medications: [...preferences.medications.filter((item) => item !== medicine), medicine],
    })
    setCustomMedication('')
    toast({ title: 'Medicine added to your tracked list', variant: 'success' })
  }

  const resetTracking = () => {
    tracking.reset()
    toast({
      title: 'Tracking preferences reset',
      description: 'The default laboratory tests, scales and report sections are back.',
      variant: 'success',
    })
  }

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Settings"
        description="Account, preferences, privacy and data control. Nothing here changes a prescription."
        action={
          <Badge tone={supabaseConfigured ? 'teal' : 'lavender'}>
            {supabaseConfigured ? 'Supabase connected' : 'Local-only build'}
          </Badge>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Profile */}
        <Card className="p-4 sm:p-5">
          <CardHeader title="Profile & clinical context" subtitle="Only information you choose to record" />
          <form onSubmit={saveProfile} className="mt-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Display name" htmlFor="profileName">
                <Input id="profileName" value={name} onChange={(event) => setName(event.target.value)} />
              </Field>
              <Field label="Email" htmlFor="profileEmail" hint="Managed by your account provider.">
                <Input id="profileEmail" value={user?.email ?? data.profile.email} readOnly disabled />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Date of birth" htmlFor="dateOfBirth" optional hint="Stays on this device.">
                <Input
                  id="dateOfBirth"
                  type="date"
                  max={todayInputValue()}
                  value={preferences.biodata.dateOfBirth ?? ''}
                  onChange={(event) => tracking.setBiodata({ dateOfBirth: event.target.value || undefined })}
                />
              </Field>
              <Field label="Sex" htmlFor="sex" optional>
                <Select
                  id="sex"
                  value={preferences.biodata.sex ?? ''}
                  onChange={(event) =>
                    tracking.setBiodata({
                      sex: (event.target.value || undefined) as BiologicalSex | undefined,
                    })
                  }
                >
                  <option value="">Not recorded</option>
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                  <option value="intersex">Intersex</option>
                  <option value="prefer-not-to-say">Prefer not to say</option>
                </Select>
              </Field>
              <Field label="Height (cm)" htmlFor="heightCm" optional>
                <Input
                  id="heightCm"
                  type="number"
                  inputMode="decimal"
                  min={30}
                  max={260}
                  step="0.1"
                  value={preferences.biodata.heightCm ?? ''}
                  onChange={(event) =>
                    tracking.setBiodata({
                      heightCm: event.target.value === '' ? undefined : Number(event.target.value),
                    })
                  }
                />
              </Field>
              <Field label="Head deviation from wall (cm)" htmlFor="headDeviationCm" optional hint="How far your head deviated from a wall when standing attached to the wall, as measured by your clinician">
                <Input
                  id="headDeviationCm"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={30}
                  step="0.1"
                  value={preferences.biodata.headDeviationCm ?? ''}
                  onChange={(event) =>
                    tracking.setBiodata({
                      headDeviationCm: event.target.value === '' ? undefined : Number(event.target.value),
                    })
                  }
                />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Timezone" htmlFor="timezone">
                <Select id="timezone" value={timezone} onChange={(event) => setTimezone(event.target.value)}>
                  {TIMEZONES.map((zone) => (
                    <option key={zone} value={zone}>{zone}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Units" htmlFor="units">
                <Select id="units" value={units} onChange={(event) => setUnits(event.target.value as UnitsSystem)}>
                  <option value="metric">Metric (cm, kg, °C)</option>
                  <option value="imperial">Imperial (in, lb, °F)</option>
                </Select>
              </Field>
            </div>

            <Field label="Diagnosis (as documented)" htmlFor="diagnosis" optional hint="Do not type a diagnosis you have not been given.">
              <Input
                id="diagnosis"
                value={diagnosis}
                onChange={(event) => setDiagnosis(event.target.value)}
                placeholder="Leave blank unless documented"
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Diagnosis date" htmlFor="diagnosisDate" optional>
                <Input
                  id="diagnosisDate"
                  type="date"
                  max={todayInputValue()}
                  value={diagnosisDate}
                  onChange={(event) => setDiagnosisDate(event.target.value)}
                />
              </Field>
              <Field label="Clinic" htmlFor="clinic" optional>
                <Input id="clinic" value={clinic} onChange={(event) => setClinic(event.target.value)} />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Baseline assessment date" htmlFor="baselineDate" optional hint="Used for baseline comparisons.">
                <Input
                  id="baselineDate"
                  type="date"
                  max={todayInputValue()}
                  value={baselineDate}
                  onChange={(event) => setBaselineDate(event.target.value)}
                />
              </Field>
              <Field label="Treatment start date" htmlFor="treatmentStart" optional hint="Only if clinician-documented.">
                <Input
                  id="treatmentStart"
                  type="date"
                  max={todayInputValue()}
                  value={treatmentStartedOn}
                  onChange={(event) => setTreatmentStartedOn(event.target.value)}
                />
              </Field>
            </div>

            <Button type="submit">Save preferences</Button>
          </form>
        </Card>

        {/* Appearance + reminders */}
        <div className="space-y-4">
          <Card className="p-4 sm:p-5">
            <CardHeader title="Appearance" subtitle="Theme preference is saved on this device." />
            <div className="mt-3 flex items-center justify-between gap-3">
              <SegmentedControl
                label="Theme"
                value={theme}
                onChange={(value) => setTheme(value as 'light' | 'dark')}
                options={[
                  { value: 'light', label: 'Light' },
                  { value: 'dark', label: 'Dark' },
                ]}
              />
              <span className="text-muted" aria-hidden>
                {theme === 'dark' ? <Moon className="size-5" /> : <Sun className="size-5" />}
              </span>
            </div>
            <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-muted">
              <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              Animations respect your operating system&apos;s reduced-motion setting automatically.
            </p>
          </Card>

          <Card className="p-4 sm:p-5">
            <CardHeader
              title="Reminders & notifications"
              subtitle="Disabled by default. Delivery is best-effort."
              action={<BellRing className="size-4 text-muted" aria-hidden />}
            />
            <div className="mt-3 space-y-4">
              {REMINDER_KINDS.map((item) => {
                const reminder = reminderFor(item.kind)
                return (
                  <div key={item.kind} className="space-y-2">
                    <Switch
                      label={item.label}
                      description={item.description}
                      checked={reminder.enabled}
                      onChange={(checked) => updateReminder(item.kind, { enabled: checked })}
                    />
                    {reminder.enabled ? (
                      <div className="grid grid-cols-2 gap-2 pl-0.5">
                        <Field label="Quiet from" htmlFor={`${item.kind}-quiet-start`}>
                          <Input
                            id={`${item.kind}-quiet-start`}
                            type="time"
                            value={reminder.quietHoursStart}
                            onChange={(event) => updateReminder(item.kind, { quietHoursStart: event.target.value })}
                          />
                        </Field>
                        <Field label="Quiet until" htmlFor={`${item.kind}-quiet-end`}>
                          <Input
                            id={`${item.kind}-quiet-end`}
                            type="time"
                            value={reminder.quietHoursEnd}
                            onChange={(event) => updateReminder(item.kind, { quietHoursEnd: event.target.value })}
                          />
                        </Field>
                      </div>
                    ) : null}
                  </div>
                )
              })}

              <Switch
                label="Discreet lock-screen text"
                description="Never name a medicine or diagnosis on the lock screen. Recommended."
                checked={reminderFor('medication').discreetLockScreen}
                onChange={(checked) => updateReminder('medication', { discreetLockScreen: checked })}
              />

              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-navy-900/5 p-3 dark:bg-white/5">
                <div>
                  <p className="text-xs font-semibold text-ink">Browser notification permission</p>
                  <p className="text-[11px] text-muted">Status: {permission}</p>
                </div>
                <Button variant="secondary" size="sm" onClick={() => void requestPermission()}>
                  Request permission
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Care plan & tracking preferences */}
      <Card className="p-4 sm:p-5">
        <CardHeader
          title="Tracking preferences"
          subtitle="Choose what matters for your case. These tune shortcuts and report sections; they never change clinical validity."
          action={<ClipboardList className="size-4 text-muted" aria-hidden />}
        />

        <div className="mt-4 grid gap-5 lg:grid-cols-2">
          <section>
            <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted">
              <FlaskConical className="size-3.5" aria-hidden /> Laboratory tests
            </h3>
            <p className="mt-1 text-[11px] leading-relaxed text-muted">
              Tracked tests appear as one-tap shortcuts when adding a result.
            </p>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {LAB_TESTS.map((test) => (
                <PreferenceChip
                  key={test.name}
                  active={preferences.labTests.includes(test.name)}
                  onClick={() => tracking.toggleLabTest(test.name)}
                >
                  {test.name}
                </PreferenceChip>
              ))}
            </div>
          </section>

          <section>
            <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted">
              <Pill className="size-3.5" aria-hidden /> Medicines
            </h3>
            <p className="mt-1 text-[11px] leading-relaxed text-muted">
              Add only what has been prescribed. A shortcut never creates a prescription or a dose.
            </p>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {allMedications.map((medicine) => (
                <PreferenceChip
                  key={medicine}
                  active={preferences.medications.includes(medicine)}
                  onClick={() => tracking.toggleMedication(medicine)}
                >
                  {medicine}
                </PreferenceChip>
              ))}
            </div>
            <div className="mt-2.5 flex gap-2">
              <Input
                value={customMedication}
                onChange={(event) => setCustomMedication(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    addCustomMedication()
                  }
                }}
                placeholder="Another prescribed medicine"
                aria-label="Add another prescribed medicine"
                className="max-w-64"
              />
              <Button variant="secondary" size="sm" onClick={addCustomMedication}>
                Add
              </Button>
            </div>
          </section>

          <section>
            <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted">
              <Activity className="size-3.5" aria-hidden /> Symptom metrics
            </h3>
            <p className="mt-1 text-[11px] leading-relaxed text-muted">
              Keep the scales that reflect your case. All recorded values remain in exports.
            </p>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {METRIC_OPTIONS.map((metric) => (
                <PreferenceChip
                  key={metric.key}
                  active={preferences.metrics.includes(metric.key)}
                  onClick={() => tracking.toggleMetric(metric.key)}
                >
                  {metric.label}
                </PreferenceChip>
              ))}
            </div>
          </section>

          <section>
            <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted">
              <FileText className="size-3.5" aria-hidden /> Questionnaires & reports
            </h3>
            <p className="mt-1 text-[11px] leading-relaxed text-muted">
              Questionnaires stay available here; unchecking one only hides its shortcut.
            </p>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {QUESTIONNAIRE_OPTIONS.map((questionnaire) => (
                <PreferenceChip
                  key={questionnaire.key}
                  active={preferences.questionnaires.includes(questionnaire.key)}
                  onClick={() => tracking.toggleQuestionnaire(questionnaire.key)}
                >
                  {questionnaire.label}
                </PreferenceChip>
              ))}
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-muted">Report sections to include:</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {REPORT_SECTIONS.map((section) => (
                <PreferenceChip
                  key={section.key}
                  active={preferences.reportSections.includes(section.key)}
                  onClick={() => tracking.toggleReportSection(section.key)}
                >
                  {section.label}
                </PreferenceChip>
              ))}
            </div>
          </section>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-navy-900/5 pt-3 dark:border-white/5">
          <p className="flex items-center gap-1.5 text-[11px] text-muted">
            <ShieldCheck className="size-3.5 shrink-0" aria-hidden />
            Saved on this device for this account. Biodata and preferences are included in JSON exports.
          </p>
          <Button variant="secondary" size="sm" onClick={resetTracking}>
            <RotateCcw className="size-3.5" aria-hidden /> Reset to defaults
          </Button>
        </div>
      </Card>

      {/* Install + sync */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4 sm:p-5">
          <CardHeader
            title="Install the app"
            subtitle="Add myRheumApp to your home screen for a standalone experience."
            action={<Smartphone className="size-4 text-muted" aria-hidden />}
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button onClick={() => void install()} disabled={isStandalone}>
              <Download className="size-4" aria-hidden /> {isStandalone ? 'Already installed' : 'Install app'}
            </Button>
            <Badge tone={canInstall ? 'teal' : 'neutral'}>
              {canInstall ? 'Install prompt ready' : isStandalone ? 'Standalone mode' : 'Use browser menu to install'}
            </Badge>
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-muted">
            Installation requires HTTPS (or localhost) and a supporting browser. Offline access covers the app
            shell, cached summaries and drafts — not remote laboratory files or authentication.
          </p>
        </Card>

        <Card className="p-4 sm:p-5">
          <CardHeader
            title="Sync & storage"
            subtitle="Local-first: every change saves on this device immediately."
            action={<CloudUpload className="size-4 text-muted" aria-hidden />}
          />
          <dl className="mt-3 space-y-2 text-xs">
            {[
              ['Mode', state.online ? 'Online' : 'Offline'],
              ['Remote account', supabaseConfigured ? (user?.mode === 'remote' ? 'Connected' : 'Configured, demo session') : 'Not configured'],
              ['Queued changes', String(state.outbox.length)],
              ['Last synced', data.lastSyncedAt ? formatRelative(data.lastSyncedAt) : 'Not yet'],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-3 border-b border-navy-900/5 pb-1.5 dark:border-white/5">
                <dt className="text-muted">{label}</dt>
                <dd className="font-semibold text-ink">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link to="/reports">
              <Button variant="secondary" size="sm">
                <Download className="size-3.5" aria-hidden /> Export data
              </Button>
            </Link>
            <Button variant="ghost" size="sm" onClick={() => void store.flush()}>
              <HardDrive className="size-3.5" aria-hidden /> Flush to device
            </Button>
          </div>
        </Card>
      </div>

      {/* Clinic access */}
      <Card className="p-4 sm:p-5">
        <CardHeader
          title="Clinic access"
          subtitle="Single-patient build. A future clinic edition requires explicit, revocable consent."
          action={<Users className="size-4 text-muted" aria-hidden />}
        />
        <div className="mt-3 rounded-xl bg-navy-900/5 p-3 text-[11px] leading-relaxed text-muted dark:bg-white/5">
          <p className="flex items-center gap-1.5 font-semibold text-ink">
            <LockKeyhole className="size-3.5" aria-hidden /> Current access: you are the record owner.
          </p>
          <p className="mt-1">
            {data.memberships.length === 0 && data.consents.length === 0
              ? 'No organisation memberships or clinician consents are recorded. No clinician can read this record.'
              : `${data.memberships.length} membership(s) and ${data.consents.length} consent(s) recorded.`}
          </p>
          <p className="mt-1">
            Clinic access is enforced by Row Level Security in PostgreSQL, not by hiding buttons. A clinician
            receives read access only through an active patient consent, and read-write only if their role allows
            it. Consent revocation is checked on every request.
          </p>
        </div>
      </Card>

      {/* Data control */}
      <Card className="p-4 sm:p-5">
        <CardHeader
          title="Data control"
          subtitle="You own this record. Export before clearing anything."
          action={<ShieldCheck className="size-4 text-muted" aria-hidden />}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => setConfirm('reset')}>
            <RotateCcw className="size-3.5" aria-hidden /> Restore demo data
          </Button>
          <Button variant="danger" size="sm" onClick={() => setConfirm('clear')}>
            <Trash2 className="size-3.5" aria-hidden /> Clear local data & sign out
          </Button>
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-muted">
          Clearing removes local records and queued changes from this browser. Data already uploaded to a
          configured Supabase account must be deleted through your account workflow.
        </p>
      </Card>

      <InlineAlert tone="info" title="Limitations you should know">
        This is a personal tracking tool, not a certified medical device. It is not clinically validated, not
        HIPAA certified, and cannot guarantee reminder delivery. Free-tier infrastructure has no guaranteed
        backup retention. Keep your own exports and verify original reports with your clinician.
      </InlineAlert>

      <p className="text-center text-[10px] text-muted">
        Record created {formatDate(data.profile.createdAt)} · myRheumApp 1.0.0
      </p>

      <Modal
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={confirm === 'clear' ? 'Clear local data?' : 'Restore demo data?'}
        description={
          confirm === 'clear'
            ? 'Every local entry, queued change and photograph in this browser will be removed, then you will be signed out.'
            : 'This replaces local data with the synthetic demo record. Export a backup first if you have real entries.'
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(null)}>Cancel</Button>
            {confirm === 'clear' ? (
              <Button variant="danger" onClick={() => void doClear()}>
                Clear and sign out
              </Button>
            ) : (
              <Button onClick={doReset}>Restore demo data</Button>
            )}
          </>
        }
      >
        <p className="text-xs leading-relaxed text-muted">
          This action cannot be undone. Use Reports → JSON backup to keep a copy.
        </p>
      </Modal>
    </div>
  )
}

export default Settings
