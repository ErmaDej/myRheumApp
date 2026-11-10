import { useMemo, useState } from 'react'
import { Check, ChevronDown, NotebookPen, Plus, Trash2, TriangleAlert } from 'lucide-react'
import { useData } from '@/data/DataProvider'
import { useTrackingPreferences } from '@/data/preferences'
import { useToast } from '@/hooks/useToast'
import type { SymptomEntry } from '@/data/types'
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
  RangeSlider,
  SectionHeader,
  Textarea,
} from '@/components/ui'
import { cn, formatDate, formatMinutes, formatRelative, uid } from '@/lib/utils'

interface FormState {
  recordedAt: string
  pain: number
  stiffnessMinutes: string
  fatigue: number
  sleepQuality: number
  functionalDifficulty: number
  mood: number
  triggers: string
  notes: string
  sideEffects: string
}

const emptyForm = (): FormState => ({
  recordedAt: new Date().toISOString().slice(0, 16),
  pain: 3,
  stiffnessMinutes: '',
  fatigue: 3,
  sleepQuality: 6,
  functionalDifficulty: 3,
  mood: 6,
  triggers: '',
  notes: '',
  sideEffects: '',
})

/** The five symptom sliders all start at 0 so "untouched" can be detected. */
const blankForm = (): FormState => ({
  ...emptyForm(),
  pain: 0,
  fatigue: 0,
  sleepQuality: 0,
  functionalDifficulty: 0,
  mood: 0,
})

const fromEntry = (entry: SymptomEntry): FormState => ({
  recordedAt: new Date(entry.recordedAt).toISOString().slice(0, 16),
  pain: entry.pain ?? 0,
  stiffnessMinutes: entry.stiffnessMinutes === null ? '' : String(entry.stiffnessMinutes),
  fatigue: entry.fatigue ?? 0,
  sleepQuality: entry.sleepQuality ?? 0,
  functionalDifficulty: entry.functionalDifficulty ?? 0,
  mood: entry.mood ?? 0,
  triggers: entry.triggers,
  notes: entry.notes,
  sideEffects: entry.sideEffects,
})

