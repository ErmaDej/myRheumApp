import { describe, expect, it } from 'vitest'
import { detectFlares, recentFlare } from '@/lib/analytics'
import { emptyData, createDemoData } from '@/data/seed'

const profile = createDemoData(new Date('2026-11-09T09:00:00.000Z')).profile

const entry = (id: string, at: string, pain: number | null): any => ({
  id,
  patientId: profile.id,
  recordedAt: at,
  pain,
  stiffnessMinutes: pain === null ? null : 30,
  fatigue: 4,
  sleepQuality: 6,
  functionalDifficulty: 3,
  mood: 6,
  triggers: '',
  notes: '',
  sideEffects: '',
  provenance: 'patient',
})

describe('flare detection', () => {
  it('detects a run of high-pain days', () => {
    const data = emptyData(profile)
    data.symptomEntries = [
      entry('e1', '2026-11-07T07:00:00.000Z', 8),
      entry('e2', '2026-11-08T07:00:00.000Z', 7),
      entry('e3', '2026-11-09T07:00:00.000Z', 8),
      entry('e4', '2026-11-10T07:00:00.000Z', 6), // below threshold
      entry('e5', '2026-11-11T07:00:00.000Z', 9),
      entry('e6', '2026-11-12T07:00:00.000Z', 9),
    ]
    const flares = detectFlares(data.symptomEntries)
    expect(flares).toHaveLength(2)
    expect(flares[0].days).toBe(3) // e1-e3: 8,7,8 all >= 7
    expect(flares[1].days).toBe(2) // e5-e6: 9,9 both >= 7
  })

  it('does not detect a single high-pain day as a flare', () => {
    const data = emptyData(profile)
    data.symptomEntries = [
      entry('e1', '2026-11-07T07:00:00.000Z', 10),
      entry('e2', '2026-11-08T07:00:00.000Z', 6), // below threshold
    ]
    const flares = detectFlares(data.symptomEntries)
    expect(flares).toHaveLength(0)
  })

  it('finds the most recent flare', () => {
    const data = emptyData(profile)
    data.symptomEntries = [
      entry('e1', '2026-10-01T07:00:00.000Z', 8),
      entry('e2', '2026-10-02T07:00:00.000Z', 7),
      entry('e3', '2026-11-07T07:00:00.000Z', 9),
      entry('e4', '2026-11-08T07:00:00.000Z', 9),
    ]
    const recent = recentFlare(data.symptomEntries, 30)
    expect(recent).not.toBeNull()
    expect(recent?.days).toBe(2)
    expect(recent?.start).toBe('2026-11-07')
  })

  it('returns null when no flare exists within the window', () => {
    const data = emptyData(profile)
    data.symptomEntries = [
      entry('e1', '2026-09-01T07:00:00.000Z', 8),
      entry('e2', '2026-09-02T07:00:00.000Z', 7),
    ]
    const recent = recentFlare(data.symptomEntries, 30)
    expect(recent).toBeNull()
  })

  it('finds the longest flare when none is recent', () => {
    const data = emptyData(profile)
    data.symptomEntries = [
      entry('e1', '2026-09-01T07:00:00.000Z', 8),
      entry('e2', '2026-09-02T07:00:00.000Z', 7),
      entry('e3', '2026-11-01T07:00:00.000Z', 9),
      entry('e4', '2026-11-02T07:00:00.000Z', 9),
      entry('e5', '2026-11-03T07:00:00.000Z', 9),
    ]
    const recent = recentFlare(data.symptomEntries, 30)
    expect(recent).not.toBeNull()
    expect(recent?.days).toBe(3) // the November flare is longer
  })
})