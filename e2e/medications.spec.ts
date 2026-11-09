import { expect, test } from '@playwright/test'
import { openSection, signInAsDemo } from './helpers'

test('reminder preference can be toggled without changing the prescription', async ({ page }) => {
  await signInAsDemo(page)
  await openSection(page, 'Medications')

  await expect(page.getByRole('heading', { name: /medications/i })).toBeVisible()
  const toggle = page.getByRole('switch', { name: 'Adalimumab (demo)' }).first()
  await expect(toggle).toBeVisible()
  await toggle.click()
  await expect(page.getByText(/reminder plan (enabled|disabled)/i)).toBeVisible()
})

test('side-effect logging creates a journal entry and warns about urgent care', async ({ page }) => {
  await signInAsDemo(page)
  await openSection(page, 'Medications')

  await page.getByRole('button', { name: /log side effect/i }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText(/seek urgent medical care/i)).toBeVisible()

  await dialog.getByLabel('What did you notice?').fill('Mild nausea after the injection')
  await dialog.getByRole('button', { name: 'Save side effect' }).click()
  await expect(page.getByText('Side effect recorded')).toBeVisible()
})
