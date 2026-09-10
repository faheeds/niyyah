import { prepareCommunityTables } from '../db/index.js'

// Auto-enrolls a volunteer as a "student" member of every organization
// whose registered email domain (see organization_email_domains) matches
// their account email. Safe - and meant - to be called on every
// sign-up/sign-in, not only account creation: that's what lets a student who
// signed up before their school registered its domain get swept in
// automatically the next time they sign in, with no action needed from them.
// ON CONFLICT DO NOTHING never overwrites an existing organization_members
// row, so this can never downgrade a membership an admin already approved,
// or resurrect one an organizer removed (see the 'removed' status in
// app/api/organizer/route.js's removeMember action).
//
// emailVerified must be true only when the caller has independent proof of
// the address (currently: Google's email_verified claim). A password
// sign-up/sign-in's email is self-asserted - anyone can claim any address at
// /api/auth/signup with no ownership check - so passing true there would let
// someone grant themselves approved-student standing on a school's roster
// just by typing a plausible address. Unverified callers land 'pending' so
// an organizer confirms the person before that standing (and, later, hours
// approval) is granted.
export async function autoEnrollBySchoolEmail(userId, email, displayName, emailVerified) {
  const cleanEmail = String(email || '').trim().toLowerCase()
  const domain = cleanEmail.split('@')[1]
  if (!domain) return
  const db = await prepareCommunityTables()
  const matches = await db.prepare('SELECT organization_id FROM organization_email_domains WHERE domain=?').bind(domain).all()
  const rows = matches.results ?? []
  if (!rows.length) return
  const now = new Date().toISOString()
  const status = emailVerified ? 'approved' : 'pending'
  for (const row of rows) {
    await db.prepare(`INSERT INTO organization_members (id,organization_id,user_id,email,display_name,tag,status,source,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(organization_id,user_id) DO NOTHING`)
      .bind(crypto.randomUUID(), row.organization_id, userId, cleanEmail, displayName || cleanEmail, 'student', status, 'school_email', now, now).run()
  }
}
