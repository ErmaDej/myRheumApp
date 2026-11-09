import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, Info, ShieldCheck, Sparkles } from 'lucide-react'
import { useAuth } from '@/data/auth'
import { useData } from '@/data/DataProvider'
import { useToast } from '@/hooks/useToast'
import type { UnitsSystem } from '@/data/types'
import { Badge, Button, Card, Field, InlineAlert, Input, Select } from '@/components/ui'
import { cn, todayInputValue } from '@/lib/utils'

const STEPS = ['Consent', 'Preferences', 'Baseline'] as const

const TIMEZONES = ['Africa/Addis_Ababa', 'Africa/Nairobi', 'UTC', 'Europe/London', 'Europe/Berlin', 'Asia/Dubai', 'America/New_York']

export const Onboarding = () => {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { state, store } = useData()
  const data = state.data
  const { toast } = useToast()

  const [step, setStep] = useState(0)
  const [consentData, setConsentData] = useState(false)
  const [consentUnderstand, setConsentUnderstand] = useState(false)
  const [name, setName] = useState(data.profile.name === 'Demo Patient' ? user?.name ?? '' : data.profile.name)
  const [timezone, setTimezone] = useState(data.profile.timezone)
  const [units, setUnits] = useState<UnitsSystem>(data.profile.units)
  const [diagnosis, setDiagnosis] = useState('')
  const [baselineDate, setBaselineDate] = useState(todayInputValue())
  const [treatmentDate, setTreatmentDate] = useState('')
  const [error, setError] = useState<string | null>(null)

  const consentComplete = consentData && consentUnderstand

  const next = () => {
    if (step === 0 && !consentComplete) {
      setError('Both consent statements are required to continue.')
      return
    }
    if (step === 1 && !name.trim()) {
      setError('Add a display name so summaries are labelled correctly.')
      return
    }
    setError(null)
    setStep((prev) => Math.min(prev + 1, STEPS.length - 1))
  }

  const finish = () => {
    store.updateProfile({
      name: name.trim() || 'Patient',
      email: user?.email ?? data.profile.email,
      timezone,
      units,
      consentGiven: true,
      onboardingComplete: true,
      diagnosis: diagnosis.trim() || undefined,
      baselineDate: baselineDate ? new Date(`${baselineDate}T12:00:00`).toISOString() : undefined,
      treatmentStartedOn: treatmentDate ? new Date(`${treatmentDate}T12:00:00`).toISOString() : undefined,
    })
    toast({
      title: 'Your journal is ready',
      description: 'You can add baseline details gradually from Settings and Medical records.',
      variant: 'success',
    })
    navigate('/dashboard', { replace: true })
  }

  return (
    <div className="min-h-dvh bg-surface px-4 py-6 sm:px-6">
      <div className="mx-auto w-full max-w-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/icons/icon-192.png" alt="" className="size-10 rounded-xl" width={40} height={40} />
            <div>
              <p className="text-sm font-bold tracking-tight text-ink">myRheumApp</p>
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted">Set-up</p>
            </div>
          </div>
          <Badge tone="lavender">
            <Sparkles className="size-3" aria-hidden /> Step {step + 1} of {STEPS.length}
          </Badge>
        </div>

        {/* Progress */}
        <ol className="mt-6 flex items-center gap-2" aria-label="Set-up progress">
          {STEPS.map((label, index) => (
            <li key={label} className="flex flex-1 items-center gap-2">
              <span
                className={cn(
                  'flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
                  index < step && 'bg-teal-500 text-white',
                  index === step && 'bg-navy-900 text-white dark:bg-teal-400 dark:text-navy-950',
                  index > step && 'bg-navy-900/10 text-muted dark:bg-white/10',
                )}
                aria-current={index === step ? 'step' : undefined}
              >
                {index < step ? <Check className="size-3.5" aria-hidden /> : index + 1}
              </span>
              <span className={cn('text-[11px] font-semibold', index === step ? 'text-ink' : 'text-muted')}>
                {label}
              </span>
              {index < STEPS.length - 1 ? (
                <span className="h-px flex-1 bg-navy-900/10 dark:bg-white/10" aria-hidden />
              ) : null}
            </li>
          ))}
        </ol>

        <Card className="mt-5 p-5 sm:p-6">
          {step === 0 ? (
            <div>
              <h1 className="font-display text-2xl tracking-tight text-ink">Your record, your consent.</h1>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                This journal stores information you choose to enter so you and your clinician can see trends over
                time. It is not a medical device and does not provide medical advice.
              </p>

              <div className="mt-5 space-y-3">
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-navy-900/10 p-3 dark:border-white/10">
                  <input
                    type="checkbox"
                    checked={consentData}
                    onChange={(event) => setConsentData(event.target.checked)}
                    className="mt-0.5 size-4 accent-teal-600"
                  />
                  <span className="text-xs leading-relaxed text-ink">
                    I consent to storing the health information I enter in this app, on this device and, if a
                    Supabase account is configured, in my private account.
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-navy-900/10 p-3 dark:border-white/10">
                  <input
                    type="checkbox"
                    checked={consentUnderstand}
                    onChange={(event) => setConsentUnderstand(event.target.checked)}
                    className="mt-0.5 size-4 accent-teal-600"
                  />
                  <span className="text-xs leading-relaxed text-ink">
                    I understand that this app does not diagnose or treat disease, that scores are not a
                    substitute for clinical review, and that reminders may be delayed.
                  </span>
                </label>
              </div>

              <InlineAlert tone="info" title="You stay in control">
                You can export or delete your data at any time from Settings. An audit-friendly distinction is
                kept between patient-entered observations, imported results and clinician-documented records.
              </InlineAlert>
            </div>
          ) : null}

          {step === 1 ? (
            <div>
              <h2 className="font-display text-2xl tracking-tight text-ink">How should your journal read?</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                Your name appears on summaries. Timezone controls how scheduled doses and appointments are shown.
              </p>
              <div className="mt-5 space-y-4">
                <Field label="Display name" htmlFor="onboardingName">
                  <Input
                    id="onboardingName"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Name used on summaries"
                    autoComplete="name"
                  />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Timezone" htmlFor="onboardingTimezone">
                    <Select id="onboardingTimezone" value={timezone} onChange={(event) => setTimezone(event.target.value)}>
                      {TIMEZONES.map((zone) => (
                        <option key={zone} value={zone}>{zone}</option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Units" htmlFor="onboardingUnits">
                    <Select
                      id="onboardingUnits"
                      value={units}
                      onChange={(event) => setUnits(event.target.value as UnitsSystem)}
                    >
                      <option value="metric">Metric (cm, kg, °C)</option>
                      <option value="imperial">Imperial (in, lb, °F)</option>
                    </Select>
                  </Field>
                </div>
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div>
              <h2 className="font-display text-2xl tracking-tight text-ink">Baseline context</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                Optional and editable later. Record only dates you can verify from your own documents.
              </p>
              <div className="mt-5 space-y-4">
                <Field
                  label="Documented diagnosis"
                  htmlFor="onboardingDiagnosis"
                  optional
                  hint="Leave blank rather than guessing."
                >
                  <Input
                    id="onboardingDiagnosis"
                    value={diagnosis}
                    onChange={(event) => setDiagnosis(event.target.value)}
                    placeholder="e.g. axial spondyloarthritis"
                  />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Baseline assessment date" htmlFor="onboardingBaseline">
                    <Input
                      id="onboardingBaseline"
                      type="date"
                      max={todayInputValue()}
                      value={baselineDate}
                      onChange={(event) => setBaselineDate(event.target.value)}
                    />
                  </Field>
                  <Field label="Treatment start date" htmlFor="onboardingTreatment" optional>
                    <Input
                      id="onboardingTreatment"
                      type="date"
                      max={todayInputValue()}
                      value={treatmentDate}
                      onChange={(event) => setTreatmentDate(event.target.value)}
                    />
                  </Field>
                </div>
                <div className="flex items-start gap-2 rounded-xl bg-lavender-50 p-3 text-[11px] leading-relaxed text-navy-800 dark:bg-lavender-400/10 dark:text-lavender-100">
                  <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  A baseline is most useful before treatment starts. If treatment has already begun, set the
                  baseline date to when your first reliable records exist and state that in your notes.
                </div>
              </div>
            </div>
          ) : null}

          {error ? (
            <p role="alert" className="mt-4 text-xs font-medium text-danger-600 dark:text-danger-400">
              {error}
            </p>
          ) : null}

          <div className="mt-6 flex items-center justify-between gap-2">
            <Button
              variant="ghost"
              onClick={() => setStep((prev) => Math.max(0, prev - 1))}
              disabled={step === 0}
            >
              <ArrowLeft className="size-4" aria-hidden /> Back
            </Button>
            {step < STEPS.length - 1 ? (
              <Button onClick={next}>
                Continue <ArrowRight className="size-4" aria-hidden />
              </Button>
            ) : (
              <Button onClick={finish} disabled={!consentComplete}>
                <ShieldCheck className="size-4" aria-hidden /> Enter my journal
              </Button>
            )}
          </div>
        </Card>

        <p className="mt-4 text-center text-[10px] leading-relaxed text-muted">
          Demo builds contain synthetic data only. You can skip profile completion and add records gradually.
        </p>
      </div>
    </div>
  )
}

export default Onboarding
