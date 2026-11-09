import { describe, expect, it } from 'vitest'
import { appointmentReminderAt, isQuietHours, isReminderDue } from '@/lib/reminders/schedule'

describe('isQuietHours', () => {
  const zone = 'Africa/Addis_Ababa' // UTC+3, no DST

  it('detects quiet hours that wrap midnight', () => {
    // 21:00 UTC = 00:00 in Addis Ababa → inside 22:00–07:00
    expect(isQuietHours(new Date('2026-11-09T21:00:00.000Z'), zone, '22:00', '07:00')).toBe(true)
    // 06:00 UTC = 09:00 local → outside
    expect(isQuietHours(new Date('2026-11-09T06:00:00.000Z'), zone, '22:00', '07:00')).toBe(false)
    // 03:00 UTC = 06:00 local → inside
    expect(isQuietHours(new Date('2026-11-09T03:00:00.000Z'), zone, '22:00', '07:00')).toBe(true)
  })

  it('handles same-day quiet windows', () => {
    // 11:30 UTC = 14:30 local
    expect(isQuietHours(new Date('2026-11-09T11:30:00.000Z'), zone, '13:00', '15:00')).toBe(true)
    expect(isQuietHours(new Date('2026-11-09T09:00:00.000Z'), zone, '13:00', '15:00')).toBe(false)
  })

  it('treats identical start and end as disabled', () => {
    expect(isQuietHours(new Date('2026-11-09T03:00:00.000Z'), zone, '07:00', '07:00')).toBe(false)
  })
})

describe('isReminderDue', () => {
  const now = new Date('2026-11-09T07:00:00.000Z')

  it('is due at the scheduled time', () => {
    expect(isReminderDue({ scheduledFor: '2026-11-09T07:00:00.000Z', now })).toBe(true)
  })

  it('is due within the tolerance window', () => {
    expect(isReminderDue({ scheduledFor: '2026-11-09T06:55:00.000Z', now })).toBe(true)
  })

  it('is not due long after the event', () => {
    expect(isReminderDue({ scheduledFor: '2026-11-09T05:00:00.000Z', now })).toBe(false)
  })

  it('is not due before the window opens', () => {
    expect(isReminderDue({ scheduledFor: '2026-11-09T09:00:00.000Z', now })).toBe(false)
  })

  it('supports lead time in minutes', () => {
    expect(
      isReminderDue({ scheduledFor: '2026-11-09T07:30:00.000Z', leadMinutes: 30, now }),
    ).toBe(true)
  })

  it('rejects invalid dates', () => {
    expect(isReminderDue({ scheduledFor: 'not-a-date', now })).toBe(false)
  })
})

describe('appointmentReminderAt', () => {
  it('subtracts the configured number of days', () => {
    expect(appointmentReminderAt('2026-11-19T07:30:00.000Z', 1).toISOString()).toBe(
      '2026-11-18T07:30:00.000Z',
    )
  })

  it('never moves a reminder into the future with a negative lead', () => {
    expect(appointmentReminderAt('2026-11-19T07:30:00.000Z', -3).toISOString()).toBe(
      '2026-11-19T07:30:00.000Z',
    )
  })
})
