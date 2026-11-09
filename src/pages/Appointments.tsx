import { useMemo, useState } from 'react'
import { CalendarDays, CalendarPlus, Clock3, Download, MapPin, Pencil, Stethoscope } from 'lucide-react'
import { useData } from '@/data/DataProvider'
import { useToast } from '@/hooks/useToast'
import type { Appointment, AppointmentKind, AppointmentStatus } from '@/data/types'
import { buildIcs } from '@/lib/reports/ics'
import { downloadFile } from '@/lib/reports/csv'
import { daysUntil } from '@/lib/analytics'
import { utcToWallClock, wallClockToUtc, zoneOffsetLabel } from '@/lib/timezone'
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  InlineAlert,
  Input,
  Modal,
  SectionHeader,
  Select,
  Textarea,
} from '@/components/ui'
import { cn, formatDate, formatDateTime, formatRelative, todayInputValue, uid } from '@/lib/utils'

interface AppointmentForm {
  date: string
  time: string
  kind: AppointmentKind
  clinician: string
  location: string
  notes: string
  questions: string
  reminderDaysBefore: string
  status: AppointmentStatus
}

const emptyForm = (timezone: string): AppointmentForm => {
  const wall = utcToWallClock(new Date(Date.now() + 7 * 86_400_000).toISOString(), timezone)
  return {
    date: wall.date,
    time: '10:00',
    kind: 'follow-up',
    clinician: '',
    location: '',
    notes: '',
    questions: '',
    reminderDaysBefore: '1',
    status: 'scheduled',
  }
}

const fromAppointment = (appointment: Appointment, timezone: string): AppointmentForm => {
  const wall = utcToWallClock(appointment.startsAt, timezone)
  return {
    date: wall.date,
    time: wall.time,
    kind: appointment.kind,
    clinician: appointment.clinician ?? '',
    location: appointment.location ?? '',
    notes: appointment.notes ?? '',
    questions: appointment.questions.join('\n'),
    reminderDaysBefore: String(appointment.reminderDaysBefore),
    status: appointment.status,
  }
}

const statusTone = (status: AppointmentStatus) =>
  status === 'scheduled' ? 'teal' : status === 'completed' ? 'lavender' : status === 'cancelled' ? 'danger' : 'amber'

