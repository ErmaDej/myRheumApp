import type {
  AppData,
  Appointment,
  DoseEvent,
  LabResult,
  MedicationPlan,
  QuestionnaireAssessment,
  SymptomEntry,
} from '@/data/types'
import { computeBasdai, computeBasfi } from '@/lib/clinical'
import { round } from '@/lib/utils'
import { wallClockToUtc } from '@/lib/timezone'

/**
 * Synthetic preview data. Every value here is generated for demonstration and
 * is never written into a real patient account.
 */

const mulberry32 = (seed: number) => {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const DEMO_TIMEZONE = 'Africa/Addis_Ababa'

/** Demo wall-clock times are authored in Addis Ababa, not the browser's zone. */
const isoAt = (base: Date, daysAgo: number, hour = 8, minute = 0): string => {
  const date = new Date(base.getTime() - daysAgo * 86_400_000)
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: DEMO_TIMEZONE }).format(date)
  const pad = (value: number) => String(value).padStart(2, '0')
  return wallClockToUtc(day, `${pad(hour)}:${pad(minute)}`, DEMO_TIMEZONE)
}

const isoOn = (base: Date, daysFromNow: number, hour = 10, minute = 0): string =>
  isoAt(base, -daysFromNow, hour, minute)

export const createDemoData = (now = new Date()): AppData => {
  const random = mulberry32(20261109)
  const patientId = 'patient_demo'

  const profile: AppData['profile'] = {
    id: patientId,
    name: 'Demo Patient',
    email: 'demo@myrheum.app',
    timezone: 'Africa/Addis_Ababa',
    units: 'metric',
    consentGiven: true,
    onboardingComplete: true,
    diagnosis: 'Axial spondyloarthritis (synthetic demo record)',
    diagnosisDate: isoAt(now, 400),
    baselineDate: isoAt(now, 120),
    treatmentStartedOn: isoAt(now, 90),
    clinic: 'Rheum Clinic, Addis Ababa (demo)',
    createdAt: isoAt(now, 400),
  }

  const entries: SymptomEntry[] = []
  for (let daysAgo = 120; daysAgo >= 0; daysAgo -= 1) {
    // Deliberately leave some gaps so the UI shows missing data honestly.
    if (random() < 0.14) continue

    const treated = daysAgo <= 90
    const progress = treated ? (90 - daysAgo) / 90 : 0
    const noise = (scale: number) => (random() - 0.5) * scale

    const pain = round(Math.max(0, Math.min(10, 6.4 - progress * 2.6 + noise(1.6))), 0)
    const stiffness = Math.round(Math.max(0, 48 - progress * 27 + noise(16)))
    const fatigue = round(Math.max(0, Math.min(10, 7.1 - progress * 2.5 + noise(1.5))), 1)
    const sleep = round(Math.max(0, Math.min(10, 4.2 + progress * 2.2 + noise(1.4))), 1)
    const functional = round(Math.max(0, Math.min(10, 5.9 - progress * 2.4 + noise(1.2))), 1)

    entries.push({
      id: `sym_${120 - daysAgo}`,
      patientId,
      recordedAt: isoAt(now, daysAgo, 7 + Math.floor(random() * 2), 15),
      pain,
      stiffnessMinutes: stiffness,
      fatigue,
      sleepQuality: sleep,
      functionalDifficulty: functional,
      mood: round(Math.max(0, Math.min(10, 5 + progress * 1.5 + noise(2))), 1),
      triggers:
        daysAgo % 17 === 0
          ? 'Cold, damp morning'
          : daysAgo % 23 === 0
            ? 'Long day sitting at work'
            : '',
      notes:
        daysAgo % 31 === 0
          ? 'Stiffness eased after stretching and a warm shower.'
          : daysAgo % 19 === 0
            ? 'Slept poorly; symptoms felt worse than usual.'
            : '',
      sideEffects: daysAgo === 12 ? 'Mild nausea about two hours after the injection.' : '',
      provenance: 'patient',
    })
  }

  const assessmentAt = (daysAgo: number, treatedProgress: number): QuestionnaireAssessment[] => {
    const basdaiAnswers = {
      fatigue: round(Math.max(0, 7 - treatedProgress * 2.4), 0),
      backPain: round(Math.max(0, 6.5 - treatedProgress * 2.5), 0),
      peripheralPain: round(Math.max(0, 4.5 - treatedProgress * 1.6), 0),
      enthesitis: round(Math.max(0, 3.5 - treatedProgress * 1.4), 0),
      stiffnessSeverity: round(Math.max(0, 6.8 - treatedProgress * 2.2), 0),
      stiffnessDuration: round(Math.max(0, 5.5 - treatedProgress * 2), 0),
    }
    const basfiAnswers = Object.fromEntries(
      [
        'socks',
        'bendForward',
        'overheadShelf',
        'armlessChair',
        'floorToStand',
        'standTenMinutes',
        'stairs',
        'lookOverShoulder',
        'physicalActivity',
        'fullDay',
      ].map((id, index) => [id, round(Math.max(0, 5.5 - treatedProgress * 2.2 + ((index % 3) - 1) * 0.6), 0)]),
    )
    const basdai = computeBasdai(basdaiAnswers)
    const basfi = computeBasfi(basfiAnswers)
    const at = isoAt(now, daysAgo, 9, 30)
    const results: QuestionnaireAssessment[] = []
    if (basdai.ok) {
      results.push({
        id: `assess_basdai_${daysAgo}`,
        patientId,
        instrument: 'BASDAI',
        answers: basdaiAnswers,
        score: basdai.result.score,
        algorithmVersion: basdai.result.version,
        assessedAt: at,
        notes: 'Synthetic demo assessment.',
      })
    }
    if (basfi.ok) {
      results.push({
        id: `assess_basfi_${daysAgo}`,
        patientId,
        instrument: 'BASFI',
        answers: basfiAnswers,
        score: basfi.result.score,
        algorithmVersion: basfi.result.version,
        assessedAt: at,
        notes: 'Synthetic demo assessment.',
      })
    }
    return results
  }

  const assessments: QuestionnaireAssessment[] = [
    ...assessmentAt(118, 0),
    ...assessmentAt(88, 0.1),
    ...assessmentAt(58, 0.45),
    ...assessmentAt(28, 0.75),
    ...assessmentAt(3, 0.95),
  ]

  const labs: LabResult[] = []
  const labSeries = [
    { name: 'C-reactive protein', unit: 'mg/L', low: 0, high: 5, values: [18.4, 12.1, 7.8, 4.2, 3.1] },
    { name: 'Erythrocyte sedimentation rate', unit: 'mm/h', low: 0, high: 15, values: [42, 31, 24, 17, 14] },
    { name: 'Haemoglobin', unit: 'g/dL', low: 13, high: 17, values: [13.1, 13.3, 13.6, 14.0, 14.2] },
    { name: 'Alanine aminotransferase', unit: 'U/L', low: 7, high: 35, values: [24, 26, 29, 27, 25] },
    { name: 'Creatinine', unit: 'mg/dL', low: 0.7, high: 1.3, values: [0.9, 0.9, 1.0, 0.9, 0.95] },
  ]
  const labDays = [112, 82, 52, 23, 4]
  labSeries.forEach((series) => {
    series.values.forEach((value, index) => {
      labs.push({
        id: `lab_${series.name.replace(/\s+/g, '_').toLowerCase()}_${index}`,
        patientId,
        testName: series.name,
        value,
        unit: series.unit,
        referenceLow: series.low,
        referenceHigh: series.high,
        referenceText: `${series.low}–${series.high} ${series.unit}`,
        collectedAt: isoAt(now, labDays[index], 6, 45),
        laboratory: 'Demo Laboratory, Addis Ababa',
        source: 'imported',
        notes: 'Synthetic value for preview only.',
        createdAt: isoAt(now, labDays[index], 12, 0),
      })
    })
  })

  const medicationPlans: MedicationPlan[] = [
    {
      id: 'plan_biologic',
      patientId,
      name: 'Adalimumab (demo)',
      ingredient: 'adalimumab',
      dose: '40 mg',
      route: 'Subcutaneous',
      frequency: 'Every 2 weeks',
      times: ['20:00'],
      startDate: isoAt(now, 90).slice(0, 10),
      prescriber: 'Dr. Demo Rheumatologist',
      status: 'active',
      notes: 'Synthetic prescription for preview. Rotate injection sites.',
      reminderEnabled: true,
      createdAt: isoAt(now, 90),
    },
    {
      id: 'plan_naproxen',
      patientId,
      name: 'Naproxen (demo)',
      ingredient: 'naproxen',
      dose: '500 mg',
      route: 'Oral',
      frequency: 'Twice daily',
      times: ['08:00', '20:00'],
      startDate: isoAt(now, 120).slice(0, 10),
      prescriber: 'Dr. Demo Rheumatologist',
      status: 'active',
      notes: 'Take with food. Synthetic prescription for preview.',
      reminderEnabled: true,
      createdAt: isoAt(now, 120),
    },
    {
      id: 'plan_vitd',
      patientId,
      name: 'Colecalciferol (demo)',
      ingredient: 'vitamin D3',
      dose: '1000 IU',
      route: 'Oral',
      frequency: 'Once daily',
      times: ['08:00'],
      startDate: isoAt(now, 90).slice(0, 10),
      status: 'active',
      notes: 'Synthetic supplement for preview.',
      reminderEnabled: false,
      createdAt: isoAt(now, 90),
    },
  ]

  const doseEvents: DoseEvent[] = []
  for (let daysAgo = 20; daysAgo >= 0; daysAgo -= 1) {
    medicationPlans.forEach((plan) => {
      plan.times.forEach((time, timeIndex) => {
        if (plan.id === 'plan_biologic' && daysAgo % 14 !== 0) return
        const [hour, minute] = time.split(':').map(Number)
        const scheduledFor = isoAt(now, daysAgo, hour, minute)
        if (new Date(scheduledFor).getTime() > now.getTime()) {
          doseEvents.push({
            id: `dose_${plan.id}_${daysAgo}_${timeIndex}`,
            patientId,
            planId: plan.id,
            scheduledFor,
            status: 'pending',
          })
          return
        }
        const roll = random()
        const status: DoseEvent['status'] =
          daysAgo === 11 && plan.id === 'plan_biologic'
            ? 'uncertain'
            : roll < 0.86
              ? 'taken'
              : roll < 0.94
                ? 'skipped'
                : 'uncertain'
        doseEvents.push({
          id: `dose_${plan.id}_${daysAgo}_${timeIndex}`,
          patientId,
          planId: plan.id,
          scheduledFor,
          status,
          recordedAt: scheduledFor,
          note: status === 'skipped' ? 'Missed due to work schedule' : undefined,
        })
      })
    })
  }

  const appointments: Appointment[] = [
    {
      id: 'appt_next',
      patientId,
      startsAt: isoOn(now, 9, 10, 30),
      timezone: 'Africa/Addis_Ababa',
      clinician: 'Dr. Demo Rheumatologist',
      location: 'Rheum Clinic, Addis Ababa (demo)',
      kind: 'follow-up',
      status: 'scheduled',
      notes: 'Review symptom trends and recent CRP before any treatment change.',
      questions: [
        'Is the current stiffness trend expected?',
        'Do the liver results need repeating?',
      ],
      tasks: [
        { id: 'task_1', label: 'Bring latest laboratory report', done: true },
        { id: 'task_2', label: 'Complete BASDAI before the visit', done: false },
      ],
      reminderDaysBefore: 1,
      createdAt: isoAt(now, 20),
    },
    {
      id: 'appt_past_1',
      patientId,
      startsAt: isoAt(now, 32, 11, 0),
      timezone: 'Africa/Addis_Ababa',
      clinician: 'Dr. Demo Rheumatologist',
      location: 'Rheum Clinic, Addis Ababa (demo)',
      kind: 'review',
      status: 'completed',
      notes: 'Synthetic visit summary. Continue current plan; repeat bloods in six weeks.',
      questions: [],
      tasks: [{ id: 'task_3', label: 'Repeat blood tests', done: true }],
      reminderDaysBefore: 1,
      createdAt: isoAt(now, 50),
    },
    {
      id: 'appt_past_2',
      patientId,
      startsAt: isoAt(now, 92, 9, 0),
      timezone: 'Africa/Addis_Ababa',
      clinician: 'Dr. Demo Rheumatologist',
      location: 'Rheum Clinic, Addis Ababa (demo)',
      kind: 'initial',
      status: 'completed',
      notes: 'Synthetic baseline assessment and treatment discussion.',
      questions: [],
      tasks: [],
      reminderDaysBefore: 2,
      createdAt: isoAt(now, 120),
    },
  ]

  const documents: AppData['documents'] = [
    {
      id: 'doc_mri',
      patientId,
      title: 'MRI sacroiliac joints (synthetic report)',
      category: 'imaging',
      occurredOn: isoAt(now, 125).slice(0, 10),
      clinician: 'Demo Radiologist',
      body: 'Synthetic imaging report used for preview. No real patient findings are represented.',
      source: 'imported',
      createdAt: isoAt(now, 120),
    },
    {
      id: 'doc_diagnosis',
      patientId,
      title: 'Rheumatology assessment (synthetic note)',
      category: 'diagnosis',
      occurredOn: isoAt(now, 118).slice(0, 10),
      clinician: 'Dr. Demo Rheumatologist',
      body: 'Synthetic clinical note. Baseline documented; treatment plan discussed.',
      source: 'clinician',
      createdAt: isoAt(now, 118),
    },
    {
      id: 'doc_prescription',
      patientId,
      title: 'Prescription record (synthetic)',
      category: 'prescription',
      occurredOn: isoAt(now, 90).slice(0, 10),
      clinician: 'Dr. Demo Rheumatologist',
      body: 'Synthetic prescription used to demonstrate medication tracking.',
      source: 'imported',
      createdAt: isoAt(now, 90),
    },
  ]

  return {
    profile,
    symptomEntries: entries,
    assessments,
    medicationPlans,
    doseEvents,
    labResults: labs,
    appointments,
    documents,
    photos: [],
    reminders: [
      {
        id: 'reminder_1',
        patientId,
        kind: 'medication',
        enabled: true,
        quietHoursStart: '22:00',
        quietHoursEnd: '07:00',
        discreetLockScreen: true,
      },
      {
        id: 'reminder_2',
        patientId,
        kind: 'appointment',
        enabled: true,
        quietHoursStart: '22:00',
        quietHoursEnd: '07:00',
        discreetLockScreen: true,
      },
    ],
    memberships: [],
    consents: [],
    auditEvents: [
      {
        id: 'audit_seed_1',
        actorId: patientId,
        action: 'record.created',
        entity: 'symptom_entries',
        at: isoAt(now, 1, 8, 0),
      },
    ],
    lastSyncedAt: isoAt(now, 0, 7, 45),
  }
}

export const emptyData = (profile: AppData['profile']): AppData => ({
  profile,
  symptomEntries: [],
  assessments: [],
  medicationPlans: [],
  doseEvents: [],
  labResults: [],
  appointments: [],
  documents: [],
  photos: [],
  reminders: [],
  memberships: [],
  consents: [],
  auditEvents: [],
  lastSyncedAt: null,
})