export const HealthJournal = () => {
  const { state, store } = useData()
  const { toast } = useToast()
  const { data } = state
  const { preferences } = useTrackingPreferences(data.profile.id)

  const [form, setForm] = useState<FormState>(blankForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [touched, setTouched] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<SymptomEntry | null>(null)

  const entries = useMemo(
    () => [...data.symptomEntries].sort((a, b) => b.recordedAt.localeCompare(a.recordedAt)),
    [data.symptomEntries],
  )

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setTouched((prev) => new Set(prev).add(String(key)))
    setError(null)
  }

  const hasAnyValue =
    touched.has('pain') ||
    touched.has('fatigue') ||
    touched.has('sleepQuality') ||
    touched.has('functionalDifficulty') ||
    touched.has('mood') ||
    form.stiffnessMinutes.trim() !== '' ||
    form.notes.trim() !== '' ||
    form.sideEffects.trim() !== '' ||
    form.triggers.trim() !== ''

  const resetForm = () => {
    setForm(blankForm())
    setTouched(new Set())
    setEditingId(null)
    setError(null)
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!hasAnyValue) {
      setError('Record at least one observation before saving. Every individual question can be skipped.')
      return
    }

    const recordedAt = new Date(form.recordedAt)
    if (Number.isNaN(recordedAt.getTime())) {
      setError('The date and time are not valid.')
      return
    }

    const entry: SymptomEntry = {
      id: editingId ?? uid('sym'),
      patientId: data.profile.id,
      recordedAt: recordedAt.toISOString(),
      pain: touched.has('pain') || editingId ? form.pain : null,
      stiffnessMinutes:
        form.stiffnessMinutes.trim() === '' ? null : Math.max(0, Number(form.stiffnessMinutes)),
      fatigue: touched.has('fatigue') || editingId ? form.fatigue : null,
      sleepQuality: touched.has('sleepQuality') || editingId ? form.sleepQuality : null,
      functionalDifficulty:
        touched.has('functionalDifficulty') || editingId ? form.functionalDifficulty : null,
      mood: touched.has('mood') || editingId ? form.mood : null,
      triggers: form.triggers.trim(),
      notes: form.notes.trim(),
      sideEffects: form.sideEffects.trim(),
      provenance: 'patient',
    }

    store.saveSymptomEntry(entry)
    toast({
      title: editingId ? 'Check-in updated' : 'Check-in saved',
      description: state.online
        ? 'Saved on this device and queued for your account.'
        : 'Saved on this device. It will sync when you are back online.',
      variant: 'success',
    })
    resetForm()
  }

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Daily check-in"
        description="Thirty seconds, on your terms. Skip anything that does not apply — missing answers are stored as missing, never guessed."
        action={
          <Badge tone="teal">
            <NotebookPen className="size-3" aria-hidden /> {entries.length} entries
          </Badge>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <Card className="p-4 sm:p-5">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-ink">
                  {editingId ? 'Edit check-in' : 'How are you today?'}
                </h2>
                <p className="mt-0.5 text-xs text-muted">
                  {entries.length ? `Last entry ${formatRelative(entries[0].recordedAt)}` : 'This will be your first entry.'}
                </p>
              </div>
              {editingId ? (
                <Button variant="ghost" size="sm" onClick={resetForm}>
                  Cancel edit
                </Button>
              ) : null}
            </div>

            <Field label="Date and time" htmlFor="recordedAt">
              <Input
                id="recordedAt"
                type="datetime-local"
                value={form.recordedAt}
                max={new Date().toISOString().slice(0, 16)}
                onChange={(event) => update('recordedAt', event.target.value)}
              />
            </Field>

            {preferences.metrics.some((metric) => metric !== 'stiffnessMinutes') ? (
              <div className="space-y-4 rounded-2xl bg-navy-900/[0.035] p-3.5 dark:bg-white/5">
                {preferences.metrics.includes('pain') ? (
                  <RangeSlider
                    label="Overall pain"
                    value={form.pain}
                    onChange={(value) => update('pain', value)}
                    lowLabel="0 — no pain"
                    highLabel="10 — worst imaginable"
                  />
                ) : null}
                {preferences.metrics.includes('fatigue') ? (
                  <RangeSlider
                    label="Fatigue"
                    value={form.fatigue}
                    onChange={(value) => update('fatigue', value)}
                    lowLabel="0 — none"
                    highLabel="10 — exhausted"
                  />
                ) : null}
                {preferences.metrics.includes('sleepQuality') ? (
                  <RangeSlider
                    label="Sleep quality"
                    value={form.sleepQuality}
                    onChange={(value) => update('sleepQuality', value)}
                    lowLabel="0 — very poor"
                    highLabel="10 — excellent"
                  />
                ) : null}
                {preferences.metrics.includes('functionalDifficulty') ? (
                  <RangeSlider
                    label="Functional difficulty"
                    value={form.functionalDifficulty}
                    onChange={(value) => update('functionalDifficulty', value)}
                    lowLabel="0 — none"
                    highLabel="10 — unable"
                  />
                ) : null}
                {preferences.metrics.includes('mood') ? (
                  <RangeSlider
                    label="Mood / well-being"
                    value={form.mood}
                    onChange={(value) => update('mood', value)}
                    lowLabel="0 — very low"
                    highLabel="10 — very good"
                  />
                ) : null}
              </div>
            ) : null}

            {preferences.metrics.includes('stiffnessMinutes') ? (
              <Field
                label="Morning stiffness duration"
                htmlFor="stiffness"
                hint="In minutes. Leave blank if you did not have stiffness."
                optional
              >
                <Input
                  id="stiffness"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={1440}
                  placeholder="e.g. 25"
                  value={form.stiffnessMinutes}
                  onChange={(event) => update('stiffnessMinutes', event.target.value)}
                />
              </Field>
            ) : null}

            <p className="text-[10px] leading-relaxed text-muted">
              Visible scales follow your tracking preferences. Hidden scales keep any previously recorded values.
            </p>

            <details className="group rounded-2xl border border-navy-900/10 dark:border-white/10">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3.5 py-3 text-sm font-medium text-ink">
                Add context, side effects or notes
                <ChevronDown className="size-4 text-muted transition-transform group-open:rotate-180" aria-hidden />
              </summary>
              <div className="space-y-3 border-t border-navy-900/10 p-3.5 dark:border-white/10">
                <Field label="Possible triggers" htmlFor="triggers" optional>
                  <Input
                    id="triggers"
                    placeholder="Weather, stress, activity, sleep…"
                    value={form.triggers}
                    onChange={(event) => update('triggers', event.target.value)}
                  />
                </Field>
                <Field label="Side effects" htmlFor="sideEffects" optional hint="Describe anything you noticed after a dose.">
                  <Textarea
                    id="sideEffects"
                    rows={2}
                    placeholder="e.g. nausea two hours after injection"
                    value={form.sideEffects}
                    onChange={(event) => update('sideEffects', event.target.value)}
                  />
                </Field>
                <Field label="Notes" htmlFor="notes" optional>
                  <Textarea
                    id="notes"
                    rows={3}
                    placeholder="Anything else worth remembering?"
                    value={form.notes}
                    onChange={(event) => update('notes', event.target.value)}
                  />
                </Field>
              </div>
            </details>

            {error ? (
              <p role="alert" className="text-xs font-medium text-danger-600 dark:text-danger-400">
                {error}
              </p>
            ) : null}

            {form.sideEffects.trim().length > 0 ? (
              <InlineAlert tone="warning" title="Side effects need clinical advice">
                If this is severe, sudden, or you feel unwell, contact your treating clinician or urgent care.
                Do not wait for an app notification.
              </InlineAlert>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button type="submit" size="lg">
                <Check className="size-4" aria-hidden /> {editingId ? 'Update check-in' : 'Save check-in'}
              </Button>
              <Button type="button" variant="secondary" size="lg" onClick={resetForm}>
                Reset
              </Button>
            </div>

            <p className="text-[11px] leading-relaxed text-muted">
              Saved locally first. Nothing is marked as verified until you save it, and questionnaires are
              separate from your clinician&apos;s assessment.
            </p>
          </form>
        </Card>

        <Card className="p-4 sm:p-5">
          <CardHeader
            title="Recent entries"
            subtitle="Edit or remove an entry if you recorded it wrongly"
            action={<Plus className="size-4 text-muted" aria-hidden />}
          />
          <div className="mt-3 space-y-2">
            {entries.length === 0 ? (
              <EmptyState
                icon={<NotebookPen className="size-5" aria-hidden />}
                title="No entries yet"
                description="Save your first check-in and it will appear here immediately, even offline."
              />
            ) : (
              entries.slice(0, 12).map((entry) => (
                <div
                  key={entry.id}
                  className={cn(
                    'rounded-xl border p-3 transition-colors',
                    editingId === entry.id
                      ? 'border-teal-500 bg-teal-50 dark:bg-teal-500/10'
                      : 'border-navy-900/10 dark:border-white/10',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-ink">{formatDate(entry.recordedAt)}</p>
                      <p className="mt-0.5 text-[11px] text-muted">
                        Pain {entry.pain ?? '—'} · Fatigue {entry.fatigue ?? '—'} · Sleep {entry.sleepQuality ?? '—'} ·
                        Stiffness {formatMinutes(entry.stiffnessMinutes)}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          setForm(fromEntry(entry))
                          setEditingId(entry.id)
                          setTouched(new Set(Object.keys(fromEntry(entry))))
                          window.scrollTo({ top: 0, behavior: 'smooth' })
                        }}
                        className="rounded-lg px-2 py-1 text-[11px] font-semibold text-teal-700 hover:bg-teal-50 dark:text-teal-300 dark:hover:bg-teal-500/10"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(entry)}
                        className="rounded-lg p-1 text-muted hover:bg-danger-500/10 hover:text-danger-600"
                        aria-label={`Delete check-in from ${formatDate(entry.recordedAt)}`}
                      >
                        <Trash2 className="size-3.5" aria-hidden />
                      </button>
                    </div>
                  </div>
                  {entry.notes ? <p className="mt-1 line-clamp-2 text-[11px] text-muted">{entry.notes}</p> : null}
                  {entry.sideEffects ? (
                    <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                      <TriangleAlert className="size-3" aria-hidden /> Side effect recorded
                    </p>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Delete this entry?"
        description="This removes the check-in from this device and queues the deletion for your account. It cannot be undone."
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              Keep entry
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (!deleteTarget) return
                store.deleteSymptomEntry(deleteTarget.id)
                if (editingId === deleteTarget.id) resetForm()
                setDeleteTarget(null)
                toast({ title: 'Entry deleted', variant: 'success' })
              }}
            >
              Delete entry
            </Button>
          </>
        }
      >
        {deleteTarget ? (
          <p className="text-sm text-muted">
            {formatDate(deleteTarget.recordedAt)} — pain {deleteTarget.pain ?? '—'}/10.
          </p>
        ) : null}
      </Modal>
    </div>
  )
}

export default HealthJournal
