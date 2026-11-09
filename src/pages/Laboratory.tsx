import { useMemo, useState } from 'react'
import { Download, FlaskConical, Info, Plus, Trash2, TriangleAlert } from 'lucide-react'
import { useData } from '@/data/DataProvider'
import { useToast } from '@/hooks/useToast'
import type { LabResult, Provenance } from '@/data/types'
import { isOutOfRange, labSeries, latestLabs } from '@/lib/analytics'
import { downloadFile, labResultsCsv } from '@/lib/reports/csv'
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
  Select,
  SectionHeader,
} from '@/components/ui'
import { TrendChart } from '@/components/charts/TrendChart'
import { cn, formatDate, todayInputValue, uid } from '@/lib/utils'

interface LabForm {
  testName: string
  value: string
  unit: string
  referenceLow: string
  referenceHigh: string
  referenceText: string
  collectedAt: string
  laboratory: string
  source: Provenance
  notes: string
}

const emptyLab = (): LabForm => ({
  testName: '',
  value: '',
  unit: '',
  referenceLow: '',
  referenceHigh: '',
  referenceText: '',
  collectedAt: todayInputValue(),
  laboratory: '',
  source: 'patient',
  notes: '',
})

const rangeLabel = (lab: LabResult): string => {
  if (lab.referenceText) return lab.referenceText
  if (lab.referenceLow !== undefined && lab.referenceHigh !== undefined)
    return `${lab.referenceLow}–${lab.referenceHigh} ${lab.unit}`
  if (lab.referenceHigh !== undefined) return `≤ ${lab.referenceHigh} ${lab.unit}`
  if (lab.referenceLow !== undefined) return `≥ ${lab.referenceLow} ${lab.unit}`
  return 'Not supplied'
}

