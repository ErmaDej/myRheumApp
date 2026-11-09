import type { DoseEvent, LabResult, MedicationPlan, SymptomEntry } from '@/data/types'
import { formatDate } from '@/lib/utils'

type Cell = string | number | null | undefined

/**
 * Spreadsheet apps treat cells starting with these characters as formulas.
 * Prefixing with an apostrophe keeps exported clinical notes inert.
 */
const FORMULA_PREFIXES = ['=', '+', '-', '@', '\t', '\r']

const escapeCell = (value: Cell): string => {
  if (value === null || value === undefined) return ''
  let text = String(value)
  if (FORMULA_PREFIXES.some((prefix) => text.startsWith(prefix))) {
    text = `'${text}`
  }
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

export const toCsv = (headers: string[], rows: Cell[][]): string => {
  const lines = [headers.map(escapeCell).join(','), ...rows.map((row) => row.map(escapeCell).join(','))]
  // Excel and LibreOffice open UTF-8 CSV reliably with a BOM.
  return `\uFEFF${lines.join('\r\n')}\r\n`
}

export const symptomEntriesCsv = (entries: SymptomEntry[]): string =>
  toCsv(
    [
      'Recorded at',
      'Pain (0-10)',
      'Morning stiffness (min)',
      'Fatigue (0-10)',
      'Sleep quality (0-10)',
      'Functional difficulty (0-10)',
      'Mood (0-10)',
      'Triggers',
      'Side effects',
      'Notes',
      'Provenance',
    ],
    entries.map((entry) => [
      entry.recordedAt,
      entry.pain,
      entry.stiffnessMinutes,
      entry.fatigue,
      entry.sleepQuality,
      entry.functionalDifficulty,
      entry.mood,
      entry.triggers,
      entry.sideEffects,
      entry.notes,
      entry.provenance,
    ]),
  )

export const labResultsCsv = (labs: LabResult[]): string =>
  toCsv(
    [
      'Collected',
      'Test',
      'Value',
      'Unit',
      'Reference low',
      'Reference high',
      'Reference text',
      'Laboratory',
      'Source',
      'Notes',
    ],
    labs.map((lab) => [
      formatDate(lab.collectedAt),
      lab.testName,
      lab.value,
      lab.unit,
      lab.referenceLow,
      lab.referenceHigh,
      lab.referenceText,
      lab.laboratory,
      lab.source,
      lab.notes,
    ]),
  )

export const doseEventsCsv = (events: DoseEvent[], plans: MedicationPlan[]): string => {
  const planNames = new Map(plans.map((plan) => [plan.id, plan.name]))
  return toCsv(
    ['Scheduled for', 'Medication', 'Status', 'Recorded at', 'Note'],
    events.map((event) => [
      event.scheduledFor,
      planNames.get(event.planId) ?? 'Unknown plan',
      event.status,
      event.recordedAt,
      event.note,
    ]),
  )
}

export const downloadFile = (filename: string, content: string, mime = 'text/csv;charset=utf-8'): void => {
  if (typeof document === 'undefined') return
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
