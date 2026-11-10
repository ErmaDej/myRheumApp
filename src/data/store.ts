import type {
  AppData,
  Appointment,
  DoseEvent,
  DoseStatus,
  Attachment,
  ImportBatch,
  LabPanel,
  LabResult,
  MedicationPlan,
  OutboxItem,
  ProgressPhoto,
  QuestionnaireAssessment,
  ReminderPreference,
  SymptomEntry,
  MedicalDocument,
  Profile,
} from '@/data/types'
import { createDemoData } from '@/data/seed'
import { uid } from '@/lib/utils'
import { pushOutbox, readOutbox, removeOutbox, writeLocalState } from '@/data/localDb'

export interface AppState {
  data: AppData
  hydrated: boolean
  outbox: OutboxItem[]
  online: boolean
}

export type StoreListener = () => void

export interface StoreOptions {
  persist?: (data: AppData) => Promise<void>
  enqueue?: (item: OutboxItem) => Promise<void>
  dequeue?: (id: string) => Promise<void>
  seed?: () => AppData
}

const nowIso = () => new Date().toISOString()

export class AppStore {
  private state: AppState
  private listeners = new Set<StoreListener>()
  private persistTimer: ReturnType<typeof setTimeout> | null = null
  private options: Required<Pick<StoreOptions, 'persist' | 'enqueue'>> & StoreOptions

