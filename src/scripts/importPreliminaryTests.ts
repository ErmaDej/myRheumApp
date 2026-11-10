import type { AppData, SymptomEntry } from '@/data/types'
import type { AppStore } from '@/data/store'
import { createDemoData } from '@/data/seed'
import { pushOutbox } from '@/data/localDb'

const nextId = (prefix: string): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}_${crypto.randomUUID()}`
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

// Dedup-and-merge helper for generic entity arrays.
// Preserves IDs from the new items where present; generates one otherwise.
const mergeEntities = <T extends { id?: string }>(
  incoming: T[],
  existing: T[],
  prefix: string,
): T[] => {
  const seen = new Set(existing.map((item) => item.id as string))
  const result: T[] = [...existing]
  for (const item of incoming) {
    const id = item.id ?? nextId(prefix)
    if (!seen.has(id)) {
      seen.add(id)
      result.push({ ...item, id } as T)
    }
  }
  return result
}

// Merge symptom entries with their full, predictable shape.
const mergeSymptoms = (
  incoming: Array<{ id?: string; patientId?: string; recordedAt?: string; pain?: number | null; stiffnessMinutes?: number | null; fatigue?: number | null; sleepQuality?: number | null; functionalDifficulty?: number | null; mood?: number | null; triggers?: string; notes?: string; sideEffects?: string; provenance?: 'patient' | 'imported' | 'clinician' }>,
  existing: SymptomEntry[],
): SymptomEntry[] => {
  const seen = new Set(existing.map((e) => e.id))
  const result = [...existing]
  for (const item of incoming) {
    const id = item.id ?? nextId('sym')
    if (!seen.has(id)) {
      seen.add(id)
      result.push({
        id,
        patientId: item.patientId ?? existing[0]?.patientId ?? '',
        recordedAt: item.recordedAt ?? '',
        pain: item.pain ?? null,
        stiffnessMinutes: item.stiffnessMinutes ?? null,
        fatigue: item.fatigue ?? null,
        sleepQuality: item.sleepQuality ?? null,
        functionalDifficulty: item.functionalDifficulty ?? null,
        mood: item.mood ?? null,
        triggers: item.triggers ?? '',
        notes: item.notes ?? '',
        sideEffects: item.sideEffects ?? '',
        provenance: item.provenance ?? 'patient',
      })
    }
  }
  return result
}

/** Import preliminary test data from a JSON file or seed object.
 *  Merges the imported data into the app store, preserving existing data where appropriate.
 */
export function importPreliminaryTests(importedData: Partial<AppData>, store: AppStore): AppData {
  const current = store.getSnapshot().data

  const profile = importedData.profile ? { ...current.profile, ...importedData.profile } : current.profile

  const symptomEntries = importedData.symptomEntries
    ? mergeSymptoms(importedData.symptomEntries, current.symptomEntries)
    : current.symptomEntries

  const assessments = mergeEntities(importedData.assessments ?? [], current.assessments, 'assess')
  const medicationPlans = mergeEntities(importedData.medicationPlans ?? [], current.medicationPlans, 'plan')
  const doseEvents = mergeEntities(importedData.doseEvents ?? [], current.doseEvents, 'dose')
  const labResults = mergeEntities(importedData.labResults ?? [], current.labResults, 'lab')
  const labPanels = mergeEntities(importedData.labPanels ?? [], current.labPanels, 'panel')
  const appointments = mergeEntities(importedData.appointments ?? [], current.appointments, 'appt')
  const documents = mergeEntities(importedData.documents ?? [], current.documents, 'doc')
  const attachments = mergeEntities(importedData.attachments ?? [], current.attachments, 'att')
  const importBatches = mergeEntities(importedData.importBatches ?? [], current.importBatches, 'batch')
  const reminders = mergeEntities(importedData.reminders ?? [], current.reminders, 'rem')
  const memberships = mergeEntities(importedData.memberships ?? [], current.memberships, 'mem')
  const consents = mergeEntities(importedData.consents ?? [], current.consents, 'cons')
  const auditEvents = mergeEntities(importedData.auditEvents ?? [], current.auditEvents, 'audit')

  const merged: AppData = {
    profile,
    symptomEntries,
    assessments,
    medicationPlans,
    doseEvents,
    labResults,
    labPanels,
    appointments,
    documents,
    attachments,
    photos: current.photos,
    importBatches,
    reminders,
    memberships,
    consents,
    auditEvents,
    lastSyncedAt: importedData.lastSyncedAt ?? current.lastSyncedAt,
  }

  store.replaceData(merged)

  if (importedData.lastSyncedAt) {
    const outboxItem = {
      id: nextId('import'),
      entity: 'appData',
      operation: 'upsert' as const,
      payload: merged,
      createdAt: new Date().toISOString(),
      attempts: 0,
    }
    void pushOutbox(outboxItem)
  }

  return merged
}

export function importDemoTests(store: AppStore): AppData {
  return importPreliminaryTests(createDemoData(), store)
}
