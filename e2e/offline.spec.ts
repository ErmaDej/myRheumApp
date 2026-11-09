import { expect, test } from '@playwright/test'
import { signInAsDemo } from './helpers'

test('app shell remains usable offline after the service worker is active', async ({ page, context }) => {
  await signInAsDemo(page)

  await page.evaluate(async () => {
    if ('serviceWorker' in navigator) {
      await navigator.serviceWorker.ready
    }
  })
  // Reload once while online so the service worker controls the page.
  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: /dashboard/i })).toBeVisible()

  await context.setOffline(true)
  await page.reload()

  await expect(page.getByRole('heading', { level: 1, name: /dashboard/i })).toBeVisible()
  // The chip is rendered in both the sidebar and header; only one is visible per breakpoint.
  await expect(page.getByText('Offline', { exact: true }).filter({ visible: true }).first()).toBeVisible()
  await expect(page.getByText(/entries are saved on this device/i)).toBeAttached()

  await context.setOffline(false)
})
