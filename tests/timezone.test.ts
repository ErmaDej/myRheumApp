import { describe, expect, it } from 'vitest'
import { utcToWallClock, wallClockToUtc, zoneOffsetLabel } from '@/lib/timezone'

describe('wallClockToUtc', () => {
  it('converts Addis Ababa (UTC+3, no DST)', () => {
    expect(wallClockToUtc('2026-11-19', '10:30', 'Africa/Addis_Ababa')).toBe('2026-11-19T07:30:00.000Z')
  })

  it('converts UTC unchanged', () => {
    expect(wallClockToUtc('2026-01-05', '00:00', 'UTC')).toBe('2026-01-05T00:00:00.000Z')
  })

  it('handles the US spring-forward gap (02:30 does not exist)', () => {
    // 2026-03-08 02:30 EST would be 07:30Z; after the jump the same wall clock
    // is interpreted with the new offset, yielding 06:30Z. Either way the
    // conversion must be a real instant, not an invalid date.
    const result = wallClockToUtc('2026-03-08', '02:30', 'America/New_York')
    expect(Number.isNaN(new Date(result).getTime())).toBe(false)
    expect(['2026-03-08T06:30:00.000Z', '2026-03-08T07:30:00.000Z']).toContain(result)
  })

  it('handles the US fall-back repeated hour', () => {
    const before = wallClockToUtc('2026-11-01', '01:30', 'America/New_York')
    expect(Number.isNaN(new Date(before).getTime())).toBe(false)
    expect(new Date(before).getUTCHours()).toBeGreaterThanOrEqual(5)
    expect(new Date(before).getUTCHours()).toBeLessThanOrEqual(6)
  })

  it('rejects malformed input', () => {
    expect(() => wallClockToUtc('not-a-date', '10:00', 'UTC')).toThrow()
  })
})

describe('utcToWallClock', () => {
  it('round-trips a wall clock through UTC', () => {
    const iso = wallClockToUtc('2026-11-19', '10:30', 'Africa/Addis_Ababa')
    expect(utcToWallClock(iso, 'Africa/Addis_Ababa')).toEqual({ date: '2026-11-19', time: '10:30' })
  })

  it('reflects the New York summer offset', () => {
    expect(utcToWallClock('2026-07-01T12:00:00.000Z', 'America/New_York')).toEqual({
      date: '2026-07-01',
      time: '08:00',
    })
  })
})

describe('zoneOffsetLabel', () => {
  it('labels Addis Ababa as UTC+03:00', () => {
    expect(zoneOffsetLabel('2026-11-19T07:30:00.000Z', 'Africa/Addis_Ababa')).toBe('UTC+03:00')
  })
})
