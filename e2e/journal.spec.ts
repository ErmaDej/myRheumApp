import { expect, test } from '@playwright/test'
import { openSection, signInAsDemo } from './helpers'

test('a check-in saves locally and appears in recent entries', async ({ page }) => {
  await signInAsDemo(page)
  await openSection(page, 'Journal')

  await expect(page.getByRole('heading', { name: /daily check-in/i })).toBeVisible()
  await page.getByLabel('Morning stiffness duration').fill('18')

  await page.getByText('Add context, side effects or notes').click()
  await page.getByLabel('Notes').fill('Automated test check-in; stiffness easing after stretching.')

  await page.getByRole('button', { name: 'Save check-in' }).click()
  await expect(page.getByText('Check-in saved')).toBeVisible()

  await expect(
    page.getByText('Automated test check-in; stiffness easing after stretching.'),
  ).toBeVisible()
})
