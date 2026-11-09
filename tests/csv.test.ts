import { describe, expect, it } from 'vitest'
import { symptomEntriesCsv, toCsv } from '@/lib/reports/csv'
import type { SymptomEntry } from '@/data/types'

const entry = (overrides: Partial<SymptomEntry> = {}): SymptomEntry => ({
  id: 'sym_1',
  patientId: 'patient_demo',
  recordedAt: '2026-11-01T07:15:00.000Z',
  pain: 4,
  stiffnessMinutes: 25,
  fatigue: 5,
  sleepQuality: 6,
  functionalDifficulty: 3,
  mood: 7,
  triggers: '',
  notes: '',
  sideEffects: '',
  provenance: 'patient',
  ...overrides,
})

describe('toCsv', () => {
  it('writes a UTF-8 BOM and CRLF line endings', () => {
    const csv = toCsv(['a', 'b'], [[1, 2]])
    expect(csv.startsWith('\uFEFF')).toBe(true)
    expect(csv).toContain('a,b\r\n1,2\r\n')
  })

  it('quotes commas, quotes and newlines', () => {
    const csv = toCsv(['note'], [['pain, worse in the "morning"\nand evening']])
    expect(csv).toContain('"pain, worse in the ""morning""\nand evening"')
  })

  it('neutralises formula-like cells', () => {
    const csv = toCsv(['notes'], [['=HYPERLINK("http://evil")'], ['+1'], ['-2'], ['@cmd']])
    expect(csv).toContain("'=HYPERLINK")
    expect(csv).toContain("'+1")
    expect(csv).toContain("'-2")
    expect(csv).toContain("'@cmd")
  })

  it('renders null as an empty cell rather than zero', () => {
    const csv = toCsv(['pain', 'note'], [[null, undefined]])
    expect(csv).toContain('pain,note')
    expect(csv.split('\r\n')[1]).toBe(',')
  })
})

describe('symptomEntriesCsv', () => {
  it('preserves provenance and every recorded value', () => {
    const csv = symptomEntriesCsv([
      entry({ notes: 'Stiffness eased after stretching', sideEffects: 'nausea' }),
    ])
    expect(csv).toContain('Recorded at,Pain (0-10)')
    expect(csv).toContain('patient')
    expect(csv).toContain('Stiffness eased after stretching')
    expect(csv).toContain('nausea')
  })
})
