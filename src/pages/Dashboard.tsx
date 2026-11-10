import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity,
  ArrowRight,
  CalendarDays,
  ChevronRight,
  ClipboardCheck,
  CircleCheck,
  Clock3,
  FlaskConical,
  NotebookPen,
  Pill,
  Sparkles,
  TriangleAlert,
} from 'lucide-react'
import { useData } from '@/data/DataProvider'
import { useToast } from '@/hooks/useToast'
import {
  activePlans,
  adherenceRate,
  changeFromBaseline,
  dailySeries,
  daysUntil,
  dosesForDay,
  latestAssessment,
  latestLabs,
  outstandingTasks,
  recentFlare,
  reportReadiness,
  upcomingAppointment,
} from '@/lib/analytics'
import { buildWeeklySummary, defaultRange } from '@/lib/reports/summary'
import { formatDate, formatDateTime, formatMinutes, formatRelative, formatTime, formatWeekday } from '@/lib/utils'
import { Badge, Button, Card, CardHeader, EmptyState, InlineAlert, Stat } from '@/components/ui'
import { TrendChart } from '@/components/charts/TrendChart'

const greeting = (): string => {
  const hour = new Date().getHours()
  if (hour < 5) return 'Still awake'
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

export const Dashboard = () => {
  const { state, store } = useData()
  const { toast } = useToast()
  const { data } = state
  const { profile } = data

  const todayDoses = useMemo(() => dosesForDay(data.doseEvents, profile.timezone), [data.doseEvents, profile.timezone])
  const plans = useMemo(() => activePlans(data.medicationPlans), [data.medicationPlans])
  const planById = useMemo(() => new Map(data.medicationPlans.map((plan) => [plan.id, plan])), [data.medicationPlans])
  const nextAppointment = useMemo(() => upcomingAppointment(data), [data])
  const tasks = useMemo(() => outstandingTasks(data), [data])
  const labs = useMemo(() => latestLabs(data.labResults).slice(0, 4), [data.labResults])
  const basdai = useMemo(() => latestAssessment(data.assessments, 'BASDAI'), [data.assessments])
  const basfi = useMemo(() => latestAssessment(data.assessments, 'BASFI'), [data.assessments])

  const week = useMemo(() => buildWeeklySummary(data, defaultRange(7)), [data])
  const pain = useMemo(() => changeFromBaseline(data, (entry) => entry.pain), [data])
  const stiffness7 = week.stiffness.mean
  const adherence = useMemo(() => adherenceRate(data.doseEvents, 7), [data.doseEvents])
  const flare = useMemo(() => recentFlare(data.symptomEntries), [data.symptomEntries])
  const readiness = useMemo(() => reportReadiness(data), [data])
  const gaps = readiness.items.filter((item) => !item.done)

  const chartData = useMemo(() => {
    const painSeries = dailySeries(data.symptomEntries, (entry) => entry.pain, 30)
    const fatigueSeries = dailySeries(data.symptomEntries, (entry) => entry.fatigue, 30)
    return painSeries.map((point, index) => ({
      day: point.day,
      pain: point.value,
      fatigue: fatigueSeries[index]?.value ?? null,
    }))
  }, [data.symptomEntries])

  const recentEntries = useMemo(
    () => [...data.symptomEntries].sort((a, b) => b.recordedAt.localeCompare(a.recordedAt)).slice(0, 3),
    [data.symptomEntries],
  )

  const recentSideEffects = useMemo(
    () =>
      [...data.symptomEntries]
        .filter((entry) => entry.sideEffects.trim().length > 0)
        .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))[0] ?? null,
    [data.symptomEntries],
  )

  const markDose = (id: string, status: 'taken' | 'skipped') => {
    store.recordDose(id, status)
    toast({
      title: status === 'taken' ? 'Dose recorded as taken' : 'Dose recorded as skipped',
      description: 'Only your recorded action is stored — reminders never mark a dose automatically.',
      variant: 'success',
    })
  }

  const todayLabel = new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: profile.timezone,
  }).format(new Date())

  const takenToday = todayDoses.filter((dose) => dose.status === 'taken').length

  return (
    <div className="space-y-5">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl bg-navy-900 p-5 text-white shadow-lift sm:p-7">
        <div className="surface-grid absolute inset-0 opacity-70" aria-hidden />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-teal-300">{todayLabel}</p>
            <h2 className="mt-2 font-display text-3xl leading-tight tracking-tight sm:text-4xl">
              {greeting()}, {profile.name.split(' ')[0]}.
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/70">
              {todayDoses.length > 0
                ? `${takenToday} of ${todayDoses.length} scheduled doses recorded today. Keep the record honest — skipped and uncertain doses matter too.`
                : 'No doses scheduled today. A quick check-in keeps your trend complete.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/health-journal">
              <Button variant="accent">
                <NotebookPen className="size-4" aria-hidden /> Quick check-in
              </Button>
            </Link>
            <Link to="/reports">
              <Button variant="secondary" className="border-white/20 bg-white/10 text-white hover:bg-white/15">
                Weekly summary <ArrowRight className="size-4" aria-hidden />
              </Button>
            </Link>
          </div>
        </div>

        <div className="relative mt-6 grid grid-cols-2 gap-4 border-t border-white/10 pt-4 sm:grid-cols-4">
          {[
            {
              label: 'Pain (7d avg)',
              value: week.pain.mean === null ? '—' : week.pain.mean.toFixed(1),
              suffix: '/10',
            },
            {
              label: 'Stiffness (7d)',
              value: stiffness7 === null ? '—' : formatMinutes(stiffness7),
              suffix: '',
            },
            {
              label: 'Adherence (7d)',
              value: adherence === null ? '—' : `${adherence}`,
              suffix: adherence === null ? '' : '%',
            },
            {
              label: 'Check-ins (7d)',
              value: `${week.checkIns}`,
              suffix: `/7`,
            },
          ].map((item) => (
            <div key={item.label}>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-white/45">{item.label}</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-white">
                {item.value}
                <span className="ml-0.5 text-[11px] font-medium text-white/50">{item.suffix}</span>
              </p>
            </div>
          ))}
        </div>
      </section>

      {recentSideEffects ? (
        <InlineAlert tone="warning" title={`Side effect reported ${formatRelative(recentSideEffects.recordedAt)}`}>
          “{recentSideEffects.sideEffects}” — If a side effect is severe, sudden, or worrying, contact your
          treating clinician or urgent care rather than waiting for a reminder.
        </InlineAlert>
      ) : null}

      {/* Record quality + a descriptive flare pattern, both from recorded data only. */}
      <Card className="p-4 sm:p-5">
        <div className="grid gap-5 sm:grid-cols-[auto_1fr]">
          <div className="min-w-40">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
              <ClipboardCheck className="size-3.5" aria-hidden /> Consultation readiness
            </p>
            <p className="mt-1 font-display text-3xl font-bold tracking-tight text-ink">
              {readiness.percent}%
            </p>
            <div
              className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-navy-900/10 dark:bg-white/15"
              role="progressbar"
              aria-valuenow={readiness.percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Report readiness checklist"
            >
              <div
                className="h-full rounded-full bg-teal-500 transition-all"
                style={{ width: `${readiness.percent}%` }}
              />
            </div>
            <Link
              to="/reports"
              className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-teal-700 dark:text-teal-300"
            >
              Open exports <ArrowRight className="size-3" aria-hidden />
            </Link>
          </div>

          <div className="space-y-2">
            <p className="flex flex-wrap items-center gap-2 text-xs text-muted">
              <Activity className="size-3.5 shrink-0" aria-hidden />
              {flare ? (
                <>
                  <Badge tone="amber">
                    Pain ≥7 for {flare.days} day{flare.days === 1 ? '' : 's'}
                  </Badge>
                  <span>
                    {formatDate(flare.start)} – {formatDate(flare.end)} · peak {flare.peak}/10. A descriptive
                    pattern in your own record, not a diagnosis.
                  </span>
                </>
              ) : (
                <span>No run of high-pain days recorded. Gaps are left as gaps, never estimated.</span>
              )}
            </p>
            {gaps.length > 0 ? (
              <ul className="flex flex-wrap gap-1.5">
                {gaps.map((item) => (
                  <li key={item.key}>
                    <span className="inline-flex rounded-full bg-amber-400/15 px-2.5 py-1 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                      {item.label} — {item.detail}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[11px] font-medium text-teal-700 dark:text-teal-300">
                Checklist complete for a routine consultation. This is not a statement of clinical completeness.
              </p>
            )}
          </div>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Today's medications */}
        <Card className="p-4 sm:p-5 lg:col-span-2">
          <CardHeader
            title="Today's medication schedule"
            subtitle="Marking a dose is a manual record. A reminder is not proof a dose was taken."
            action={
              <Link to="/medications" className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 dark:text-teal-300">
                Manage <ChevronRight className="size-3.5" aria-hidden />
              </Link>
            }
          />

          <div className="mt-4 space-y-2">
            {todayDoses.length === 0 ? (
              <EmptyState
                icon={<Pill className="size-5" aria-hidden />}
                title="No doses scheduled today"
                description="Add a prescribed plan to see today's schedule. Plans must come from your clinician."
                action={
                  <Link to="/medications">
                    <Button variant="secondary" size="sm">
                      Add a prescribed plan
                    </Button>
                  </Link>
                }
              />
            ) : (
              todayDoses.map((dose) => {
                const plan = planById.get(dose.planId)
                const isPending = dose.status === 'pending'
                return (
                  <div
                    key={dose.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-navy-900/10 px-3 py-2.5 dark:border-white/10"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-200">
                        <Pill className="size-4" aria-hidden />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink">
                          {plan?.name ?? 'Medication'} <span className="font-normal text-muted">· {plan?.dose}</span>
                        </p>
                        <p className="text-[11px] text-muted">
                          {formatTime(dose.scheduledFor, profile.timezone)} · {plan?.route}
                        </p>
                      </div>
                    </div>

                    {isPending ? (
                      <div className="flex gap-1.5">
                        <Button size="sm" onClick={() => markDose(dose.id, 'taken')}>
                          <CircleCheck className="size-3.5" aria-hidden /> Taken
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => markDose(dose.id, 'skipped')}>
                          Skip
                        </Button>
                      </div>
                    ) : (
                      <Badge
                        tone={dose.status === 'taken' ? 'teal' : dose.status === 'skipped' ? 'amber' : 'neutral'}
                      >
                        {dose.status}
                      </Badge>
                    )}
                  </div>
                )
              })
            )}
          </div>

          {plans.length > 0 ? (
            <p className="mt-3 text-[11px] leading-relaxed text-muted">
              Active demo plans: {plans.map((plan) => plan.name).join(', ')}. Never start, stop or change a
              prescribed medicine based on this app.
            </p>
          ) : null}
        </Card>

        {/* Next appointment */}
        <Card className="flex flex-col p-4 sm:p-5">
          <CardHeader
            title="Next appointment"
            subtitle={nextAppointment ? `${formatWeekday(nextAppointment.startsAt, profile.timezone)} · ${formatTime(nextAppointment.startsAt, profile.timezone)}` : 'Nothing scheduled'}
            action={<CalendarDays className="size-4 text-muted" aria-hidden />}
          />
          {nextAppointment ? (
            <div className="mt-4 flex-1">
              <p className="text-4xl font-bold tracking-tight text-ink">
                {Math.max(0, daysUntil(nextAppointment.startsAt))}
                <span className="ml-1 text-sm font-medium text-muted">days</span>
              </p>
              <p className="mt-1 text-xs text-muted">
                {formatDate(nextAppointment.startsAt, profile.timezone)} · {nextAppointment.clinician}
              </p>
              {nextAppointment.location ? (
                <p className="mt-0.5 text-xs text-muted">{nextAppointment.location}</p>
              ) : null}

              <ul className="mt-3 space-y-1.5">
                {nextAppointment.tasks.map((task) => (
                  <li key={task.id}>
                    <button
                      type="button"
                      onClick={() => store.toggleAppointmentTask(nextAppointment.id, task.id)}
                      className="flex w-full items-center gap-2 rounded-lg px-1 py-1 text-left text-xs text-ink hover:bg-navy-900/5 dark:hover:bg-white/10"
                    >
                      <span
                        className={`flex size-4 items-center justify-center rounded border ${
                          task.done
                            ? 'border-teal-500 bg-teal-500 text-white'
                            : 'border-navy-900/25 dark:border-white/25'
                        }`}
                        aria-hidden
                      >
                        {task.done ? '✓' : ''}
                      </span>
                      <span className={task.done ? 'text-muted line-through' : ''}>{task.label}</span>
                    </button>
                  </li>
                ))}
                {nextAppointment.tasks.length === 0 ? (
                  <li className="text-xs text-muted">No preparation tasks yet.</li>
                ) : null}
              </ul>
            </div>
          ) : (
            <div className="mt-4 flex-1">
              <EmptyState
                icon={<CalendarDays className="size-5" aria-hidden />}
                title="No upcoming visit"
                description="Schedule a visit to track preparation and follow-up tasks."
                action={
                  <Link to="/appointments">
                    <Button variant="secondary" size="sm">
                      Add appointment
                    </Button>
                  </Link>
                }
              />
            </div>
          )}
          <Link
            to="/appointments"
            className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-teal-700 dark:text-teal-300"
          >
            Open calendar <ChevronRight className="size-3.5" aria-hidden />
          </Link>
        </Card>
      </div>

      {/* Scores and trend */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-4 sm:p-5">
          <CardHeader title="Latest scores" subtitle="Calculated from your recorded answers" />
          <div className="mt-4 grid grid-cols-2 gap-4">
            <Stat
              label="BASDAI"
              value={basdai ? basdai.score.toFixed(1) : '—'}
              unit="/10"
              hint={basdai ? formatDate(basdai.assessedAt) : 'Not completed'}
              tone="teal"
            />
            <Stat
              label="BASFI"
              value={basfi ? basfi.score.toFixed(1) : '—'}
              unit="/10"
              hint={basfi ? formatDate(basfi.assessedAt) : 'Not completed'}
            />
          </div>
          <div className="mt-4 rounded-xl bg-navy-900/5 p-3 text-[11px] leading-relaxed text-muted dark:bg-white/5">
            A lower score can mean fewer symptoms, but a score is not a diagnosis and cannot show that a
            treatment caused a change.
          </div>
          <Link
            to="/measurements"
            className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-teal-700 dark:text-teal-300"
          >
            Complete a questionnaire <ChevronRight className="size-3.5" aria-hidden />
          </Link>
        </Card>

        <Card className="p-4 sm:p-5 lg:col-span-2">
          <CardHeader
            title="Pain & fatigue — last 30 days"
            subtitle="Gaps remain gaps; missing days are never filled with invented values."
            action={
              <Badge tone={pain.change !== null && pain.change < 0 ? 'teal' : 'neutral'}>
                {pain.change === null ? 'No baseline' : `${pain.change > 0 ? '+' : ''}${pain.change}% vs baseline`}
              </Badge>
            }
          />
          <div className="mt-3">
            <TrendChart
              title="Pain and fatigue trend"
              description="Daily pain and fatigue scores from recorded check-ins."
              data={chartData}
              xKey="day"
              domain={[0, 10]}
              series={[
                { key: 'pain', label: 'Pain', color: '#2f9d89' },
                { key: 'fatigue', label: 'Fatigue', color: '#a98ff2', dashed: true },
              ]}
            />
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Labs */}
        <Card className="p-4 sm:p-5">
          <CardHeader
            title="Latest laboratory results"
            subtitle="Reference ranges are shown exactly as reported"
            action={
              <Link to="/laboratory" className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 dark:text-teal-300">
                All results <ChevronRight className="size-3.5" aria-hidden />
              </Link>
            }
          />
          <div className="mt-4 space-y-2">
            {labs.length === 0 ? (
              <EmptyState
                icon={<FlaskConical className="size-5" aria-hidden />}
                title="No laboratory results yet"
                description="Add a result with its original unit and the laboratory's reference interval."
                action={
                  <Link to="/laboratory">
                    <Button variant="secondary" size="sm">
                      Add first result
                    </Button>
                  </Link>
                }
              />
            ) : (
              labs.map((lab) => {
                const numeric = typeof lab.value === 'number' ? lab.value : Number(lab.value)
                const out = Number.isFinite(numeric)
                  ? (lab.referenceLow !== undefined && numeric < lab.referenceLow) ||
                    (lab.referenceHigh !== undefined && numeric > lab.referenceHigh)
                  : false
                return (
                  <div
                    key={lab.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-navy-900/10 px-3 py-2.5 dark:border-white/10"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{lab.testName}</p>
                      <p className="text-[11px] text-muted">
                        {formatDate(lab.collectedAt)} · {lab.laboratory ?? 'Laboratory not recorded'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold tabular-nums text-ink">
                        {lab.value} <span className="text-[10px] font-medium text-muted">{lab.unit}</span>
                      </p>
                      <Badge tone={out ? 'amber' : 'teal'}>{out ? 'Needs interpretation' : 'In reported range'}</Badge>
                    </div>
                  </div>
                )
              })
            )}
          </div>
          {labs.some((lab) => {
            const numeric = typeof lab.value === 'number' ? lab.value : Number(lab.value)
            return (
              (lab.referenceLow !== undefined && numeric < lab.referenceLow) ||
              (lab.referenceHigh !== undefined && numeric > lab.referenceHigh)
            )
          }) ? (
            <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-amber-600 dark:text-amber-400">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              A result outside the laboratory interval needs clinical interpretation — it is not an automatic
              diagnosis.
            </p>
          ) : null}
        </Card>

        {/* Recent check-ins + timeline */}
        <div className="space-y-4">
          <Card className="p-4 sm:p-5">
            <CardHeader
              title="Recent check-ins"
              subtitle={recentEntries.length ? `Latest ${formatRelative(recentEntries[0].recordedAt)}` : 'No entries yet'}
              action={
                <Link to="/health-journal" className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 dark:text-teal-300">
                  Check in <ChevronRight className="size-3.5" aria-hidden />
                </Link>
              }
            />
            <div className="mt-3 space-y-2">
              {recentEntries.length === 0 ? (
                <EmptyState
                  icon={<NotebookPen className="size-5" aria-hidden />}
                  title="Your journal is empty"
                  description="A 30-second check-in builds the baseline your clinician needs."
                  action={
                    <Link to="/health-journal">
                      <Button size="sm">Start check-in</Button>
                    </Link>
                  }
                />
              ) : (
                recentEntries.map((entry) => (
                  <div key={entry.id} className="flex items-start justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium text-ink">
                        Pain {entry.pain ?? '—'}/10 · Stiffness {formatMinutes(entry.stiffnessMinutes)}
                      </p>
                      <p className="truncate text-[11px] text-muted">
                        {entry.notes || 'No note added'}
                      </p>
                    </div>
                    <span className="shrink-0 text-[11px] text-muted">{formatDate(entry.recordedAt)}</span>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card className="p-4 sm:p-5">
            <CardHeader title="Treatment timeline" subtitle="Facts you recorded, in order" />
            <ol className="mt-4 space-y-3">
              {[
                {
                  label: 'Baseline assessment',
                  date: profile.baselineDate,
                  note: 'Pretreatment reference point',
                },
                {
                  label: 'Treatment started',
                  date: profile.treatmentStartedOn,
                  note: 'Clinician-documented start date',
                },
                {
                  label: 'Latest BASDAI',
                  date: basdai?.assessedAt,
                  note: basdai ? `Score ${basdai.score}/10` : 'Not recorded',
                },
                {
                  label: 'Next visit',
                  date: nextAppointment?.startsAt,
                  note: nextAppointment?.clinician ?? 'Not scheduled',
                },
              ].map((item) => (
                <li key={item.label} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span className="mt-1 size-2 rounded-full bg-teal-500" aria-hidden />
                    <span className="mt-1 w-px flex-1 bg-navy-900/10 dark:bg-white/10" aria-hidden />
                  </div>
                  <div className="pb-1">
                    <p className="text-xs font-semibold text-ink">{item.label}</p>
                    <p className="text-[11px] text-muted">
                      {item.date ? formatDateTime(item.date) : 'Not recorded'} · {item.note}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>

      {/* Weekly + tasks */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4 sm:p-5">
          <CardHeader
            title="This week at a glance"
            subtitle="Only recorded data is summarised"
            action={<Sparkles className="size-4 text-lavender-400" aria-hidden />}
          />
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Check-ins" value={week.checkIns} unit="/7" />
            <Stat label="Pain avg" value={week.pain.mean ?? '—'} unit="/10" tone="teal" />
            <Stat label="Doses taken" value={week.adherence.taken} hint={`${week.adherence.notRecorded} not recorded`} />
            <Stat label="New labs" value={week.newLabs.length} hint="This period" />
          </div>
          {week.missingDataWarnings.length > 0 ? (
            <ul className="mt-4 space-y-1 text-[11px] leading-relaxed text-muted">
              {week.missingDataWarnings.slice(0, 2).map((warning) => (
                <li key={warning} className="flex items-start gap-1.5">
                  <span className="mt-1.5 size-1 shrink-0 rounded-full bg-amber-500" aria-hidden />
                  {warning}
                </li>
              ))}
            </ul>
          ) : null}
          <Link
            to="/reports"
            className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-teal-700 dark:text-teal-300"
          >
            Generate a consultation report <ChevronRight className="size-3.5" aria-hidden />
          </Link>
        </Card>

        <Card className="p-4 sm:p-5">
          <CardHeader
            title="Outstanding follow-up"
            subtitle={tasks.length ? `${tasks.length} open task${tasks.length === 1 ? '' : 's'}` : 'Nothing outstanding'}
            action={<Clock3 className="size-4 text-muted" aria-hidden />}
          />
          <div className="mt-3">
            {tasks.length === 0 ? (
              <p className="rounded-xl bg-navy-900/5 p-3 text-xs leading-relaxed text-muted dark:bg-white/5">
                Follow-up tasks from your visits will appear here. You are all caught up.
              </p>
            ) : (
              <ul className="space-y-2">
                {tasks.slice(0, 4).map((task) => (
                  <li key={`${task.appointment.id}-${task.id}`}>
                    <button
                      type="button"
                      onClick={() => store.toggleAppointmentTask(task.appointment.id, task.id)}
                      className="flex w-full items-center justify-between gap-3 rounded-xl border border-navy-900/10 px-3 py-2 text-left text-xs transition hover:bg-navy-900/5 dark:border-white/10 dark:hover:bg-white/10"
                    >
                      <span className="text-ink">{task.label}</span>
                      <span className="shrink-0 text-[10px] text-muted">
                        {formatDate(task.appointment.startsAt)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}

export default Dashboard
