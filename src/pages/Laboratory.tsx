import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Download,
  FilePlus2,
  FlaskConical,
  Info,
  Paperclip,
  Plus,
  Trash2,
  TriangleAlert,
} from 'lucide-react'
import { useData } from '@/data/DataProvider'
import { labTestUnit, useTrackingPreferences } from '@/data/preferences'
import { useToast } from '@/hooks/useToast'
import { AttachmentField, AttachmentList } from '@/components/attachments/AttachmentUpload'
import { supabaseConfigured, uploadAttachmentFile } from '@/data/remote'
import type { ImportBatch, LabPanel, LabResult, Provenance } from '@/data/types'
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

interface ImportRowDraft {
  key: string
  testName: string
  value: string
  unit: string
  referenceLow: string
  referenceHigh: string
  referenceText: string
}

interface ImportDraft {
  title: string
  collectedAt: string
  laboratory: string
  source: Provenance
  notes: string
  rows: ImportRowDraft[]
}

const blankRow = (): ImportRowDraft => ({
  key: uid('row'),
  testName: '',
  value: '',
  unit: '',
  referenceLow: '',
  referenceHigh: '',
  referenceText: '',
})

const emptyImport = (): ImportDraft => ({
  title: '',
  collectedAt: todayInputValue(),
  laboratory: '',
  source: 'imported',
  notes: '',
  rows: [blankRow(), blankRow(), blankRow()],
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
  const [importOpen, setImportOpen] = useState(false)
  const [importDraft, setImportDraft] = useState<ImportDraft>(emptyImport)
  const [importError, setImportError] = useState<string | null>(null)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [params, setParams] = useSearchParams()
  const [expandedPanel, setExpandedPanel] = useState<string | null>(null)
  const [trackedOnly, setTrackedOnly] = useState(false)
  const { preferences } = useTrackingPreferences(data.profile.id)

  // The command palette links here with ?new=1 / ?import=1.
  useEffect(() => {
    if (params.get('new') === '1') setOpen(true)
    if (params.get('import') === '1') setImportOpen(true)
    if (params.get('new') || params.get('import')) {
      const next = new URLSearchParams(params)
      next.delete('new')
      next.delete('import')
      setParams(next, { replace: true })
    }
  }, [params, setParams])

  const panels = useMemo(
    () => [...data.labPanels].sort((a, b) => b.collectedAt.localeCompare(a.collectedAt)),
    [data.labPanels],
  )

  const latest = useMemo(() => latestLabs(data.labResults), [data.labResults])
  const trackedTests = useMemo(() => new Set(preferences.labTests), [preferences.labTests])
  const visibleLatest = trackedOnly
    ? latest.filter((lab) => trackedTests.has(lab.testName))
    : latest
  const activeTest = selectedTest ?? visibleLatest[0]?.testName ?? latest[0]?.testName ?? null
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

  const updateImport = <K extends keyof ImportDraft>(key: K, value: ImportDraft[K]) => {
    setImportDraft((prev) => ({ ...prev, [key]: value }))
    setImportError(null)
  }

  const updateRow = (key: string, patch: Partial<ImportRowDraft>) => {
    setImportDraft((prev) => ({
      ...prev,
      rows: prev.rows.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    }))
    setImportError(null)
  }

  const saveImport = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!importDraft.title.trim()) return setImportError('Give the report a title.')
    if (!importDraft.collectedAt) return setImportError('Choose the collection date.')

    const filled = importDraft.rows.filter(
      (row) => row.testName.trim() || row.value.trim() || row.unit.trim(),
    )
    if (filled.length === 0) return setImportError('Add at least one result from the report.')
    for (const row of filled) {
      if (!row.testName.trim() || !row.value.trim() || !row.unit.trim()) {
        return setImportError('Every row needs a test name, value and unit.')
      }
      if (Number.isNaN(Number(row.value))) {
        return setImportError(`“${row.testName}” needs a numeric value. Enter text results as a separate record.`)
      }
    }

    setImporting(true)
    const now = new Date().toISOString()
    const panel: LabPanel = {
      id: uid('panel'),
      patientId: data.profile.id,
      title: importDraft.title.trim(),
      collectedAt: new Date(`${importDraft.collectedAt}T08:00:00`).toISOString(),
      laboratory: importDraft.laboratory.trim() || undefined,
      source: importDraft.source,
      notes: importDraft.notes.trim() || undefined,
      createdAt: now,
    }
    const batch: ImportBatch = {
      id: uid('batch'),
      patientId: data.profile.id,
      label: panel.title,
      source: 'manual',
      status: 'complete',
      itemCount: filled.length,
      notes: importFile ? `Original file: ${importFile.name}` : undefined,
      createdAt: now,
    }
    const results: LabResult[] = filled.map((row) => ({
      id: uid('lab'),
      patientId: data.profile.id,
      panelId: panel.id,
      testName: row.testName.trim(),
      value: Number(row.value),
      unit: row.unit.trim(),
      referenceLow: row.referenceLow.trim() === '' ? undefined : Number(row.referenceLow),
      referenceHigh: row.referenceHigh.trim() === '' ? undefined : Number(row.referenceHigh),
      referenceText: row.referenceText.trim() || undefined,
      collectedAt: panel.collectedAt,
      laboratory: panel.laboratory,
      source: importDraft.source,
      notes: importDraft.notes.trim() || undefined,
      createdAt: now,
    }))

    store.saveImportBatch(batch)
    store.saveLabReport(panel, results)

    if (importFile && supabaseConfigured) {
      try {
        const storagePath = await uploadAttachmentFile(data.profile.id, importFile)
        store.saveAttachment({
          id: uid('att'),
          patientId: data.profile.id,
          labPanelId: panel.id,
          importBatchId: batch.id,
          storageBucket: 'medical-documents',
          storagePath,
          fileName: importFile.name,
          mimeType: importFile.type || 'application/pdf',
          byteSize: importFile.size,
          kind: 'lab-report',
          capturedOn: importDraft.collectedAt,
          createdAt: now,
        })
      } catch (cause) {
        toast({
          title: 'Report saved, file not uploaded',
          description: cause instanceof Error ? cause.message : 'Attach the original from the panel later.',
          variant: 'warning',
        })
      }
    }

    toast({
      title: `Report imported with ${results.length} result${results.length === 1 ? '' : 's'}`,
      description: 'Values, units and the report grouping are stored; nothing was converted or estimated.',
      variant: 'success',
    })
    setImportDraft(emptyImport())
    setImportFile(null)
    setImporting(false)
    setImportOpen(false)
    setSelectedTest(results[0]?.testName ?? null)
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
            <Button variant="secondary" size="sm" onClick={() => setImportOpen(true)}>
              <FilePlus2 className="size-3.5" aria-hidden /> Import report
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
            subtitle={
              trackedOnly
                ? `${visibleLatest.length} tracked of ${latest.length} recorded`
                : `${latest.length} distinct test${latest.length === 1 ? '' : 's'} recorded`
            }
            action={
              <div className="flex items-center gap-1.5">
                <Button
                  variant={trackedOnly ? 'secondary' : 'ghost'}
                  size="sm"
                  aria-pressed={trackedOnly}
                  onClick={() => setTrackedOnly((value) => !value)}
                >
                  Tracked
                </Button>
                <FlaskConical className="size-4 text-muted" aria-hidden />
              </div>
            }
          />
          <div className="mt-3 space-y-2">
            {visibleLatest.length === 0 ? (
              <EmptyState
                icon={<FlaskConical className="size-5" aria-hidden />}
                title={trackedOnly && latest.length > 0 ? 'No tracked test recorded yet' : 'No laboratory results yet'}
                description={
                  trackedOnly && latest.length > 0
                    ? 'Choose your tracked tests in Settings, or add a result with one tap from the tracked list.'
                    : 'Add CRP, ESR, full blood count or any result exactly as reported, with its unit.'
                }
                action={<Button size="sm" onClick={() => setOpen(true)}>Add first result</Button>}
              />
            ) : (
              visibleLatest.map((lab) => {
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
                        {trackedTests.has(lab.testName) ? ' · tracked' : ''}
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

      {/* Report panels keep one venepuncture together with its original file. */}
      <Card className="p-4 sm:p-5">
        <CardHeader
          title="Report panels"
          subtitle="Results from one report stay grouped, with the original PDF in your private bucket."
          action={<Paperclip className="size-4 text-muted" aria-hidden />}
        />
        <div className="mt-3 space-y-2">
          {panels.length === 0 ? (
            <EmptyState
              icon={<FilePlus2 className="size-5" aria-hidden />}
              title="No reports imported yet"
              description="Import a printed or PDF report once and enter every value as it was reported. You can attach the original file."
              action={
                <Button size="sm" onClick={() => setImportOpen(true)}>
                  Import a report
                </Button>
              }
            />
          ) : (
            panels.map((panel) => {
              const panelResults = data.labResults.filter((result) => result.panelId === panel.id)
              const panelAttachments = data.attachments.filter(
                (attachment) => attachment.labPanelId === panel.id,
              )
              const expanded = expandedPanel === panel.id
              return (
                <div
                  key={panel.id}
                  className="rounded-xl border border-navy-900/10 dark:border-white/10"
                >
                  <div className="flex items-start gap-2 p-3">
                    <button
                      type="button"
                      onClick={() => setExpandedPanel(expanded ? null : panel.id)}
                      aria-expanded={expanded}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="truncate text-sm font-medium text-ink">{panel.title}</p>
                      <p className="mt-0.5 text-[11px] text-muted">
                        {formatDate(panel.collectedAt)}
                        {panel.laboratory ? ` · ${panel.laboratory}` : ''} · {panelResults.length} result
                        {panelResults.length === 1 ? '' : 's'}
                        {panelAttachments.length > 0 ? ' · file attached' : ''}
                      </p>
                    </button>
                    <Badge tone={panel.source === 'clinician' ? 'teal' : 'lavender'}>{panel.source}</Badge>
                    <button
                      type="button"
                      onClick={() => {
                        store.deleteLabPanel(panel.id)
                        toast({
                          title: 'Panel grouping removed',
                          description: 'The individual results are kept.',
                          variant: 'success',
                        })
                      }}
                      className="rounded-lg p-1.5 text-muted hover:bg-danger-500/10 hover:text-danger-600"
                      aria-label={`Remove panel ${panel.title}`}
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                    </button>
                  </div>
                  {expanded ? (
                    <div className="space-y-3 border-t border-navy-900/10 p-3 dark:border-white/10">
                      {panel.notes ? (
                        <p className="whitespace-pre-line text-xs text-muted">{panel.notes}</p>
                      ) : null}
                      <ul className="grid gap-1.5 sm:grid-cols-2">
                        {panelResults.map((result) => (
                          <li
                            key={result.id}
                            className="flex items-baseline justify-between gap-2 rounded-lg bg-navy-900/5 px-2.5 py-1.5 dark:bg-white/5"
                          >
                            <span className="truncate text-xs text-ink">{result.testName}</span>
                            <span className="shrink-0 text-xs font-semibold tabular-nums text-ink">
                              {result.value}{' '}
                              <span className="text-[10px] font-normal text-muted">{result.unit}</span>
                            </span>
                          </li>
                        ))}
                      </ul>
                      <AttachmentList
                        attachments={panelAttachments}
                        emptyHint="No original file attached to this report."
                      />
                      <AttachmentField
                        patientId={data.profile.id}
                        kind="lab-report"
                        labPanelId={panel.id}
                        importBatchId={panelAttachments[0]?.importBatchId}
                      />
                    </div>
                  ) : null}
                </div>
              )
            })
          )}
        </div>
      </Card>

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
          {preferences.labTests.length > 0 ? (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Tracked tests</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {preferences.labTests.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => {
                      update('testName', name)
                      const unit = labTestUnit(name)
                      if (unit) update('unit', unit)
                    }}
                    className={cn(
                      'rounded-full border px-3 py-1.5 text-[11px] font-medium transition',
                      form.testName === name
                        ? 'border-teal-500 bg-teal-50 text-teal-800 dark:bg-teal-500/15 dark:text-teal-200'
                        : 'border-navy-900/10 text-muted hover:bg-navy-900/5 dark:border-white/10 dark:hover:bg-white/10',
                    )}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

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

      <Modal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Import a laboratory report"
        description="Transcribe every value exactly as reported and keep the original file with it. Nothing is converted or estimated."
        wide
      >
        <form onSubmit={(event) => void saveImport(event)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Report title" htmlFor="importTitle">
              <Input
                id="importTitle"
                value={importDraft.title}
                onChange={(event) => updateImport('title', event.target.value)}
                placeholder="e.g. Full blood count and CRP"
                required
              />
            </Field>
            <Field label="Collection date" htmlFor="importDate">
              <Input
                id="importDate"
                type="date"
                value={importDraft.collectedAt}
                max={todayInputValue()}
                onChange={(event) => updateImport('collectedAt', event.target.value)}
                required
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Laboratory" htmlFor="importLab" optional>
              <Input
                id="importLab"
                value={importDraft.laboratory}
                onChange={(event) => updateImport('laboratory', event.target.value)}
                placeholder="As printed on the report"
              />
            </Field>
            <Field label="Source" htmlFor="importSource">
              <Select
                id="importSource"
                value={importDraft.source}
                onChange={(event) => updateImport('source', event.target.value as Provenance)}
              >
                <option value="imported">Imported from report</option>
                <option value="patient">Patient-entered</option>
                <option value="clinician">Clinician-entered</option>
              </Select>
            </Field>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-ink">Results on this report</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => updateImport('rows', [...importDraft.rows, blankRow()])}
              >
                <Plus className="size-3.5" aria-hidden /> Add row
              </Button>
            </div>
            {importDraft.rows.map((row, index) => (
              <div
                key={row.key}
                className="grid grid-cols-2 gap-2 rounded-xl border border-navy-900/10 p-2 sm:grid-cols-[1.4fr_0.7fr_0.7fr_0.7fr_0.7fr_auto] dark:border-white/10"
              >
                <Input
                  aria-label={`Test name, row ${index + 1}`}
                  value={row.testName}
                  onChange={(event) => updateRow(row.key, { testName: event.target.value })}
                  placeholder="Test"
                />
                <Input
                  aria-label={`Value, row ${index + 1}`}
                  type="number"
                  step="any"
                  value={row.value}
                  onChange={(event) => updateRow(row.key, { value: event.target.value })}
                  placeholder="Value"
                />
                <Input
                  aria-label={`Unit, row ${index + 1}`}
                  value={row.unit}
                  onChange={(event) => updateRow(row.key, { unit: event.target.value })}
                  placeholder="Unit"
                />
                <Input
                  aria-label={`Reference low, row ${index + 1}`}
                  type="number"
                  step="any"
                  value={row.referenceLow}
                  onChange={(event) => updateRow(row.key, { referenceLow: event.target.value })}
                  placeholder="Ref low"
                />
                <Input
                  aria-label={`Reference high, row ${index + 1}`}
                  type="number"
                  step="any"
                  value={row.referenceHigh}
                  onChange={(event) => updateRow(row.key, { referenceHigh: event.target.value })}
                  placeholder="Ref high"
                />
                <button
                  type="button"
                  onClick={() =>
                    updateImport(
                      'rows',
                      importDraft.rows.filter((item) => item.key !== row.key),
                    )
                  }
                  className="justify-self-end rounded-lg p-2 text-muted hover:bg-danger-500/10 hover:text-danger-600"
                  aria-label={`Remove row ${index + 1}`}
                  disabled={importDraft.rows.length === 1}
                >
                  <Trash2 className="size-3.5" aria-hidden />
                </button>
              </div>
            ))}
          </div>

          <Field
            label="Original report file"
            htmlFor="importFile"
            optional
            hint="PDF or photograph. Uploaded to your private bucket, never a public URL."
          >
            <input
              id="importFile"
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              onChange={(event) => setImportFile(event.target.files?.[0] ?? null)}
              className="w-full rounded-xl border border-navy-900/15 bg-white px-3 py-2 text-xs text-ink file:mr-3 file:rounded-lg file:border-0 file:bg-navy-900 file:px-2.5 file:py-1.5 file:text-xs file:font-semibold file:text-white dark:border-white/15 dark:bg-navy-900/50 dark:file:bg-teal-400 dark:file:text-navy-950"
            />
          </Field>

          <Field label="Notes" htmlFor="importNotes" optional>
            <Input
              id="importNotes"
              value={importDraft.notes}
              onChange={(event) => updateImport('notes', event.target.value)}
              placeholder="e.g. Fasting sample; report from Dr.…"
            />
          </Field>

          {importError ? (
            <p role="alert" className="text-xs font-medium text-danger-600 dark:text-danger-400">
              {importError}
            </p>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setImportOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={importing}>
              {importing ? 'Saving report…' : 'Save report'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default Laboratory
