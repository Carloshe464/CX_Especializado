import { expect, it } from 'vitest'
import { isOrgManager } from '@/lib/permissions'

it.each([
  ['admin da plataforma', { role: 'platform_admin', organizationId: null }, true],
  ['supervisor da mesma organização', { role: 'supervisor', organizationId: 'org-x' }, true],
  ['supervisor de outra organização', { role: 'supervisor', organizationId: 'org-y' }, false],
  ['analista', { role: 'analista', organizationId: 'org-x' }, false],
  ['sessão vazia', {}, false],
  ['sessão ausente', null, false],
])('isOrgManager: %s → %s', (_, session, expected) => {
  expect(isOrgManager(session, 'org-x')).toBe(expected)
})
