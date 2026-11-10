import { beforeEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_TRACKING_PREFERENCES,
  labTestUnit,
  normaliseTrackingPreferences,
  readTrackingPreferences,
  trackingStorageKey,
  writeTrackingPreferences,
} from '@/data/preferences'

describe('tracking preferences', () => {
  beforeEach(() => localStorage.clear())

  it('returns the defaults for an account with nothing saved', () => {
    const preferences = readTrackingPreferences('patient_a')
    expect(preferences.labTests).toEqual(DEFAULT_TRACKING_PREFERENCES.labTests)
    expect(preferences.medications).toEqual([])
    expect(preferences.metrics).toHaveLength(6)
  })

  it('keeps each account on its own care plan', () => {
    const first = readTrackingPreferences('patient_a')
    writeTrackingPreferences('patient_a', { ...first, labTests: ['C-reactive protein'] })

    expect(readTrackingPreferences('patient_a').labTests).toEqual(['C-reactive protein'])
    expect(readTrackingPreferences('patient_b').labTests).toEqual(
      DEFAULT_TRACKING_PREFERENCES.labTests,
    )
    expect(localStorage.getItem(trackingStorageKey('patient_a'))).toBeTruthy()
  })

  it('drops unknown catalogue entries and malformed biodata', () => {
    const preferences = normaliseTrackingPreferences({
      labTests: ['C-reactive protein', 'Invented test'],
      metrics: ['pain', 'not-a-metric'],
      questionnaires: ['BASDAI', 'Invalid'],
      reportSections: ['labs'],
      biodata: { dateOfBirth: '1990-02-31x', sex: 'unknown', heightCm: 900 },
    })

    expect(preferences.labTests).toEqual(['C-reactive protein'])
    expect(preferences.metrics).toEqual(['pain'])
    expect(preferences.questionnaires).toEqual(['BASDAI'])
    expect(preferences.reportSections).toEqual(['labs'])
    expect(preferences.biodata).toEqual({})
  })

  it('respects an explicit choice to track none', () => {
    const preferences = normaliseTrackingPreferences({
      labTests: [],
      metrics: [],
      questionnaires: [],
      reportSections: [],
      medications: [],
    })
    expect(preferences.labTests).toEqual([])
    expect(preferences.metrics).toEqual([])
    expect(preferences.questionnaires).toEqual([])
    expect(preferences.reportSections).toEqual([])
    expect(preferences.medications).toEqual([])
  })

  it('keeps a valid date of birth, sex and height', () => {
    const preferences = normaliseTrackingPreferences({
      biodata: { dateOfBirth: '1990-04-12', sex: 'female', heightCm: 168.5 },
    })
    expect(preferences.biodata).toEqual({
      dateOfBirth: '1990-04-12',
      sex: 'female',
      heightCm: 168.5,
    })
  })

  it('provides the reported unit for known tests only', () => {
    expect(labTestUnit('C-reactive protein')).toBe('mg/L')
    expect(labTestUnit('Unknown')).toBeUndefined()
  })
})