  constructor(initial: AppData = createDemoData(), options: StoreOptions = {}) {
    this.state = {
      data: initial,
      hydrated: false,
      outbox: [],
      online: typeof navigator === 'undefined' ? true : navigator.onLine,
    }
    this.options = {
      persist: options.persist ?? writeLocalState,
      enqueue: options.enqueue ?? pushOutbox,
      dequeue: options.dequeue ?? removeOutbox,
      seed: options.seed,
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleOnline)
      window.addEventListener('offline', this.handleOffline)
    }
  }

  getSnapshot = (): AppState => this.state

  subscribe = (listener: StoreListener): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private handleOnline = () => this.setOnline(true)
  private handleOffline = () => this.setOnline(false)

  private setOnline(online: boolean) {
    if (this.state.online === online) return
    this.state = { ...this.state, online }
    this.emit()
  }

  private emit() {
    this.listeners.forEach((listener) => listener())
  }

  private schedulePersist() {
    if (this.persistTimer) clearTimeout(this.persistTimer)
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null
      void this.options.persist(this.state.data)
    }, 120)
  }

  async hydrate(data: AppData | null, outbox: OutboxItem[] = []): Promise<void> {
    this.state = {
      ...this.state,
      data: data ?? this.options.seed?.() ?? this.state.data,
      outbox,
      hydrated: true,
    }
    this.emit()
    if (!data) await this.options.persist(this.state.data)
  }

  async flush(): Promise<void> {
    if (this.persistTimer) {
      clearTimeout(this.persistTimer)
      this.persistTimer = null
    }
    await this.options.persist(this.state.data)
  }

  private commit(data: AppData) {
    this.state = { ...this.state, data: { ...data, lastSyncedAt: data.lastSyncedAt } }
    this.emit()
    this.schedulePersist()
  }

  private queue(entity: string, operation: OutboxItem['operation'], payload: unknown) {
    const item: OutboxItem = {
      id: uid('outbox'),
      entity,
      operation,
      payload,
      createdAt: nowIso(),
      attempts: 0,
    }
    this.state = { ...this.state, outbox: [...this.state.outbox, item] }
    void this.options.enqueue(item)
    this.emit()
  }

  private save(entity: string, payload: { id: string }) {
    this.queue(entity, 'upsert', payload)
  }

  /* ----------------------------- profile ----------------------------- */

  updateProfile(patch: Partial<Profile>): void {
    this.commit({ ...this.state.data, profile: { ...this.state.data.profile, ...patch } })
    this.save('profile', { ...this.state.data.profile, ...patch })
  }

  /* -------------------------- symptom journal ------------------------ */

  saveSymptomEntry(entry: SymptomEntry): void {
    const exists = this.state.data.symptomEntries.some((item) => item.id === entry.id)
    const symptomEntries = exists
      ? this.state.data.symptomEntries.map((item) => (item.id === entry.id ? entry : item))
      : [entry, ...this.state.data.symptomEntries]
    this.commit({ ...this.state.data, symptomEntries })
    this.save('symptomEntry', entry)
  }

  deleteSymptomEntry(id: string): void {
    this.commit({
      ...this.state.data,
      symptomEntries: this.state.data.symptomEntries.filter((entry) => entry.id !== id),
    })
    this.queue('symptomEntry', 'delete', { id })
  }

  /* --------------------------- assessments --------------------------- */

  saveAssessment(assessment: QuestionnaireAssessment): void {
    const assessments = [
      assessment,
      ...this.state.data.assessments.filter((item) => item.id !== assessment.id),
    ]
    this.commit({ ...this.state.data, assessments })
    this.save('assessment', assessment)
  }

  /* --------------------------- medications --------------------------- */

  saveMedicationPlan(plan: MedicationPlan): void {
    const exists = this.state.data.medicationPlans.some((item) => item.id === plan.id)
    const medicationPlans = exists
      ? this.state.data.medicationPlans.map((item) => (item.id === plan.id ? plan : item))
      : [plan, ...this.state.data.medicationPlans]
    this.commit({ ...this.state.data, medicationPlans })
    this.save('medicationPlan', plan)
  }

  archiveMedicationPlan(id: string): void {
    const medicationPlans = this.state.data.medicationPlans.map((plan) =>
      plan.id === id ? { ...plan, status: 'discontinued' as const } : plan,
    )
    this.commit({ ...this.state.data, medicationPlans })
    const plan = medicationPlans.find((item) => item.id === id)
    if (plan) this.save('medicationPlan', plan)
  }

  recordDose(eventId: string, status: DoseStatus, note?: string): void {
    const recordedAt = status === 'pending' ? undefined : nowIso()
    const doseEvents = this.state.data.doseEvents.map((event) =>
      event.id === eventId ? { ...event, status, recordedAt, note: note ?? event.note } : event,
    )
    this.commit({ ...this.state.data, doseEvents })
    const updated = doseEvents.find((event) => event.id === eventId)
    if (updated) this.save('doseEvent', updated)
  }

  saveDoseEvent(event: DoseEvent): void {
    const exists = this.state.data.doseEvents.some((item) => item.id === event.id)
    const doseEvents = exists
      ? this.state.data.doseEvents.map((item) => (item.id === event.id ? event : item))
      : [...this.state.data.doseEvents, event]
    this.commit({ ...this.state.data, doseEvents })
    this.save('doseEvent', event)
  }

  /* ----------------------------- laboratory -------------------------- */

  saveLabResult(lab: LabResult): void {
    const exists = this.state.data.labResults.some((item) => item.id === lab.id)
    const labResults = exists
      ? this.state.data.labResults.map((item) => (item.id === lab.id ? lab : item))
      : [lab, ...this.state.data.labResults]
    this.commit({ ...this.state.data, labResults })
    this.save('labResult', lab)
  }

  deleteLabResult(id: string): void {
    this.commit({
      ...this.state.data,
      labResults: this.state.data.labResults.filter((lab) => lab.id !== id),
    })
    this.queue('labResult', 'delete', { id })
  }

  saveLabPanel(panel: LabPanel): void {
    const exists = this.state.data.labPanels.some((item) => item.id === panel.id)
    const labPanels = exists
      ? this.state.data.labPanels.map((item) => (item.id === panel.id ? panel : item))
      : [panel, ...this.state.data.labPanels]
    this.commit({ ...this.state.data, labPanels })
    this.save('labPanel', panel)
  }

  /**
   * Save a whole report in one commit so the panel and its results appear
   * together. Every result is still queued individually for sync.
   */
  saveLabReport(panel: LabPanel, results: LabResult[]): void {
    const resultIds = new Set(results.map((result) => result.id))
    const otherResults = this.state.data.labResults.filter((result) => !resultIds.has(result.id))
    const labPanels = [
      panel,
      ...this.state.data.labPanels.filter((item) => item.id !== panel.id),
    ]
    this.commit({
      ...this.state.data,
      labPanels,
      labResults: [...results, ...otherResults],
    })
    this.save('labPanel', panel)
    results.forEach((result) => this.save('labResult', result))
  }

  deleteLabPanel(id: string): void {
    this.commit({
      ...this.state.data,
      labPanels: this.state.data.labPanels.filter((panel) => panel.id !== id),
      // Keep the individual results; only the grouping goes away.
      labResults: this.state.data.labResults.map((result) =>
        result.panelId === id ? { ...result, panelId: undefined } : result,
      ),
      attachments: this.state.data.attachments.map((attachment) =>
        attachment.labPanelId === id ? { ...attachment, labPanelId: undefined } : attachment,
      ),
    })
    this.queue('labPanel', 'delete', { id })
  }

  saveImportBatch(batch: ImportBatch): void {
    const importBatches = [
      batch,
      ...this.state.data.importBatches.filter((item) => item.id !== batch.id),
    ]
    this.commit({ ...this.state.data, importBatches })
    this.save('importBatch', batch)
  }

  /* ---------------------------- attachments -------------------------- */

  // Attachment metadata is synced; the bytes go to private Supabase Storage
  // separately, so a failed upload never leaves a row pointing at nothing.
  saveAttachment(attachment: Attachment): void {
    const attachments = [
      attachment,
      ...this.state.data.attachments.filter((item) => item.id !== attachment.id),
    ]
    this.commit({ ...this.state.data, attachments })
    this.save('attachment', attachment)
  }

  deleteAttachment(id: string): void {
    this.commit({
      ...this.state.data,
      attachments: this.state.data.attachments.filter((attachment) => attachment.id !== id),
    })
    this.queue('attachment', 'delete', { id })
  }

  /* ---------------------------- appointments ------------------------- */

  saveAppointment(appointment: Appointment): void {
    const exists = this.state.data.appointments.some((item) => item.id === appointment.id)
    const appointments = exists
      ? this.state.data.appointments.map((item) => (item.id === appointment.id ? appointment : item))
      : [appointment, ...this.state.data.appointments]
    this.commit({ ...this.state.data, appointments })
    this.save('appointment', appointment)
  }

  toggleAppointmentTask(appointmentId: string, taskId: string): void {
    const appointments = this.state.data.appointments.map((appointment) =>
      appointment.id === appointmentId
        ? {
            ...appointment,
            tasks: appointment.tasks.map((task) =>
              task.id === taskId ? { ...task, done: !task.done } : task,
            ),
          }
        : appointment,
    )
    this.commit({ ...this.state.data, appointments })
    const updated = appointments.find((item) => item.id === appointmentId)
    if (updated) this.save('appointment', updated)
  }

  /* ------------------------------ documents -------------------------- */

  saveDocument(document: MedicalDocument): void {
    const exists = this.state.data.documents.some((item) => item.id === document.id)
    const documents = exists
      ? this.state.data.documents.map((item) => (item.id === document.id ? document : item))
      : [document, ...this.state.data.documents]
    this.commit({ ...this.state.data, documents })
    this.save('document', document)
  }

  deleteDocument(id: string): void {
    this.commit({
      ...this.state.data,
      documents: this.state.data.documents.filter((document) => document.id !== id),
    })
    this.queue('document', 'delete', { id })
  }

  /* ------------------------------- photos ---------------------------- */

  // Photos stay on this device on purpose: sensitive images are never queued
  // for upload from this local build.
  savePhoto(photo: ProgressPhoto): void {
    const photos = [photo, ...this.state.data.photos.filter((item) => item.id !== photo.id)]
    this.commit({ ...this.state.data, photos })
  }

  deletePhoto(id: string): void {
    this.commit({
      ...this.state.data,
      photos: this.state.data.photos.filter((photo) => photo.id !== id),
    })
  }

  /* ------------------------------ reminders -------------------------- */

  saveReminder(reminder: ReminderPreference): void {
    const reminders = [
      reminder,
      ...this.state.data.reminders.filter((item) => item.kind !== reminder.kind),
    ]
    this.commit({ ...this.state.data, reminders })
    this.save('reminders', reminder)
  }

  /* ------------------------------- sync ------------------------------ */

  markSynced(at = nowIso()): void {
    this.commit({ ...this.state.data, lastSyncedAt: at })
  }

  removeOutboxItem(id: string): void {
    this.state = { ...this.state, outbox: this.state.outbox.filter((item) => item.id !== id) }
    void this.options.dequeue?.(id)
    this.emit()
  }

  incrementOutboxAttempt(id: string): void {
    this.state = {
      ...this.state,
      outbox: this.state.outbox.map((item) =>
        item.id === id ? { ...item, attempts: item.attempts + 1 } : item,
      ),
    }
    this.emit()
  }

  /* ------------------------------ lifecycle -------------------------- */

  resetToDemo(seed: () => AppData = createDemoData): void {
    this.commit(seed())
    this.markSynced(nowIso())
  }

  clearAll(data: AppData): void {
    // Drop any queued mutations from the previous account so demo edits are
    // never pushed into a real Supabase account.
    const previousOutbox = this.state.outbox
    this.state = { ...this.state, outbox: [] }
    previousOutbox.forEach((item) => void this.options.dequeue?.(item.id))
    this.commit(data)
  }

  /** Replace local state with a merged account snapshot (no outbox writes). */
  replaceData(data: AppData): void {
    this.commit(data)
  }

  destroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleOnline)
      window.removeEventListener('offline', this.handleOffline)
    }
    if (this.persistTimer) clearTimeout(this.persistTimer)
    this.listeners.clear()
  }
}

export const createAppStore = (initial?: AppData, options?: StoreOptions): AppStore =>
  new AppStore(initial, options)

export const loadOutbox = readOutbox
