import { useMemo, useState } from 'react'
import { Check, Clock3, Pencil, Pill, Plus, ShieldAlert, SkipForward, TriangleAlert } from 'lucide-react'
import { useData } from '@/data/DataProvider'
import { useTrackingPreferences } from '@/data/preferences'
import { useToast } from '@/hooks/useToast'
import type { DoseEvent, MedicationPlan, MedicationStatus } from '@/data/types'
import { adherenceRate, dosesForDay, latestByPlan } from '@/lib/analytics'
import { summariseAdherence } from '@/lib/reports/summary'
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
  Switch,
  Textarea,
} from '@/components/ui'
import { cn, formatDate, formatTime, todayInputValue, uid } from '@/lib/utils'

interface PlanForm {
  name: string
  ingredient: string
  dose: string
  route: string
  frequency: string
  times: string
  startDate: string
  endDate: string
  prescriber: string
  notes: string
  status: MedicationStatus
  reminderEnabled: boolean
}

const emptyPlan = (): PlanForm => ({
  name: '',
  ingredient: '',
  dose: '',
  route: 'Oral',
  frequency: '',
  times: '08:00',
  startDate: todayInputValue(),
  endDate: '',
  prescriber: '',
  notes: '',
  status: 'active',
  reminderEnabled: true,
})

const fromPlan = (plan: MedicationPlan): PlanForm => ({
  name: plan.name,
  ingredient: plan.ingredient ?? '',
  dose: plan.dose,
  route: plan.route,
  frequency: plan.frequency,
  times: plan.times.join(', '),
  startDate: plan.startDate,
  endDate: plan.endDate ?? '',
  prescriber: plan.prescriber ?? '',
  notes: plan.notes ?? '',
  status: plan.status,
  reminderEnabled: plan.reminderEnabled,
})

const statusTone = (status: MedicationStatus) =>
  status === 'active' ? 'teal' : status === 'paused' ? 'amber' : 'neutral'

