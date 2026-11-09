/**
 * Pure reminder scheduling helpers.
 *
 * The same rules are implemented in supabase/functions/send-reminders so the
 * server can run without the client bundle. Keep both versions in sync; this
 * module is the tested reference implementation.
 */

export const minutesInZone = (date: Date, timeZone: string): number => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(date)
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? '0')
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? '0')
  return hour * 60 + minute
}

const toMinutes = (time: string): number => {
  const [hour, minute] = time.split(':').map(Number)
  return (Number.isFinite(hour) ? hour : 0) * 60 + (Number.isFinite(minute) ? minute : 0)
}

/** Quiet hours may wrap midnight, e.g. 22:00 → 07:00. */
export const isQuietHours = (
  now: Date,
  timeZone: string,
  quietStart: string,
  quietEnd: string,
): boolean => {
  const current = minutesInZone(now, timeZone)
  const start = toMinutes(quietStart)
  const end = toMinutes(quietEnd)
  if (start === end) return false
  if (start < end) return current >= start && current < end
  return current >= start || current < end
}

export interface ReminderWindow {
  /** Scheduled time of the underlying event (dose or appointment). */
  scheduledFor: string
  /** Minutes before the event at which to remind. */
  leadMinutes?: number
  now: Date
  toleranceMinutes?: number
}

export const isReminderDue = ({
  scheduledFor,
  leadMinutes = 0,
  now,
  toleranceMinutes = 10,
}: ReminderWindow): boolean => {
  const eventTime = new Date(scheduledFor).getTime()
  if (Number.isNaN(eventTime)) return false
  const reminderTime = eventTime - leadMinutes * 60_000
  const difference = now.getTime() - reminderTime
  return difference >= -5 * 60_000 && difference <= toleranceMinutes * 60_000
}

export const appointmentReminderAt = (startsAt: string, daysBefore: number): Date =>
  new Date(new Date(startsAt).getTime() - Math.max(0, daysBefore) * 86_400_000)
