import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Eye, EyeOff, LockKeyhole, ShieldCheck, Sparkles } from 'lucide-react'
import { DEMO_CREDENTIALS, useAuth } from '@/data/auth'
import { supabaseConfigured } from '@/data/remote'
import { Badge, Button, Field, InlineAlert, Input } from '@/components/ui'

export const Login = () => {
  const navigate = useNavigate()
  const { user, signIn, signUp, continueAsDemo, error, clearError, configured } = useAuth()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState(DEMO_CREDENTIALS.email)
  const [password, setPassword] = useState(DEMO_CREDENTIALS.password)
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  useEffect(() => {
    if (user) navigate('/dashboard', { replace: true })
  }, [user, navigate])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setLocalError(null)
    clearError()
    try {
      if (mode === 'signup') {
        await signUp(email, password)
        setLocalError('Check your inbox to confirm the account, then sign in.')
        setMode('signin')
      } else {
        await signIn(email, password)
        navigate('/dashboard', { replace: true })
      }
    } catch (caught) {
      setLocalError(caught instanceof Error ? caught.message : 'Something went wrong. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const enterDemo = () => {
    continueAsDemo()
    navigate('/dashboard', { replace: true })
  }

  const activeError = localError ?? error

  return (
    <div className="min-h-dvh bg-navy-950 text-white lg:grid lg:grid-cols-[1.05fr_1fr]">
      {/* Editorial hero */}
      <section className="surface-grid relative overflow-hidden px-5 pb-10 pt-8 sm:px-10 lg:flex lg:flex-col lg:justify-between lg:px-14 lg:py-14">
        <div className="flex items-center gap-3">
          <img src="/icons/icon-192.png" alt="" className="size-11 rounded-2xl" width={44} height={44} />
          <div>
            <p className="text-sm font-bold tracking-tight">myRheumApp</p>
            <p className="text-[10px] uppercase tracking-[0.2em] text-teal-300/80">Personal rheumatology journal</p>
          </div>
        </div>

        <div className="mt-10 max-w-xl lg:mt-0">
          <Badge tone="teal" className="bg-teal-400/15 text-teal-200">
            <ShieldCheck className="size-3" aria-hidden /> Private by design
          </Badge>
          <h1 className="mt-5 font-display text-4xl leading-[1.05] tracking-tight sm:text-5xl">
            A calm, careful record of your
            <span className="text-teal-300"> rheumatology journey.</span>
          </h1>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-white/70">
            Keep a pretreatment baseline, log symptoms and medication events honestly, and bring
            clear trend summaries to your rheumatology appointments.
          </p>

          <ul className="mt-7 grid gap-3 text-sm text-white/80 sm:grid-cols-2">
            {[
              'Offline-first daily check-ins',
              'Validated BASDAI & BASFI scoring',
              'Laboratory trends with reference ranges',
              'Private, dated photo journal',
            ].map((feature) => (
              <li key={feature} className="flex items-start gap-2">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-teal-400" aria-hidden />
                {feature}
              </li>
            ))}
          </ul>

          <div className="mt-8 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-white/70">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-teal-400/15 text-teal-300">
              <LockKeyhole className="size-4" aria-hidden />
            </div>
            <p>
              Patient-owned records, row-level security and private storage. This app supports care —
              it never replaces your clinician.
            </p>
          </div>
        </div>

        <p className="mt-10 hidden text-[11px] leading-relaxed text-white/40 lg:block">
          Demo preview contains synthetic data only. No real patient information is stored in this build.
        </p>
      </section>

      {/* Auth form */}
      <section className="flex items-center justify-center bg-surface px-4 py-8 text-ink sm:px-8">
        <div className="w-full max-w-sm animate-fade-rise">
          <div className="mb-6">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">
              {mode === 'signin' ? 'Welcome back' : 'Create account'}
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight">
              {mode === 'signin' ? 'Sign in to your journal' : 'Start your private record'}
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              {configured
                ? 'Your Supabase account keeps records in sync across your devices.'
                : 'Supabase is not configured in this build, so sign-in runs in local demo mode.'}
            </p>
          </div>

          {activeError ? (
            <div className="mb-4">
              <InlineAlert tone="danger" title="Could not continue">
                {activeError}
              </InlineAlert>
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="Email address" htmlFor="email">
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
              />
            </Field>

            <Field
              label="Password"
              htmlFor="password"
              hint={mode === 'signup' ? 'Use at least eight characters for a real account.' : undefined}
            >
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  required
                  minLength={6}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-xl text-muted hover:text-ink"
                >
                  {showPassword ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
                </button>
              </div>
            </Field>

            <Button type="submit" size="lg" className="w-full" disabled={submitting}>
              {submitting ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
              {!submitting ? <ArrowRight className="size-4" aria-hidden /> : null}
            </Button>
          </form>

          <div className="my-5 flex items-center gap-3 text-[11px] uppercase tracking-widest text-muted">
            <span className="h-px flex-1 bg-navy-900/10 dark:bg-white/10" />
            or
            <span className="h-px flex-1 bg-navy-900/10 dark:bg-white/10" />
          </div>

          <Button variant="secondary" size="lg" className="w-full" onClick={enterDemo}>
            <Sparkles className="size-4 text-lavender-400" aria-hidden /> Explore with synthetic demo data
          </Button>

          {supabaseConfigured ? (
            <p className="mt-4 text-center text-xs text-muted">
              {mode === 'signin' ? 'No account yet?' : 'Already registered?'}{' '}
              <button
                type="button"
                className="font-semibold text-teal-700 underline-offset-2 hover:underline dark:text-teal-300"
                onClick={() => {
                  setMode(mode === 'signin' ? 'signup' : 'signin')
                  setLocalError(null)
                  clearError()
                }}
              >
                {mode === 'signin' ? 'Create one' : 'Sign in'}
              </button>
            </p>
          ) : (
            <p className="mt-4 rounded-xl bg-navy-900/5 px-3 py-2 text-center text-[11px] leading-relaxed text-muted dark:bg-white/5">
              Local preview credentials are prefilled. Any valid email and a 6+ character password
              opens a private, device-only demo journal.
            </p>
          )}

          <p className="mt-6 flex items-center justify-center gap-1.5 text-[11px] text-muted">
            <ShieldCheck className="size-3.5" aria-hidden /> Records are never sold or used for advertising.
          </p>
        </div>
      </section>
    </div>
  )
}

export default Login
