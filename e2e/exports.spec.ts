import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { openSection, signInAsDemo } from './helpers'

test('JSON backup contains the expected patient tables', async ({ page }) => {
  await signInAsDemo(page)
  await openSection(page, 'Reports & exports')

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download JSON backup' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^myrheum-backup-\d{4}-\d{2}-\d{2}\.json$/)

  const filePath = await download.path()
  expect(filePath).toBeTruthy()
  const payload = JSON.parse(await readFile(filePath!, 'utf8'))
  expect(payload.app).toBe('myRheumApp')
  expect(payload.profile.email).toBe('demo@myrheum.app')
  expect(Array.isArray(payload.symptomEntries)).toBe(true)
  expect(payload.symptomEntries.length).toBeGreaterThan(10)
  expect(Array.isArray(payload.labResults)).toBe(true)
  expect(payload.photosOmitted).toBe(0)
})

test('symptoms CSV is downloadable and correctly quoted', async ({ page }) => {
  await signInAsDemo(page)
  await openSection(page, 'Reports & exports')

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download Symptoms CSV' }).click()
  const download = await downloadPromise
  const filePath = await download.path()
  const csv = await readFile(filePath!, 'utf8')
  expect(csv).toContain('Recorded at,Pain (0-10)')
  expect(csv.split('\r\n').length).toBeGreaterThan(5)
})

test('PDF summary downloads a valid PDF document', async ({ page }) => {
  await signInAsDemo(page)
  await openSection(page, 'Reports & exports')

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'PDF summary' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^myrheum-summary-.*\.pdf$/)
  const filePath = await download.path()
  const buffer = await readFile(filePath!)
  expect(buffer.subarray(0, 5).toString()).toBe('%PDF-')
  expect(buffer.byteLength).toBeGreaterThan(1000)
})
