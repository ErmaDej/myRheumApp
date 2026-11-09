import { describe, expect, it } from 'vitest'
import { buildIcs, toIcsStamp } from '@/lib/reports/ics'
import type { Appointment } from '@/data/types'

const appointment: Appointment = {
  id: 'appt_1',
  patientId: 'patient_demo',
  startsAt: '2026-11-19T07:30:00.000Z',
  timezone: 'Africa/Addis_Ababa',
  clinician: 'Dr. Demo, Rheumatology',
  location: 'Rheum Clinic; Addis Ababa',
  kind: 'follow-up',
  status: 'scheduled',
  notes: 'Bring reports\nand questions',
  questions: ['Is the trend expected?'],
  tasks: [],
  reminderDaysBefore: 1,
  createdAt: '2026-11-01T00:00:00.000Z',
}

describe('toIcsStamp', () => {
  it('formats UTC timestamps with a Z suffix', () => {
    expect(toIcsStamp('2026-11-19T07:30:00.000Z')).toBe('20261119T073000Z')
  })

  it('rejects invalid dates', () => {
    expect(() => toIcsStamp('nope')).toThrow()
  })
})

describe('buildIcs', () => {
  const ics = buildIcs([appointment])

  it('wraps events in a calendar', () => {
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true)
    expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true)
    expect(ics).toContain('BEGIN:VEVENT')
    expect(ics).toContain('END:VEVENT')
  })

  it('uses UTC start times and a discreet alarm', () => {
    expect(ics).toContain('DTSTART:20261119T073000Z')
    expect(ics).toContain('TRIGGER:-P1D')
    expect(ics).toContain('You have a scheduled health reminder.')
  })

  it('escapes commas, semicolons and newlines', () => {
    expect(ics).toContain('Dr. Demo\\, Rheumatology')
    expect(ics).toContain('Rheum Clinic\\; Addis Ababa')
    expect(ics).toContain('Bring reports\\nand questions')
  })

  it('keeps every content line within the fold limit', () => {
    for (const line of ics.split('\r\n')) {
      expect(line.length).toBeLessThanOrEqual(75)
    }
  })
})
