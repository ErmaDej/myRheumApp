import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import { createAppStore, type AppState, type AppStore } from '@/data/store'
import { createDemoData, emptyData } from '@/data/seed'
import { clearLocalState, readLocalState, readOutbox } from '@/data/localDb'
import type { OutboxItem } from '@/data/types'
import {
  fetchRemoteSnapshot,
  getRemoteUser,
  mergeRemoteSnapshot,
  pushOutboxItem,
  supabaseConfigured,
} from '@/data/remote'
import { useAuth } from '@/data/auth'
import { uid } from '@/lib/utils'

interface DataContextValue {
  state: AppState
  store: AppStore
  syncNow: () => Promise<void>
  /** Pull the account snapshot from Supabase and merge it over local state. */
  refreshFromRemote: () => Promise<void>
}

const DataContext = createContext<DataContextValue | null>(null)

/** Demo records must never be pushed into or merged into a real account. */
const isDemoOutboxItem = (item: OutboxItem): boolean => {
  const payload = (item.payload ?? {}) as { patientId?: string; id?: string; email?: string }
  if (payload.patientId === 'patient_demo') return true
  if (item.entity === 'profile' && (payload.id === 'patient_demo' || payload.email === 'demo@myrheum.app')) {
    return true
  }
  return false
}

export const DataProvider = ({
  children,
  store: providedStore,
}: {
  children: ReactNode
  store?: AppStore
}) => {
  const { user } = useAuth()
  const store = useMemo(
    () => providedStore ?? createAppStore(createDemoData(), { seed: createDemoData }),
    [providedStore],
  )
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  const hydratedRef = useRef(false)

  // Load persisted state once.
  useEffect(() => {
    if (hydratedRef.current) return
    hydratedRef.current = true

    if (providedStore) {
      void providedStore.hydrate(providedStore.getSnapshot().data, [])
      return
    }

    let cancelled = false
    void (async () => {
      const [local, outbox] = await Promise.all([readLocalState(), readOutbox()])
      if (cancelled) return

      // When a real Supabase session exists, only reuse a cached record that
      // belongs to that same account (so offline reads still work). Demo data
      // or another account's record is discarded instead of leaking in.
      if (supabaseConfigured) {
        const remote = await getRemoteUser()
        if (cancelled) return
        if (remote) {
          const cleanOutbox = outbox.filter((item) => !isDemoOutboxItem(item))
          if (local && local.profile.id === remote.id) {
            await store.hydrate(local, cleanOutbox)
            return
          }

          const profile = {
            id: remote.id,
            name: remote.email.split('@')[0] ?? 'Patient',
            email: remote.email,
            timezone: 'Africa/Addis_Ababa',
            units: 'metric' as const,
            consentGiven: false,
            onboardingComplete: false,
            createdAt: new Date().toISOString(),
          }
          await store.hydrate(emptyData(profile), [])
          void clearLocalState()
          return
        }
      }

      const cleanOutbox = outbox.filter((item) => !isDemoOutboxItem(item))
      await store.hydrate(local, cleanOutbox)
    })()

    return () => {
      cancelled = true
    }
  }, [store, providedStore])

  // Keep data scoped to the signed-in account. Demo data never leaks into a
  // real Supabase account: a different user id starts from an empty record.
  useEffect(() => {
    if (!snapshot.hydrated) return
    const profileId = snapshot.data.profile.id

    if (user?.mode === 'remote' && profileId !== user.id) {
      const profile = {
        id: user.id,
        name: user.name,
        email: user.email,
        timezone: 'Africa/Addis_Ababa',
        units: 'metric' as const,
        consentGiven: false,
        onboardingComplete: false,
        createdAt: new Date().toISOString(),
      }
      store.clearAll(emptyData(profile))
      // Purge persisted demo state and any queued demo mutations.
      void clearLocalState()
    }

    // Re-entering the synthetic preview always restores the demo record, even
    // after a real account was open in the same browser.
    if (user?.mode === 'demo' && profileId !== 'patient_demo') {
      store.resetToDemo()
    }
  }, [user, snapshot.hydrated, snapshot.data.profile.id, store])

  // Pull the account once per session, after queued edits have uploaded, so a
  // new device shows the records imported in Supabase without losing offline work.
  const pullingRef = useRef(false)
  const refreshFromRemote = useMemo(
    () => async () => {
      if (!supabaseConfigured || !user || user.mode !== 'remote') return
      if (pullingRef.current) return
      pullingRef.current = true
      try {
        const remote = await fetchRemoteSnapshot()
        if (remote) {
          store.replaceData(mergeRemoteSnapshot(store.getSnapshot().data, remote))
        }
      } catch (error) {
        console.warn('Could not refresh from your account.', error)
      } finally {
        pullingRef.current = false
      }
    },
    [store, user],
  )

  useEffect(() => {
    if (!snapshot.hydrated) return
    if (!supabaseConfigured || !user || user.mode !== 'remote') return
    if (snapshot.outbox.length > 0) return
    void refreshFromRemote()
  }, [snapshot.hydrated, snapshot.outbox.length, user, refreshFromRemote])

  // Flush queued mutations while online.
  const syncingRef = useRef(false)
  const syncNow = useMemo(
    () => async () => {
      if (syncingRef.current) return
      if (!supabaseConfigured || !user || user.mode !== 'remote') return
      const current = store.getSnapshot()
      if (!current.online || current.outbox.length === 0) return

      syncingRef.current = true
      let allSucceeded = true
      try {
        for (const item of current.outbox.slice(0, 25)) {
          try {
            await pushOutboxItem(item)
            store.removeOutboxItem(item.id)
          } catch {
            allSucceeded = false
            store.incrementOutboxAttempt(item.id)
          }
        }
        if (allSucceeded) store.markSynced(new Date().toISOString())
      } finally {
        syncingRef.current = false
      }
    },
    [store, user],
  )

  useEffect(() => {
    if (!snapshot.online) return
    if (!supabaseConfigured || !user || user.mode !== 'remote') return
    if (snapshot.outbox.length === 0) return

    const timer = setTimeout(() => void syncNow(), 800)
    return () => clearTimeout(timer)
  }, [snapshot.online, snapshot.outbox.length, user, syncNow])

  const value = useMemo<DataContextValue>(
    () => ({ state: snapshot, store, syncNow, refreshFromRemote }),
    [snapshot, store, syncNow, refreshFromRemote],
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export const useData = (): DataContextValue => {
  const context = useContext(DataContext)
  if (!context) throw new Error('useData must be inside DataProvider')
  return context
}

export const newId = (prefix: string): string => uid(prefix)