export const Appointments = () => {
  const { state, store } = useData()
  const { toast } = useToast()
  const { data } = state
  const timezone = data.profile.timezone

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Appointment | null>(null)
  const [form, setForm] = useState<AppointmentForm>(() => emptyForm(timezone))
  const [error, setError] = useState<string | null>(null)

  const sorted = useMemo(
    () => [...data.appointments].sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    [data.appointments],
  )
  const upcoming = useMemo(
    () => sorted.filter((appointment) => new Date(appointment.startsAt).getTime() >= Date.now() - 3_600_000 && appointment.status === 'scheduled'),
    [sorted],
  )
  const past = useMemo(
    () =>
      sorted
        .filter((appointment) => !upcoming.includes(appointment))
        .sort((a, b) => b.startsAt.localeCompare(a.startsAt)),
    [sorted, upcoming],
  )

  const update = <K extends keyof AppointmentForm>(key: K, value: AppointmentForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setError(null)
  }

  const startCreate = () => {
    setEditing(null)
    setForm(emptyForm(timezone))
    setOpen(true)
  }

  const startEdit = (appointment: Appointment) => {
    setEditing(appointment)
    setForm(fromAppointment(appointment, timezone))
    setOpen(true)
  }

  const save = (event: React.FormEvent) => {
    event.preventDefault()
    if (!form.date) return setError('Choose an appointment date.')
    if (!/^\d{2}:\d{2}$/.test(form.time)) return setError('Enter a valid 24-hour time, e.g. 10:30.')

    let startsAt: string
    try {
      startsAt = wallClockToUtc(form.date, form.time, timezone)
    } catch {
      return setError('The appointment date or time is invalid.')
    }

    const appointment: Appointment = {
      id: editing?.id ?? uid('appt'),
      patientId: data.profile.id,
      startsAt,
      timezone,
      clinician: form.clinician.trim() || undefined,
      location: form.location.trim() || undefined,
      kind: form.kind,
      status: form.status,
      notes: form.notes.trim() || undefined,
      questions: form.questions
        .split('\n')
        .map((question) => question.trim())
        .filter(Boolean),
      tasks: editing?.tasks ?? [],
      reminderDaysBefore: Math.max(0, Number(form.reminderDaysBefore) || 0),
      createdAt: editing?.createdAt ?? new Date().toISOString(),
    }

    store.saveAppointment(appointment)
    toast({
      title: editing ? 'Appointment updated' : 'Appointment saved',
      description: `Stored in ${timezone} (${zoneOffsetLabel(startsAt, timezone)}).`,
      variant: 'success',
    })
    setOpen(false)
    setEditing(null)
  }

  const exportIcs = () => {
    if (sorted.length === 0) return
    downloadFile(`myrheum-appointments-${todayInputValue()}.ics`, buildIcs(sorted), 'text/calendar;charset=utf-8')
    toast({
      title: 'Calendar file downloaded',
      description: 'Import it into your calendar app. External calendar reminders are managed by that app.',
      variant: 'success',
    })
  }

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Appointments"
        description="Plan visits, prepare questions and keep follow-up tasks visible. Times are stored against your configured timezone."
        action={
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={exportIcs} disabled={sorted.length === 0}>
              <Download className="size-3.5" aria-hidden /> ICS
            </Button>
            <Button size="sm" onClick={startCreate}>
              <CalendarPlus className="size-3.5" aria-hidden /> New visit
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted">
        <Badge tone="lavender">{timezone}</Badge>
        <span>{zoneOffsetLabel(new Date().toISOString(), timezone)}</span>
        <span>· Change this in Settings.</span>
      </div>

      {upcoming[0] ? (
        <Card className="relative overflow-hidden bg-navy-900 p-5 text-white">
          <div className="surface-grid absolute inset-0 opacity-60" aria-hidden />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-300">Next visit</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight">
                {formatDate(upcoming[0].startsAt, timezone)} · {formatRelative(upcoming[0].startsAt)}
              </p>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/70">
                <span className="inline-flex items-center gap-1"><Clock3 className="size-3.5" aria-hidden /> {formatDateTime(upcoming[0].startsAt, timezone)}</span>
                {upcoming[0].clinician ? <span className="inline-flex items-center gap-1"><Stethoscope className="size-3.5" aria-hidden /> {upcoming[0].clinician}</span> : null}
                {upcoming[0].location ? <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" aria-hidden /> {upcoming[0].location}</span> : null}
              </p>
            </div>
            <div className="rounded-2xl bg-white/10 px-4 py-3 text-center">
              <p className="text-3xl font-bold tabular-nums">{Math.max(0, daysUntil(upcoming[0].startsAt))}</p>
              <p className="text-[10px] uppercase tracking-widest text-white/60">days away</p>
            </div>
          </div>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4 sm:p-5">
          <CardHeader
            title="Upcoming"
            subtitle={`${upcoming.length} scheduled`}
            action={<CalendarDays className="size-4 text-muted" aria-hidden />}
          />
          <div className="mt-3 space-y-2">
            {upcoming.length === 0 ? (
              <EmptyState
                icon={<CalendarDays className="size-5" aria-hidden />}
                title="No upcoming visits"
                description="Add your next rheumatology appointment to prepare questions and tasks."
                action={<Button size="sm" onClick={startCreate}>Schedule a visit</Button>}
              />
            ) : (
              upcoming.map((appointment) => (
                <AppointmentCard
                  key={appointment.id}
                  appointment={appointment}
                  timezone={timezone}
                  onEdit={() => startEdit(appointment)}
                  onToggleTask={(taskId) => store.toggleAppointmentTask(appointment.id, taskId)}
                  onCancel={() => {
                    store.saveAppointment({ ...appointment, status: 'cancelled' })
                    toast({ title: 'Appointment marked cancelled', variant: 'info' })
                  }}
                />
              ))
            )}
          </div>
        </Card>

        <Card className="p-4 sm:p-5">
          <CardHeader title="Visit history" subtitle={`${past.length} earlier visits`} />
          <div className="mt-3 space-y-2">
            {past.length === 0 ? (
              <p className="rounded-xl bg-navy-900/5 p-3 text-xs text-muted dark:bg-white/5">
                Completed and cancelled visits will appear here.
              </p>
            ) : (
              past.map((appointment) => (
                <AppointmentCard
                  key={appointment.id}
                  appointment={appointment}
                  timezone={timezone}
                  onEdit={() => startEdit(appointment)}
                  onToggleTask={(taskId) => store.toggleAppointmentTask(appointment.id, taskId)}
                />
              ))
            )}
          </div>
        </Card>
      </div>

      <InlineAlert tone="info" title="Reminder honesty">
        In-app and browser reminders can be delayed when the device is asleep, the browser is closed, or
        permissions are missing. Calendar alarms depend on your calendar app. Use the ICS export if you need a
        more reliable external reminder.
      </InlineAlert>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'Edit appointment' : 'New appointment'}
        description={`Times are entered in ${timezone} and stored precisely.`}
        wide
      >
        <form onSubmit={save} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Date" htmlFor="apptDate">
              <Input
                id="apptDate"
                type="date"
                value={form.date}
                onChange={(event) => update('date', event.target.value)}
                required
              />
            </Field>
            <Field label="Time (24-hour)" htmlFor="apptTime">
              <Input
                id="apptTime"
                type="time"
                value={form.time}
                onChange={(event) => update('time', event.target.value)}
                required
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Visit type" htmlFor="kind">
              <Select id="kind" value={form.kind} onChange={(event) => update('kind', event.target.value as AppointmentKind)}>
                <option value="follow-up">Follow-up</option>
                <option value="initial">Initial consultation</option>
                <option value="review">Review</option>
                <option value="infusion">Infusion / injection visit</option>
                <option value="other">Other</option>
              </Select>
            </Field>
            <Field label="Status" htmlFor="apptStatus">
              <Select
                id="apptStatus"
                value={form.status}
                onChange={(event) => update('status', event.target.value as AppointmentStatus)}
              >
                <option value="scheduled">Scheduled</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
                <option value="rescheduled">Rescheduled</option>
              </Select>
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Clinician" htmlFor="clinician" optional>
              <Input
                id="clinician"
                value={form.clinician}
                onChange={(event) => update('clinician', event.target.value)}
              />
            </Field>
            <Field label="Location" htmlFor="location" optional>
              <Input
                id="location"
                value={form.location}
                onChange={(event) => update('location', event.target.value)}
              />
            </Field>
          </div>

          <Field label="Questions for the clinician" htmlFor="questions" optional hint="One question per line.">
            <Textarea
              id="questions"
              rows={3}
              value={form.questions}
              onChange={(event) => update('questions', event.target.value)}
              placeholder={'Is the stiffness trend expected?\nDo the liver results need repeating?'}
            />
          </Field>

          <Field label="Notes and preparation" htmlFor="apptNotes" optional>
            <Textarea
              id="apptNotes"
              rows={2}
              value={form.notes}
              onChange={(event) => update('notes', event.target.value)}
            />
          </Field>

          <Field
            label="Reminder lead time (days)"
            htmlFor="reminder"
            hint="Local reminder only; delivery is best-effort."
          >
            <Input
              id="reminder"
              type="number"
              min={0}
              max={30}
              value={form.reminderDaysBefore}
              onChange={(event) => update('reminderDaysBefore', event.target.value)}
            />
          </Field>

          {error ? (
            <p role="alert" className="text-xs font-medium text-danger-600 dark:text-danger-400">
              {error}
            </p>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit">{editing ? 'Save changes' : 'Save appointment'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

const AppointmentCard = ({
  appointment,
  timezone,
  onEdit,
  onToggleTask,
  onCancel,
}: {
  appointment: Appointment
  timezone: string
  onEdit: () => void
  onToggleTask: (taskId: string) => void
  onCancel?: () => void
}) => (
  <div
    className={cn(
      'rounded-xl border p-3',
      appointment.status === 'cancelled'
        ? 'border-danger-500/30 opacity-70'
        : 'border-navy-900/10 dark:border-white/10',
    )}
  >
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="text-sm font-semibold text-ink">{formatDate(appointment.startsAt, timezone)}</p>
          <Badge tone={statusTone(appointment.status)}>{appointment.status}</Badge>
        </div>
        <p className="mt-0.5 text-[11px] text-muted">
          {formatDateTime(appointment.startsAt, timezone)} · {appointment.kind.replace('-', ' ')}
          {appointment.clinician ? ` · ${appointment.clinician}` : ''}
        </p>
        {appointment.location ? <p className="text-[11px] text-muted">{appointment.location}</p> : null}
      </div>
      <div className="flex shrink-0 gap-0.5">
        <button
          type="button"
          onClick={onEdit}
          className="rounded-lg p-1.5 text-muted hover:bg-navy-900/5 hover:text-ink dark:hover:bg-white/10"
          aria-label={`Edit appointment on ${formatDate(appointment.startsAt, timezone)}`}
        >
          <Pencil className="size-3.5" aria-hidden />
        </button>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-2 py-1 text-[11px] font-medium text-muted hover:bg-danger-500/10 hover:text-danger-600"
          >
            Cancel
          </button>
        ) : null}
      </div>
    </div>

    {appointment.questions.length > 0 ? (
      <ul className="mt-2 space-y-0.5 rounded-lg bg-lavender-50 p-2 text-[11px] text-navy-800 dark:bg-lavender-400/10 dark:text-lavender-100">
        {appointment.questions.map((question) => (
          <li key={question} className="flex gap-1.5">
            <span aria-hidden>•</span> {question}
          </li>
        ))}
      </ul>
    ) : null}

    {appointment.tasks.length > 0 ? (
      <ul className="mt-2 space-y-1">
        {appointment.tasks.map((task) => (
          <li key={task.id}>
            <button
              type="button"
              onClick={() => onToggleTask(task.id)}
              className="flex w-full items-center gap-1.5 rounded px-0.5 py-0.5 text-left text-[11px] hover:bg-navy-900/5 dark:hover:bg-white/10"
            >
              <span
                className={cn(
                  'flex size-3.5 items-center justify-center rounded border text-[8px]',
                  task.done ? 'border-teal-500 bg-teal-500 text-white' : 'border-navy-900/25 dark:border-white/25',
                )}
                aria-hidden
              >
                {task.done ? '✓' : ''}
              </span>
              <span className={task.done ? 'text-muted line-through' : 'text-ink'}>{task.label}</span>
            </button>
          </li>
        ))}
      </ul>
    ) : null}

    {appointment.notes ? <p className="mt-1.5 text-[11px] text-muted">{appointment.notes}</p> : null}
  </div>
)

export default Appointments
