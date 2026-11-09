import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Appointment, OutboxItem } from '@/data/types'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabaseConfigured = Boolean(url && anonKey)

export const supabase: SupabaseClient | null = url && anonKey
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
        storageKey: 'myrheumapp-auth',
      },
    })
  : null

export const syncCapability = supabaseConfigured
  ? {
      remote: true as const,
      message:
        'Changes save on this device first and are queued for your Supabase account when online.',
    }
  : {
      remote: false as const,
      message:
        'Local-only demo mode. Data stays in this browser. Add Supabase environment variables to sync across devices.',
    }

export interface RemoteProfile {
  id: string
  email: string
}

export const getRemoteUser = async (): Promise<RemoteProfile | null> => {
  if (!supabase) return null
  const { data, error } = await supabase.auth.getUser()
  if (error) return null
  return data.user ? { id: data.user.id, email: data.user.email ?? '' } : null
}

export const signInRemote = async (email: string, password: string) => {
  if (!supabase) throw new Error('Supabase is not configured')
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw new Error(error.message)
}

export const signUpRemote = async (email: string, password: string) => {
  if (!supabase) throw new Error('Supabase is not configured')
  const { error } = await supabase.auth.signUp({ email, password })
  if (error) throw new Error(error.message)
}

export const signOutRemote = async () => {
  if (!supabase) return
  await supabase.auth.signOut()
}

const TABLE_BY_ENTITY: Record<string, string> = {
  profile: 'profiles',
  symptomEntry: 'symptom_entries',
  assessment: 'questionnaire_assessments',
  medicationPlan: 'medication_plans',
  doseEvent: 'medication_events',
  labResult: 'lab_results',
  appointment: 'appointments',
  document: 'medical_documents',
  reminders: 'reminder_preferences',
}

export const isRelayable = (entity: string): boolean => entity in TABLE_BY_ENTITY

type Row = Record<string, unknown>

const dateOnly = (value: unknown): string | null => {
  if (typeof value !== 'string' || value.length === 0) return null
  return value.slice(0, 10)
}

const numericValue = (value: unknown): number | null => {
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? number : null
}

/**
 * Maps the app's camelCase domain objects onto the SQL schema. Keeping the
 * mapping in one place means a schema change breaks compilation here, not
 * silently at runtime.
 */
