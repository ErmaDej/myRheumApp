import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  getRemoteUser,
  signInRemote,
  signOutRemote,
  signUpRemote,
  supabase,
  supabaseConfigured,
} from '@/data/remote'

export type AuthMode = 'demo' | 'remote'

export interface SessionUser {
  id: string
  email: string
  name: string
  mode: AuthMode
}

interface AuthState {
  user: SessionUser | null
  loading: boolean
  configured: boolean
  error: string | null
}

export interface AuthContextValue extends AuthState {
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  continueAsDemo: () => void
  clearError: () => void
}

const DEMO_EMAIL = 'demo@myrheum.app'
const DEMO_PASSWORD = 'demo1234'
const DEMO_STORAGE_KEY = 'myrheumapp.demo-session'

const demoUser = (email = DEMO_EMAIL): SessionUser => ({
  id: 'patient_demo',
  email,
  name: 'Demo Patient',
  mode: 'demo',
})

export const DEMO_CREDENTIALS = { email: DEMO_EMAIL, password: DEMO_PASSWORD }

const AuthContext = createContext<AuthContextValue | null>(null)

const readDemoSession = (): SessionUser | null => {
  try {
    const raw = localStorage.getItem(DEMO_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { email?: string }
    return demoUser(parsed.email ?? DEMO_EMAIL)
  } catch {
    return null
  }
}

export const AuthProvider = ({
  children,
  initialUser = null,
}: {
  children: ReactNode
  initialUser?: SessionUser | null
}) => {
  const [state, setState] = useState<AuthState>({
    user: initialUser,
    loading: !initialUser,
    configured: supabaseConfigured,
    error: null,
  })

  useEffect(() => {
    if (initialUser) return
    let cancelled = false

    const bootstrap = async () => {
      if (supabaseConfigured && supabase) {
        const remote = await getRemoteUser()
        if (cancelled) return
        if (remote) {
          setState({
            user: { id: remote.id, email: remote.email, name: remote.email.split('@')[0] ?? 'Patient', mode: 'remote' },
            loading: false,
            configured: true,
            error: null,
          })
          return
        }
      }

      const demo = readDemoSession()
      if (cancelled) return
      setState({ user: demo, loading: false, configured: supabaseConfigured, error: null })
    }

    void bootstrap()

    if (!supabase || !supabaseConfigured) {
      return () => {
        cancelled = true
      }
    }

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setState({
          user: {
            id: session.user.id,
            email: session.user.email ?? '',
            name: (session.user.email ?? 'Patient').split('@')[0] ?? 'Patient',
            mode: 'remote',
          },
          loading: false,
          configured: true,
          error: null,
        })
      } else {
        setState((prev) => ({ ...prev, user: prev.user?.mode === 'demo' ? prev.user : null }))
      }
    })

    return () => {
      cancelled = true
      data.subscription.unsubscribe()
    }
  }, [initialUser])

  const signIn = useCallback(async (email: string, password: string) => {
    setState((prev) => ({ ...prev, loading: true, error: null }))
    try {
      if (!email.includes('@')) throw new Error('Enter a valid email address.')
      if (password.length < 6) throw new Error('Password must be at least 6 characters.')

      if (supabaseConfigured) {
        await signInRemote(email, password)
        const remote = await getRemoteUser()
        if (!remote) throw new Error('Sign-in did not return a session.')
        setState({
          user: { id: remote.id, email: remote.email, name: remote.email.split('@')[0] ?? 'Patient', mode: 'remote' },
          loading: false,
          configured: true,
          error: null,
        })
        return
      }

      const user = demoUser(email)
      localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify({ email }))
      setState({ user, loading: false, configured: false, error: null })
    } catch (error) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Could not sign in.',
      }))
      throw error
    }
  }, [])

  const signUp = useCallback(async (email: string, password: string) => {
    if (!supabaseConfigured) throw new Error('Account creation needs a configured Supabase project.')
    setState((prev) => ({ ...prev, loading: true, error: null }))
    try {
      await signUpRemote(email, password)
      setState((prev) => ({ ...prev, loading: false }))
    } catch (error) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Could not create the account.',
      }))
      throw error
    }
  }, [])

  const signOut = useCallback(async () => {
    if (supabaseConfigured) await signOutRemote()
    localStorage.removeItem(DEMO_STORAGE_KEY)
    setState((prev) => ({ ...prev, user: null, error: null }))
  }, [])

  const continueAsDemo = useCallback(() => {
    localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify({ email: DEMO_EMAIL }))
    setState({ user: demoUser(), loading: false, configured: supabaseConfigured, error: null })
  }, [])

  const clearError = useCallback(() => setState((prev) => ({ ...prev, error: null })), [])

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, signIn, signUp, signOut, continueAsDemo, clearError }),
    [state, signIn, signUp, signOut, continueAsDemo, clearError],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
