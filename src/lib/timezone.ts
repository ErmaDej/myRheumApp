/**
 * Converts a wall-clock date/time in a named IANA timezone to an ISO UTC string.
 *
 * Intl gives us the zone offset for a given instant. We start with the naive UTC
 * interpretation, read how that instant looks in the target zone, and correct the
 * guess. Two iterations also cover daylight-saving transitions.
 */
const partsFormatterCache = new Map<string, Intl.DateTimeFormat>()

const formatterFor = (timeZone: string): Intl.DateTimeFormat => {
  const cached = partsFormatterCache.get(timeZone)
  if (cached) return cached
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  partsFormatterCache.set(timeZone, formatter)
  return formatter
}

interface Parts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

const readParts = (instantMs: number, timeZone: string): Parts => {
  const parts = formatterFor(timeZone).formatToParts(new Date(instantMs))
  const lookup = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value ?? '0')
  return {
    year: lookup('year'),
    month: lookup('month'),
    day: lookup('day'),
    hour: lookup('hour'),
    minute: lookup('minute'),
    second: lookup('second'),
  }
}

export const wallClockToUtc = (date: string, time: string, timeZone: string): string => {
  const [year, month, day] = date.split('-').map(Number)
  const [hour, minute] = time.split(':').map(Number)
  if ([year, month, day, hour, minute].some((value) => Number.isNaN(value))) {
    throw new Error('Invalid date or time')
  }

  const target = Date.UTC(year, month - 1, day, hour, minute, 0)
  let guess = target

  for (let iteration = 0; iteration < 4; iteration += 1) {
    const parts = readParts(guess, timeZone)
    const asIfUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
    const difference = asIfUtc - target
    if (difference === 0) break
    guess -= difference
  }

  return new Date(guess).toISOString()
}

/** Converts an ISO instant to date/time input values in a named timezone. */
export const utcToWallClock = (
  iso: string,
  timeZone: string,
): { date: string; time: string } => {
  const parts = readParts(new Date(iso).getTime(), timeZone)
  const pad = (value: number) => String(value).padStart(2, '0')
  return {
    date: `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`,
    time: `${pad(parts.hour)}:${pad(parts.minute)}`,
  }
}

export const zoneOffsetLabel = (iso: string, timeZone: string): string => {
  const parts = readParts(new Date(iso).getTime(), timeZone)
  const asIfUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
  const offsetMinutes = (asIfUtc - new Date(iso).getTime()) / 60_000
  const sign = offsetMinutes >= 0 ? '+' : '-'
  const absolute = Math.abs(offsetMinutes)
  const hours = Math.floor(absolute / 60)
  const minutes = absolute % 60
  return `UTC${sign}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}