export const Laboratory = () => {
  const { state, store } = useData()
  const { toast } = useToast()
  const { data } = state

  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<LabForm>(emptyLab)
  const [error, setError] = useState<string | null>(null)
  const [selectedTest, setSelectedTest] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<LabResult | null>(null)

  const latest = useMemo(() => latestLabs(data.labResults), [data.labResults])
  const activeTest = selectedTest ?? latest[0]?.testName ?? null
  const series = useMemo(
    () => (activeTest ? labSeries(data.labResults, activeTest) : []),
    [data.labResults, activeTest],
  )
  const chartData = useMemo(
    () =>
      series.map((lab) => ({
        day: lab.collectedAt,
        value: typeof lab.value === 'number' ? lab.value : Number(lab.value),
      })),
    [series],
  )
  const activeSample = series[series.length - 1]

  const update = <K extends keyof LabForm>(key: K, value: LabForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setError(null)
  }

  const save = (event: React.FormEvent) => {
    event.preventDefault()
    if (!form.testName.trim()) return setError('A test name is required.')
    if (!form.value.trim()) return setError('A result value is required.')
    if (!form.unit.trim()) return setError('Record the unit exactly as the laboratory reported it.')
    if (Number.isNaN(Number(form.value))) return setError('The value must be a number.')
    if (!form.collectedAt) return setError('A collection date is required.')

    const lab: LabResult = {
      id: uid('lab'),
      patientId: data.profile.id,
      testName: form.testName.trim(),
      value: Number(form.value),
      unit: form.unit.trim(),
      referenceLow: form.referenceLow.trim() === '' ? undefined : Number(form.referenceLow),
      referenceHigh: form.referenceHigh.trim() === '' ? undefined : Number(form.referenceHigh),
      referenceText: form.referenceText.trim() || undefined,
      collectedAt: new Date(`${form.collectedAt}T08:00:00`).toISOString(),
      laboratory: form.laboratory.trim() || undefined,
      source: form.source,
      notes: form.notes.trim() || undefined,
      createdAt: new Date().toISOString(),
    }

    store.saveLabResult(lab)
    toast({
      title: 'Laboratory result saved',
      description: 'Original value and unit preserved; no unit conversion was applied.',
      variant: 'success',
    })
    setForm(emptyLab())
    setOpen(false)
    setSelectedTest(lab.testName)
  }

  const exportCsv = () => {
    downloadFile(`myrheum-labs-${todayInputValue()}.csv`, labResultsCsv(data.labResults))
    toast({ title: 'Laboratory CSV downloaded', variant: 'success' })
  }

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Laboratory results"
        description="Every value keeps its original unit and the laboratory's own reference interval. Units are never silently converted."
        action={
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={exportCsv} disabled={data.labResults.length === 0}>
              <Download className="size-3.5" aria-hidden /> CSV
            </Button>
            <Button size="sm" onClick={() => setOpen(true)}>
              <Plus className="size-3.5" aria-hidden /> Add result
            </Button>
          </div>
        }
      />

      {data.labResults.some(isOutOfRange) ? (
        <InlineAlert tone="warning" title="Some results fall outside the reported reference interval">
          Out-of-range values need interpretation by your clinician. They are not an automatic diagnosis.
        </InlineAlert>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_1.25fr]">
        <Card className="p-4 sm:p-5">
          <CardHeader
            title="Latest by test"
            subtitle={`${latest.length} distinct test${latest.length === 1 ? '' : 's'} recorded`}
            action={<FlaskConical className="size-4 text-muted" aria-hidden />}
          />
          <div className="mt-3 space-y-2">
            {latest.length === 0 ? (
              <EmptyState
                icon={<FlaskConical className="size-5" aria-hidden />}
                title="No laboratory results yet"
                description="Add CRP, ESR, full blood count or any result exactly as reported, with its unit."
                action={<Button size="sm" onClick={() => setOpen(true)}>Add first result</Button>}
              />
            ) : (
              latest.map((lab) => {
                const out = isOutOfRange(lab)
                return (
                  <button
                    key={lab.id}
                    type="button"
                    onClick={() => setSelectedTest(lab.testName)}
                    className={cn(
                      'flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition',
                      activeTest === lab.testName
                        ? 'border-teal-500 bg-teal-50 dark:bg-teal-500/10'
                        : 'border-navy-900/10 hover:bg-navy-900/5 dark:border-white/10 dark:hover:bg-white/10',
                    )}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{lab.testName}</p>
                      <p className="text-[11px] text-muted">
                        {formatDate(lab.collectedAt)} · ref {rangeLabel(lab)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold tabular-nums text-ink">
                        {lab.value} <span className="text-[10px] font-medium text-muted">{lab.unit}</span>
                      </p>
                      <Badge tone={out ? 'amber' : 'teal'}>{out ? 'Outside range' : 'In range'}</Badge>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </Card>

        <Card className="p-4 sm:p-5">
          <CardHeader
            title={activeTest ? `${activeTest} trend` : 'Trend'}
            subtitle={
              activeSample
                ? `Latest ${formatDate(activeSample.collectedAt)} · ${activeSample.value} ${activeSample.unit} · ref ${rangeLabel(activeSample)}`
                : 'Select a test to view its history'
            }
            action={
              activeSample ? (
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Delete latest ${activeTest} result`}
                  onClick={() => setDeleteTarget(activeSample)}
                >
                  <Trash2 className="size-3.5" aria-hidden />
                </Button>
              ) : undefined
            }
          />
          <div className="mt-3">
            <TrendChart
              title={activeTest ? `${activeTest} over time` : 'Laboratory trend'}
              data={chartData}
              xKey="day"
              height={230}
              domain={[0, 'auto']}
              unit={activeSample ? ` ${activeSample.unit}` : undefined}
              series={[{ key: 'value', label: activeTest ?? 'Value', color: '#2f9d89' }]}
            />
          </div>
          {activeSample && (activeSample.referenceLow !== undefined || activeSample.referenceHigh !== undefined) ? (
            <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-relaxed text-muted">
              <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              Reference interval as reported by {activeSample.laboratory ?? 'the laboratory'}: {rangeLabel(activeSample)}.
              Ranges differ between laboratories.
            </p>
          ) : null}
        </Card>
      </div>

      {/* Recent rows */}
      <Card className="p-4 sm:p-5">
        <CardHeader title="All results" subtitle="Newest first" />
        <div className="mt-3 overflow-x-auto">
          {data.labResults.length === 0 ? (
            <p className="text-xs text-muted">Nothing recorded yet.</p>
          ) : (
            <table className="w-full min-w-[560px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-navy-900/10 text-[10px] uppercase tracking-wide text-muted dark:border-white/10">
                  <th scope="col" className="py-2 pr-3 font-semibold">Collected</th>
                  <th scope="col" className="py-2 pr-3 font-semibold">Test</th>
                  <th scope="col" className="py-2 pr-3 font-semibold">Result</th>
                  <th scope="col" className="py-2 pr-3 font-semibold">Reference</th>
                  <th scope="col" className="py-2 pr-3 font-semibold">Laboratory</th>
                  <th scope="col" className="py-2 font-semibold"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {[...data.labResults]
                  .sort((a, b) => b.collectedAt.localeCompare(a.collectedAt))
                  .slice(0, 25)
                  .map((lab) => (
                    <tr key={lab.id} className="border-b border-navy-900/5 last:border-0 dark:border-white/5">
                      <td className="py-2 pr-3 text-muted">{formatDate(lab.collectedAt)}</td>
                      <td className="py-2 pr-3 font-medium text-ink">{lab.testName}</td>
                      <td className="py-2 pr-3 tabular-nums text-ink">
                        {lab.value} {lab.unit}
                        {isOutOfRange(lab) ? (
                          <TriangleAlert className="ml-1 inline size-3 text-amber-500" aria-label="Outside reference range" />
                        ) : null}
                      </td>
                      <td className="py-2 pr-3 text-muted">{rangeLabel(lab)}</td>
                      <td className="py-2 pr-3 text-muted">{lab.laboratory ?? '—'}</td>
                      <td className="py-2 text-right">
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(lab)}
                          className="rounded-lg p-1.5 text-muted hover:bg-danger-500/10 hover:text-danger-600"
                          aria-label={`Delete ${lab.testName} result from ${formatDate(lab.collectedAt)}`}
                        >
                          <Trash2 className="size-3.5" aria-hidden />
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Add laboratory result"
        description="Enter the values exactly as printed on the report. Never round or convert a unit here."
        wide
      >
        <form onSubmit={save} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Test name" htmlFor="testName">
              <Input
                id="testName"
                value={form.testName}
                onChange={(event) => update('testName', event.target.value)}
                placeholder="e.g. C-reactive protein"
                required
              />
            </Field>
            <Field label="Collection date" htmlFor="collectedAt">
              <Input
                id="collectedAt"
                type="date"
                value={form.collectedAt}
                max={todayInputValue()}
                onChange={(event) => update('collectedAt', event.target.value)}
                required
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Result value" htmlFor="value">
              <Input
                id="value"
                type="number"
                step="any"
                value={form.value}
                onChange={(event) => update('value', event.target.value)}
                placeholder="e.g. 3.2"
                required
              />
            </Field>
            <Field label="Unit as reported" htmlFor="unit">
              <Input
                id="unit"
                value={form.unit}
                onChange={(event) => update('unit', event.target.value)}
                placeholder="e.g. mg/L"
                required
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Reference low" htmlFor="referenceLow" optional>
              <Input
                id="referenceLow"
                type="number"
                step="any"
                value={form.referenceLow}
                onChange={(event) => update('referenceLow', event.target.value)}
              />
            </Field>
            <Field label="Reference high" htmlFor="referenceHigh" optional>
              <Input
                id="referenceHigh"
                type="number"
                step="any"
                value={form.referenceHigh}
                onChange={(event) => update('referenceHigh', event.target.value)}
              />
            </Field>
          </div>

          <Field
            label="Reference text as printed"
            htmlFor="referenceText"
            optional
            hint="Use this when the laboratory prints a range you cannot express as two numbers."
          >
            <Input
              id="referenceText"
              value={form.referenceText}
              onChange={(event) => update('referenceText', event.target.value)}
              placeholder="e.g. < 5 mg/L"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Reporting laboratory" htmlFor="laboratory" optional>
              <Input
                id="laboratory"
                value={form.laboratory}
                onChange={(event) => update('laboratory', event.target.value)}
                placeholder="e.g. Rheum Clinic laboratory"
              />
            </Field>
            <Field label="Source" htmlFor="source">
              <Select
                id="source"
                value={form.source}
                onChange={(event) => update('source', event.target.value as Provenance)}
              >
                <option value="patient">Patient-entered</option>
                <option value="imported">Imported from report</option>
                <option value="clinician">Clinician-entered</option>
              </Select>
            </Field>
          </div>

          {error ? (
            <p role="alert" className="text-xs font-medium text-danger-600 dark:text-danger-400">
              {error}
            </p>
          ) : null}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Save result</Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Delete this result?"
        description="The calculation history will no longer include it."
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Keep</Button>
            <Button
              variant="danger"
              onClick={() => {
                if (!deleteTarget) return
                store.deleteLabResult(deleteTarget.id)
                setDeleteTarget(null)
                toast({ title: 'Result deleted', variant: 'success' })
              }}
            >
              Delete
            </Button>
          </>
        }
      >
        {deleteTarget ? (
          <p className="text-sm text-muted">
            {deleteTarget.testName} · {deleteTarget.value} {deleteTarget.unit} · {formatDate(deleteTarget.collectedAt)}
          </p>
        ) : null}
      </Modal>
    </div>
  )
}

export default Laboratory
