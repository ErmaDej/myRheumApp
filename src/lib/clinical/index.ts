/**
 * Validated rheumatology questionnaire algorithms.
 *
 * Design rules for this module:
 *  - Pure functions only (safe to unit test and to run offline).
 *  - Never guess missing answers: the caller receives the list of missing items.
 *  - Every result carries the algorithm version so stored scores stay auditable.
 *  - Scores are patient-reported/calculated outputs, never a diagnosis.
 */

export type Instrument = 'BASDAI' | 'BASFI' | 'ASDAS'

export interface QuestionDefinition {
  id: string
  label: string
  help: string
}

export interface ScoreResult {
  instrument: Instrument
  score: number
  version: string
  answered: number
  /** Optional reference band, e.g. ASDAS activity state. Never a diagnosis. */
  band?: string
}

export type ScoreOutcome =
  | { ok: true; result: ScoreResult }
  | { ok: false; missing: string[]; invalid: string[] }

export const ALGORITHM_VERSIONS = {
  BASDAI: 'basdai/1.0.0',
  BASFI: 'basfi/1.0.0',
  ASDAS: 'asdas-crp/1.0.0',
} as const

export const SCALE_MIN = 0
export const SCALE_MAX = 10

/* ------------------------------------------------------------------ */
/*                                BASDAI                              */
/* ------------------------------------------------------------------ */

export const BASDAI_QUESTIONS: QuestionDefinition[] = [
  {
    id: 'fatigue',
    label: 'Fatigue',
    help: 'How would you describe the overall level of fatigue you have experienced?',
  },
  {
    id: 'backPain',
    label: 'Spinal / back pain',
    help: 'Overall level of neck, back or hip pain.',
  },
  {
    id: 'peripheralPain',
    label: 'Joint pain or swelling',
    help: 'Overall level of pain or swelling in joints other than neck, back or hips.',
  },
  {
    id: 'enthesitis',
    label: 'Tender areas',
    help: 'Overall level of discomfort in areas tender to touch or pressure.',
  },
  {
    id: 'stiffnessSeverity',
    label: 'Morning stiffness severity',
    help: 'How severe is the stiffness you wake up with?',
  },
  {
    id: 'stiffnessDuration',
    label: 'Morning stiffness duration',
    help: 'How long does morning stiffness last? 0 = none, 10 = two hours or more.',
  },
]

/**
 * BASDAI = (Q1 + Q2 + Q3 + Q4 + (Q5 + Q6) / 2) / 5
 * All six items are required. Result range 0–10.
 */
export const computeBasdai = (answers: Record<string, number>): ScoreOutcome => {
  const missing: string[] = []
  const invalid: string[] = []

  for (const question of BASDAI_QUESTIONS) {
    const value = answers[question.id]
    if (value === undefined || value === null || Number.isNaN(value)) {
      missing.push(question.id)
      continue
    }
    if (value < SCALE_MIN || value > SCALE_MAX) invalid.push(question.id)
  }

  if (missing.length > 0 || invalid.length > 0) {
    return { ok: false, missing, invalid }
  }

  const q = (id: string) => answers[id]
  const total =
    q('fatigue') +
    q('backPain') +
    q('peripheralPain') +
    q('enthesitis') +
    (q('stiffnessSeverity') + q('stiffnessDuration')) / 2

  return {
    ok: true,
    result: {
      instrument: 'BASDAI',
      score: Math.round((total / 5) * 10) / 10,
      version: ALGORITHM_VERSIONS.BASDAI,
      answered: BASDAI_QUESTIONS.length,
    },
  }
}

/* ------------------------------------------------------------------ */
/*                                 BASFI                              */
/* ------------------------------------------------------------------ */

export const BASFI_QUESTIONS: QuestionDefinition[] = [
  {
    id: 'socks',
    label: 'Putting on socks',
    help: 'Putting on your socks or stockings without help or aids.',
  },
  {
    id: 'bendForward',
    label: 'Bending forward',
    help: 'Bending forward from the waist to pick up a pen from the floor.',
  },
  {
    id: 'overheadShelf',
    label: 'Reaching a shelf',
    help: 'Reaching up to a shelf above head height without aids.',
  },
  {
    id: 'armlessChair',
    label: 'Rising from a chair',
    help: 'Getting up from an armless chair without using your hands.',
  },
  {
    id: 'floorToStand',
    label: 'Getting up from the floor',
    help: 'Getting up from lying on your back on the floor without help.',
  },
  {
    id: 'standTenMinutes',
    label: 'Standing 10 minutes',
    help: 'Standing unsupported for 10 minutes without discomfort.',
  },
  {
    id: 'stairs',
    label: 'Climbing stairs',
    help: 'Climbing 12–15 stairs without a handrail or aids.',
  },
  {
    id: 'lookOverShoulder',
    label: 'Looking over shoulder',
    help: 'Looking over your shoulder without turning your body.',
  },
  {
    id: 'physicalActivity',
    label: 'Physical activity',
    help: 'Doing physically demanding activities (exercise, gardening, sport).',
  },
  {
    id: 'fullDay',
    label: 'Full day of activity',
    help: 'Doing a full day of activities at home or at work.',
  },
]

