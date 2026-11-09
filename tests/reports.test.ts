import { describe, expect, it } from 'vitest'
import { buildWeeklySummary, defaultRange, describeRange, summariseAdherence } from '@/lib/reports/summary'
import { emptyData, createDemoData } from '@/data/seed'
import type { AppData, DoseEvent, SymptomEntry } from '@/data/types'

const profile = createDemoData(new Date('2026-11-09T09:00:00.000Z')).profile

const entry = (id: string, at: string, pain: number | null, notes = ''): SymptomEntry => ({
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
  notes,
  sideEffects: '',
  provenance: 'patient',
})

const dose = (id: string, at: string, status: DoseEvent['status'], planId = 'plan_naproxen'): DoseEvent => ({
  id,
  patientId: profile.id,
  planId,
  scheduledFor: at,
  status,
  recordedAt: status === 'pending' ? undefined : at,
})

const withEntries = (entries: SymptomEntry[], doses: DoseEvent[] = []): AppData => ({
  ...emptyData(profile),
  symptomEntries: entries,
  medicationPlans: createDemoData(new Date('2026-11-09T09:00:00.000Z')).medicationPlans,
  doseEvents: doses,
})

describe('summariseAdherence', () => {
  it('counts only recorded outcomes and keeps unknown doses visible', () => {
    const summary = summariseAdherence([
      dose('1', '2026-11-01T08:00:00.000Z', 'taken'),
      dose('2', '2026-11-02T08:00:00.000Z', 'taken'),
      dose('3', '2026-11-03T08:00:00.000Z', 'skipped'),
      dose('4', '2026-11-04T08:00:00.000Z', 'uncertain'),
      dose('5', '2026-11-05T08:00:00.000Z', 'pending'),
    ])
    expect(summary).toMatchObject({ expected: 5, taken: 2, skipped: 1, uncertain: 1, notRecorded: 1 })
    expect(summary.percentRecordedTaken).toBe(40)
  })

  it('does not divide by zero when nothing is scheduled', () => {
    expect(summariseAdherence([]).percentRecordedTaken).toBeNull()
  })
})

describe('buildWeeklySummary', () => {
  const range = { start: '2026-11-01T00:00:00.000Z', end: '2026-11-07T23:59:59.000Z' }

  it('summarises only entries inside the requested range', () => {
    const data = withEntries([
      entry('in1', '2026-11-02T08:00:00.000Z', 4),
      entry('in2', '2026-11-05T08:00:00.000Z', 6),
      entry('out', '2026-10-20T08:00:00.000Z', 1),
    ])
    const summary = buildWeeklySummary(data, range)
    expect(summary.checkIns).toBe(2)
    expect(summary.pain.mean).toBe(5)
    expect(summary.pain.samples).toBe(2)
    expect(summary.pain.min).toBe(4)
    expect(summary.pain.max).toBe(6)
  })

  it('never fabricates values for missing days', () => {
    const data = withEntries([entry('only', '2026-11-02T08:00:00.000Z', 4)])
    const summary = buildWeeklySummary(data, range)
    expect(summary.daysInRange).toBe(7)
    expect(summary.missingDays).toBe(6)
    expect(summary.missingDataWarnings.some((warning) => warning.includes('no check-in'))).toBe(true)
  })

  it('reports null pain when no pain score was recorded', () => {
    const data = withEntries([entry('nopain', '2026-11-02T08:00:00.000Z', null, 'Only a note')])
    const summary = buildWeeklySummary(data, range)
    expect(summary.pain.mean).toBeNull()
    expect(summary.pain.samples).toBe(0)
    expect(summary.patientNotes).toContain('Only a note')
  })

  it('excludes "not recorded" doses from adherence percentages', () => {
    const data = withEntries(
      [entry('a', '2026-11-02T08:00:00.000Z', 4)],
      [
        dose('d1', '2026-11-02T08:00:00.000Z', 'taken'),
        dose('d2', '2026-11-03T08:00:00.000Z', 'pending'),
      ],
    )
    const summary = buildWeeklySummary(data, range)
    expect(summary.adherence.taken).toBe(1)
    expect(summary.adherence.notRecorded).toBe(1)
    expect(summary.missingDataWarnings.some((warning) => warning.includes('no recorded outcome'))).toBe(true)
  })

  it('generates baseline comparisons with sample counts', () => {
    const data = withEntries([
      entry('base1', '2026-08-20T08:00:00.000Z', 8),
      entry('base2', '2026-08-21T08:00:00.000Z', 8),
      entry('recent', '2026-11-02T08:00:00.000Z', 4),
    ])
    data.profile.baselineDate = '2026-08-19T00:00:00.000Z'
    const summary = buildWeeklySummary(data, range)
    const pain = summary.trends.find((trend) => trend.label === 'Pain')
    expect(pain?.baseline).toBe(8)
    expect(pain?.recent).toBe(4)
    expect(pain?.changePercent).toBe(-50)
    expect(pain?.sampleBaseline).toBe(2)
  })
})

describe('range helpers', () => {
  it('defaultRange spans the requested number of days', () => {
    const range = defaultRange(30)
    const days = (new Date(range.end).getTime() - new Date(range.start).getTime()) / 86_400_000
    expect(Math.round(days)).toBe(29)
  })

  it('describes a range for reports', () => {
    expect(describeRange({ start: '2026-11-01T00:00:00.000Z', end: '2026-11-07T00:00:00.000Z' })).toBe(
      '1 Nov 2026 – 7 Nov 2026',
    )
  })
})
