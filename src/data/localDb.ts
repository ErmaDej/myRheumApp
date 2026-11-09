import Dexie, { type Table } from 'dexie'
import type { AppData, OutboxItem } from '@/data/types'

interface StateRow {
  id: string
  data: AppData
  updatedAt: string
}

class RheumDatabase extends Dexie {
  state!: Table<StateRow, string>
  outbox!: Table<OutboxItem, string>

  constructor() {
    super('myrheumapp')
    this.version(1).stores({
      state: 'id',
      outbox: 'id, createdAt',
    })
  }
}

export const localDb = new RheumDatabase()

const STATE_KEY = 'app'

export const readLocalState = async (): Promise<AppData | null> => {
  try {
    const row = await localDb.state.get(STATE_KEY)
    return row?.data ?? null
  } catch (error) {
    console.warn('Offline store unavailable; continuing in memory.', error)
    return null
  }
}

export const writeLocalState = async (data: AppData): Promise<void> => {
  try {
    await localDb.state.put({ id: STATE_KEY, data, updatedAt: new Date().toISOString() })
  } catch (error) {
    console.warn('Could not persist offline state.', error)
  }
}

export const readOutbox = async (): Promise<OutboxItem[]> => {
  try {
    return await localDb.outbox.orderBy('createdAt').toArray()
  } catch {
    return []
  }
}

export const pushOutbox = async (item: OutboxItem): Promise<void> => {
  try {
    await localDb.outbox.put(item)
  } catch {
    /* non-fatal */
  }
}

export const removeOutbox = async (id: string): Promise<void> => {
  try {
    await localDb.outbox.delete(id)
  } catch {
    /* non-fatal */
  }
}

export const clearLocalState = async (): Promise<void> => {
  try {
    await Promise.all([localDb.state.clear(), localDb.outbox.clear()])
  } catch {
    /* non-fatal */
  }
}
