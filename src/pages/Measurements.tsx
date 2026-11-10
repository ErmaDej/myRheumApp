import { useEffect, useMemo, useState } from 'react'
import { Calculator, ClipboardList, Info, TriangleAlert } from 'lucide-react'
import { useData } from '@/data/DataProvider'
import { QUESTIONNAIRE_OPTIONS, useTrackingPreferences } from '@/data/preferences'
import { useToast } from '@/hooks/useToast'
import {
  ASDAS_QUESTIONS,
  BASDAI_QUESTIONS,
  BASFI_QUESTIONS,
  computeAsdas,
  computeBasdai,
  computeBasfi,
  type AsdasInputs,
  type ScoreOutcome,
} from '@/lib/clinical'
import type { Instrument, QuestionnaireAssessment } from '@/data/types'
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  InlineAlert,
  Input,
  SegmentedControl,
} from '@/components/ui'
import { TrendChart } from '@/components/charts/TrendChart'
import { cn, formatDate, uid } from '@/lib/utils'

type Answers = Record<string, number | undefined>

const instrumentQuestions = (instrument: Instrument) => {
  if (instrument === 'BASDAI') return BASDAI_QUESTIONS
  if (instrument === 'BASFI') return BASFI_QUESTIONS
  return ASDAS_QUESTIONS
}

const instrumentHint: Record<Instrument, string> = {
  BASDAI: 'Six items about the last week. All six are required for a valid score.',
  BASFI: 'Ten items about daily function. All ten are required for a valid score.',
  ASDAS: 'Four symptom items plus a CRP value in mg/L from a laboratory result.',
}

