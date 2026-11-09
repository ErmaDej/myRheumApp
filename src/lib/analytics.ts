import type {
  AppData,
  DoseEvent,
  LabResult,
  MedicationPlan,
  QuestionnaireAssessment,
  SymptomEntry,
} from '@/data/types'
import { mean, percentChange, round } from '@/lib/utils'

export const dateKeyInZone = (iso: string, timezone: string): string => {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date(iso))
  } catch {
    return new Date(iso).toISOString().slice(0, 10)
  }
}

export const todayKey = (timezone: string): string => dateKeyInZone(new Date().toISOString(), timezone)

export const dosesForDay = (
  doseEvents: DoseEvent[],
  timezone: string,
  dayKey = todayKey(timezone),
): DoseEvent[] =>
  doseEvents
    .filter((event) => dateKeyInZone(event.scheduledFor, timezone) === dayKey)
    .sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor))

export const latestByPlan = (doseEvents: DoseEvent[], timezone: string) => {
  const map = new Map<string, DoseEvent>()
  for (const event of [...doseEvents].sort((a, b) => b.scheduledFor.localeCompare(a.scheduledFor))) {
    if (!map.has(event.planId) && dateKeyInZone(event.scheduledFor, timezone) <= todayKey(timezone)) {
      map.set(event.planId, event)
    }
  }
  return map
}

export const activePlans = (plans: MedicationPlan[]): MedicationPlan[] =>
  plans.filter((plan) => plan.status === 'active')

export const latestLabs = (labs: LabResult[]): LabResult[] => {
  const map = new Map<string, LabResult>()
  for (const lab of [...labs].sort((a, b) => b.collectedAt.localeCompare(a.collectedAt))) {
    if (!map.has(lab.testName)) map.set(lab.testName, lab)
  }
  return [...map.values()].sort((a, b) => a.testName.localeCompare(b.testName))
}

export const labSeries = (labs: LabResult[], testName: string): LabResult[] =>
  labs
    .filter((lab) => lab.testName === testName && typeof lab.value === 'number')
    .sort((a, b) => a.collectedAt.localeCompare(b.collectedAt))

export const isOutOfRange = (lab: LabResult): boolean => {
  const value = typeof lab.value === 'number' ? lab.value : Number(lab.value)
  if (Number.isNaN(value)) return false
  if (lab.referenceLow !== undefined && value < lab.referenceLow) return true
  if (lab.referenceHigh !== undefined && value > lab.referenceHigh) return true
  return false
}

export const latestAssessment = (
  assessments: QuestionnaireAssessment[],
  instrument: QuestionnaireAssessment['instrument'],
): QuestionnaireAssessment | null =>
  assessments
    .filter((assessment) => assessment.instrument === instrument)
    .sort((a, b) => b.assessedAt.localeCompare(a.assessedAt))[0] ?? null

export const assessmentTrend = (
  assessments: QuestionnaireAssessment[],
  instrument: QuestionnaireAssessment['instrument'],
): Array<{ assessedAt: string; score: number }> =>
  assessments
    .filter((assessment) => assessment.instrument === instrument)
    .sort((a, b) => a.assessedAt.localeCompare(b.assessedAt))
    .map((assessment) => ({ assessedAt: assessment.assessedAt, score: assessment.score }))

export interface DailyPoint {
  day: string
  value: number | null
}

/**
 * Build a day-by-day series with explicit nulls for missing days so charts
 * show gaps instead of interpolating invented values.
 */
export const dailySeries = (
  entries: SymptomEntry[],
  pick: (entry: SymptomEntry) => number | null,
  days: number,
  end = new Date(),
): DailyPoint[] => {
  const byDay = new Map<string, number[]>()
  for (const entry of entries) {
    const value = pick(entry)
    if (value === null || Number.isNaN(value)) continue
    const key = entry.recordedAt.slice(0, 10)
    const list = byDay.get(key) ?? []
    list.push(value)
    byDay.set(key, list)
  }

  const points: DailyPoint[] = []
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(end)
    date.setDate(date.getDate() - offset)
    const key = date.toISOString().slice(0, 10)
    const values = byDay.get(key)
    points.push({ day: key, value: values && values.length ? round(mean(values)!, 1) : null })
  }
  return points
}

export const periodMean = (
  entries: SymptomEntry[],
  pick: (entry: SymptomEntry) => number | null,
  days: number,
): number | null => {
  const cutoff = Date.now() - days * 86_400_000
  const values = entries
    .filter((entry) => new Date(entry.recordedAt).getTime() >= cutoff)
    .map(pick)
    .filter((value): value is number => value !== null && !Number.isNaN(value))
  return values.length ? round(mean(values)!, 1) : null
}

export const adherenceRate = (doseEvents: DoseEvent[], days: number): number | null => {
  const cutoff = Date.now() - days * 86_400_000
  const recent = doseEvents.filter(
    (event) => new Date(event.scheduledFor).getTime() >= cutoff && event.status !== 'pending',
  )
  if (recent.length === 0) return null
  const taken = recent.filter((event) => event.status === 'taken').length
  return round((taken / recent.length) * 100, 0)
}

export const changeFromBaseline = (
  data: AppData,
  pick: (entry: SymptomEntry) => number | null,
  recentDays = 14,
  baselineDays = 30,
): { baseline: number | null; recent: number | null; change: number | null } => {
  const baselineStart = data.profile.baselineDate
    ? new Date(data.profile.baselineDate).getTime()
    : Date.now() - 120 * 86_400_000
  const baselineValues = data.symptomEntries
    .filter((entry) => {
      const t = new Date(entry.recordedAt).getTime()
      return t >= baselineStart && t < baselineStart + baselineDays * 86_400_000
    })
    .map(pick)
    .filter((value): value is number => value !== null && !Number.isNaN(value))

  const recent = periodMean(data.symptomEntries, pick, recentDays)
  const baseline = baselineValues.length ? round(mean(baselineValues)!, 1) : null
  return {
    baseline,
    recent,
    change: baseline !== null && recent !== null ? round(percentChange(baseline, recent)!, 0) : null,
  }
}

export const outstandingTasks = (data: AppData) =>
  data.appointments
    .filter((appointment) => appointment.status === 'scheduled')
    .flatMap((appointment) =>
      appointment.tasks
        .filter((task) => !task.done)
        .map((task) => ({ ...task, appointment })),
    )

export const upcomingAppointment = (data: AppData) =>
  data.appointments
    .filter(
      (appointment) =>
        appointment.status === 'scheduled' &&
        new Date(appointment.startsAt).getTime() >= Date.now() - 3_600_000,
    )
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0] ?? null

export const daysUntil = (iso: string): number => {
  const diff = new Date(iso).getTime() - Date.now()
  return Math.ceil(diff / 86_400_000)
}

export interface AllergyNotice {
  hasNotice: boolean
}

export const sideEffectNotices = (entries: SymptomEntry[]): SymptomEntry[] =>
  entries.filter((entry) => entry.sideEffects.trim().length > 0).slice(0, 5)
