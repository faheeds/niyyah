import { prepareCommunityTables } from '../db/index.js'

// Auto-enrolls a volunteer as an approved "student" member of every
// organization whose registered email domain (see organization_email_domains)
// matches their account email. Safe - and meant - to be called on every
// sign-up/sign-in, not only account creation: that's what lets a student who
// signed up before their school registered its domain get swept in
// automatically the next time they sign in, with no action needed from them.
// ON CONFLICT DO NOTHING never overwrites an existing organization_members
// row, so this can never downgrade a membership an admin already approved
// with a different tag.
export async function autoEnrollBySchoolEmail(userId, email, displayName) {
  const cleanEmail = String(email || '').trim().toLowerCase()
  const domain = cleanEmail.split('@')[1]
  if (!domain) return
  const db = await prepareCommunityTables()
  const matches = await db.prepare('SELECT organization_id FROM organization_email_domains WHERE domain=?').bind(domain).all()
  const rows = matches.results ?? []
  if (!rows.length) return
  const now = new Date().toISOString()
  for (const row of rows) {
    await db.prepare(`INSERT INTO organization_members (id,organization_id,user_id,email,display_name,tag,status,source,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(organization_id,user_id) DO NOTHING`)
      .bind(crypto.randomUUID(), row.organization_id, userId, cleanEmail, displayName || cleanEmail, 'student', 'approved', 'school_email', now, now).run()
  }
}