export const Measurements = () => {
  const { state, store } = useData()
  const { toast } = useToast()
  const { data } = state
  const { preferences } = useTrackingPreferences(data.profile.id)
  const availableInstruments = useMemo(() => {
    const tracked = QUESTIONNAIRE_OPTIONS.filter((item) =>
      preferences.questionnaires.includes(item.key),
    )
    return tracked.length > 0 ? tracked : QUESTIONNAIRE_OPTIONS
  }, [preferences.questionnaires])

  const [instrument, setInstrument] = useState<Instrument>('BASDAI')
  const [answers, setAnswers] = useState<Answers>({})
  const [crp, setCrp] = useState('')
  const [headDeviation, setHeadDeviation] = useState<number | undefined>(undefined)
  const [outcome, setOutcome] = useState<ScoreOutcome | null>(null)

  const questions = instrumentQuestions(instrument)

  // If the selected questionnaire is hidden in Settings, move to a tracked one.
  useEffect(() => {
    if (!availableInstruments.some((item) => item.key === instrument)) {
      setInstrument(availableInstruments[0].key)
      setAnswers({})
      setCrp('')
      setOutcome(null)
    }
  }, [availableInstruments, instrument])

  const history = useMemo(
    () =>
      data.assessments
        .filter((assessment) => assessment.instrument === instrument)
        .sort((a, b) => b.assessedAt.localeCompare(a.assessedAt)),
    [data.assessments, instrument],
  )

  const chart = useMemo(() => {
    const series = [...data.assessments]
      .filter((assessment) => assessment.instrument === instrument)
      .sort((a, b) => a.assessedAt.localeCompare(b.assessedAt))
      .map((assessment) => ({ day: assessment.assessedAt, score: assessment.score }))
    return series
  }, [data.assessments, instrument])

  const answeredCount = questions.filter((question) => answers[question.id] !== undefined).length

  const reset = () => {
    setAnswers({})
    setCrp('')
    setOutcome(null)
  }

  const switchInstrument = (next: Instrument) => {
    setInstrument(next)
    reset()
  }

  const calculate = () => {
    let result: ScoreOutcome
    if (instrument === 'BASDAI') {
      result = computeBasdai(answers as Record<string, number>)
    } else if (instrument === 'BASFI') {
      result = computeBasfi(answers as Record<string, number>)
    } else {
      const asdasInputs: Partial<AsdasInputs> = {
        backPain: answers.backPain,
        morningStiffness: answers.morningStiffness,
        peripheralPain: answers.peripheralPain,
        fatigue: answers.fatigue,
        crp: crp.trim() === '' ? undefined : Number(crp),
      }
      result = computeAsdas(asdasInputs)
    }
    setOutcome(result)
    if (!result.ok) {
      toast({
        title: 'Not enough answers yet',
        description: 'All items are required for a validated score. Incomplete scores are not generated.',
        variant: 'warning',
      })
    }
  }

  const save = () => {
    if (!outcome?.ok) return
    const assessment: QuestionnaireAssessment = {
      id: uid('assess'),
      patientId: data.profile.id,
      instrument,
      answers: Object.fromEntries(
        Object.entries(answers).filter((entry): entry is [string, number] => typeof entry[1] === 'number'),
      ),
      crp: instrument === 'ASDAS' && crp.trim() !== '' ? Number(crp) : undefined,
      score: outcome.result.score,
      algorithmVersion: outcome.result.version,
      assessedAt: new Date().toISOString(),
      notes: 'Patient-completed questionnaire.',
    }
    store.saveAssessment(assessment)
    toast({
      title: `${instrument} saved`,
      description: `Score ${outcome.result.score}/10 calculated with ${outcome.result.version}.`,
      variant: 'success',
    })
    reset()
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-ink">Clinical measurements</h2>
          <p className="mt-0.5 max-w-2xl text-xs leading-relaxed text-muted">
            Validated questionnaires are calculated only when every required item is present. Your answers
            are stored separately from the calculated score and its algorithm version.
          </p>
        </div>
        <SegmentedControl
          label="Questionnaire"
          value={instrument}
          onChange={(value) => switchInstrument(value as Instrument)}
          options={availableInstruments.map((item) => ({ value: item.key, label: item.label }))}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <Card className="p-4 sm:p-5">
          <CardHeader
            title={`${instrument} questionnaire`}
            subtitle={instrumentHint[instrument]}
            action={<Badge tone="lavender">{answeredCount}/{questions.length} answered</Badge>}
          />

          <div className="mt-4 space-y-4">
            {questions.map((question, index) => {
              const value = answers[question.id]
              return (
                <div key={question.id} className="rounded-xl border border-navy-900/10 p-3 dark:border-white/10">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink">
                        <span className="mr-1.5 text-[11px] font-bold text-muted">{index + 1}.</span>
                        {question.label}
                      </p>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-muted">{question.help}</p>
                    </div>
                    <Badge tone={value === undefined ? 'neutral' : 'teal'}>
                      {question.id === 'crp' ? 'mg/L' : value === undefined ? 'Not set' : `${value}/10`}
                    </Badge>
                  </div>

                  {question.id === 'crp' ? (
                    <Input
                      className="mt-2 max-w-40"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="0.1"
                      placeholder="e.g. 3.2"
                      value={crp}
                      onChange={(event) => {
                        setCrp(event.target.value)
                        setOutcome(null)
                      }}
                      aria-label="C-reactive protein in mg/L"
                    />
                  ) : (
                    <input
                      type="range"
                      min={0}
                      max={10}
                      step={1}
                      value={value ?? 0}
                      onChange={(event) => {
                        const next = Number(event.target.value)
                        setAnswers((prev) => ({ ...prev, [question.id]: next }))
                        setOutcome(null)
                      }}
                      aria-label={`${question.label} score`}
                      aria-valuetext={value === undefined ? 'Not set' : `${value} out of 10`}
                      className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-full bg-navy-900/10 dark:bg-white/15"
                      style={{
                        background:
                          value === undefined
                            ? undefined
                            : `linear-gradient(to right, var(--color-teal-500) ${(value / 10) * 100}%, transparent ${(value / 10) * 100}%)`,
                      }}
                    />
                  )}
                </div>
              )
            })}
          </div>

          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-ink">Head deviation from wall</p>
              <Badge tone="teal">cm</Badge>
            </div>
            <div>
              <input
                type="range"
                min={0}
                max={30}
                step={1}
                value={headDeviation ?? 0}
                onChange={(event) => {
                  const next = Number(event.target.value)
                  setAnswers((prev) => ({ ...prev, headDeviation: next }))
                  setHeadDeviation(next)
                  setOutcome(null)
                }}
                aria-label="Head deviation from wall in cm"
                aria-valuetext={headDeviation === undefined ? 'Not set' : `${headDeviation} cm`}
                className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-full bg-navy-900/10 dark:bg-white/15"
                style={{
                  background:
                    headDeviation === undefined
                      ? undefined
                      : `linear-gradient(to right, var(--color-teal-500) ${(headDeviation / 30) * 100}%, transparent ${(headDeviation / 30) * 100}%)`,
                }}
              />
              <Input
                type="number"
                min={0}
                max={30}
                step="0.1"
                value={headDeviation !== undefined ? String(headDeviation) : ''}
                onChange={(event) => {
                  const next = event.target.value === '' ? undefined : Number(event.target.value)
                  setAnswers((prev) => ({ ...prev, headDeviation: next }))
                  setHeadDeviation(next)
                  setOutcome(null)
                }}
                aria-label="Head deviation from wall in cm"
                className="mt-2 max-w-40"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={calculate}>
              <Calculator className="size-4" aria-hidden /> Calculate {instrument}
            </Button>
            <Button variant="secondary" onClick={reset}>
              Clear answers
            </Button>
          </div>

          {outcome && !outcome.ok ? (
            <div className="mt-4">
              <InlineAlert tone="warning" title="Score not calculated">
                {outcome.missing.length > 0
                  ? `Missing: ${outcome.missing.map((id) => questions.find((q) => q.id === id)?.label ?? id).join(', ')}.`
                  : ''}{' '}
                {outcome.invalid.length > 0
                  ? `Out of range: ${outcome.invalid.join(', ')}.`
                  : ''}{' '}
                Every required item is needed for a validated result.
              </InlineAlert>
            </div>
          ) : null}

          {outcome?.ok ? (
            <div className="mt-4 rounded-2xl border border-teal-500/40 bg-teal-50 p-4 dark:bg-teal-500/10">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-teal-700 dark:text-teal-300">
                    {instrument} result
                  </p>
                  <p className="mt-1 text-4xl font-bold tabular-nums tracking-tight text-ink">
                    {outcome.result.score.toFixed(instrument === 'ASDAS' ? 2 : 1)}
                    <span className="ml-1 text-sm font-medium text-muted">
                      {instrument === 'ASDAS' ? '' : '/10'}
                    </span>
                  </p>
                  {outcome.result.band ? (
                    <p className="mt-1 text-xs font-medium text-teal-800 dark:text-teal-200">{outcome.result.band}</p>
                  ) : null}
                  <p className="mt-1 text-[11px] text-muted">Algorithm {outcome.result.version}</p>
                </div>
                <Button onClick={save}>Save result</Button>
              </div>
              <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-teal-800/80 dark:text-teal-100/80">
                <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                A questionnaire score is not a diagnosis and does not replace your clinician&apos;s assessment.
                Do not use it to change treatment.
              </p>
            </div>
          ) : null}
        </Card>

        <div className="space-y-4">
          <Card className="p-4 sm:p-5">
            <CardHeader
              title={`${instrument} over time`}
              subtitle="Recorded assessments only"
              action={<ClipboardList className="size-4 text-muted" aria-hidden />}
            />
            <div className="mt-3">
              <TrendChart
                title={`${instrument} history`}
                data={chart}
                xKey="day"
                height={200}
                domain={instrument === 'ASDAS' ? [0, 6] : [0, 10]}
                series={[{ key: 'score', label: instrument, color: '#2f9d89' }]}
              />
            </div>
          </Card>

          <Card className="p-4 sm:p-5">
            <CardHeader title="Saved assessments" subtitle="Newest first" />
            <div className="mt-3 space-y-2">
              {history.length === 0 ? (
                <EmptyState
                  icon={<ClipboardList className="size-5" aria-hidden />}
                  title={`No ${instrument} recorded`}
                  description="Complete all items to create your first validated score."
                />
              ) : (
                history.slice(0, 8).map((assessment) => (
                  <div
                    key={assessment.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-navy-900/10 px-3 py-2 dark:border-white/10"
                  >
                    <div>
                      <p className="text-xs font-semibold text-ink">{formatDate(assessment.assessedAt)}</p>
                      <p className="text-[10px] text-muted">{assessment.algorithmVersion}</p>
                    </div>
                    <span
                      className={cn(
                        'rounded-lg px-2 py-1 text-sm font-bold tabular-nums',
                        'bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-200',
                      )}
                    >
                      {assessment.score.toFixed(instrument === 'ASDAS' ? 2 : 1)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card className="p-4 text-[11px] leading-relaxed text-muted sm:p-5">
            <p className="flex items-start gap-1.5">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-amber-500" aria-hidden />
              Clinician-measured mobility (chest expansion, Schober test) is documented in your clinical notes.
              This app does not infer spinal fusion or structural change from symptoms or photographs.
            </p>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default Measurements
