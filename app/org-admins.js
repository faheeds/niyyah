import { prepareCommunityTables } from '../db/index.js'

// Activates a pending admin invitation. Possession of the token (from the
// link an owner copies and sends however they like - email, Slack, text) is
// the entire authorization here, deliberately not the account's email
// address: a password sign-up/sign-in's email is self-asserted (anyone can
// claim any address at /api/auth/signup with no ownership check - see the
// comment on this in app/org-membership.js, one privilege tier down), so an
// invite that activated off "the signed-in account's email matches the
// invited address" could be claimed by an attacker who simply registers
// that address first. A random token nobody else has seen doesn't have that
// hole, and unlike relying on Google's emailVerified it works before Google
// sign-in is even configured, and for admins who only ever use a password.
// Returns the organization name on success, or null if the token doesn't
// match a still-pending invite (already used, or never existed).
export async function acceptAdminInvite(userId, email, displayName, token) {
  const cleanToken = String(token || '').trim()
  if (!cleanToken) return null
  const db = await prepareCommunityTables()
  const now = new Date().toISOString()
  const invite = await db.prepare("SELECT id,organization_id FROM organization_admins WHERE invite_token=? AND status='invited'").bind(cleanToken).first()
  if (!invite) return null
  // Whoever holds the link claims the seat, using their own real account
  // details - not whatever address the owner guessed when typing the invite.
  await db.prepare(`UPDATE organization_admins SET user_id=?,email=?,display_name=?,status='active',invite_token=NULL,updated_at=? WHERE id=?`)
    .bind(userId, String(email || '').trim().toLowerCase(), displayName || null, now, invite.id).run()
  const organization = await db.prepare('SELECT name FROM organizations WHERE id=?').bind(invite.organization_id).first()
  return organization?.name || 'your organization'
}

// Resolves what organization (if any) this user can access from
// /organizer, and at what role. Ownership (organizations.owner_user_id)
// always wins and is reported as role 'owner' - organization_admins only
// ever grants 'admin' or 'staff', never 'owner', so this can't be used to
// self-promote past the person who created the organization. A user
// administering more than one organization is an edge case this app
// doesn't support yet; the first match wins.
export async function resolveOrganizationAccess(db, userId) {
  const owned = await db.prepare('SELECT * FROM organizations WHERE owner_user_id=?').bind(userId).first()
  if (owned) return { organization: owned, role: 'owner' }
  const admin = await db.prepare(`SELECT o.*, a.role AS admin_role FROM organization_admins a JOIN organizations o ON o.id=a.organization_id WHERE a.user_id=? AND a.status='active' LIMIT 1`).bind(userId).first()
  if (admin) {
    const { admin_role, ...organization } = admin
    return { organization, role: admin_role }
  }
  return { organization: null, role: null }
}
