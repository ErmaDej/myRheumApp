import { useCallback, useEffect, useState } from 'react'
import type { Instrument } from '@/data/types'

/**
 * Account-scoped tracking preferences.
 *
 * These settings describe what *this person* wants to keep an eye on: which
 * laboratory tests, medicines, symptom scales, questionnaires and report
 * sections matter for their case. They are deliberately stored per account on
 * this device, so two accounts in the same browser never share a care plan.
 *
 * They do not change what is medically valid. They only tune the shortcuts and
 * summaries shown in the app; no preference can invent a result or a dose.
 */

export type MetricKey =
  | 'pain'
  | 'stiffnessMinutes'
  | 'fatigue'
  | 'sleepQuality'
  | 'functionalDifficulty'
  | 'mood'
  | 'headDeviationCm'

export type ReportSectionKey = 'symptoms' | 'medications' | 'labs' | 'side-effects'

export type BiologicalSex = 'female' | 'male' | 'intersex' | 'prefer-not-to-say'

export interface Biodata {
  dateOfBirth?: string
  sex?: BiologicalSex
  heightCm?: number
  headDeviationCm?: number
}

export interface TrackingPreferences {
  version: 1
  labTests: string[]
  medications: string[]
  metrics: MetricKey[]
  questionnaires: Instrument[]
  reportSections: ReportSectionKey[]
  biodata: Biodata
}

export interface LabTestOption {
  name: string
  unit: string
  group: 'inflammation' | 'blood count' | 'liver & kidney' | 'rheumatology'
}

export const LAB_TESTS: LabTestOption[] = [
  { name: 'C-reactive protein', unit: 'mg/L', group: 'inflammation' },
  { name: 'Erythrocyte sedimentation rate', unit: 'mm/h', group: 'inflammation' },
  { name: 'Haemoglobin', unit: 'g/dL', group: 'blood count' },
  { name: 'White cell count', unit: '10^9/L', group: 'blood count' },
  { name: 'Platelet count', unit: '10^9/L', group: 'blood count' },
  { name: 'Alanine aminotransferase', unit: 'U/L', group: 'liver & kidney' },
  { name: 'Aspartate aminotransferase', unit: 'U/L', group: 'liver & kidney' },
  { name: 'Creatinine', unit: 'mg/dL', group: 'liver & kidney' },
  { name: 'Ferritin', unit: 'ng/mL', group: 'rheumatology' },
  { name: 'Vitamin D', unit: 'ng/mL', group: 'rheumatology' },
  { name: 'Uric acid', unit: 'mg/dL', group: 'rheumatology' },
  { name: 'Rheumatoid factor', unit: 'IU/mL', group: 'rheumatology' },
  { name: 'Anti-CCP antibodies', unit: 'U/mL', group: 'rheumatology' },
  { name: 'HLA-B27', unit: 'qualitative', group: 'rheumatology' },
]

export const MEDICATIONS: string[] = [
  'Adalimumab',
  'Etanercept',
  'Certolizumab pegol',
  'Golimumab',
  'Secukinumab',
  'Ixekizumab',
  'Ustekinumab',
  'Methotrexate',
  'Sulfasalazine',
  'Leflunomide',
  'Naproxen',
  'Ibuprofen',
  'Celecoxib',
  'Prednisolone',
  'Colecalciferol',
  'Folic acid',
  'Omeprazole',
]

export const METRIC_OPTIONS: Array<{ key: MetricKey; label: string; hint: string }> = [
  { key: 'pain', label: 'Pain', hint: '0–10 scale' },
  { key: 'stiffnessMinutes', label: 'Morning stiffness', hint: 'Minutes' },
  { key: 'fatigue', label: 'Fatigue', hint: '0–10 scale' },
  { key: 'sleepQuality', label: 'Sleep quality', hint: '0–10 scale' },
  { key: 'functionalDifficulty', label: 'Functional difficulty', hint: '0–10 scale' },
  { key: 'mood', label: 'Mood', hint: '0–10 scale' },
  { key: 'headDeviationCm', label: 'Head deviation from wall (cm)', hint: 'How far your head deviated from a wall when standing attached to the wall, measured by your doctor' },
]

export const QUESTIONNAIRE_OPTIONS: Array<{ key: Instrument; label: string; hint: string }> = [
  { key: 'BASDAI', label: 'BASDAI', hint: 'Disease activity, 6 items' },
  { key: 'BASFI', label: 'BASFI', hint: 'Daily function, 10 items' },
  { key: 'ASDAS', label: 'ASDAS', hint: 'Activity plus CRP' },
]