export const Medications = () => {
  const { state, store } = useData()
  const { toast } = useToast()
  const { data } = state
  const { preferences } = useTrackingPreferences(data.profile.id)

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<MedicationPlan | null>(null)
  const [form, setForm] = useState<PlanForm>(emptyPlan)
  const [error, setError] = useState<string | null>(null)
  const [sideEffectOpen, setSideEffectOpen] = useState(false)
  const [sideEffect, setSideEffect] = useState({ text: '', note: '' })

  const today = useMemo(() => dosesForDay(data.doseEvents, data.profile.timezone), [data.doseEvents, data.profile.timezone])
  const planById = useMemo(() => new Map(data.medicationPlans.map((plan) => [plan.id, plan])), [data.medicationPlans])
  const lastByPlan = useMemo(
    () => latestByPlan(data.doseEvents, data.profile.timezone),
    [data.doseEvents, data.profile.timezone],
  )

  const recentEvents = useMemo(() => {
    const cutoff = Date.now() - 14 * 86_400_000
    return data.doseEvents.filter((event) => new Date(event.scheduledFor).getTime() >= cutoff)
  }, [data.doseEvents])

  const overall = summariseAdherence(recentEvents)
  const overallRate = adherenceRate(data.doseEvents, 14)

  const update = <K extends keyof PlanForm>(key: K, value: PlanForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setError(null)
  }

  const startCreate = () => {
    setEditing(null)
    setForm(emptyPlan())
    setOpen(true)
  }

  const startEdit = (plan: MedicationPlan) => {
    setEditing(plan)
    setForm(fromPlan(plan))
    setOpen(true)
  }

  const savePlan = (event: React.FormEvent) => {
    event.preventDefault()
    if (!form.name.trim()) return setError('Medication name is required.')
    if (!form.dose.trim()) return setError('Record the prescribed dose exactly as documented.')
    if (!form.frequency.trim()) return setError('Frequency / administration instruction is required.')

    const times = form.times
      .split(',')
      .map((time) => time.trim())
      .filter((time) => /^\d{2}:\d{2}$/.test(time))
    if (times.length === 0) return setError('Add at least one reminder time in 24-hour HH:MM format.')

    const plan: MedicationPlan = {
      id: editing?.id ?? uid('plan'),
      patientId: data.profile.id,
      name: form.name.trim(),
      ingredient: form.ingredient.trim() || undefined,
      dose: form.dose.trim(),
      route: form.route,
      frequency: form.frequency.trim(),
      times,
      startDate: form.startDate,
      endDate: form.endDate || undefined,
      prescriber: form.prescriber.trim() || undefined,
      status: form.status,
      notes: form.notes.trim() || undefined,
      reminderEnabled: form.reminderEnabled,
      createdAt: editing?.createdAt ?? new Date().toISOString(),
    }

    store.saveMedicationPlan(plan)
    toast({
      title: editing ? 'Plan updated' : 'Plan added',
      description: 'Only record prescriptions that a clinician has documented. This app never generates a dose.',
      variant: 'success',
    })
    setOpen(false)
    setEditing(null)
  }

  const recordDose = (dose: DoseEvent, status: DoseEvent['status']) => {
    store.recordDose(dose.id, status)
    toast({
      title: `Dose marked ${status}`,
      description: 'This is your recorded status, not a confirmation from your clinician.',
      variant: 'success',
    })
  }

  const saveSideEffect = (event: React.FormEvent) => {
    event.preventDefault()
    if (!sideEffect.text.trim()) return
    store.saveSymptomEntry({
      id: uid('sym'),
      patientId: data.profile.id,
      recordedAt: new Date().toISOString(),
      pain: null,
      stiffnessMinutes: null,
      fatigue: null,
      sleepQuality: null,
      functionalDifficulty: null,
      mood: null,
      triggers: '',
      notes: sideEffect.note.trim(),
      sideEffects: sideEffect.text.trim(),
      provenance: 'patient',
    })
    toast({
      title: 'Side effect recorded',
      description: 'Tell your clinician about anything severe or unexpected.',
      variant: 'success',
    })
    setSideEffect({ text: '', note: '' })
    setSideEffectOpen(false)
  }

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Medications"
        description="Prescribed plans, scheduled doses and your recorded adherence. A reminder never marks a dose as taken."
        action={
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setSideEffectOpen(true)}>
              <TriangleAlert className="size-3.5" aria-hidden /> Log side effect
            </Button>
            <Button size="sm" onClick={startCreate}>
              <Plus className="size-3.5" aria-hidden /> Add plan
            </Button>
          </div>
        }
      />

      <InlineAlert tone="info" title="Safety first">
        Never start, stop, increase, decrease or substitute a prescription based on this app. Changes must come
        from your treating clinician or a documented prescription.
      </InlineAlert>

      {/* Today */}
      <Card className="p-4 sm:p-5">
        <CardHeader
          title="Today's schedule"
          subtitle="Times shown in your configured timezone"
          action={
            <Badge tone="teal">
              <Clock3 className="size-3" aria-hidden /> {formatDate(new Date().toISOString(), data.profile.timezone)}
            </Badge>
          }
        />
        <div className="mt-3 space-y-2">
          {today.length === 0 ? (
            <EmptyState
              icon={<Pill className="size-5" aria-hidden />}
              title="No doses due today"
              description="When a plan is active, its scheduled doses appear here automatically."
            />
          ) : (
            today.map((dose) => {
              const plan = planById.get(dose.planId)
              return (
                <div
                  key={dose.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-navy-900/10 px-3 py-3 dark:border-white/10"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex size-10 shrink-0 flex-col items-center justify-center rounded-xl bg-navy-900 text-[10px] font-bold text-white dark:bg-teal-400 dark:text-navy-950">
                      <span>{formatTime(dose.scheduledFor, data.profile.timezone)}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">
                        {plan?.name ?? 'Medication'} <span className="font-normal text-muted">· {plan?.dose}</span>
                      </p>
                      <p className="text-[11px] text-muted">
                        {plan?.route} · {plan?.frequency}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {dose.status === 'pending' ? (
                      <>
                        <Button size="sm" onClick={() => recordDose(dose, 'taken')}>
                          <Check className="size-3.5" aria-hidden /> Taken
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => recordDose(dose, 'skipped')}>
                          <SkipForward className="size-3.5" aria-hidden /> Skipped
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => recordDose(dose, 'uncertain')}>
                          Unsure
                        </Button>
                      </>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Badge
                          tone={dose.status === 'taken' ? 'teal' : dose.status === 'skipped' ? 'amber' : 'neutral'}
                        >
                          {dose.status}
                        </Badge>
                        <button
                          type="button"
                          onClick={() => recordDose(dose, 'pending')}
                          className="text-[11px] font-medium text-muted underline-offset-2 hover:underline"
                        >
                          Change
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        {/* Plans */}
        <Card className="p-4 sm:p-5">
          <CardHeader title="Prescribed plans" subtitle={`${data.medicationPlans.length} recorded`} />
          <div className="mt-3 space-y-2">
            {data.medicationPlans.length === 0 ? (
              <EmptyState
                icon={<Pill className="size-5" aria-hidden />}
                title="No plans yet"
                description="Add a plan only from a prescription you have been given."
                action={<Button size="sm" onClick={startCreate}>Add a prescribed plan</Button>}
              />
            ) : (
              data.medicationPlans.map((plan) => {
                const last = lastByPlan.get(plan.id)
                return (
                  <div key={plan.id} className="rounded-xl border border-navy-900/10 p-3 dark:border-white/10">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="text-sm font-semibold text-ink">{plan.name}</p>
                          <Badge tone={statusTone(plan.status)}>{plan.status}</Badge>
                          {!plan.reminderEnabled ? <Badge tone="neutral">Reminders off</Badge> : null}
                        </div>
                        <p className="mt-0.5 text-[11px] text-muted">
                          {plan.dose} · {plan.route} · {plan.frequency} · {plan.times.join(', ')}
                        </p>
                        <p className="text-[11px] text-muted">
                          Since {formatDate(plan.startDate)}
                          {plan.prescriber ? ` · ${plan.prescriber}` : ''}
                          {last ? ` · last dose ${last.status}` : ''}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => startEdit(plan)}
                        className="rounded-lg p-1.5 text-muted hover:bg-navy-900/5 hover:text-ink dark:hover:bg-white/10"
                        aria-label={`Edit ${plan.name}`}
                      >
                        <Pencil className="size-3.5" aria-hidden />
                      </button>
                    </div>
                    {plan.notes ? <p className="mt-1.5 text-[11px] text-muted">{plan.notes}</p> : null}
                    <div className="mt-2 flex gap-1.5">
                      {plan.status === 'active' ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            store.saveMedicationPlan({ ...plan, status: 'paused' })
                            toast({ title: `${plan.name} marked paused`, description: 'Only do this if your clinician paused it.', variant: 'warning' })
                          }}
                        >
                          Mark paused by clinician
                        </Button>
                      ) : null}
                      {plan.status !== 'discontinued' ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            store.archiveMedicationPlan(plan.id)
                            toast({ title: `${plan.name} archived`, variant: 'info' })
                          }}
                        >
                          Discontinue
                        </Button>
                      ) : null}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </Card>

        {/* Adherence */}
        <div className="space-y-4">
          <Card className="p-4 sm:p-5">
            <CardHeader
              title="Adherence — last 14 days"
              subtitle="Based only on recorded dose events"
              action={<Badge tone={overallRate !== null && overallRate >= 80 ? 'teal' : 'amber'}>{overallRate === null ? 'No data' : `${overallRate}%`}</Badge>}
            />
            <div className="mt-4 grid grid-cols-2 gap-3">
              {[
                { label: 'Taken', value: overall.taken, tone: 'text-teal-700 dark:text-teal-300' },
                { label: 'Skipped', value: overall.skipped, tone: 'text-amber-600 dark:text-amber-400' },
                { label: 'Uncertain', value: overall.uncertain, tone: 'text-muted' },
                { label: 'Not recorded', value: overall.notRecorded, tone: 'text-muted' },
              ].map((item) => (
                <div key={item.label} className="rounded-xl bg-navy-900/5 p-3 dark:bg-white/5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">{item.label}</p>
                  <p className={cn('mt-0.5 text-xl font-bold tabular-nums', item.tone)}>{item.value}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-muted">
              A delivered reminder is never counted as a taken dose. “Not recorded” doses are kept visible rather
              than assumed.
            </p>
          </Card>

          <Card className="p-4 sm:p-5">
            <CardHeader title="Reminders" subtitle="Discreet by default" />
            <div className="mt-3 space-y-3">
              {data.medicationPlans.map((plan) => (
                <Switch
                  key={plan.id}
                  label={plan.name}
                  description={`${plan.times.join(', ')} · local reminder`}
                  checked={plan.reminderEnabled}
                  onChange={(checked) => {
                    store.saveMedicationPlan({ ...plan, reminderEnabled: checked })
                    toast({
                      title: checked ? 'Reminder plan enabled' : 'Reminder plan disabled',
                      description: 'The prescription itself is unchanged.',
                      variant: 'info',
                    })
                  }}
                />
              ))}
              {data.medicationPlans.length === 0 ? (
                <p className="text-xs text-muted">Add a plan to configure reminders.</p>
              ) : null}
            </div>
            <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-muted">
              <ShieldAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              Browser reminders can be delayed or suppressed when the device is asleep or the app is closed.
              Lock-screen text stays discreet and never names a medicine.
            </p>
          </Card>
        </div>
      </div>

      {/* Plan modal */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'Edit medication plan' : 'Add prescribed plan'}
        description="Copy the prescription exactly. This app does not calculate or suggest doses."
        wide
      >
        <form onSubmit={savePlan} className="space-y-4">
          {preferences.medications.length > 0 ? (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                Your tracked medicines
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {preferences.medications.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => update('name', name)}
                    className={cn(
                      'rounded-full border px-3 py-1.5 text-[11px] font-medium transition',
                      form.name === name
                        ? 'border-teal-500 bg-teal-50 text-teal-800 dark:bg-teal-500/15 dark:text-teal-200'
                        : 'border-navy-900/10 text-muted hover:bg-navy-900/5 dark:border-white/10 dark:hover:bg-white/10',
                    )}
                  >
                    {name}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-[10px] leading-relaxed text-muted">
                A shortcut only fills the name. Dose, route and schedule still come from the prescription.
              </p>
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Medication name" htmlFor="planName">
              <Input
                id="planName"
                value={form.name}
                onChange={(event) => update('name', event.target.value)}
                placeholder="As printed on the prescription"
                required
              />
            </Field>
            <Field label="Active ingredient" htmlFor="ingredient" optional>
              <Input
                id="ingredient"
                value={form.ingredient}
                onChange={(event) => update('ingredient', event.target.value)}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Dose" htmlFor="dose">
              <Input
                id="dose"
                value={form.dose}
                onChange={(event) => update('dose', event.target.value)}
                placeholder="e.g. 40 mg"
                required
              />
            </Field>
            <Field label="Route" htmlFor="route">
              <Select id="route" value={form.route} onChange={(event) => update('route', event.target.value)}>
                {['Oral', 'Subcutaneous', 'Intramuscular', 'Intravenous', 'Topical', 'Other'].map((route) => (
                  <option key={route} value={route}>{route}</option>
                ))}
              </Select>
            </Field>
            <Field label="Status" htmlFor="status">
              <Select
                id="status"
                value={form.status}
                onChange={(event) => update('status', event.target.value as MedicationStatus)}
              >
                <option value="active">Active</option>
                <option value="paused">Paused by clinician</option>
                <option value="completed">Completed</option>
                <option value="discontinued">Discontinued</option>
              </Select>
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Frequency / instruction" htmlFor="frequency">
              <Input
                id="frequency"
                value={form.frequency}
                onChange={(event) => update('frequency', event.target.value)}
                placeholder="e.g. Every 2 weeks"
                required
              />
            </Field>
            <Field label="Reminder times" htmlFor="times" hint="Comma separated 24-hour times, e.g. 08:00, 20:00">
              <Input
                id="times"
                value={form.times}
                onChange={(event) => update('times', event.target.value)}
                placeholder="08:00, 20:00"
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Start date" htmlFor="startDate">
              <Input
                id="startDate"
                type="date"
                value={form.startDate}
                onChange={(event) => update('startDate', event.target.value)}
                required
              />
            </Field>
            <Field label="Planned end date" htmlFor="endDate" optional>
              <Input
                id="endDate"
                type="date"
                value={form.endDate}
                onChange={(event) => update('endDate', event.target.value)}
              />
            </Field>
          </div>

          <Field label="Prescribing clinician" htmlFor="prescriber" optional>
            <Input
              id="prescriber"
              value={form.prescriber}
              onChange={(event) => update('prescriber', event.target.value)}
            />
          </Field>

          <Field label="Notes" htmlFor="planNotes" optional>
            <Textarea
              id="planNotes"
              rows={2}
              value={form.notes}
              onChange={(event) => update('notes', event.target.value)}
              placeholder="Administration notes from the prescription"
            />
          </Field>

          <Switch
            label="Enable local reminders"
            description="You can turn these off at any time without changing the prescription."
            checked={form.reminderEnabled}
            onChange={(checked) => update('reminderEnabled', checked)}
          />

          {error ? (
            <p role="alert" className="text-xs font-medium text-danger-600 dark:text-danger-400">
              {error}
            </p>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit">{editing ? 'Save changes' : 'Add plan'}</Button>
          </div>
        </form>
      </Modal>

      {/* Side effect modal */}
      <Modal
        open={sideEffectOpen}
        onClose={() => setSideEffectOpen(false)}
        title="Log a side effect"
        description="This creates a timestamped journal entry. It does not send a message to your clinician."
      >
        <form onSubmit={saveSideEffect} className="space-y-4">
          <Field label="What did you notice?" htmlFor="sideEffectText">
            <Input
              id="sideEffectText"
              value={sideEffect.text}
              onChange={(event) => setSideEffect((prev) => ({ ...prev, text: event.target.value }))}
              placeholder="e.g. nausea, rash, dizziness"
              required
            />
          </Field>
          <Field label="Additional context" htmlFor="sideEffectNote" optional>
            <Textarea
              id="sideEffectNote"
              rows={3}
              value={sideEffect.note}
              onChange={(event) => setSideEffect((prev) => ({ ...prev, note: event.target.value }))}
              placeholder="When it started, how long it lasted, anything that helped"
            />
          </Field>
          <InlineAlert tone="warning" title="Urgent symptoms">
            Seek urgent medical care for severe reactions such as breathing difficulty, facial swelling, or a high
            fever. Do not wait for the app.
          </InlineAlert>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setSideEffectOpen(false)}>Cancel</Button>
            <Button type="submit" variant="danger">Save side effect</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default Medications
