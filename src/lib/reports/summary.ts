import type {
  AppData,
  Appointment,
  DoseEvent,
  LabResult,
  MedicationPlan,
  QuestionnaireAssessment,
  SymptomEntry,
} from '@/data/types'
import { formatDate, mean, percentChange, round } from '@/lib/utils'

export interface SummaryRange {
  start: string
  end: string
}

export interface AdherenceSummary {
  expected: number
  taken: number
  skipped: number
  uncertain: number
  notRecorded: number
  percentRecordedTaken: number | null
}

export interface MedicationAdherenceLine extends AdherenceSummary {
  plan: MedicationPlan
}

export interface TrendSummary {
  label: string
  baseline: number | null
  recent: number | null
  changePercent: number | null
  unit: string
  sampleBaseline: number
  sampleRecent: number
}

export interface WeeklySummary {
  range: SummaryRange
  checkIns: number
  daysInRange: number
  missingDays: number
  pain: { mean: number | null; min: number | null; max: number | null; samples: number }
  stiffness: { mean: number | null; samples: number }
  fatigue: { mean: number | null; samples: number }
  sleep: { mean: number | null; samples: number }
  adherence: AdherenceSummary
  medicationLines: MedicationAdherenceLine[]
  sideEffects: string[]
  newLabs: LabResult[]
  assessments: QuestionnaireAssessment[]
  upcomingAppointments: Appointment[]
  trends: TrendSummary[]
  patientNotes: string[]
  missingDataWarnings: string[]
}

const inRange = (iso: string, range: SummaryRange): boolean => {
  const t = new Date(iso).getTime()
  return t >= new Date(range.start).getTime() && t <= new Date(range.end).getTime()
}

const daysBetween = (start: string, end: string): number => {
  const ms = new Date(end).getTime() - new Date(start).getTime()
  return Math.max(1, Math.round(ms / 86_400_000))
}

const numeric = (value: number | null): value is number => value !== null && !Number.isNaN(value)

export const summariseAdherence = (events: DoseEvent[]): AdherenceSummary => {
  const taken = events.filter((event) => event.status === 'taken').length
  const skipped = events.filter((event) => event.status === 'skipped').length
  const uncertain = events.filter((event) => event.status === 'uncertain').length
  const pending = events.filter((event) => event.status === 'pending').length
  const expected = events.length
  return {
    expected,
    taken,
    skipped,
    uncertain,
    notRecorded: pending,
    percentRecordedTaken: expected === 0 ? null : round((taken / expected) * 100, 0),
  }
}

