import { describe, expect, it } from 'vitest'
import { reportReadiness } from '@/lib/analytics'
import { emptyData, createDemoData } from '@/data/seed'

const profile = createDemoData(new Date('2026-11-09T09:00:00.000Z')).profile

const withLabs = (overrides: Partial<any> = {}): any => ({
  ...emptyData(profile),
  labResults: [
    { id: 'lab_crp_1', patientId: profile.id, testName: 'C-reactive protein', value: 18.4, unit: 'mg/L', referenceLow: 0, referenceHigh: 5, referenceText: '0–5 mg/L', collectedAt: '2026-11-01T06:45:00.000Z', laboratory: 'Demo Lab', source: 'imported', notes: '', createdAt: '2026-11-01T12:00:00.000Z' },
    { id: 'lab_crp_2', patientId: profile.id, testName: 'C-reactive protein', value: 7.8, unit: 'mg/L', referenceLow: 0, referenceHigh: 5, referenceText: '0–5 mg/L', collectedAt: '2026-11-07T06:45:00.000Z', laboratory: 'Demo Lab', source: 'imported', notes: '', createdAt: '2026-11-07T12:00:00.000Z' },
  ],
  ...overrides,
})

const withLabsAndPanel = (overrides: Partial<any> = {}): any => ({
  ...withLabs(overrides),
  labPanels: [
    { id: 'panel_1', patientId: profile.id, title: 'CRP draw', collectedAt: '2026-11-07T06:45:00.000Z', laboratory: 'Demo Lab', source: 'imported', notes: '', createdAt: '2026-11-07T12:00:00.000Z' },
  ],
  labResults: [
    ...(overrides.labResults || []),
    { id: 'lab_crp_panel', patientId: profile.id, testName: 'C-reactive protein', value: 7.8, unit: 'mg/L', referenceLow: 0, referenceHigh: 5, referenceText: '0–5 mg/L', panelId: 'panel_1', collectedAt: '2026-11-07T06:45:00.000Z', laboratory: 'Demo Lab', source: 'imported', notes: '', createdAt: '2026-11-07T12:00:00.000Z' },
  ],
})

describe('report readiness with new entities', () => {
  it('includes lab results in readiness check', () => {
    const data = withLabsAndPanel()
    const readiness = reportReadiness(data)
    const labItem = readiness.items.find((item) => item.key === 'labs')
    expect(labItem).toBeDefined()
    expect(labItem?.done).toBe(true)
    expect(labItem?.detail).toContain('2 results recorded')
  })

  it('reports no recent labs when only old panels exist', () => {
    const data = withLabsAndPanel({
      labResults: [],
      labPanels: [{ id: 'panel_1', patientId: profile.id, title: 'Old panel', collectedAt: '2026-09-01T06:45:00.000Z' }],
    })
    const readiness = reportReadiness(data)
    const labItem = readiness.items.find((item) => item.key === 'labs')
    expect(labItem?.done).toBe(false)
    expect(labItem?.detail).toContain('No recent result recorded')
  })

  it('includes medication plans in readiness check', () => {
    const data = withLabsAndPanel({
      medicationPlans: [
        { id: 'plan_1', patientId: profile.id, name: 'Adalimumab (demo)', ingredient: 'adalimumab', dose: '40 mg', route: 'Subcutaneous', frequency: 'Every 2 weeks', times: ['20:00'], startDate: '2026-08-01', status: 'active', notes: '', reminderEnabled: true, createdAt: '2026-08-01' },
      ],
    })
    const readiness = reportReadiness(data)
    const medItem = readiness.items.find((item) => item.key === 'medications')
    expect(medItem).toBeDefined()
    expect(medItem?.done).toBe(true)
  })

  it('includes upcoming appointment in readiness check', () => {
    const data = withLabsAndPanel({
      appointments: [
        { id: 'appt_1', patientId: profile.id, startsAt: '2026-11-19T07:30:00.000Z', timezone: 'Africa/Addis_Ababa', clinician: 'Dr. Demo', location: 'Clinic', kind: 'follow-up', status: 'scheduled', notes: '', questions: [], tasks: [], reminderDaysBefore: 1, createdAt: '2026-11-01' },
      ],
    })
    const readiness = reportReadiness(data)
    const apptItem = readiness.items.find((item) => item.key === 'appointment')
    expect(apptItem).toBeDefined()
    expect(apptItem?.done).toBe(true)
    expect(apptItem?.detail).toBe('Next visit scheduled')
  })

  it('reports no upcoming appointment when none exist', () => {
    const data = withLabsAndPanel({
      appointments: [],
    })
    const readiness = reportReadiness(data)
    const apptItem = readiness.items.find((item) => item.key === 'appointment')
    expect(apptItem?.done).toBe(false)
    expect(apptItem?.detail).toBe('No upcoming visit')
  })

  it('includes check-ins in readiness check', () => {
    const data = withLabsAndPanel({
      symptomEntries: [
        { id: 's1', patientId: profile.id, recordedAt: '2026-11-08T07:00:00.000Z', pain: 4, stiffnessMinutes: 30, fatigue: 4, sleepQuality: 6, functionalDifficulty: 3, mood: 6, triggers: '', notes: '', sideEffects: '', provenance: 'patient' },
        { id: 's2', patientId: profile.id, recordedAt: '2026-11-07T07:00:00.000Z', pain: 4, stiffnessMinutes: 30, fatigue: 4, sleepQuality: 6, functionalDifficulty: 3, mood: 6, triggers: '', notes: '', sideEffects: '', provenance: 'patient' },
        { id: 's3', patientId: profile.id, recordedAt: '2026-11-06T07:00:00.000Z', pain: 4, stiffnessMinutes: 30, fatigue: 4, sleepQuality: 6, functionalDifficulty: 3, mood: 6, triggers: '', notes: '', sideEffects: '', provenance: 'patient' },
        { id: 's4', patientId: profile.id, recordedAt: '2026-11-05T07:00:00.000Z', pain: 4, stiffnessMinutes: 30, fatigue: 4, sleepQuality: 6, functionalDifficulty: 3, mood: 6, triggers: '', notes: '', sideEffects: '', provenance: 'patient' },
        { id: 's5', patientId: profile.id, recordedAt: '2026-11-04T07:00:00.000Z', pain: 4, stiffnessMinutes: 30, fatigue: 4, sleepQuality: 6, functionalDifficulty: 3, mood: 6, triggers: '', notes: '', sideEffects: '', provenance: 'patient' },
      ],
    })
    const readiness = reportReadiness(data)
    const checkInItem = readiness.items.find((item) => item.key === 'check-ins')
    expect(checkInItem).toBeDefined()
    expect(checkInItem?.done).toBe(true)
    expect(checkInItem?.detail).toBe('5 entries recorded')
  })

  it('reports insufficient check-ins', () => {
    const data = withLabsAndPanel({
      symptomEntries: [
        { id: 's1', patientId: profile.id, recordedAt: '2026-11-08T07:00:00.000Z', pain: 4, stiffnessMinutes: 30, fatigue: 4, sleepQuality: 6, functionalDifficulty: 3, mood: 6, triggers: '', notes: '', sideEffects: '', provenance: 'patient' },
      ],
    })
    const readiness = reportReadiness(data)
    const checkInItem = readiness.items.find((item) => item.key === 'check-ins')
    expect(checkInItem?.done).toBe(false)
    expect(checkInItem?.detail).toBe('1 of 5 recommended entries')
  })
})