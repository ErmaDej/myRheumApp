import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type {
  AppData,
  Appointment,
  Attachment,
  DoseEvent,
  ImportBatch,
  LabPanel,
  LabResult,
  MedicalDocument,
  MedicationPlan,
  OutboxItem,
  Profile,
  QuestionnaireAssessment,
  ReminderPreference,
  SymptomEntry,
} from '@/data/types'

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
  labPanel: 'lab_panels',
  attachment: 'attachments',
  importBatch: 'import_batches',
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
        panel_id: item.panelId ?? null,
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
    case 'labPanel':
      return {
        id: item.id,
        patient_id: item.patientId,
        title: item.title,
        collected_at: item.collectedAt,
        laboratory: item.laboratory ?? null,
        source: item.source ?? 'patient',
        notes: item.notes ?? null,
        created_at: item.createdAt,
      }
    case 'attachment':
      return {
        id: item.id,
        patient_id: item.patientId,
        document_id: item.documentId ?? null,
        lab_panel_id: item.labPanelId ?? null,
        import_batch_id: item.importBatchId ?? null,
        storage_bucket: item.storageBucket ?? 'medical-documents',
        storage_path: item.storagePath,
        file_name: item.fileName,
        mime_type: item.mimeType,
        byte_size: item.byteSize ?? null,
        sha256: item.sha256 ?? null,
        kind: item.kind ?? 'other',
        captured_on: item.capturedOn ? dateOnly(item.capturedOn) : null,
        notes: item.notes ?? null,
        created_at: item.createdAt,
      }
    case 'importBatch':
      return {
        id: item.id,
        patient_id: item.patientId,
        label: item.label,
        source: item.source ?? 'manual',
        status: item.status ?? 'complete',
        item_count: item.itemCount ?? 0,
        notes: item.notes ?? null,
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

/* ------------------------------------------------------------------ */
/*                      private attachment storage                    */
/* ------------------------------------------------------------------ */

const bucketFor = (bucket: Attachment['storageBucket'] = 'medical-documents'): string => bucket

const safeFileName = (name: string): string =>
  name
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(-80) || 'attachment'

/**
 * Upload one file to the private bucket under the owner's folder.
 * Returns the storage path; the caller persists the metadata row afterwards.
 */
export const uploadAttachmentFile = async (
  patientId: string,
  file: File,
  bucket: Attachment['storageBucket'] = 'medical-documents',
): Promise<string> => {
  if (!supabase) throw new Error('Supabase is not configured')
  const path = `${patientId}/${uidForStorage()}-${safeFileName(file.name)}`
  const { error } = await supabase.storage.from(bucketFor(bucket)).upload(path, file, {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  })
  if (error) throw new Error(error.message)
  return path
}

const uidForStorage = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

/** Short-lived, read-only URL for a private object. */
export const createAttachmentUrl = async (
  attachment: Pick<Attachment, 'storageBucket' | 'storagePath'>,
  expiresIn = 600,
): Promise<string> => {
  if (!supabase) throw new Error('Supabase is not configured')
  const { data, error } = await supabase.storage
    .from(bucketFor(attachment.storageBucket))
    .createSignedUrl(attachment.storagePath, expiresIn)
  if (error || !data?.signedUrl) throw new Error(error?.message ?? 'Could not create a download link.')
  return data.signedUrl
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
    const payload = item.payload as { id?: string; storageBucket?: string; storagePath?: string }
    const id = payload.id
    if (!id) return
    const { error } = await supabase.from(table).delete().eq('id', id)
    if (error) throw new Error(error.message)
    // Object deletion is best-effort: the row is gone, and an orphaned private
    // object is still protected by the owner-folder storage policy.
    if (item.entity === 'attachment' && payload.storageBucket && payload.storagePath) {
      await supabase.storage.from(payload.storageBucket).remove([payload.storagePath])
    }
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

/* ------------------------------------------------------------------ */
/*                         remote hydration                           */
/* ------------------------------------------------------------------ */

export interface RemoteSnapshot {
  profile: Profile | null
  symptomEntries: SymptomEntry[]
  assessments: QuestionnaireAssessment[]
  medicationPlans: MedicationPlan[]
  doseEvents: DoseEvent[]
  labPanels: LabPanel[]
  labResults: LabResult[]
  appointments: Appointment[]
  documents: MedicalDocument[]
  attachments: Attachment[]
  importBatches: ImportBatch[]
  reminders: ReminderPreference[]
}

const asText = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback

const asOptionalText = (value: unknown): string | undefined =>
  typeof value === 'string' && value.length > 0 ? value : undefined

const asNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? number : null
}

const asOptionalNumber = (value: unknown): number | undefined => asNumber(value) ?? undefined

const asBoolean = (value: unknown): boolean => value === true

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []

const asAnswers = (value: unknown): Record<string, number> => {
  if (!value || typeof value !== 'object') return {}
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .map(([key, answer]) => [key, asNumber(answer)])
      .filter((entry): entry is [string, number] => entry[1] !== null),
  )
}