export const buildWeeklySummary = (
  data: AppData,
  range: SummaryRange,
  now = new Date(),
): WeeklySummary => {
  const entries = data.symptomEntries
    .filter((entry) => inRange(entry.recordedAt, range))
    .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt))

  const pains = entries.map((e) => e.pain).filter(numeric)
  const stiffness = entries.map((e) => e.stiffnessMinutes).filter(numeric)
  const fatigue = entries.map((e) => e.fatigue).filter(numeric)
  const sleep = entries.map((e) => e.sleepQuality).filter(numeric)

  const doseEvents = data.doseEvents.filter((event) => inRange(event.scheduledFor, range))
  const adherence = summariseAdherence(doseEvents)

  const medicationLines: MedicationAdherenceLine[] = data.medicationPlans.map((plan) => {
    const events = doseEvents.filter((event) => event.planId === plan.id)
    return { plan, ...summariseAdherence(events) }
  })

  const sideEffects = entries
    .map((entry) => entry.sideEffects.trim())
    .filter((value) => value.length > 0)

  const newLabs = data.labResults
    .filter((lab) => inRange(lab.collectedAt, range))
    .sort((a, b) => b.collectedAt.localeCompare(a.collectedAt))

  const assessments = data.assessments
    .filter((assessment) => inRange(assessment.assessedAt, range))
    .sort((a, b) => a.assessedAt.localeCompare(b.assessedAt))

  const upcomingAppointments = data.appointments
    .filter(
      (appointment) =>
        appointment.status === 'scheduled' &&
        new Date(appointment.startsAt).getTime() >= now.getTime(),
    )
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))

  const patientNotes = entries
    .map((entry) => entry.notes.trim())
    .filter((value) => value.length > 0)

  const daysInRange = daysBetween(range.start, range.end)
  const checkInDays = new Set(entries.map((entry) => entry.recordedAt.slice(0, 10))).size
  const missingDays = Math.max(0, daysInRange - checkInDays)

  const baselineStart = data.profile.baselineDate
    ? new Date(data.profile.baselineDate)
    : new Date(new Date(range.start).getTime() - 90 * 86_400_000)
  const baselineEntries = data.symptomEntries.filter((entry) => {
    const t = new Date(entry.recordedAt).getTime()
    return t >= baselineStart.getTime() && t < baselineStart.getTime() + 30 * 86_400_000
  })

  const trends = buildTrends(baselineEntries, entries)

  const missingDataWarnings: string[] = []
  if (missingDays > 0) {
    missingDataWarnings.push(
      `${missingDays} of ${daysInRange} days have no check-in in this period. Gaps are shown rather than estimated.`,
    )
  }
  if (adherence.notRecorded > 0) {
    missingDataWarnings.push(
      `${adherence.notRecorded} scheduled dose${adherence.notRecorded === 1 ? '' : 's'} have no recorded outcome; they are not counted as taken.`,
    )
  }
  if (pains.length > 0 && pains.length < 3) {
    missingDataWarnings.push('Pain summary is based on fewer than three reports and may not be representative.')
  }
  if (newLabs.length === 0) {
    missingDataWarnings.push('No laboratory results were collected in this period.')
  }

  return {
    range,
    checkIns: entries.length,
    daysInRange,
    missingDays,
    pain: {
      mean: pains.length ? round(mean(pains)!, 1) : null,
      min: pains.length ? Math.min(...pains) : null,
      max: pains.length ? Math.max(...pains) : null,
      samples: pains.length,
    },
    stiffness: {
      mean: stiffness.length ? Math.round(mean(stiffness)!) : null,
      samples: stiffness.length,
    },
    fatigue: {
      mean: fatigue.length ? round(mean(fatigue)!, 1) : null,
      samples: fatigue.length,
    },
    sleep: {
      mean: sleep.length ? round(mean(sleep)!, 1) : null,
      samples: sleep.length,
    },
    adherence,
    medicationLines,
    sideEffects,
    newLabs,
    assessments,
    upcomingAppointments,
    trends,
    patientNotes,
    missingDataWarnings: uniqueStrings(missingDataWarnings),
  }
}

const buildTrends = (baseline: SymptomEntry[], recent: SymptomEntry[]): TrendSummary[] => {
  const metric = (
    label: string,
    unit: string,
    pick: (entry: SymptomEntry) => number | null,
  ): TrendSummary => {
    const baseValues = baseline.map(pick).filter(numeric)
    const recentValues = recent.map(pick).filter(numeric)
    const baseMean = baseValues.length ? round(mean(baseValues)!, 1) : null
    const recentMean = recentValues.length ? round(mean(recentValues)!, 1) : null
    return {
      label,
      unit,
      baseline: baseMean,
      recent: recentMean,
      changePercent:
        baseMean !== null && recentMean !== null ? round(percentChange(baseMean, recentMean)!, 0) : null,
      sampleBaseline: baseValues.length,
      sampleRecent: recentValues.length,
    }
  }

  return [
    metric('Pain', '/10', (entry) => entry.pain),
    metric('Morning stiffness', 'min', (entry) => entry.stiffnessMinutes),
    metric('Fatigue', '/10', (entry) => entry.fatigue),
    metric('Functional difficulty', '/10', (entry) => entry.functionalDifficulty),
    metric('Sleep quality', '/10', (entry) => entry.sleepQuality),
  ]
}

const uniqueStrings = (values: string[]): string[] => Array.from(new Set(values))

export const describeRange = (range: SummaryRange): string =>
  `${formatDate(range.start)} – ${formatDate(range.end)}`

export const defaultRange = (days = 7): SummaryRange => {
  const end = new Date()
  const start = new Date(end.getTime() - (days - 1) * 86_400_000)
  return { start: start.toISOString(), end: end.toISOString() }
}
