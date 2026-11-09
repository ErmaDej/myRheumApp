import { describe, expect, it } from 'vitest'
import {
  ALGORITHM_VERSIONS,
  BASDAI_QUESTIONS,
  BASFI_QUESTIONS,
  computeAsdas,
  computeBasdai,
  computeBasfi,
} from '@/lib/clinical'

const allAnswers = (ids: string[], value: number) =>
  Object.fromEntries(ids.map((id) => [id, value]))

describe('BASDAI', () => {
  it('computes the documented formula for uniform answers', () => {
    // (4+4+4+4 + (4+4)/2) / 5 = 4
    const outcome = computeBasdai(allAnswers(BASDAI_QUESTIONS.map((q) => q.id), 4))
    expect(outcome.ok).toBe(true)
    if (outcome.ok) {
      expect(outcome.result.score).toBe(4)
      expect(outcome.result.instrument).toBe('BASDAI')
      expect(outcome.result.version).toBe(ALGORITHM_VERSIONS.BASDAI)
      expect(outcome.result.answered).toBe(6)
    }
  })

  it('honours the half weight of the two stiffness items', () => {
    const answers = {
      fatigue: 0,
      backPain: 0,
      peripheralPain: 0,
      enthesitis: 0,
      stiffnessSeverity: 10,
      stiffnessDuration: 10,
    }
    // (0+0+0+0 + (10+10)/2) / 5 = 2
    const outcome = computeBasdai(answers)
    expect(outcome.ok).toBe(true)
    if (outcome.ok) expect(outcome.result.score).toBe(2)
  })

  it('returns missing items instead of guessing a score', () => {
    const outcome = computeBasdai({
      fatigue: 3,
      backPain: 4,
      peripheralPain: 5,
      enthesitis: 2,
      stiffnessSeverity: 6,
    })
    expect(outcome.ok).toBe(false)
    if (!outcome.ok) {
      expect(outcome.missing).toEqual(['stiffnessDuration'])
      expect(outcome.invalid).toEqual([])
    }
  })

  it('rejects answers outside the 0–10 scale', () => {
    const answers = { ...allAnswers(BASDAI_QUESTIONS.map((q) => q.id), 5), pain: 11 }
    const outcome = computeBasdai({ ...answers, backPain: 11 })
    expect(outcome.ok).toBe(false)
    if (!outcome.ok) expect(outcome.invalid).toContain('backPain')
  })

  it('handles an entirely empty questionnaire', () => {
    const outcome = computeBasdai({})
    expect(outcome.ok).toBe(false)
    if (!outcome.ok) expect(outcome.missing).toHaveLength(6)
  })
})

describe('BASFI', () => {
  it('is the mean of all ten items', () => {
    const outcome = computeBasfi(allAnswers(BASFI_QUESTIONS.map((q) => q.id), 3))
    expect(outcome.ok).toBe(true)
    if (outcome.ok) {
      expect(outcome.result.score).toBe(3)
      expect(outcome.result.version).toBe(ALGORITHM_VERSIONS.BASFI)
    }
  })

  it('rounds to one decimal place', () => {
    const answers = Object.fromEntries(
      BASFI_QUESTIONS.map((question, index) => [question.id, index < 5 ? 1 : 2]),
    )
    // mean = 1.5
    const outcome = computeBasfi(answers)
    expect(outcome.ok).toBe(true)
    if (outcome.ok) expect(outcome.result.score).toBe(1.5)
  })

  it('requires every item', () => {
    const answers = allAnswers(BASFI_QUESTIONS.slice(0, 9).map((q) => q.id), 2)
    const outcome = computeBasfi(answers)
    expect(outcome.ok).toBe(false)
    if (!outcome.ok) expect(outcome.missing).toEqual([BASFI_QUESTIONS[9].id])
  })
})

describe('ASDAS-CRP', () => {
  it('matches a hand-calculated reference value', () => {
    // 0.121*5 + 0.110*5 + 0.073*5 + 0.058*5 + 0.579*ln(11) = 3.1984…
    const outcome = computeAsdas({
      backPain: 5,
      morningStiffness: 5,
      peripheralPain: 5,
      fatigue: 5,
      crp: 10,
    })
    expect(outcome.ok).toBe(true)
    if (outcome.ok) {
      expect(outcome.result.score).toBe(3.2)
      expect(outcome.result.version).toBe(ALGORITHM_VERSIONS.ASDAS)
      expect(outcome.result.band).toContain('High disease activity')
    }
  })

  it('treats a CRP of zero correctly', () => {
    const outcome = computeAsdas({
      backPain: 0,
      morningStiffness: 0,
      peripheralPain: 0,
      fatigue: 0,
      crp: 0,
    })
    expect(outcome.ok).toBe(true)
    if (outcome.ok) {
      expect(outcome.result.score).toBe(0)
      expect(outcome.result.band).toContain('Inactive')
    }
  })

  it('does not calculate without a CRP value', () => {
    const outcome = computeAsdas({
      backPain: 5,
      morningStiffness: 5,
      peripheralPain: 5,
      fatigue: 5,
    })
    expect(outcome.ok).toBe(false)
    if (!outcome.ok) expect(outcome.missing).toEqual(['crp'])
  })

  it('rejects negative CRP values', () => {
    const outcome = computeAsdas({
      backPain: 1,
      morningStiffness: 1,
      peripheralPain: 1,
      fatigue: 1,
      crp: -2,
    })
    expect(outcome.ok).toBe(false)
    if (!outcome.ok) expect(outcome.invalid).toContain('crp')
  })
})
