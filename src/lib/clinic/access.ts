/**
 * Clinic-edition authorisation rules.
 *
 * The current deployment is single-patient. These pure helpers exist so that a
 * future clinic edition can add clinicians *without* ever broadening access
 * implicitly:
 *   - a patient always has full access to their own record;
 *   - a clinician only sees a patient with an active, explicit consent;
 *   - consent is scoped (read vs read-write) and revocable;
 *   - membership is scoped to one organisation;
 *   - viewers can never write;
 *   - nothing here replaces Row Level Security — SQL policies must enforce
 *     the same rules on the server.
 */

import type { Membership, OrgRole, PatientConsent } from '@/data/types'

export type AccessScope = 'none' | 'read' | 'read-write'

export interface AccessContext {
  userId: string
  memberships: Membership[]
  consents: PatientConsent[]
  orgId?: string
}

const WRITE_ROLES: OrgRole[] = ['owner', 'clinician', 'coordinator']

export const roleCanWrite = (role: OrgRole): boolean => WRITE_ROLES.includes(role)

export const isConsentActive = (consent: PatientConsent): boolean => !consent.revokedAt

/** Membership of the current user in the organisation that owns a consent. */
export const membershipFor = (context: AccessContext, orgId: string): Membership | undefined =>
  context.memberships.find(
    (membership) => membership.userId === context.userId && membership.orgId === orgId,
  )

/**
 * Scope of a clinician over a patient. Returns 'none' unless an active consent
 * explicitly names this user or their organisation and the user still belongs
 * to that organisation.
 */
export const clinicianScope = (context: AccessContext, patientId: string): AccessScope => {
  const active = context.consents.filter(
    (consent) =>
      consent.patientId === patientId &&
      isConsentActive(consent) &&
      (consent.grantedToUserId === context.userId || consent.orgId === context.orgId),
  )

  if (active.length === 0) return 'none'

  let scope: AccessScope = 'none'
  for (const consent of active) {
    const membership = membershipFor(context, consent.orgId)
    if (!membership) continue
    if (consent.scope === 'read-write' && roleCanWrite(membership.role)) {
      return 'read-write'
    }
    scope = 'read'
  }
  return scope
}

/** Resolve the effective scope for the current user over a patient record. */
export const resolveScope = (context: AccessContext, patientId: string): AccessScope => {
  if (context.userId === patientId) return 'read-write'
  return clinicianScope(context, patientId)
}

export const canReadPatient = (context: AccessContext, patientId: string): boolean =>
  resolveScope(context, patientId) !== 'none'

export const canWritePatient = (context: AccessContext, patientId: string): boolean =>
  resolveScope(context, patientId) === 'read-write'

/** Only organisation members may inspect that organisation's audit trail. */
export const canViewAudit = (context: AccessContext, orgId: string): boolean => {
  const membership = membershipFor(context, orgId)
  return Boolean(membership && ['owner', 'clinician'].includes(membership.role))
}

/** Filter a list of patient identifiers to those the user may read. */
export const visiblePatientIds = (context: AccessContext, patientIds: string[]): string[] =>
  patientIds.filter((patientId) => canReadPatient(context, patientId))

/** Human-readable reason used in the UI, without leaking record existence. */
export const accessDeniedMessage = (): string =>
  'You do not have permission to view this record. If you are a clinician, ask the patient to grant access from their settings.'

/**
 * Build a defensive audit entry. Audit events must never carry clinical
 * values, only identifiers and the action performed.
 */
export const auditEntry = (
  actorId: string,
  action: string,
  options: { orgId?: string; patientId?: string; entity?: string; at?: string } = {},
) => ({
  id: `audit_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
  actorId,
  action,
  orgId: options.orgId,
  patientId: options.patientId,
  entity: options.entity,
  at: options.at ?? new Date().toISOString(),
})
