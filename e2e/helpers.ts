import { expect, type Page } from '@playwright/test'

export const signInAsDemo = async (page: Page) => {
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: /sign in to your journal/i })).toBeVisible()
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.getByRole('heading', { level: 1, name: /dashboard/i })).toBeVisible()
}

/**
 * Signs out from wherever the control lives: the desktop sidebar, the tablet header,
 * or the "All sections" sheet that is the only place it exists on a phone.
 */
export const signOut = async (page: Page) => {
  const direct = page.locator('button[aria-label="Sign out"]:visible').first()
  if (await direct.count()) {
    await direct.click()
    return
  }
  await page.getByRole('button', { name: /open navigation menu/i }).click()
  await page.getByRole('button', { name: /^sign out$/i }).click()
}

/** Navigates through the visible sidebar on desktop or the More sheet on mobile. */
export const openSection = async (page: Page, label: string) => {
  const visibleLink = page.locator('a:visible').filter({ hasText: label }).first()
  if (await visibleLink.count()) {
    await visibleLink.click()
  } else {
    await page.getByRole('button', { name: 'Open navigation menu' }).click()
    await page.locator('a:visible').filter({ hasText: label }).first().click()
  }
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
}
