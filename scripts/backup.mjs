#!/usr/bin/env node
/**
 * Backup / export drill.
 *
 * Usage:
 *   node scripts/backup.mjs <export.json> [--out backups]
 *
 * Reads a myRheumApp JSON export, validates its shape, and writes an archive
 * containing the original JSON, a manifest with SHA-256 checksums and CSV
 * copies of the clinical tables. Fails loudly on malformed input so a corrupt
 * backup is never mistaken for a good one.
 */
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const REQUIRED_ARRAYS = [
  'symptomEntries',
  'assessments',
  'medicationPlans',
  'doseEvents',
  'labResults',
  'appointments',
  'documents',
]

const args = process.argv.slice(2)
const input = args.find((arg) => !arg.startsWith('--'))
const outIndex = args.indexOf('--out')
const outRoot = outIndex >= 0 ? args[outIndex + 1] : 'backups'

if (!input) {
  console.error('Usage: node scripts/backup.mjs <export.json> [--out backups]')
  process.exit(1)
}

if (!existsSync(input)) {
  console.error(`Backup file not found: ${input}`)
  process.exit(1)
}

const raw = await readFile(input, 'utf8')
let data
try {
  data = JSON.parse(raw)
} catch (error) {
  console.error('Backup is not valid JSON:', error.message)
  process.exit(1)
}

const problems = []
if (data.app !== 'myRheumApp') problems.push('Missing app marker "myRheumApp".')
if (!data.profile || typeof data.profile !== 'object') problems.push('Missing profile object.')
for (const key of REQUIRED_ARRAYS) {
  if (!Array.isArray(data[key])) problems.push(`Missing array "${key}".`)
}
if (!data.exportedAt || Number.isNaN(Date.parse(data.exportedAt))) {
  problems.push('Missing or invalid exportedAt timestamp.')
}

if (problems.length > 0) {
  console.error('Backup validation failed:')
  for (const problem of problems) console.error(` - ${problem}`)
  process.exit(1)
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const outDir = path.join(outRoot, `myrheum-backup-${stamp}`)
await mkdir(outDir, { recursive: true })

const sha256 = (value) => createHash('sha256').update(value).digest('hex')

const csvEscape = (value) => {
  if (value === null || value === undefined) return ''
  let text = String(value)
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

const toCsv = (headers, rows) =>
  `\uFEFF${[headers, ...rows].map((row) => row.map(csvEscape).join(',')).join('\r\n')}\r\n`

const tables = {
  symptoms: {
    headers: ['recordedAt', 'pain', 'stiffnessMinutes', 'fatigue', 'sleepQuality', 'functionalDifficulty', 'mood', 'notes', 'sideEffects', 'provenance'],
    rows: data.symptomEntries.map((entry) => [
      entry.recordedAt, entry.pain, entry.stiffnessMinutes, entry.fatigue,
      entry.sleepQuality, entry.functionalDifficulty, entry.mood, entry.notes,
      entry.sideEffects, entry.provenance,
    ]),
  },
  labs: {
    headers: ['collectedAt', 'testName', 'value', 'unit', 'referenceText', 'laboratory', 'source'],
    rows: data.labResults.map((lab) => [
      lab.collectedAt, lab.testName, lab.value, lab.unit, lab.referenceText, lab.laboratory, lab.source,
    ]),
  },
  doses: {
    headers: ['scheduledFor', 'planId', 'status', 'recordedAt', 'note'],
    rows: data.doseEvents.map((event) => [
      event.scheduledFor, event.planId, event.status, event.recordedAt, event.note,
    ]),
  },
}

const files = []
const originalName = 'export-original.json'
await writeFile(path.join(outDir, originalName), raw, 'utf8')
files.push({ name: originalName, bytes: Buffer.byteLength(raw), sha256: sha256(raw) })

for (const [name, table] of Object.entries(tables)) {
  const csv = toCsv(table.headers, table.rows)
  const filename = `${name}.csv`
  await writeFile(path.join(outDir, filename), csv, 'utf8')
  files.push({ name: filename, rows: table.rows.length, sha256: sha256(csv) })
}

const manifest = {
  source: path.resolve(input),
  archivedAt: new Date().toISOString(),
  originalExportedAt: data.exportedAt,
  counts: Object.fromEntries(REQUIRED_ARRAYS.map((key) => [key, data[key].length])),
  photosOmitted: data.photosOmitted ?? 0,
  files,
  note: 'Clinical data is sensitive. Encrypt this archive and store it securely.',
}
await writeFile(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8')

// Round-trip check: the archived original must parse back to the same counts.
const reread = JSON.parse(await readFile(path.join(outDir, originalName), 'utf8'))
for (const key of REQUIRED_ARRAYS) {
  if (reread[key].length !== data[key].length) {
    console.error(`Round-trip mismatch for ${key}`)
    process.exit(1)
  }
}

console.log(`Backup verified and archived to ${outDir}`)
for (const [key, count] of Object.entries(manifest.counts)) {
  console.log(`  ${key.padEnd(20)} ${count}`)
}
console.log(`  photos omitted       ${manifest.photosOmitted}`)
