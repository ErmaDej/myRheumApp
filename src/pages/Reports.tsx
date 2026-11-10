import { useMemo, useState } from 'react'
import { Download, FileJson, FileText, Printer, ShieldCheck } from 'lucide-react'
import { useData } from '@/data/DataProvider'
import { useTrackingPreferences } from '@/data/preferences'
import { useToast } from '@/hooks/useToast'
import {
  defaultRange,
  describeRange,
  buildWeeklySummary,
} from '@/lib/reports/summary'
import { doseEventsCsv, downloadFile, labResultsCsv, symptomEntriesCsv } from '@/lib/reports/csv'
import {
  Badge,
  Button,
  Card,
  Field,
  InlineAlert,
  Input,
  SectionHeader,
  SegmentedControl,
  Stat,
} from '@/components/ui'
import { cn, formatDate, todayInputValue } from '@/lib/utils'

type Preset = '7' | '30' | '90' | 'custom'

const isoStart = (date: string) => new Date(`${date}T00:00:00`).toISOString()
const isoEnd = (date: string) => new Date(`${date}T23:59:59`).toISOString()

export const Reports = () => {
  const { state } = useData()
  const { toast } = useToast()
  const { data } = state
  const { preferences } = useTrackingPreferences(data.profile.id)
  const sections = new Set(preferences.reportSections)

  const [preset, setPreset] = useState<Preset>('7')
  const [start, setStart] = useState(defaultRange(7).start.slice(0, 10))
  const [end, setEnd] = useState(todayInputValue())
  const [busy, setBusy] = useState(false)

  const range = useMemo(() => {
    if (preset === 'custom') return { start: isoStart(start), end: isoEnd(end) }
    return defaultRange(Number(preset))
  }, [preset, start, end])

  const summary = useMemo(() => buildWeeklySummary(data, range), [data, range])

  const downloadPdf = async () => {
    setBusy(true)
    try {
      const { downloadSummaryPdf } = await import('@/lib/reports/pdf')
      await downloadSummaryPdf(summary, data.profile)
      toast({ title: 'PDF generated', description: 'Check your downloads for the consultation summary.', variant: 'success' })
    } catch (error) {
      toast({
        title: 'Could not build the PDF',
        description: error instanceof Error ? error.message : 'Try again.',
        variant: 'error',
      })
    } finally {
      setBusy(false)
    }
  }

  const exportJson = () => {
    const payload = {
      app: 'myRheumApp',
      exportedAt: new Date().toISOString(),
      notice: 'Patient-recorded data export. Contains synthetic demo data if exported from preview mode.',
      profile: data.profile,
      symptomEntries: data.symptomEntries,
      assessments: data.assessments,
      medicationPlans: data.medicationPlans,
      doseEvents: data.doseEvents,
      labResults: data.labResults,
      appointments: data.appointments,
      documents: data.documents,
      // Photos are intentionally excluded from default backups because of size and sensitivity.
      photosOmitted: data.photos.length,
      reminders: data.reminders,
      trackingPreferences: preferences,
    }
    downloadFile(
      `myrheum-backup-${todayInputValue()}.json`,
      JSON.stringify(payload, null, 2),
      'application/json;charset=utf-8',
    )
    toast({ title: 'Backup JSON downloaded', variant: 'success' })
  }

  const exportCsv = (kind: 'symptoms' | 'labs' | 'doses') => {
    if (kind === 'symptoms') {
      downloadFile(`myrheum-symptoms-${todayInputValue()}.csv`, symptomEntriesCsv(data.symptomEntries))
    } else if (kind === 'labs') {
      downloadFile(`myrheum-labs-${todayInputValue()}.csv`, labResultsCsv(data.labResults))
    } else {
      downloadFile(`myrheum-doses-${todayInputValue()}.csv`, doseEventsCsv(data.doseEvents, data.medicationPlans))
    }
    toast({ title: 'CSV downloaded', variant: 'success' })
  }

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Reports & exports"
        description="Summaries contain only recorded data. Every sample count and gap is shown so a clinician can judge completeness."
        action={
          <div className="flex gap-2 no-print">
            <Button variant="secondary" size="sm" onClick={() => window.print()}>
              <Printer className="size-3.5" aria-hidden /> Print
            </Button>
            <Button size="sm" onClick={() => void downloadPdf()} disabled={busy}>
              <Download className="size-3.5" aria-hidden /> {busy ? 'Building…' : 'PDF summary'}
            </Button>
          </div>
        }
      />

      <Card className="p-4 sm:p-5 no-print">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-ink">Reporting period</p>
            <p className="mt-0.5 text-xs text-muted">{describeRange(summary.range)}</p>
          </div>
          <SegmentedControl
            label="Reporting period preset"
            value={preset}
            onChange={(value) => setPreset(value as Preset)}
            options={[
              { value: '7', label: '7 days' },
              { value: '30', label: '30 days' },
              { value: '90', label: '90 days' },
              { value: 'custom', label: 'Custom' },
            ]}
          />
        </div>

        {preset === 'custom' ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Start date" htmlFor="reportStart">
              <Input
                id="reportStart"
                type="date"
                value={start}
                max={end}
                onChange={(event) => setStart(event.target.value)}
              />
            </Field>
            <Field label="End date" htmlFor="reportEnd">
              <Input
                id="reportEnd"
                type="date"
                value={end}
                min={start}
                max={todayInputValue()}
                onChange={(event) => setEnd(event.target.value)}
              />
            </Field>
          </div>
        ) : null}
      </Card>

      {/* Printable summary */}
      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-navy-900/10 pb-4 dark:border-white/10">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-700 dark:text-teal-300">
              myRheumApp · Personal health summary
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-ink">{data.profile.name}</h2>
            <p className="mt-0.5 text-xs text-muted">
              {describeRange(summary.range)} · Generated {formatDate(new Date().toISOString())}
            </p>
          </div>
          <Badge tone="lavender">
            <ShieldCheck className="size-3" aria-hidden /> Patient-recorded
          </Badge>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Check-ins" value={summary.checkIns} hint={`${summary.daysInRange} days covered`} />
          <Stat label="Pain mean" value={summary.pain.mean ?? '—'} unit="/10" hint={`n=${summary.pain.samples}`} tone="teal" />
          <Stat label="Doses taken" value={summary.adherence.taken} hint={`${summary.adherence.notRecorded} not recorded`} />
          <Stat label="New labs" value={summary.newLabs.length} hint="Collected in period" />
        </div>

        <div
          className={cn(
            'mt-5 grid gap-5',
            sections.has('symptoms') && sections.has('medications') && 'sm:grid-cols-2',
          )}
        >
          {sections.has('symptoms') ? (
          <section>
            <h3 className="text-xs font-bold uppercase tracking-wide text-muted">Symptom summary</h3>
            <dl className="mt-2 space-y-1.5 text-xs">
              {[
                ['Pain (0–10)', summary.pain.mean === null ? '—' : `${summary.pain.mean} (range ${summary.pain.min}–${summary.pain.max})`],
                ['Morning stiffness', summary.stiffness.mean === null ? '—' : `${summary.stiffness.mean} min`],
                ['Fatigue (0–10)', summary.fatigue.mean === null ? '—' : String(summary.fatigue.mean)],
                ['Sleep quality (0–10)', summary.sleep.mean === null ? '—' : String(summary.sleep.mean)],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-3 border-b border-navy-900/5 pb-1 dark:border-white/5">
                  <dt className="text-muted">{label}</dt>
                  <dd className="font-semibold tabular-nums text-ink">{value}</dd>
                </div>
              ))}
            </dl>
          </section>
          ) : null}

          {sections.has('medications') ? (
          <section>
            <h3 className="text-xs font-bold uppercase tracking-wide text-muted">Medication adherence</h3>
            <div className="mt-2 space-y-1.5 text-xs">
              {summary.medicationLines.length === 0 ? (
                <p className="text-muted">No medication plans recorded.</p>
              ) : (
                summary.medicationLines.map((line) => (
                  <div key={line.plan.id} className="flex justify-between gap-3 border-b border-navy-900/5 pb-1 dark:border-white/5">
                    <span className="truncate text-muted">{line.plan.name}</span>
                    <span className="shrink-0 font-semibold tabular-nums text-ink">
                      {line.taken}/{line.expected} taken
                    </span>
                  </div>
                ))
              )}
              <div className="flex justify-between gap-3 pt-1">
                <span className="text-muted">Overall recorded</span>
                <span className="font-bold tabular-nums text-ink">
                  {summary.adherence.percentRecordedTaken === null ? '—' : `${summary.adherence.percentRecordedTaken}%`}
                </span>
              </div>
            </div>
          </section>
          ) : null}
        </div>

        {sections.has('labs') && summary.newLabs.length > 0 ? (
          <section className="mt-5">
            <h3 className="text-xs font-bold uppercase tracking-wide text-muted">New laboratory results</h3>
            <ul className="mt-1 space-y-1 text-xs text-muted">
              {summary.newLabs.slice(0, 8).map((lab) => (
                <li key={lab.id} className="flex justify-between gap-3 border-b border-navy-900/5 pb-1 dark:border-white/5">
                  <span className="truncate">{lab.testName}</span>
                  <span className="shrink-0 font-semibold tabular-nums text-ink">
                    {lab.value} {lab.unit}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {sections.has('side-effects') && summary.sideEffects.length > 0 ? (
          <section className="mt-5">
            <h3 className="text-xs font-bold uppercase tracking-wide text-muted">Reported side effects</h3>
            <ul className="mt-1 space-y-1 text-xs text-muted">
              {summary.sideEffects.slice(0, 5).map((effect) => (
                <li key={effect}>• {effect}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {summary.missingDataWarnings.length > 0 ? (
          <div className="mt-5 rounded-xl border border-amber-500/30 bg-amber-400/10 p-3 text-[11px] leading-relaxed text-amber-800 dark:text-amber-200">
            <p className="font-semibold">Data limitations</p>
            <ul className="mt-1 space-y-0.5">
              {summary.missingDataWarnings.map((warning) => (
                <li key={warning}>• {warning}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <p className="mt-4 text-[10px] leading-relaxed text-muted">
          This summary is generated from patient-recorded entries. It is not a diagnosis, not a treatment plan,
          and does not prove that a medication caused any change. Verify original reports and consult your
          treating clinician before making treatment decisions.
        </p>
      </Card>

      {/* Exports */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 no-print">
        {[
          { title: 'Symptoms CSV', description: 'Every check-in with scales and notes.', icon: FileText, action: () => exportCsv('symptoms') },
          { title: 'Laboratory CSV', description: 'Results, units and reference ranges.', icon: FileText, action: () => exportCsv('labs') },
          { title: 'Dose events CSV', description: 'Taken, skipped, uncertain and pending.', icon: FileText, action: () => exportCsv('doses') },
          { title: 'JSON backup', description: 'All records except photographs.', icon: FileJson, action: exportJson },
        ].map((item) => (
          <Card key={item.title} className={cn('flex flex-col p-4')}>
            <div className="flex size-9 items-center justify-center rounded-xl bg-lavender-100 text-navy-800 dark:bg-lavender-400/15 dark:text-lavender-100">
              <item.icon className="size-4" aria-hidden />
            </div>
            <p className="mt-2 text-sm font-semibold text-ink">{item.title}</p>
            <p className="mt-0.5 flex-1 text-[11px] leading-relaxed text-muted">{item.description}</p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-3"
              onClick={item.action}
              aria-label={`Download ${item.title}`}
            >
              <Download className="size-3.5" aria-hidden /> Download
            </Button>
          </Card>
        ))}
      </div>

      <InlineAlert tone="info" title="Backup guidance">
        Download a JSON backup before clearing browser data or changing devices. Free-tier infrastructure has no
        guaranteed retention; keep your own encrypted copy of exports. Photographs are excluded from JSON backups
        and must be saved separately.
      </InlineAlert>
    </div>
  )
}

export default Reports
