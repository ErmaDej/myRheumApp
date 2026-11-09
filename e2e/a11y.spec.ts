import { expect, test, type Page } from '@playwright/test'
import axe from 'axe-core'
import { signInAsDemo } from './helpers'

const runAudit = async (page: Page) => {
  await page.addScriptTag({ content: axe.source })
  const violations = await page.evaluate(async () =>
    // @ts-expect-error axe injected at runtime
    (await window.axe.run(document, {
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'],
      },
    })).violations.filter((violation: { impact: string | null }) =>
      violation.impact === 'serious' || violation.impact === 'critical',
    ),
  )
  return violations as Array<{ id: string; help: string; nodes: Array<{ target: string[] }> }>
}

test('login meets automated WCAG 2.2 AA checks', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: /sign in to your journal/i })).toBeVisible()
  const violations = await runAudit(page)
  expect(violations, JSON.stringify(violations, null, 2)).toEqual([])
})

test('dashboard meets automated WCAG 2.2 AA checks', async ({ page }) => {
  await signInAsDemo(page)
  const violations = await runAudit(page)
  expect(violations, JSON.stringify(violations, null, 2)).toEqual([])
})
