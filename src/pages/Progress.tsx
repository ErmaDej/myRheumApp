import { useMemo, useState } from 'react'
import { Activity, GitCompareArrows, Info, TrendingDown, TrendingUp } from 'lucide-react'
import { useData } from '@/data/DataProvider'
import {
  assessmentTrend,
  changeFromBaseline,
  dailySeries,
  labSeries,
  latestLabs,
} from '@/lib/analytics'
import { buildWeeklySummary, defaultRange } from '@/lib/reports/summary'
import { Badge, Card, CardHeader, InlineAlert, SectionHeader, SegmentedControl, Stat } from '@/components/ui'
import { TrendChart } from '@/components/charts/TrendChart'
import { cn, formatDate, formatMinutes } from '@/lib/utils'

type Period = '30' | '90' | '365'

type TimelineKind = 'baseline' | 'treatment' | 'assessment' | 'lab' | 'visit' | 'document'

interface TimelineItem {
  id: string
  at: string
  kind: TimelineKind
  title: string
  detail: string
}

const kindLabel: Record<TimelineKind, string> = {
  baseline: 'Baseline',
  treatment: 'Treatment',
  assessment: 'Assessment',
  lab: 'Laboratory',
  visit: 'Visit',
  document: 'Document',
}

const kindTone: Record<TimelineKind, 'teal' | 'lavender' | 'amber' | 'neutral'> = {
  baseline: 'lavender',
  treatment: 'teal',
  assessment: 'teal',
  lab: 'amber',
  visit: 'lavender',
  document: 'neutral',
}

