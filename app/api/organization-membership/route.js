import { getUser } from '../../auth.ts'
import { prepareCommunityTables } from '../../../db/index.js'

const allowedTags = new Set(['parent', 'external'])

// Lets a volunteer request to join an organization's roster themselves -
// students get in automatically via autoEnrollBySchoolEmail (see
// app/org-membership.js) instead of using this route. Always lands as
// 'pending': only an org admin approving it from /organizer (see the
// approveMember action in app/api/organizer/route.js) can change that -
// P0-06 will make that approval a precondition for getting hours approved.
export async function POST(request) {
  const user = await getUser()
  if (!user) return Response.json({ error: 'Sign in required.' }, { status: 401 })
  let body
  try { body = await request.json() } catch { return Response.json({ error: 'Invalid request.' }, { status: 400 }) }
  const organizationId = String(body.organizationId || '')
  const tag = allowedTags.has(body.tag) ? body.tag : 'external'
  const db = await prepareCommunityTables()
  const organization = await db.prepare("SELECT id FROM organizations WHERE id=? AND status='approved'").bind(organizationId).first()
  if (!organization) return Response.json({ error: 'Choose a Niyyah organization.' }, { status: 400 })
  const now = new Date().toISOString()
  await db.prepare(`INSERT INTO organization_members (id,organization_id,user_id,email,display_name,tag,status,source,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(organization_id,user_id) DO NOTHING`)
    .bind(crypto.randomUUID(), organization.id, user.userId, user.email, user.displayName, tag, 'pending', 'self_requested', now, now).run()
  return Response.json({ ok: true })
}
