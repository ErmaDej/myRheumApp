import type { Appointment } from '@/data/types'

const pad = (value: number): string => String(value).padStart(2, '0')

/** UTC timestamp used by iCalendar (Z suffix avoids timezone database issues). */
export const toIcsStamp = (iso: string): string => {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) throw new Error('Invalid appointment date')
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
  )
}

const escapeText = (value: string): string =>
  value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;')

/** Fold content lines at 74 characters as required by RFC 5545. */
const fold = (line: string): string => {
  if (line.length <= 74) return line
  const chunks: string[] = []
  let remaining = line
  while (remaining.length > 74) {
    chunks.push(remaining.slice(0, 74))
    remaining = remaining.slice(74)
  }
  chunks.push(remaining)
  return chunks.join('\r\n ')
}

const planLine = (label: string, value?: string): string[] =>
  value && value.trim() ? [`DESCRIPTION:${escapeText(`${label}: ${value}`)}`] : []

export const buildIcs = (appointments: Appointment[], calendarName = 'myRheumApp appointments'): string => {
  const now = toIcsStamp(new Date().toISOString())
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//myRheumApp//Health Journal//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(calendarName)}`,
  ]

  for (const appointment of appointments) {
    const start = toIcsStamp(appointment.startsAt)
    const end = toIcsStamp(new Date(new Date(appointment.startsAt).getTime() + 45 * 60_000).toISOString())
    const description = [
      appointment.notes,
      appointment.clinician ? `Clinician: ${appointment.clinician}` : undefined,
      appointment.questions.length ? `Questions: ${appointment.questions.join(' | ')}` : undefined,
    ]
      .filter(Boolean)
      .join('\\n\\n')

    lines.push(
      'BEGIN:VEVENT',
      `UID:${appointment.id}@myrheum.app`,
      `DTSTAMP:${now}`,
      `DTSTART:${start}`,
      `DTEND:${end}`,
      `SUMMARY:${escapeText(`${appointment.kind === 'follow-up' ? 'Rheumatology follow-up' : 'Rheumatology appointment'}${appointment.clinician ? ` — ${appointment.clinician}` : ''}`)}`,
      ...(appointment.location ? [`LOCATION:${escapeText(appointment.location)}`] : []),
      ...(description ? [`DESCRIPTION:${escapeText(description)}`] : []),
      ...planLine('Status', appointment.status),
      'BEGIN:VALARM',
      'TRIGGER:-P1D',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeText('You have a scheduled health reminder.')}`,
      'END:VALARM',
      'END:VEVENT',
    )
  }

  lines.push('END:VCALENDAR')
  return `${lines.map(fold).join('\r\n')}\r\n`
}