export const toRemoteRow = (entity: string, payload: unknown): Row => {
  const item = payload as Record<string, unknown>
  switch (entity) {
    case 'profile':
      return {
        id: item.id,
        name: item.name,
        email: item.email,
        timezone: item.timezone,
        units: item.units,
        consent_given: item.consentGiven,
        onboarding_complete: item.onboardingComplete,
        diagnosis: item.diagnosis ?? null,
        diagnosis_date: item.diagnosisDate ?? null,
        baseline_date: item.baselineDate ?? null,
        treatment_started_on: item.treatmentStartedOn ?? null,
        clinic: item.clinic ?? null,
        created_at: item.createdAt,
      }
    case 'symptomEntry':
      return {
        id: item.id,
        patient_id: item.patientId,
        recorded_at: item.recordedAt,
        pain: item.pain,
        stiffness_minutes: item.stiffnessMinutes,
        fatigue: item.fatigue,
        sleep_quality: item.sleepQuality,
        functional_difficulty: item.functionalDifficulty,
        mood: item.mood,
        triggers: item.triggers ?? '',
        notes: item.notes ?? '',
        side_effects: item.sideEffects ?? '',
        provenance: item.provenance ?? 'patient',
      }
    case 'assessment':
      return {
        id: item.id,
        patient_id: item.patientId,
        instrument: item.instrument,
        answers: item.answers ?? {},
        crp: item.crp ?? null,
        score: item.score,
        algorithm_version: item.algorithmVersion,
        assessed_at: item.assessedAt,
        notes: item.notes ?? null,
      }
    case 'medicationPlan':
      return {
        id: item.id,
        patient_id: item.patientId,
        name: item.name,
        ingredient: item.ingredient ?? null,
        dose: item.dose,
        route: item.route,
        frequency: item.frequency,
        times: item.times ?? [],
        start_date: dateOnly(item.startDate),
        end_date: dateOnly(item.endDate),
        prescriber: item.prescriber ?? null,
        status: item.status,
        notes: item.notes ?? null,
        reminder_enabled: item.reminderEnabled ?? false,
        created_at: item.createdAt,
      }
    case 'doseEvent':
      return {
        id: item.id,
        patient_id: item.patientId,
        plan_id: item.planId,
        scheduled_for: item.scheduledFor,
        status: item.status,
        recorded_at: item.recordedAt ?? null,
        note: item.note ?? null,
      }
    case 'labResult': {
      const numeric = numericValue(item.value)
      return {
        id: item.id,
        patient_id: item.patientId,
        test_name: item.testName,
        value_numeric: numeric,
        value_text: String(item.value),
        unit: item.unit,
        reference_low: item.referenceLow ?? null,
        reference_high: item.referenceHigh ?? null,
        reference_text: item.referenceText ?? null,
        collected_at: item.collectedAt,
        laboratory: item.laboratory ?? null,
        source: item.source ?? 'patient',
        notes: item.notes ?? null,
        created_at: item.createdAt,
      }
    }
    case 'appointment':
      return {
        id: item.id,
        patient_id: item.patientId,
        starts_at: item.startsAt,
        timezone: item.timezone,
        clinician: item.clinician ?? null,
        location: item.location ?? null,
        kind: item.kind,
        status: item.status,
        notes: item.notes ?? null,
        questions: item.questions ?? [],
        reminder_days_before: item.reminderDaysBefore ?? 1,
        created_at: item.createdAt,
      }
    case 'document':
      return {
        id: item.id,
        patient_id: item.patientId,
        title: item.title,
        category: item.category,
        occurred_on: item.occurredOn,
        clinician: item.clinician ?? null,
        body: item.body ?? null,
        source: item.source ?? 'patient',
        created_at: item.createdAt,
      }
    case 'reminders':
      return {
        id: item.id,
        patient_id: item.patientId,
        kind: item.kind,
        enabled: item.enabled,
        quiet_hours_start: item.quietHoursStart,
        quiet_hours_end: item.quietHoursEnd,
        discreet_lock_screen: item.discreetLockScreen,
      }
    default:
      return item
  }
}

/**
 * Push one queued mutation. Throws on failure so the caller keeps it queued.
 * RLS on the server is the authority; the client never sends another user's id.
 */
export const pushOutboxItem = async (item: OutboxItem): Promise<void> => {
  if (!supabase) throw new Error('Supabase is not configured')
  const table = TABLE_BY_ENTITY[item.entity]
  if (!table) return

  if (item.operation === 'delete') {
    const id = (item.payload as { id?: string }).id
    if (!id) return
    const { error } = await supabase.from(table).delete().eq('id', id)
    if (error) throw new Error(error.message)
    return
  }

  const row = toRemoteRow(item.entity, item.payload)
  const { error } = await supabase.from(table).upsert(row, { onConflict: 'id' })
  if (error) throw new Error(error.message)

  // Appointment tasks live in their own table. Replace them atomically enough
  // for offline replay: delete then insert; a failure leaves the appointment
  // queued and the next replay repeats the idempotent replacement.
  if (item.entity === 'appointment') {
    const appointment = item.payload as Appointment
    const { error: deleteError } = await supabase
      .from('appointment_tasks')
      .delete()
      .eq('appointment_id', appointment.id)
    if (deleteError) throw new Error(deleteError.message)

    if (appointment.tasks.length > 0) {
      const { error: insertError } = await supabase.from('appointment_tasks').insert(
        appointment.tasks.map((task) => ({
          id: task.id,
          appointment_id: appointment.id,
          patient_id: appointment.patientId,
          label: task.label,
          done: task.done,
        })),
      )
      if (insertError) throw new Error(insertError.message)
    }
  }
}