const rowsOf = (value: unknown): Row[] =>
  Array.isArray(value) ? (value as Row[]) : []

/**
 * Read every table the signed-in account owns. RLS does the filtering, so no
 * patient id is trusted from the client. Any single failed query fails the
 * pull: a partial snapshot could silently hide records.
 */
export const fetchRemoteSnapshot = async (): Promise<RemoteSnapshot | null> => {
  if (!supabase) return null

  const query = async (table: string): Promise<Row[]> => {
    const { data, error } = await supabase.from(table).select('*')
    if (error) throw new Error(`${table}: ${error.message}`)
    return rowsOf(data)
  }

  const [
    profileRows,
    symptomRows,
    assessmentRows,
    planRows,
    doseRows,
    panelRows,
    labRows,
    appointmentRows,
    taskRows,
    documentRows,
    attachmentRows,
    batchRows,
    reminderRows,
  ] = await Promise.all([
    query('profiles'),
    query('symptom_entries'),
    query('questionnaire_assessments'),
    query('medication_plans'),
    query('medication_events'),
    query('lab_panels'),
    query('lab_results'),
    query('appointments'),
    query('appointment_tasks'),
    query('medical_documents'),
    query('attachments'),
    query('import_batches'),
    query('reminder_preferences'),
  ])

  const profileRow = profileRows[0]
  const profile: Profile | null = profileRow
    ? {
        id: asText(profileRow.id),
        name: asText(profileRow.name, 'Patient'),
        email: asText(profileRow.email),
        timezone: asText(profileRow.timezone, 'Africa/Addis_Ababa'),
        units: profileRow.units === 'imperial' ? 'imperial' : 'metric',
        consentGiven: asBoolean(profileRow.consent_given),
        onboardingComplete: asBoolean(profileRow.onboarding_complete),
        diagnosis: asOptionalText(profileRow.diagnosis),
        diagnosisDate: asOptionalText(profileRow.diagnosis_date),
        baselineDate: asOptionalText(profileRow.baseline_date),
        treatmentStartedOn: asOptionalText(profileRow.treatment_started_on),
        clinic: asOptionalText(profileRow.clinic),
        createdAt: asText(profileRow.created_at, new Date().toISOString()),
      }
    : null

  const tasksByAppointment = new Map<string, Appointment['tasks']>()
  for (const task of taskRows) {
    const appointmentId = asText(task.appointment_id)
    const list = tasksByAppointment.get(appointmentId) ?? []
    list.push({
      id: asText(task.id),
      label: asText(task.label),
      done: asBoolean(task.done),
    })
    tasksByAppointment.set(appointmentId, list)
  }

  return {
    profile,
    symptomEntries: symptomRows.map((row) => ({
      id: asText(row.id),
      patientId: asText(row.patient_id),
      recordedAt: asText(row.recorded_at),
      pain: asNumber(row.pain),
      stiffnessMinutes: asNumber(row.stiffness_minutes),
      fatigue: asNumber(row.fatigue),
      sleepQuality: asNumber(row.sleep_quality),
      functionalDifficulty: asNumber(row.functional_difficulty),
      mood: asNumber(row.mood),
      triggers: asText(row.triggers),
      notes: asText(row.notes),
      sideEffects: asText(row.side_effects),
      provenance: (row.provenance === 'imported' || row.provenance === 'clinician'
        ? row.provenance
        : 'patient') as SymptomEntry['provenance'],
    })),
    assessments: assessmentRows.map((row) => ({
      id: asText(row.id),
      patientId: asText(row.patient_id),
      instrument: (row.instrument as QuestionnaireAssessment['instrument']) ?? 'BASDAI',
      answers: asAnswers(row.answers),
      crp: asOptionalNumber(row.crp),
      score: asNumber(row.score) ?? 0,
      algorithmVersion: asText(row.algorithm_version),
      assessedAt: asText(row.assessed_at),
      notes: asOptionalText(row.notes),
    })),
    medicationPlans: planRows.map((row) => ({
      id: asText(row.id),
      patientId: asText(row.patient_id),
      name: asText(row.name),
      ingredient: asOptionalText(row.ingredient),
      dose: asText(row.dose),
      route: asText(row.route, 'Oral'),
      frequency: asText(row.frequency),
      times: asStringArray(row.times),
      startDate: asText(row.start_date),
      endDate: asOptionalText(row.end_date),
      prescriber: asOptionalText(row.prescriber),
      status: (row.status as MedicationPlan['status']) ?? 'active',
      notes: asOptionalText(row.notes),
      reminderEnabled: asBoolean(row.reminder_enabled),
      createdAt: asText(row.created_at),
    })),
    doseEvents: doseRows.map((row) => ({
      id: asText(row.id),
      patientId: asText(row.patient_id),
      planId: asText(row.plan_id),
      scheduledFor: asText(row.scheduled_for),
      status: (row.status as DoseEvent['status']) ?? 'pending',
      recordedAt: asOptionalText(row.recorded_at),
      note: asOptionalText(row.note),
    })),
    labPanels: panelRows.map((row) => ({
      id: asText(row.id),
      patientId: asText(row.patient_id),
      title: asText(row.title),
      collectedAt: asText(row.collected_at),
      laboratory: asOptionalText(row.laboratory),
      source: (row.source as LabPanel['source']) ?? 'patient',
      notes: asOptionalText(row.notes),
      createdAt: asText(row.created_at),
    })),
    labResults: labRows.map((row) => {
      const numeric = asNumber(row.value_numeric)
      return {
        id: asText(row.id),
        patientId: asText(row.patient_id),
        panelId: asOptionalText(row.panel_id),
        testName: asText(row.test_name),
        value: numeric ?? asText(row.value_text),
        unit: asText(row.unit),
        referenceLow: asOptionalNumber(row.reference_low),
        referenceHigh: asOptionalNumber(row.reference_high),
        referenceText: asOptionalText(row.reference_text),
        collectedAt: asText(row.collected_at),
        laboratory: asOptionalText(row.laboratory),
        source: (row.source as LabResult['source']) ?? 'patient',
        notes: asOptionalText(row.notes),
        createdAt: asText(row.created_at),
      }
    }),
    appointments: appointmentRows.map((row) => {
      const id = asText(row.id)
      return {
        id,
        patientId: asText(row.patient_id),
        startsAt: asText(row.starts_at),
        timezone: asText(row.timezone, 'Africa/Addis_Ababa'),
        clinician: asOptionalText(row.clinician),
        location: asOptionalText(row.location),
        kind: (row.kind as Appointment['kind']) ?? 'follow-up',
        status: (row.status as Appointment['status']) ?? 'scheduled',
        notes: asOptionalText(row.notes),
        questions: asStringArray(row.questions),
        tasks: tasksByAppointment.get(id) ?? [],
        reminderDaysBefore: asOptionalNumber(row.reminder_days_before) ?? 1,
        createdAt: asText(row.created_at),
      }
    }),
    documents: documentRows.map((row) => ({
      id: asText(row.id),
      patientId: asText(row.patient_id),
      title: asText(row.title),
      category: (row.category as MedicalDocument['category']) ?? 'other',
      occurredOn: asText(row.occurred_on),
      clinician: asOptionalText(row.clinician),
      body: asOptionalText(row.body),
      source: (row.source as MedicalDocument['source']) ?? 'patient',
      createdAt: asText(row.created_at),
    })),
    attachments: attachmentRows.map((row) => ({
      id: asText(row.id),
      patientId: asText(row.patient_id),
      documentId: asOptionalText(row.document_id),
      labPanelId: asOptionalText(row.lab_panel_id),
      importBatchId: asOptionalText(row.import_batch_id),
      storageBucket:
        row.storage_bucket === 'progress-photos' ? 'progress-photos' : 'medical-documents',
      storagePath: asText(row.storage_path),
      fileName: asText(row.file_name),
      mimeType: asText(row.mime_type, 'application/octet-stream'),
      byteSize: asOptionalNumber(row.byte_size),
      sha256: asOptionalText(row.sha256),
      kind: (row.kind as Attachment['kind']) ?? 'other',
      capturedOn: asOptionalText(row.captured_on),
      notes: asOptionalText(row.notes),
      createdAt: asText(row.created_at),
    })),
    importBatches: batchRows.map((row) => ({
      id: asText(row.id),
      patientId: asText(row.patient_id),
      label: asText(row.label),
      source: (row.source as ImportBatch['source']) ?? 'manual',
      status: (row.status as ImportBatch['status']) ?? 'complete',
      itemCount: asNumber(row.item_count) ?? 0,
      notes: asOptionalText(row.notes),
      createdAt: asText(row.created_at),
    })),
    reminders: reminderRows.map((row) => ({
      id: asText(row.id),
      patientId: asText(row.patient_id),
      kind: (row.kind as ReminderPreference['kind']) ?? 'check-in',
      enabled: asBoolean(row.enabled),
      quietHoursStart: asText(row.quiet_hours_start, '22:00').slice(0, 5),
      quietHoursEnd: asText(row.quiet_hours_end, '07:00').slice(0, 5),
      discreetLockScreen: row.discreet_lock_screen !== false,
    })),
  }
}

