import { getUser } from '../../auth.ts'
import { prepareCommunityTables } from '../../../db/index.js'
import { ADMIN_EMAILS } from '../../admin-emails.js'

// Admin access is gated on ADMIN_EMAILS membership alone - not on
// emailVerified/Google - because both public sign-up routes refuse to
// register any address on that list (see app/admin-emails.js), so no account
// with a matching email can be created by a member of the public. Requiring
// emailVerified here as well would make /admin unreachable until Google
// sign-in is configured, with no in-app remedy.
const isAdmin = user => !!user && ADMIN_EMAILS.includes(String(user.email || '').toLowerCase())

export async function GET(){
  const user = await getUser()
  if (!user) return Response.json({ error: 'Sign in required.' }, { status: 401 })
  if (!isAdmin(user)) return Response.json({ error: 'Admin access required.' }, { status: 403 })
  const db = await prepareCommunityTables()
  const organizations = await db.prepare(`SELECT id,name,organization_type,email,phone,website,address,postcode,description,safeguarding_name,safeguarding_email,status,created_at FROM organizations ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END, created_at DESC LIMIT 100`).all()
  return Response.json({ organizations: organizations.results ?? [] })
}

export async function POST(request){
  const user = await getUser()
  if (!user) return Response.json({ error: 'Sign in required.' }, { status: 401 })
  if (!isAdmin(user)) return Response.json({ error: 'Admin access required.' }, { status: 403 })
  const { organizationId, decision } = await request.json()
  if (!['approved', 'rejected'].includes(decision)) return Response.json({ error: 'Invalid decision.' }, { status: 400 })
  const db = await prepareCommunityTables()
  const result = await db.prepare(`UPDATE organizations SET status=?,updated_at=? WHERE id=?`).bind(decision, new Date().toISOString(), String(organizationId || '')).run()
  if (!result.meta?.changes) return Response.json({ error: 'Organization not found.' }, { status: 404 })
  return Response.json({ ok: true })
}
