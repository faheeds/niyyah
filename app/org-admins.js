import { prepareCommunityTables } from '../db/index.js'

// Claims any pending admin invitations for this email by linking them to
// this account, so an owner can invite a teammate by email before that
// teammate has ever created a Niyyah account - the invite becomes real
// access the moment they sign up or sign in with that address. Safe to call
// on every sign-up/sign-in, mirroring autoEnrollBySchoolEmail (see
// app/org-membership.js). Unlike that function, this needs no
// emailVerified gate: an invite always names one specific address an
// existing owner/admin typed deliberately, so there's no "guess a domain"
// exposure - only that exact address can ever claim it.
export async function claimAdminInvites(userId, email) {
  const cleanEmail = String(email || '').trim().toLowerCase()
  if (!cleanEmail) return
  const db = await prepareCommunityTables()
  const now = new Date().toISOString()
  await db.prepare(`UPDATE organization_admins SET user_id=?,status='active',updated_at=? WHERE email=? AND status='invited'`)
    .bind(userId, now, cleanEmail).run()
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
