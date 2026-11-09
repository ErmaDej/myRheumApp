import { expect, test } from '@playwright/test'
import { openSection, signInAsDemo } from './helpers'

test('anatomy explorer offers accessible regions and honest disclaimers', async ({ page }) => {
  await signInAsDemo(page)
  await openSection(page, 'Anatomy explorer')

  await expect(page.getByRole('heading', { name: /anatomy explorer/i })).toBeVisible()
  await expect(page.getByText(/generic educational model/i).first()).toBeVisible()
  await expect(page.getByText(/not a scan of your body/i)).toBeVisible()

  const region = page.getByRole('button', { name: /sacroiliac joints/i })
  await region.click()
  await expect(region).toHaveAttribute('aria-pressed', 'true')
  // The label is a <strong> followed by a text node, so match the surrounding paragraph.
  await expect(page.locator('p', { hasText: /focused region:/i })).toContainText(/sacroiliac/i)
  await expect(page.getByText(/never infers inflammation or fusion/i)).toBeVisible()
})