export const Progress = () => {
  const { state } = useData()
  const { data } = state
  const [period, setPeriod] = useState<Period>('90')
  const [filters, setFilters] = useState<Set<TimelineKind>>(new Set(Object.keys(kindLabel) as TimelineKind[]))

  const days = Number(period)

  const pain = useMemo(() => dailySeries(data.symptomEntries, (entry) => entry.pain, days), [data.symptomEntries, days])
  const stiffness = useMemo(
    () => dailySeries(data.symptomEntries, (entry) => entry.stiffnessMinutes, days),
    [data.symptomEntries, days],
  )
  const fatigue = useMemo(() => dailySeries(data.symptomEntries, (entry) => entry.fatigue, days), [data.symptomEntries, days])
  const functionSeries = useMemo(
    () => dailySeries(data.symptomEntries, (entry) => entry.functionalDifficulty, days),
    [data.symptomEntries, days],
  )
  const sleep = useMemo(() => dailySeries(data.symptomEntries, (entry) => entry.sleepQuality, days), [data.symptomEntries, days])

  const comparisons = useMemo(
    () => [
      { key: 'pain', label: 'Pain', unit: '/10', ...changeFromBaseline(data, (entry) => entry.pain) },
      {
        key: 'stiffness',
        label: 'Morning stiffness',
        unit: 'min',
        ...changeFromBaseline(data, (entry) => entry.stiffnessMinutes),
      },
      { key: 'fatigue', label: 'Fatigue', unit: '/10', ...changeFromBaseline(data, (entry) => entry.fatigue) },
      {
        key: 'function',
        label: 'Functional difficulty',
        unit: '/10',
        ...changeFromBaseline(data, (entry) => entry.functionalDifficulty),
      },
      { key: 'sleep', label: 'Sleep quality', unit: '/10', ...changeFromBaseline(data, (entry) => entry.sleepQuality) },
    ],
    [data],
  )

  const basdai = useMemo(() => assessmentTrend(data.assessments, 'BASDAI'), [data.assessments])
  const basfi = useMemo(() => assessmentTrend(data.assessments, 'BASFI'), [data.assessments])
  const scoreChart = useMemo(() => {
    const byDate = new Map<string, { day: string; basdai: number | null; basfi: number | null }>()
    basdai.forEach((point) =>
      byDate.set(point.assessedAt, { day: point.assessedAt, basdai: point.score, basfi: byDate.get(point.assessedAt)?.basfi ?? null }),
    )
    basfi.forEach((point) => {
      const existing = byDate.get(point.assessedAt)
      byDate.set(point.assessedAt, { day: point.assessedAt, basdai: existing?.basdai ?? null, basfi: point.score })
    })
    return [...byDate.values()].sort((a, b) => a.day.localeCompare(b.day))
  }, [basdai, basfi])

  const tests = useMemo(() => latestLabs(data.labResults).slice(0, 3), [data.labResults])

  const week = useMemo(() => buildWeeklySummary(data, defaultRange(days)), [data, days])

  const timeline = useMemo<TimelineItem[]>(() => {
    const items: TimelineItem[] = []
    if (data.profile.baselineDate) {
      items.push({
        id: 'baseline',
        at: data.profile.baselineDate,
        kind: 'baseline',
        title: 'Baseline assessment',
        detail: 'Pretreatment reference point recorded by the patient.',
      })
    }
    if (data.profile.treatmentStartedOn) {
      items.push({
        id: 'treatment',
        at: data.profile.treatmentStartedOn,
        kind: 'treatment',
        title: 'Treatment started',
        detail: 'Clinician-documented start date.',
      })
    }
    data.assessments
      .filter((assessment) => assessment.instrument !== 'ASDAS')
      .forEach((assessment) =>
        items.push({
          id: `assess-${assessment.id}`,
          at: assessment.assessedAt,
          kind: 'assessment',
          title: `${assessment.instrument} ${assessment.score.toFixed(1)}/10`,
          detail: `${assessment.algorithmVersion} · patient-completed`,
        }),
      )
    data.labResults
      .slice()
      .sort((a, b) => b.collectedAt.localeCompare(a.collectedAt))
      .slice(0, 10)
      .forEach((lab) =>
        items.push({
          id: `lab-${lab.id}`,
          at: lab.collectedAt,
          kind: 'lab',
          title: `${lab.testName} ${lab.value} ${lab.unit}`,
          detail: lab.referenceText ? `Reference ${lab.referenceText}` : 'No reference interval recorded',
        }),
      )
    data.appointments
      .filter((appointment) => appointment.status === 'completed')
      .forEach((appointment) =>
        items.push({
          id: `visit-${appointment.id}`,
          at: appointment.startsAt,
          kind: 'visit',
          title: `Visit with ${appointment.clinician ?? 'clinician'}`,
          detail: appointment.notes ?? 'No visit summary recorded.',
        }),
      )
    data.documents.forEach((document) =>
      items.push({
        id: `doc-${document.id}`,
        at: document.occurredOn,
        kind: 'document',
        title: document.title,
        detail: `${document.category} · ${document.source}`,
      }),
    )
    return items
      .filter((item) => filters.has(item.kind))
      .sort((a, b) => b.at.localeCompare(a.at))
  }, [data, filters])

  const toggleFilter = (kind: TimelineKind) => {
    setFilters((prev) => {
      const next = new Set(prev)
      if (next.has(kind)) next.delete(kind)
      else next.add(kind)
      return next
    })
  }

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Progress & trends"
        description="Symptom relief, function, inflammatory markers and imaging are different dimensions. They are shown separately, never collapsed into one invented score."
        action={
          <SegmentedControl
            label="Period"
            value={period}
            onChange={(value) => setPeriod(value as Period)}
            options={[
              { value: '30', label: '30 days' },
              { value: '90', label: '90 days' },
              { value: '365', label: '1 year' },
            ]}
          />
        }
      />

      {/* Baseline comparison */}
      <Card className="p-4 sm:p-5">
        <CardHeader
          title="Pretreatment baseline vs recent 14 days"
          subtitle={`Baseline period is taken from your recorded baseline date (${data.profile.baselineDate ? formatDate(data.profile.baselineDate) : 'not set'}).`}
          action={<GitCompareArrows className="size-4 text-muted" aria-hidden />}
        />
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {comparisons.map((item) => {
            const improved = item.change !== null && item.change < 0
            const worsened = item.change !== null && item.change > 0
            return (
              <div key={item.key} className="rounded-xl border border-navy-900/10 p-3 dark:border-white/10">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{item.label}</p>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <p className="text-xl font-bold tabular-nums text-ink">
                    {item.recent === null ? '—' : item.recent}
                  </p>
                  <span className="text-[10px] text-muted">{item.unit}</span>
                  {item.change !== null ? (
                    <span
                      className={cn(
                        'ml-auto inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold',
                        improved && 'bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-200',
                        worsened && 'bg-amber-400/20 text-amber-700 dark:text-amber-300',
                        !improved && !worsened && 'bg-navy-900/8 text-muted dark:bg-white/10',
                      )}
                    >
                      {improved ? <TrendingDown className="size-3" aria-hidden /> : null}
                      {worsened ? <TrendingUp className="size-3" aria-hidden /> : null}
                      {item.change > 0 ? '+' : ''}
                      {item.change}%
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-[10px] text-muted">
                  Baseline {item.baseline === null ? '—' : item.baseline} {item.unit}
                </p>
              </div>
            )
          })}
        </div>
        <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-muted">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          These are associations over time. A change after starting treatment does not prove the treatment caused
          it, and this page is not a treatment recommendation.
        </p>
      </Card>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4 sm:p-5">
          <CardHeader title="Pain" subtitle={`Daily values, last ${days} days`} />
          <div className="mt-3">
            <TrendChart
              title="Pain trend"
              data={pain}
              xKey="day"
              domain={[0, 10]}
              unit="/10"
              series={[{ key: 'value', label: 'Pain', color: '#2f9d89' }]}
            />
          </div>
        </Card>
        <Card className="p-4 sm:p-5">
          <CardHeader title="Morning stiffness" subtitle="Minutes" />
          <div className="mt-3">
            <TrendChart
              title="Morning stiffness trend"
              data={stiffness}
              xKey="day"
              unit=" min"
              series={[{ key: 'value', label: 'Stiffness', color: '#a98ff2' }]}
            />
          </div>
        </Card>
        <Card className="p-4 sm:p-5">
          <CardHeader title="Fatigue & sleep" subtitle="Two separate 0–10 scales" />
          <div className="mt-3">
            <TrendChart
              title="Fatigue and sleep trend"
              data={fatigue.map((point, index) => ({
                day: point.day,
                fatigue: point.value,
                sleep: sleep[index]?.value ?? null,
              }))}
              xKey="day"
              domain={[0, 10]}
              unit="/10"
              series={[
                { key: 'fatigue', label: 'Fatigue', color: '#f5a623' },
                { key: 'sleep', label: 'Sleep', color: '#2f9d89', dashed: true },
              ]}
            />
          </div>
        </Card>
        <Card className="p-4 sm:p-5">
          <CardHeader title="Functional difficulty" subtitle="Patient-reported daily function" />
          <div className="mt-3">
            <TrendChart
              title="Functional difficulty trend"
              data={functionSeries}
              xKey="day"
              domain={[0, 10]}
              unit="/10"
              series={[{ key: 'value', label: 'Functional difficulty', color: '#f5a623' }]}
            />
          </div>
        </Card>
      </div>

      {/* Scores */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4 sm:p-5">
          <CardHeader title="BASDAI & BASFI" subtitle="Only recorded and calculated assessments" />
          <div className="mt-3">
            <TrendChart
              title="Questionnaire score history"
              data={scoreChart}
              xKey="day"
              domain={[0, 10]}
              height={220}
              series={[
                { key: 'basdai', label: 'BASDAI', color: '#2f9d89' },
                { key: 'basfi', label: 'BASFI', color: '#a98ff2', dashed: true },
              ]}
            />
          </div>
        </Card>

        <Card className="p-4 sm:p-5">
          <CardHeader
            title="Laboratory markers"
            subtitle="Separate charts — units are never combined"
            action={<Activity className="size-4 text-muted" aria-hidden />}
          />
          <div className="mt-3 space-y-4">
            {tests.length === 0 ? (
              <p className="rounded-xl bg-navy-900/5 p-3 text-xs text-muted dark:bg-white/5">
                No laboratory results recorded yet.
              </p>
            ) : (
              tests.map((test) => {
                const series = labSeries(data.labResults, test.testName).map((lab) => ({
                  day: lab.collectedAt,
                  value: typeof lab.value === 'number' ? lab.value : Number(lab.value),
                }))
                return (
                  <div key={test.testName}>
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-ink">{test.testName}</p>
                      <Badge tone="neutral">{test.unit}</Badge>
                    </div>
                    <TrendChart
                      title={`${test.testName} trend`}
                      data={series}
                      xKey="day"
                      height={140}
                      series={[{ key: 'value', label: test.testName, color: '#2f9d89' }]}
                    />
                  </div>
                )
              })
            )}
          </div>
        </Card>
      </div>

      {/* Data completeness */}
      <Card className="p-4 sm:p-5">
        <CardHeader title="Data completeness" subtitle="Honest sample counts and gaps" />
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Check-ins" value={week.checkIns} hint={`${week.daysInRange} days in period`} />
          <Stat label="Missing days" value={week.missingDays} tone="amber" hint="Shown as gaps" />
          <Stat label="Pain samples" value={week.pain.samples} hint="Recorded values" />
          <Stat
            label="Stiffness mean"
            value={week.stiffness.mean === null ? '—' : formatMinutes(week.stiffness.mean)}
            hint={`n=${week.stiffness.samples}`}
          />
        </div>
        {week.missingDataWarnings.length > 0 ? (
          <ul className="mt-3 space-y-1 text-[11px] leading-relaxed text-muted">
            {week.missingDataWarnings.map((warning) => (
              <li key={warning}>• {warning}</li>
            ))}
          </ul>
        ) : null}
      </Card>

      {/* Timeline */}
      <Card className="p-4 sm:p-5">
        <CardHeader
          title="Treatment timeline"
          subtitle="Filter events to tell the story you need for a consultation"
          action={<Badge tone="lavender">{timeline.length} events</Badge>}
        />
        <div className="mt-3 flex flex-wrap gap-1.5">
          {(Object.keys(kindLabel) as TimelineKind[]).map((kind) => {
            const active = filters.has(kind)
            return (
              <button
                key={kind}
                type="button"
                aria-pressed={active}
                onClick={() => toggleFilter(kind)}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-[11px] font-semibold transition',
                  active
                    ? 'border-teal-500 bg-teal-100 text-teal-800 dark:bg-teal-500/15 dark:text-teal-200'
                    : 'border-navy-900/15 text-muted dark:border-white/15',
                )}
              >
                {kindLabel[kind]}
              </button>
            )
          })}
        </div>

        <ol className="mt-4 space-y-3">
          {timeline.length === 0 ? (
            <li className="rounded-xl bg-navy-900/5 p-3 text-xs text-muted dark:bg-white/5">
              No events match these filters.
            </li>
          ) : (
            timeline.slice(0, 40).map((item) => (
              <li key={item.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span className="mt-1.5 size-2 rounded-full bg-teal-500" aria-hidden />
                  <span className="mt-1 w-px flex-1 bg-navy-900/10 dark:bg-white/10" aria-hidden />
                </div>
                <div className="pb-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="text-xs font-semibold text-ink">{item.title}</p>
                    <Badge tone={kindTone[item.kind]}>{kindLabel[item.kind]}</Badge>
                  </div>
                  <p className="text-[11px] text-muted">
                    {formatDate(item.at)} · {item.detail}
                  </p>
                </div>
              </li>
            ))
          )}
        </ol>
      </Card>

      <InlineAlert tone="info">
        Structural imaging findings and inflammatory markers are not interchangeable. The app never infers spinal
        fusion, inflammation, or structural reversal from symptoms or photographs.
      </InlineAlert>
    </div>
  )
}

export default Progress