export const REPORT_SECTIONS: Array<{
  key: ReportSectionKey
  label: string
  hint: string
}> = [
  { key: 'symptoms', label: 'Symptom summary', hint: 'Pain, stiffness, fatigue and sleep means' },
  { key: 'medications', label: 'Medication adherence', hint: 'Taken vs expected per plan' },
  { key: 'labs', label: 'New laboratory results', hint: 'Results collected in the reporting period' },
  { key: 'side-effects', label: 'Reported side effects', hint: 'Free-text effects from check-ins' },
]

export const DEFAULT_TRACKING_PREFERENCES: TrackingPreferences = {
  version: 1,
  labTests: [
    'C-reactive protein',
    'Erythrocyte sedimentation rate',
    'Haemoglobin',
    'Alanine aminotransferase',
    'Creatinine',
    'Ferritin',
  ],
  // No medicine is assumed. A plan is added only after it is prescribed.
  medications: [],
  metrics: ['pain', 'stiffnessMinutes', 'fatigue', 'sleepQuality', 'functionalDifficulty', 'mood'],
  questionnaires: ['BASDAI', 'BASFI', 'ASDAS'],
  reportSections: ['symptoms', 'medications', 'labs', 'side-effects'],
  biodata: { headDeviationCm: undefined },
}

const STORAGE_PREFIX = 'myrheumapp.tracking.v1'

export const trackingStorageKey = (ownerId: string): string =>
  `${STORAGE_PREFIX}.${ownerId || 'anonymous'}`

const unique = <T,>(values: T[]): T[] => [...new Set(values)]

const fromCatalog = <T extends string>(values: unknown, catalog: readonly T[], fallback: T[]): T[] => {
  if (!Array.isArray(values)) return fallback
  const allowed = new Set(catalog)
  // An explicit empty array is a real choice ("track none"), not bad input.
  return unique(values.filter((value): value is T => typeof value === 'string' && allowed.has(value as T)))
}

const normaliseBiodata = (value: unknown): Biodata => {
  if (!value || typeof value !== 'object') return {}
  const raw = value as Record<string, unknown>
  const sexOptions: BiologicalSex[] = ['female', 'male', 'intersex', 'prefer-not-to-say']
  const dateOfBirth =
    typeof raw.dateOfBirth === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.dateOfBirth)
      ? raw.dateOfBirth
      : undefined
  const sex = sexOptions.includes(raw.sex as BiologicalSex) ? (raw.sex as BiologicalSex) : undefined
  const height = Number(raw.heightCm)
  const heightCm = Number.isFinite(height) && height > 0 && height < 300 ? height : undefined
  const headDeviation = Number(raw.headDeviationCm)
  const headDeviationCm = Number.isFinite(headDeviation) && headDeviation >= 0 && headDeviation <= 30 ? headDeviation : undefined
  return {
    ...(dateOfBirth ? { dateOfBirth } : {}),
    ...(sex ? { sex } : {}),
    ...(heightCm !== undefined ? { heightCm } : {}),
    ...(headDeviationCm !== undefined ? { headDeviationCm } : {}),
  }
}

/** Merge stored values with defaults, dropping unknown or malformed entries. */
export const normaliseTrackingPreferences = (value: unknown): TrackingPreferences => {
  if (!value || typeof value !== 'object') return DEFAULT_TRACKING_PREFERENCES
  const raw = value as Record<string, unknown>
  const labNames = LAB_TESTS.map((test) => test.name)
  const reportKeys = REPORT_SECTIONS.map((section) => section.key)
  const metricKeys = METRIC_OPTIONS.map((metric) => metric.key)
  const questionnaireKeys = QUESTIONNAIRE_OPTIONS.map((questionnaire) => questionnaire.key)

  return {
    version: 1,
    labTests: fromCatalog(raw.labTests, labNames, DEFAULT_TRACKING_PREFERENCES.labTests),
    medications: Array.isArray(raw.medications)
      ? unique(raw.medications.filter((item): item is string => typeof item === 'string' && item.trim().length > 0))
      : DEFAULT_TRACKING_PREFERENCES.medications,
    metrics: fromCatalog(raw.metrics, metricKeys, DEFAULT_TRACKING_PREFERENCES.metrics),
    questionnaires: fromCatalog(
      raw.questionnaires,
      questionnaireKeys,
      DEFAULT_TRACKING_PREFERENCES.questionnaires,
    ),
    reportSections: fromCatalog(
      raw.reportSections,
      reportKeys,
      DEFAULT_TRACKING_PREFERENCES.reportSections,
    ),
    biodata: normaliseBiodata(raw.biodata),
  }
}