/**
 * BASFI = mean of the ten items. All ten are required. Result range 0–10.
 */
export const computeBasfi = (answers: Record<string, number>): ScoreOutcome => {
  const missing: string[] = []
  const invalid: string[] = []

  for (const question of BASFI_QUESTIONS) {
    const value = answers[question.id]
    if (value === undefined || value === null || Number.isNaN(value)) {
      missing.push(question.id)
      continue
    }
    if (value < SCALE_MIN || value > SCALE_MAX) invalid.push(question.id)
  }

  if (missing.length > 0 || invalid.length > 0) {
    return { ok: false, missing, invalid }
  }

  const total = BASFI_QUESTIONS.reduce((sum, question) => sum + answers[question.id], 0)

  return {
    ok: true,
    result: {
      instrument: 'BASFI',
      score: Math.round((total / BASFI_QUESTIONS.length) * 10) / 10,
      version: ALGORITHM_VERSIONS.BASFI,
      answered: BASFI_QUESTIONS.length,
    },
  }
}

/* ------------------------------------------------------------------ */
/*                                 ASDAS                              */
/* ------------------------------------------------------------------ */

export interface AsdasInputs {
  backPain: number
  morningStiffness: number
  peripheralPain: number
  fatigue: number
  /** C-reactive protein in mg/L. */
  crp: number
}

export const ASDAS_QUESTIONS: QuestionDefinition[] = [
  { id: 'backPain', label: 'Back pain', help: 'Total back pain (0–10).' },
  { id: 'morningStiffness', label: 'Morning stiffness', help: 'Duration/severity of morning stiffness (0–10).' },
  { id: 'peripheralPain', label: 'Peripheral pain', help: 'Pain or swelling in peripheral joints (0–10).' },
  { id: 'fatigue', label: 'Fatigue', help: 'General level of fatigue (0–10).' },
  { id: 'crp', label: 'CRP', help: 'C-reactive protein in mg/L from a laboratory result.' },
]

/**
 * ASDAS-CRP = 0.121 × back pain + 0.110 × morning stiffness
 *           + 0.073 × peripheral pain + 0.058 × fatigue
 *           + 0.579 × ln(CRP + 1)
 *
 * All patient-reported items use a 0–10 scale; CRP is mg/L and must be ≥ 0.
 * ASDAS is only calculated when every input is present.
 */
export const computeAsdas = (inputs: Partial<AsdasInputs>): ScoreOutcome => {
  const missing: string[] = []
  const invalid: string[] = []

  for (const question of ASDAS_QUESTIONS) {
    const value = inputs[question.id as keyof AsdasInputs]
    if (value === undefined || value === null || Number.isNaN(value)) {
      missing.push(question.id)
      continue
    }
    if (question.id === 'crp') {
      if (value < 0) invalid.push(question.id)
    } else if (value < SCALE_MIN || value > SCALE_MAX) {
      invalid.push(question.id)
    }
  }

  if (missing.length > 0 || invalid.length > 0) {
    return { ok: false, missing, invalid }
  }

  const { backPain, morningStiffness, peripheralPain, fatigue, crp } = inputs as AsdasInputs
  const score =
    0.121 * backPain +
    0.110 * morningStiffness +
    0.073 * peripheralPain +
    0.058 * fatigue +
    0.579 * Math.log(crp + 1)

  return {
    ok: true,
    result: {
      instrument: 'ASDAS',
      score: Math.round(score * 100) / 100,
      version: ALGORITHM_VERSIONS.ASDAS,
      answered: ASDAS_QUESTIONS.length,
      band: asdasBand(score),
    },
  }
}

/**
 * Published ASDAS activity states, shown as reference information only.
 * They must never be presented as a diagnosis or as treatment advice.
 */
export const asdasBand = (score: number): string => {
  if (score < 1.3) return 'Inactive disease (reference band)'
  if (score < 2.1) return 'Low disease activity (reference band)'
  if (score <= 3.5) return 'High disease activity (reference band)'
  return 'Very high disease activity (reference band)'
}

/** Total number of required items per instrument, used by the UI. */
export const requiredItemCount = (instrument: Instrument): number => {
  if (instrument === 'BASDAI') return BASDAI_QUESTIONS.length
  if (instrument === 'BASFI') return BASFI_QUESTIONS.length
  return ASDAS_QUESTIONS.length
}
