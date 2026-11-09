import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import axe from 'axe-core'
import { AppProviders } from '@/app/AppProviders'
import { AppRoutes } from '@/app/routes'
import { createAppStore } from '@/data/store'
import { createDemoData } from '@/data/seed'
import type { SessionUser } from '@/data/auth'

const demoUser: SessionUser = {
  id: 'patient_demo',
  email: 'demo@myrheum.app',
  name: 'Demo Patient',
  mode: 'demo',
}

const audit = async () => {
  const results = await axe.run(document.body, {
    rules: {
      // jsdom has no layout engine, so contrast and target-size rules cannot run meaningfully here.
      'color-contrast': { enabled: false },
      'target-size': { enabled: false },
    },
  })
  return results.violations.filter(
    (violation) => violation.impact === 'critical' || violation.impact === 'serious',
  )
}

describe('accessibility audit', () => {
  it('login page has no serious or critical axe violations', async () => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <AppProviders>
          <AppRoutes />
        </AppProviders>
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: /sign in to your journal/i })).toBeInTheDocument()
    const violations = await audit()
    expect(violations.map((violation) => `${violation.id}: ${violation.help}`)).toEqual([])
  })

  it('dashboard has no serious or critical axe violations', async () => {
    const store = createAppStore(createDemoData())
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AppProviders authUser={demoUser} store={store}>
          <AppRoutes />
        </AppProviders>
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { level: 1, name: /dashboard/i })).toBeInTheDocument()
    expect(await screen.findByText(/demo patient/i)).toBeInTheDocument()
    const violations = await audit()
    expect(violations.map((violation) => `${violation.id}: ${violation.help}`)).toEqual([])
  })
})