export const readTrackingPreferences = (ownerId: string): TrackingPreferences => {
  if (typeof localStorage === 'undefined') return DEFAULT_TRACKING_PREFERENCES
  try {
    const raw = localStorage.getItem(trackingStorageKey(ownerId))
    if (!raw) return DEFAULT_TRACKING_PREFERENCES
    return normaliseTrackingPreferences(JSON.parse(raw))
  } catch {
    return DEFAULT_TRACKING_PREFERENCES
  }
}

export const writeTrackingPreferences = (
  ownerId: string,
  preferences: TrackingPreferences,
): void => {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(trackingStorageKey(ownerId), JSON.stringify(preferences))
  } catch {
    /* Private browsing or a full quota: preferences stay in memory. */
  }
}

export const clearTrackingPreferences = (ownerId: string): void => {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.removeItem(trackingStorageKey(ownerId))
  } catch {
    /* non-fatal */
  }
}

export const labTestUnit = (name: string): string | undefined =>
  LAB_TESTS.find((test) => test.name === name)?.unit

export interface TrackingPreferencesApi {
  preferences: TrackingPreferences
  update: (patch: Partial<TrackingPreferences>) => void
  toggleLabTest: (name: string) => void
  toggleMedication: (name: string) => void
  toggleMetric: (key: MetricKey) => void
  toggleQuestionnaire: (key: Instrument) => void
  toggleReportSection: (key: ReportSectionKey) => void
  setBiodata: (patch: Partial<Biodata>) => void
  reset: () => void
}

const toggleInList = <T,>(list: T[], value: T): T[] =>
  list.includes(value) ? list.filter((item) => item !== value) : [...list, value]

export const useTrackingPreferences = (ownerId: string): TrackingPreferencesApi => {
  const [preferences, setPreferences] = useState<TrackingPreferences>(() =>
    readTrackingPreferences(ownerId),
  )

  useEffect(() => {
    setPreferences(readTrackingPreferences(ownerId))
  }, [ownerId])

  const update = useCallback(
    (patch: Partial<TrackingPreferences>) => {
      setPreferences((previous) => {
        const next = normaliseTrackingPreferences({ ...previous, ...patch })
        writeTrackingPreferences(ownerId, next)
        return next
      })
    },
    [ownerId],
  )

  const toggleLabTest = useCallback(
    (name: string) =>
      setPreferences((previous) => {
        const next: TrackingPreferences = {
          ...previous,
          labTests: toggleInList(previous.labTests, name),
        }
        writeTrackingPreferences(ownerId, next)
        return next
      }),
    [ownerId],
  )

  const toggleMedication = useCallback(
    (name: string) =>
      setPreferences((previous) => {
        const next: TrackingPreferences = {
          ...previous,
          medications: toggleInList(previous.medications, name),
        }
        writeTrackingPreferences(ownerId, next)
        return next
      }),
    [ownerId],
  )

  const toggleMetric = useCallback(
    (key: MetricKey) =>
      setPreferences((previous) => {
        const next: TrackingPreferences = {
          ...previous,
          metrics: toggleInList(previous.metrics, key),
        }
        writeTrackingPreferences(ownerId, next)
        return next
      }),
    [ownerId],
  )

  const toggleQuestionnaire = useCallback(
    (key: Instrument) =>
      setPreferences((previous) => {
        const next: TrackingPreferences = {
          ...previous,
          questionnaires: toggleInList(previous.questionnaires, key),
        }
        writeTrackingPreferences(ownerId, next)
        return next
      }),
    [ownerId],
  )

  const toggleReportSection = useCallback(
    (key: ReportSectionKey) =>
      setPreferences((previous) => {
        const next: TrackingPreferences = {
          ...previous,
          reportSections: toggleInList(previous.reportSections, key),
        }
        writeTrackingPreferences(ownerId, next)
        return next
      }),
    [ownerId],
  )

  const setBiodata = useCallback(
    (patch: Partial<Biodata>) =>
      setPreferences((previous) => {
        const next: TrackingPreferences = {
          ...previous,
          biodata: normaliseBiodata({ ...previous.biodata, ...patch }),
        }
        writeTrackingPreferences(ownerId, next)
        return next
      }),
    [ownerId],
  )

  const reset = useCallback(() => {
    const next = normaliseTrackingPreferences(DEFAULT_TRACKING_PREFERENCES)
    writeTrackingPreferences(ownerId, next)
    setPreferences(next)
  }, [ownerId])

  return {
    preferences,
    update,
    toggleLabTest,
    toggleMedication,
    toggleMetric,
    toggleQuestionnaire,
    toggleReportSection,
    setBiodata,
    reset,
  }
}
