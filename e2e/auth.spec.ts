import { expect, test } from '@playwright/test'
import { signInAsDemo, signOut } from './helpers'

test('demo sign-in opens the dashboard with a synthetic-data notice', async ({ page }) => {
  await signInAsDemo(page)
  await expect(page.getByText(/preview mode/i)).toBeVisible()
  await expect(page.getByText(/every clinical value on this screen is synthetic/i)).toBeVisible()
})

test('session survives a reload and sign-out returns to login', async ({ page }) => {
  await signInAsDemo(page)
  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: /dashboard/i })).toBeVisible()

  await signOut(page)
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('heading', { name: /sign in to your journal/i })).toBeVisible()
})
