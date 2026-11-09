// Scheduled reminder workflow for myRheumApp.
//
// Deploy:  supabase functions deploy send-reminders --no-verify-jwt
// Secrets: supabase secrets set CRON_SECRET=...  (SUPABASE_URL and
//          SUPABASE_SERVICE_ROLE_KEY are injected by the platform)
//
// The function is intentionally dumb about delivery: it enqueues discreet,
// non-identifying notifications and marks reminder state. A separate push
// worker may read notification_queue. It never names a medicine or diagnosis.
//
// @ts-nocheck — Deno runtime; this file is not part of the Vite typecheck.

import { createClient } from 'npm:@supabase/supabase-js@2'

const WINDOW_BEFORE_MS = 5 * 60_000
const WINDOW_AFTER_MS = 10 * 60_000

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-cron-secret, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

/** Constant-time comparison so the shared secret is not leaked via timing. */
const safeEqual = (a: string, b: string): boolean => {
  const encoder = new TextEncoder()
  const left = encoder.encode(a)
  const right = encoder.encode(b)
  if (left.length !== right.length) return false
  let difference = 0
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index]
  return difference === 0
}

const minutesInZone = (date: Date, timeZone: string): number => {
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
  return (hour || 0) * 60 + (minute || 0)
}

/** Quiet hours may wrap midnight. Returns true when notifications should wait. */
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

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'POST required' }, 405)

  const expected = Deno.env.get('CRON_SECRET')
  if (!expected) return json({ error: 'CRON_SECRET is not configured' }, 500)

  const provided = request.headers.get('x-cron-secret') ?? ''
  if (!safeEqual(provided, expected)) return json({ error: 'Unauthorized' }, 401)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: 'Supabase service credentials are unavailable' }, 500)
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const now = new Date()
  const nowIso = now.toISOString()

  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, timezone')
  if (profileError) return json({ error: profileError.message }, 500)

  const timezoneFor = new Map<string, string>(
    (profiles ?? []).map((profile: { id: string; timezone: string }) => [
      profile.id,
      profile.timezone || 'Africa/Addis_Ababa',
    ]),
  )

  const { data: preferences, error: preferenceError } = await supabase
    .from('reminder_preferences')
    .select('patient_id, kind, enabled, quiet_hours_start, quiet_hours_end, discreet_lock_screen')
    .eq('enabled', true)
  if (preferenceError) return json({ error: preferenceError.message }, 500)

  const preferenceFor = new Map(
    (preferences ?? []).map((preference: Record<string, unknown>) => [
      `${preference.patient_id}:${preference.kind}`,
      preference,
    ]),
  )

  const from = new Date(now.getTime() - WINDOW_BEFORE_MS).toISOString()
  const to = new Date(now.getTime() + WINDOW_AFTER_MS).toISOString()

  const { data: dueEvents, error: dueError } = await supabase
    .from('medication_events')
    .select('id, patient_id, plan_id, scheduled_for')
    .eq('status', 'pending')
    .is('reminder_sent_at', null)
    .gte('scheduled_for', from)
    .lte('scheduled_for', to)
  if (dueError) return json({ error: dueError.message }, 500)

  const planIds = [...new Set((dueEvents ?? []).map((event: { plan_id: string }) => event.plan_id))]
  const { data: plans, error: planError } = planIds.length
    ? await supabase
        .from('medication_plans')
        .select('id, patient_id, reminder_enabled, status')
        .in('id', planIds)
    : { data: [], error: null }
  if (planError) return json({ error: planError.message }, 500)

  const planById = new Map(
    (plans ?? []).map((plan: Record<string, unknown>) => [plan.id, plan]),
  )

  const queue: Array<Record<string, unknown>> = []
  const sentEventIds: string[] = []

  for (const event of dueEvents ?? []) {
    const plan = planById.get(event.plan_id)
    if (!plan || !plan.reminder_enabled || plan.status !== 'active') continue
    if (plan.patient_id !== event.patient_id) continue

    const preference = preferenceFor.get(`${event.patient_id}:medication`)
    if (!preference) continue

    const timezone = timezoneFor.get(event.patient_id) ?? 'Africa/Addis_Ababa'
    if (isQuietHours(now, timezone, preference.quiet_hours_start, preference.quiet_hours_end)) {
      continue
    }

    queue.push({
      patient_id: event.patient_id,
      kind: 'medication',
      scheduled_for: event.scheduled_for,
      title: 'Health reminder',
      body: 'You have a scheduled health reminder.',
      dedupe_key: `dose:${event.id}`,
      status: 'pending',
    })
    sentEventIds.push(event.id)
  }

  // Appointments whose lead-time reminder is now due.
  const { data: dueAppointments, error: appointmentError } = await supabase
    .from('appointments')
    .select('id, patient_id, starts_at, reminder_days_before')
    .eq('status', 'scheduled')
    .is('reminder_sent_at', null)
    .gte('starts_at', nowIso)
    .lte('starts_at', new Date(now.getTime() + 31 * 86_400_000).toISOString())
  if (appointmentError) return json({ error: appointmentError.message }, 500)

  const sentAppointmentIds: string[] = []

  for (const appointment of dueAppointments ?? []) {
    const preference = preferenceFor.get(`${appointment.patient_id}:appointment`)
    if (!preference) continue

    const reminderAt =
      new Date(appointment.starts_at).getTime() - Number(appointment.reminder_days_before) * 86_400_000
    if (reminderAt > now.getTime()) continue

    const timezone = timezoneFor.get(appointment.patient_id) ?? 'Africa/Addis_Ababa'
    if (isQuietHours(now, timezone, preference.quiet_hours_start, preference.quiet_hours_end)) {
      continue
    }

    queue.push({
      patient_id: appointment.patient_id,
      kind: 'appointment',
      scheduled_for: new Date(reminderAt).toISOString(),
      title: 'Health reminder',
      body: 'You have a scheduled health reminder.',
      dedupe_key: `appointment:${appointment.id}`,
      status: 'pending',
    })
    sentAppointmentIds.push(appointment.id)
  }

  if (queue.length > 0) {
    const { error: queueError } = await supabase
      .from('notification_queue')
      .upsert(queue, { onConflict: 'dedupe_key', ignoreDuplicates: true })
    if (queueError) return json({ error: queueError.message }, 500)
  }

  if (sentEventIds.length > 0) {
    const { error: updateError } = await supabase
      .from('medication_events')
      .update({ reminder_sent_at: nowIso })
      .in('id', sentEventIds)
    if (updateError) return json({ error: updateError.message }, 500)
  }

  if (sentAppointmentIds.length > 0) {
    const { error: updateError } = await supabase
      .from('appointments')
      .update({ reminder_sent_at: nowIso })
      .in('id', sentAppointmentIds)
    if (updateError) return json({ error: updateError.message }, 500)
  }

  return json({
    ok: true,
    checkedAt: nowIso,
    medicationRemindersQueued: sentEventIds.length,
    appointmentRemindersQueued: sentAppointmentIds.length,
    note: 'Notification text is deliberately discreet and contains no medicine or diagnosis.',
  })
})