/**
 * Merge a remote snapshot into local state. Same-id remote rows win; rows that
 * exist only locally are kept so an unsynced offline entry is never dropped.
 */
export const mergeRemoteSnapshot = (local: AppData, remote: RemoteSnapshot): AppData => {
  const merge = <T extends { id: string }>(localRows: T[], remoteRows: T[]): T[] => {
    const remoteIds = new Set(remoteRows.map((row) => row.id))
    return [...remoteRows, ...localRows.filter((row) => !remoteIds.has(row.id))]
  }

  return {
    ...local,
    profile: remote.profile ?? local.profile,
    symptomEntries: merge(local.symptomEntries, remote.symptomEntries),
    assessments: merge(local.assessments, remote.assessments),
    medicationPlans: merge(local.medicationPlans, remote.medicationPlans),
    doseEvents: merge(local.doseEvents, remote.doseEvents),
    labPanels: merge(local.labPanels, remote.labPanels),
    labResults: merge(local.labResults, remote.labResults),
    appointments: merge(local.appointments, remote.appointments),
    documents: merge(local.documents, remote.documents),
    attachments: merge(local.attachments, remote.attachments),
    importBatches: merge(local.importBatches, remote.importBatches),
    reminders: merge(local.reminders, remote.reminders),
  }
}
