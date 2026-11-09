import { describe, expect, it, vi } from 'vitest'
import { AppStore } from '@/data/store'
import { createDemoData } from '@/data/seed'
import type { OutboxItem, ProgressPhoto } from '@/data/types'
import { uid } from '@/lib/utils'

const fixedNow = new Date('2026-11-09T09:00:00.000Z')

const makeStore = () => {
  const queued: OutboxItem[] = []
  const persisted: number[] = []
  const store = new AppStore(createDemoData(fixedNow), {
    persist: async () => {
      persisted.push(Date.now())
    },
    enqueue: async (item) => {
      queued.push(item)
    },
    dequeue: async () => {},
  })
  return { store, queued, persisted }
}

describe('AppStore', () => {
  it('prepends a new symptom entry and queues it for sync', () => {
    const { store, queued } = makeStore()
    const before = store.getSnapshot().data.symptomEntries.length
    store.saveSymptomEntry({
      id: 'sym_new',
      patientId: 'patient_demo',
      recordedAt: '2026-11-09T07:00:00.000Z',
      pain: 2,
      stiffnessMinutes: 10,
      fatigue: 3,
      sleepQuality: 7,
      functionalDifficulty: 2,
      mood: 7,
      triggers: '',
      notes: 'Feeling better',
      sideEffects: '',
      provenance: 'patient',
    })
    expect(store.getSnapshot().data.symptomEntries).toHaveLength(before + 1)
    expect(store.getSnapshot().data.symptomEntries[0].id).toBe('sym_new')
    expect(queued.at(-1)).toMatchObject({ entity: 'symptomEntry', operation: 'upsert' })
  })

  it('updates an existing entry instead of duplicating it', () => {
    const { store } = makeStore()
    const entry = store.getSnapshot().data.symptomEntries[0]
    store.saveSymptomEntry({ ...entry, pain: 9 })
    const sameId = store.getSnapshot().data.symptomEntries.filter((item) => item.id === entry.id)
    expect(sameId).toHaveLength(1)
    expect(sameId[0].pain).toBe(9)
  })

  it('records a dose status without inventing a taken dose', () => {
    const { store, queued } = makeStore()
    const pending = store.getSnapshot().data.doseEvents.find((event) => event.status === 'pending')
    expect(pending).toBeDefined()
    store.recordDose(pending!.id, 'skipped')
    const updated = store.getSnapshot().data.doseEvents.find((event) => event.id === pending!.id)
    expect(updated?.status).toBe('skipped')
    expect(updated?.recordedAt).toBeTruthy()
    expect(queued.at(-1)).toMatchObject({ entity: 'doseEvent' })
  })

  it('queues a deletion rather than silently dropping it', () => {
    const { store, queued } = makeStore()
    const entry = store.getSnapshot().data.symptomEntries[0]
    store.deleteSymptomEntry(entry.id)
    expect(store.getSnapshot().data.symptomEntries.some((item) => item.id === entry.id)).toBe(false)
    expect(queued.at(-1)).toMatchObject({ entity: 'symptomEntry', operation: 'delete', payload: { id: entry.id } })
  })

  it('keeps photographs local and never queues them for upload', () => {
    const { store, queued } = makeStore()
    const photo: ProgressPhoto = {
      id: uid('photo'),
      patientId: 'patient_demo',
      takenOn: fixedNow.toISOString(),
      view: 'front',
      dataUrl: 'data:image/jpeg;base64,AAAA',
      createdAt: fixedNow.toISOString(),
    }
    const queueBefore = queued.length
    store.savePhoto(photo)
    expect(store.getSnapshot().data.photos).toHaveLength(1)
    expect(queued).toHaveLength(queueBefore)
  })

  it('toggles follow-up tasks and queues the appointment', () => {
    const { store, queued } = makeStore()
    const appointment = store.getSnapshot().data.appointments.find((item) => item.tasks.length > 0)!
    const task = appointment.tasks[0]
    store.toggleAppointmentTask(appointment.id, task.id)
    const updated = store.getSnapshot().data.appointments.find((item) => item.id === appointment.id)!
    expect(updated.tasks.find((item) => item.id === task.id)?.done).toBe(!task.done)
    expect(queued.at(-1)).toMatchObject({ entity: 'appointment' })
  })

  it('notifies subscribers and reflects connectivity changes', () => {
    const { store } = makeStore()
    const listener = vi.fn()
    const unsubscribe = store.subscribe(listener)
    window.dispatchEvent(new Event('offline'))
    expect(store.getSnapshot().online).toBe(false)
    expect(listener).toHaveBeenCalled()
    window.dispatchEvent(new Event('online'))
    expect(store.getSnapshot().online).toBe(true)
    unsubscribe()
  })

  it('archives a plan instead of deleting its history', () => {
    const { store } = makeStore()
    const plan = store.getSnapshot().data.medicationPlans[0]
    store.archiveMedicationPlan(plan.id)
    const updated = store.getSnapshot().data.medicationPlans.find((item) => item.id === plan.id)!
    expect(updated.status).toBe('discontinued')
  })

  it('resets to a clean demo record', () => {
    const { store } = makeStore()
    store.updateProfile({ name: 'Changed' })
    store.resetToDemo(() => createDemoData(fixedNow))
    expect(store.getSnapshot().data.profile.name).toBe('Demo Patient')
  })
})
