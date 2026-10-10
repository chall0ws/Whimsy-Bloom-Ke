import type { Role, User } from './types'

/**
 * Parses the team list from configuration, e.g.
 *   "you@gmail.com:SUPER_ADMIN, her@gmail.com:ADMIN"
 * An entry without a role is an admin.
 */
export function parseStaffList(raw: string | undefined): Map<string, Role> {
  const staff = new Map<string, Role>()
  for (const entry of (raw ?? '').split(',')) {
    const [email, role] = entry.split(':').map((s) => s.trim())
    if (!email || !email.includes('@')) continue
    staff.set(email.toLowerCase(), role?.toUpperCase() === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'ADMIN')
  }
  return staff
}

/** The dashboard role for a signed-in Google account, or null for customers. */
export function staffRoleFor(email: string, configured: Map<string, Role>, users: User[]): Role | null {
  const key = email.trim().toLowerCase()
  return configured.get(key) ?? users.find((u) => u.email.toLowerCase() === key)?.role ?? null
}
