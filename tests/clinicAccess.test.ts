import { describe, expect, it } from 'vitest'
import {
  canReadPatient,
  canViewAudit,
  canWritePatient,
  resolveScope,
  roleCanWrite,
  visiblePatientIds,
} from '@/lib/clinic/access'
import type { AccessContext } from '@/lib/clinic/access'
import type { Membership, PatientConsent } from '@/data/types'

const membership = (role: Membership['role'], orgId = 'org_1'): Membership => ({
  id: `m_${role}`,
  orgId,
  userId: 'clinician_1',
  role,
  createdAt: '2026-01-01T00:00:00.000Z',
})

const consent = (overrides: Partial<PatientConsent> = {}): PatientConsent => ({
  id: 'consent_1',
  orgId: 'org_1',
  patientId: 'patient_1',
  grantedToUserId: 'clinician_1',
  scope: 'read',
  grantedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
})

const context = (overrides: Partial<AccessContext> = {}): AccessContext => ({
  userId: 'clinician_1',
  memberships: [membership('clinician')],
  consents: [consent()],
  orgId: 'org_1',
  ...overrides,
})

describe('patient ownership', () => {
  it('always gives the patient read-write access to their own record', () => {
    const ctx = context({ userId: 'patient_1', memberships: [], consents: [] })
    expect(resolveScope(ctx, 'patient_1')).toBe('read-write')
    expect(canWritePatient(ctx, 'patient_1')).toBe(true)
  })

  it('denies access to an unrelated patient id', () => {
    const ctx = context({ consents: [] })
    expect(resolveScope(ctx, 'patient_2')).toBe('none')
    expect(canReadPatient(ctx, 'patient_2')).toBe(false)
  })
})

describe('clinician consent', () => {
  it('grants read scope with an active read consent', () => {
    expect(resolveScope(context(), 'patient_1')).toBe('read')
    expect(canWritePatient(context(), 'patient_1')).toBe(false)
  })

  it('grants read-write only when consent and role both allow it', () => {
    const ctx = context({ consents: [consent({ scope: 'read-write' })] })
    expect(resolveScope(ctx, 'patient_1')).toBe('read-write')
    expect(canWritePatient(ctx, 'patient_1')).toBe(true)
  })

  it('never lets a viewer write, even with a read-write consent', () => {
    const ctx = context({
      memberships: [membership('viewer')],
      consents: [consent({ scope: 'read-write' })],
    })
    expect(roleCanWrite('viewer')).toBe(false)
    expect(resolveScope(ctx, 'patient_1')).toBe('read')
    expect(canWritePatient(ctx, 'patient_1')).toBe(false)
  })

  it('revoking consent removes access immediately', () => {
    const ctx = context({ consents: [consent({ revokedAt: '2026-02-01T00:00:00.000Z' })] })
    expect(canReadPatient(ctx, 'patient_1')).toBe(false)
  })

  it('requires a membership in the consenting organisation', () => {
    const ctx = context({ memberships: [membership('clinician', 'org_2')], orgId: 'org_2' })
    expect(canReadPatient(ctx, 'patient_1')).toBe(false)
  })

  it('does not transfer access to another clinician without consent', () => {
    const ctx = context({ userId: 'clinician_2' })
    expect(canReadPatient(ctx, 'patient_1')).toBe(false)
  })

  it('cannot be widened by passing an organisation id alone', () => {
    const ctx = context({ userId: 'stranger', memberships: [], orgId: 'org_1' })
    expect(canReadPatient(ctx, 'patient_1')).toBe(false)
  })
})

describe('audit visibility', () => {
  it('allows owners and clinicians to read their organisation audit trail', () => {
    expect(canViewAudit(context({ memberships: [membership('owner')] }), 'org_1')).toBe(true)
    expect(canViewAudit(context(), 'org_1')).toBe(true)
  })

  it('denies viewers and outsiders', () => {
    expect(canViewAudit(context({ memberships: [membership('viewer')] }), 'org_1')).toBe(false)
    expect(canViewAudit(context({ memberships: [] }), 'org_1')).toBe(false)
  })
})

describe('visiblePatientIds', () => {
  it('filters a list without leaking inaccessible ids', () => {
    const ctx = context({
      consents: [consent({ patientId: 'patient_1' }), consent({ id: 'c2', patientId: 'patient_3', revokedAt: 'x' })],
    })
    expect(visiblePatientIds(ctx, ['patient_1', 'patient_2', 'patient_3'])).toEqual(['patient_1'])
  })
})
