import { useCallback, useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferredPrompt: BeforeInstallPromptEvent | null = null
const listeners = new Set<() => void>()

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    deferredPrompt = event as BeforeInstallPromptEvent
    listeners.forEach((listener) => listener())
  })
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    listeners.forEach((listener) => listener())
  })
}

export const usePwaInstall = () => {
  const [canInstall, setCanInstall] = useState(Boolean(deferredPrompt))
  const [isStandalone, setIsStandalone] = useState(false)

  useEffect(() => {
    const update = () => setCanInstall(Boolean(deferredPrompt))
    listeners.add(update)
    setIsStandalone(
      window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as Navigator & { standalone?: boolean }).standalone === true,
    )
    return () => {
      listeners.delete(update)
    }
  }, [])

  const promptInstall = useCallback(async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
    if (!deferredPrompt) return 'unavailable'
    await deferredPrompt.prompt()
    const choice = await deferredPrompt.userChoice
    if (choice.outcome === 'accepted') {
      deferredPrompt = null
      listeners.forEach((listener) => listener())
    }
    return choice.outcome
  }, [])

  return { canInstall, isStandalone, promptInstall }
}
