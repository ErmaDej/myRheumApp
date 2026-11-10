import { createAppStore, type AppData, type StoreOptions } from '@/data/store'
import { createDemoData, emptyData } from '@/data/seed'
import { useData } from '@/data/DataProvider'
import { pushOutbox } from '@/data/localDb'
import { writable } from 'react'

/** Import preliminary test data from a JSON file or seed object.
 *  Merges the imported data into the app store, preserving existing data where appropriate.
 */
export function importPreliminaryTests(importedData: Partial<AppData>): AppData {
  const store = useData().store
  const current = store.getSnapshot().data

  // Merge profile: always use the imported profile if provided
  const profile = importedData.profile ? { ...current.profile, ...importedData.profile } : current.profile

  // Merge symptom entries: add new ones, keep existing ones with same id
  const symptomEntries = importedData.symptomEntries
    ? [...new Set([...current.symptomEntries, ...importedData.symptomEntries.map((e: any) => e.id ? e : { ...e, id: e.id || `sym_${Date.now()}_${Math.random()}`) })]]
    : current.symptomEntries

  // Merge assessments
  const assessments = importedData.assessments
    ? [...new Set([...current.assessments, ...importedData.assessments.map((a: any) => a.id ? a : { ...a, id: a.id || `assess_${Date.now()}_${Math.random()}`) })]]
    : current.assessments

  // Merge medication plans
  const medicationPlans = importedData.medicationPlans
    ? [...new Set([...current.medicationPlans, ...importedData.medicationPlans.map((p: any) => p.id ? p : { ...p, id: p.id || `plan_${Date.now()}_${Math.random()}`) })]]
    : current.medicationPlans

  // Merge dose events
  const doseEvents = importedData.doseEvents
    ? [...current.doseEvents, ...importedData.doseEvents.filter((e: any) => !current.doseEvents.some((de: any) => de.id === e.id))]
    : current.doseEvents

  // Merge lab results
  const labResults = importedData.labResults
    ? [...new Set([...current.labResults, ...importedData.labResults.map((l: any) => l.id ? l : { ...l, id: l.id || `lab_${Date.now()}_${Math.random()}`) })]]
    : current.labResults

  // Merge lab panels
  const labPanels = importedData.labPanels
    ? [...new Set([...current.labPanels, ...importedData.labPanels.map((p: any) => p.id ? p : { ...p, id: p.id || `panel_${Date.now()}_${Math.random()}`) })]]
    : current.labPanels

  // Merge appointments
  const appointments = importedData.appointments
    ? [...new Set([...current.appointments, ...importedData.appointments.map((a: any) => a.id ? a : { ...a, id: a.id || `appt_${Date.now()}_${Math.random()}`) })]]
    : current.appointments

  // Merge documents
  const documents = importedData.documents
    ? [...new Set([...current.documents, ...importedData.documents.map((d: any) => d.id ? d : { ...d, id: d.id || `doc_${Date.now()}_${Math.random()}`) })]]
    : current.documents

  // Merge attachments
  const attachments = importedData.attachments
    ? [...new Set([...current.attachments, ...importedData.attachments.map((a: any) => a.id ? a : { ...a, id: a.id || `att_${Date.now()}_${Math.random()}`) })]]
    : current.attachments

  // Merge import batches
  const importBatches = importedData.importBatches
    ? [...new Set([...current.importBatches, ...importedData.importBatches.map((b: any) => b.id ? b : { ...b, id: b.id || `batch_${Date.now()}_${Math.random()}`) })]]
    : current.importBatches

  // Merge reminders
  const reminders = importedData.reminders
    ? [...new Set([...current.reminders, ...importedData.reminders.map((r: any) => r.id ? r : { ...r, id: r.id || `rem_${Date.now()}_${Math.random()}`) })]]
    : current.reminders

  // Merge memberships
  const memberships = importedData.memberships
    ? [...new Set([...current.memberships, ...importedData.memberships.map((m: any) => m.id ? m : { ...m, id: m.id || `mem_${Date.now()}_${Math.random()}`) })]]
    : current.memberships

  // Merge consents
  const consents = importedData.consents
    ? [...new Set([...current.consents, ...importedData.consents.map((c: any) => c.id ? c : { ...c, id: c.id || `cons_${Date.now()}_${Math.random()}`) })]]
    : current.consents

  // Merge audit events
  const auditEvents = importedData.auditEvents
    ? [...new Set([...current.auditEvents, ...importedData.auditEvents.map((a: any) => a.id ? a : { ...a, id: a.id || `audit_${Date.now()}_${Math.random()}`) })]]
    : current.auditEvents

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
    importBatches,
    reminders,
    memberships,
    consents,
    auditEvents,
    lastSyncedAt: importedData.lastSyncedAt ?? current.lastSyncedAt,
  }

  // Commit to store
  store.replaceData(merged)

  // Optionally enqueue for remote sync
  if (importedData.lastSyncedAt) {
    const outboxItem = {
      id: `import_${Date.now()}`,
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

/** Default import using the demo seed data, for quick testing. */
export function importDemoTests(): AppData {
  return importPreliminaryTests(createDemoData())
}