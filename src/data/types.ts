export type Provenance = 'patient' | 'imported' | 'clinician'
export type UnitsSystem = 'metric' | 'imperial'
export type Instrument = 'BASDAI' | 'BASFI' | 'ASDAS'

export interface Profile {
  id: string
  name: string
  email: string
  timezone: string
  units: UnitsSystem
  consentGiven: boolean
  onboardingComplete: boolean
  diagnosis?: string
  diagnosisDate?: string
  baselineDate?: string
  treatmentStartedOn?: string
  clinic?: string
  createdAt: string
}

export interface SymptomEntry {
  id: string
  patientId: string
  recordedAt: string
  pain: number | null
  stiffnessMinutes: number | null
  fatigue: number | null
  sleepQuality: number | null
  functionalDifficulty: number | null
  mood: number | null
  triggers: string
  notes: string
  sideEffects: string
  provenance: Provenance
}

export interface QuestionnaireAssessment {
  id: string
  patientId: string
  instrument: Instrument
  answers: Record<string, number>
  crp?: number
  score: number
  algorithmVersion: string
  assessedAt: string
  notes?: string
}

export type MedicationStatus = 'active' | 'paused' | 'completed' | 'discontinued'
export type DoseStatus = 'taken' | 'skipped' | 'uncertain' | 'pending'

export interface MedicationPlan {
  id: string
  patientId: string
  name: string
  ingredient?: string
  dose: string
  route: string
  frequency: string
  times: string[]
  startDate: string
  endDate?: string
  prescriber?: string
  status: MedicationStatus
  notes?: string
  reminderEnabled: boolean
  createdAt: string
}

export interface DoseEvent {
  id: string
  patientId: string
  planId: string
  scheduledFor: string
  status: DoseStatus
  recordedAt?: string
  note?: string
}

export interface LabResult {
  id: string
  patientId: string
  /** Report the result was transcribed from, when there was one. */
  panelId?: string
  testName: string
  value: number | string
  unit: string
  referenceLow?: number
  referenceHigh?: number
  referenceText?: string
  collectedAt: string
  laboratory?: string
  source: Provenance
  notes?: string
  createdAt: string
}

export type ImportSource = 'manual' | 'myTestRes' | 'pdf' | 'csv'
export type ImportStatus = 'draft' | 'partial' | 'complete' | 'failed'

/** One venepuncture / one printed report that groups several results. */
export interface LabPanel {
  id: string
  patientId: string
  title: string
  collectedAt: string
  laboratory?: string
  source: Provenance
  notes?: string
  createdAt: string
}

export type AttachmentKind =
  | 'lab-report'
  | 'imaging'
  | 'prescription'
  | 'referral'
  | 'photo'
  | 'other'

/**
 * Metadata for a file in a private Supabase Storage bucket. The file itself
 * never lives in this table; storage_path is always "<patient uuid>/<name>".
 */
export interface Attachment {
  id: string
  patientId: string
  documentId?: string
  labPanelId?: string
  importBatchId?: string
  storageBucket: 'medical-documents' | 'progress-photos'
  storagePath: string
  fileName: string
  mimeType: string
  byteSize?: number
  sha256?: string
  kind: AttachmentKind
  capturedOn?: string
  notes?: string
  createdAt: string
}

/** Provenance for a set of records added together (e.g. an imported PDF). */
export interface ImportBatch {
  id: string
  patientId: string
  label: string
  source: ImportSource
  status: ImportStatus
  itemCount: number
  notes?: string
  createdAt: string
}

export type AppointmentKind = 'follow-up' | 'initial' | 'review' | 'infusion' | 'other'
export type AppointmentStatus = 'scheduled' | 'completed' | 'cancelled' | 'rescheduled'

export interface AppointmentTask {
  id: string
  label: string
  done: boolean
}

export interface Appointment {
  id: string
  patientId: string
  startsAt: string
  timezone: string
  clinician?: string
  location?: string
  kind: AppointmentKind
  status: AppointmentStatus
  notes?: string
  questions: string[]
  tasks: AppointmentTask[]
  reminderDaysBefore: number
  createdAt: string
}

export type DocumentCategory =
  | 'diagnosis'
  | 'note'
  | 'imaging'
  | 'prescription'
  | 'lab-report'
  | 'referral'
  | 'other'

export interface MedicalDocument {
  id: string
  patientId: string
  title: string
  category: DocumentCategory
  occurredOn: string
  clinician?: string
  body?: string
  source: Provenance
  createdAt: string
}

export type PhotoView = 'front' | 'side' | 'back' | 'other'

export interface ProgressPhoto {
  id: string
  patientId: string
  takenOn: string
  view: PhotoView
  dataUrl: string
  notes?: string
  createdAt: string
}

export interface ReminderPreference {
  id: string
  patientId: string
  kind: 'medication' | 'appointment' | 'check-in'
  enabled: boolean
  quietHoursStart: string
  quietHoursEnd: string
  discreetLockScreen: boolean
}

/* ------------------------------------------------------------------ */
/*                             Clinic model                            */
/* ------------------------------------------------------------------ */

export type OrgRole = 'owner' | 'clinician' | 'coordinator' | 'viewer'

export interface Organization {
  id: string
  name: string
  createdAt: string
}

export interface Membership {
  id: string
  orgId: string
  userId: string
  role: OrgRole
  createdAt: string
}

export interface PatientConsent {
  id: string
  orgId: string
  patientId: string
  grantedToUserId: string
  scope: 'read' | 'read-write'
  grantedAt: string
  revokedAt?: string
}

export interface AuditEvent {
  id: string
  actorId: string
  orgId?: string
  patientId?: string
  action: string
  entity?: string
  at: string
}

/* ------------------------------------------------------------------ */
/*                            App container                           */
/* ------------------------------------------------------------------ */

export interface AppData {
  profile: Profile
  symptomEntries: SymptomEntry[]
  assessments: QuestionnaireAssessment[]
  medicationPlans: MedicationPlan[]
  doseEvents: DoseEvent[]
  labResults: LabResult[]
  labPanels: LabPanel[]
  appointments: Appointment[]
  documents: MedicalDocument[]
  attachments: Attachment[]
  importBatches: ImportBatch[]
  photos: ProgressPhoto[]
  reminders: ReminderPreference[]
  memberships: Membership[]
  consents: PatientConsent[]
  auditEvents: AuditEvent[]
  lastSyncedAt: string | null
}

export interface OutboxItem {
  id: string
  entity: string
  operation: 'upsert' | 'delete'
  payload: unknown
  createdAt: string
  attempts: number
}
