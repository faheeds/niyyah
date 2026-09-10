import { getUser } from '../../auth.ts'
import { acceptAdminInvite } from '../../org-admins.js'

// Claims a pending admin invite by token - see the comment on
// acceptAdminInvite in app/org-admins.js for why possession of the token,
// not the signed-in account's email, is what authorizes this.
export async function POST(request) {
  const user = await getUser()
  if (!user) return Response.json({ error: 'Sign in required.' }, { status: 401 })
  let body
  try { body = await request.json() } catch { return Response.json({ error: 'Invalid request.' }, { status: 400 }) }
  const token = typeof body.token === 'string' ? body.token.trim() : ''
  if (!token) return Response.json({ error: 'This invite link is missing its token.' }, { status: 400 })
  const organizationName = await acceptAdminInvite(user.userId, user.email, user.displayName, token)
  if (!organizationName) return Response.json({ error: 'This invite link is invalid or has already been used.' }, { status: 404 })
  return Response.json({ ok: true, organizationName })
}
