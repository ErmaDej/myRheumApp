import { lazy, type ComponentType, type LazyExoticComponent } from 'react'

/**
 * Deploys replace hashed chunk files. When a service worker still serves an older
 * index.html, the first navigation to a route can request a chunk that no longer
 * exists and React would show an error. Reloading once fetches the fresh index and
 * chunk together; a second failure is a real error and is rethrown to the boundary.
 */
const RETRY_PREFIX = 'myrheum:chunk-retry:'

export const lazyWithRetry = <P>(
  factory: () => Promise<{ default: ComponentType<P> }>,
  name: string,
): LazyExoticComponent<ComponentType<P>> =>
  lazy(async () => {
    try {
      return await factory()
    } catch (error) {
      if (typeof window === 'undefined' || typeof sessionStorage === 'undefined') throw error
      const key = `${RETRY_PREFIX}${name}`
      if (sessionStorage.getItem(key) !== '1') {
        sessionStorage.setItem(key, '1')
        window.location.reload()
        // The page is unloading; keep Suspense pending instead of flashing an error.
        return new Promise<never>(() => {})
      }
      sessionStorage.removeItem(key)
      throw error
    }
  })
