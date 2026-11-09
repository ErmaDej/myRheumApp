import { describe, expect, it } from 'vitest'
import { isRelayable, toRemoteRow } from '@/data/remote'
import type { LabResult, SymptomEntry } from '@/data/types'

describe('toRemoteRow', () => {
  it('maps symptom entries to snake_case columns without inventing values', () => {
    const entry: SymptomEntry = {
      id: 'sym_1',
      patientId: 'patient_demo',
      recordedAt: '2026-11-09T07:00:00.000Z',
      pain: null,
      stiffnessMinutes: 0,
      fatigue: 4,
      sleepQuality: 6,
      functionalDifficulty: 3,
      mood: null,
      triggers: 'cold',
      notes: '',
      sideEffects: '',
      provenance: 'patient',
    }
    const row = toRemoteRow('symptomEntry', entry)
    expect(row).toMatchObject({
      id: 'sym_1',
      patient_id: 'patient_demo',
      recorded_at: '2026-11-09T07:00:00.000Z',
      pain: null,
      stiffness_minutes: 0,
      fatigue: 4,
      sleep_quality: 6,
      functional_difficulty: 3,
      mood: null,
    })
    expect(row).not.toHaveProperty('stiffnessMinutes')
  })

  it('preserves the original laboratory text and unit alongside a numeric copy', () => {
    const lab: LabResult = {
      id: 'lab_1',
      patientId: 'patient_demo',
      testName: 'C-reactive protein',
      value: '3.2',
      unit: 'mg/L',
      referenceText: '< 5 mg/L',
      collectedAt: '2026-11-01T06:45:00.000Z',
      laboratory: 'Demo Laboratory',
      source: 'imported',
      createdAt: '2026-11-01T12:00:00.000Z',
    }
    const row = toRemoteRow('labResult', lab)
    expect(row.value_text).toBe('3.2')
    expect(row.value_numeric).toBe(3.2)
    expect(row.unit).toBe('mg/L')
    expect(row.reference_text).toBe('< 5 mg/L')
  })

  it('keeps a non-numeric qualitative result as text', () => {
    const row = toRemoteRow('labResult', {
      id: 'lab_2',
      patientId: 'patient_demo',
      testName: 'Urinalysis',
      value: 'Trace',
      unit: '',
      collectedAt: '2026-11-01T06:45:00.000Z',
      source: 'clinician',
      createdAt: '2026-11-01T12:00:00.000Z',
    })
    expect(row.value_text).toBe('Trace')
    expect(row.value_numeric).toBeNull()
  })

  it('maps appointment questions and reminder lead time', () => {
    const row = toRemoteRow('appointment', {
      id: 'appt_1',
      patientId: 'patient_demo',
      startsAt: '2026-11-19T07:30:00.000Z',
      timezone: 'Africa/Addis_Ababa',
      kind: 'follow-up',
      status: 'scheduled',
      questions: ['Question one'],
      reminderDaysBefore: 2,
      createdAt: '2026-11-01T00:00:00.000Z',
    })
    expect(row.starts_at).toBe('2026-11-19T07:30:00.000Z')
    expect(row.questions).toEqual(['Question one'])
    expect(row.reminder_days_before).toBe(2)
  })

  it('recognises relayable entities only', () => {
    expect(isRelayable('symptomEntry')).toBe(true)
    expect(isRelayable('photo')).toBe(false)
    expect(isRelayable('unknown')).toBe(false)
  })
})
