import { env } from 'cloudflare:workers'
import { prepareAuthTables } from '../../../../../db/index.js'
import { readCookie, createSession, sessionCookieHeader } from '../../../../auth.ts'
import { autoEnrollBySchoolEmail } from '../../../../org-membership.js'

const clearOauthCookies = [
  'niyyah_oauth_state=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax',
  'niyyah_oauth_return=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax',
]

export async function GET(request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const stateParam = url.searchParams.get('state')
  const cookieHeader = request.headers.get('cookie')
  const expectedState = readCookie(cookieHeader, 'niyyah_oauth_state')
  const returnTo = readCookie(cookieHeader, 'niyyah_oauth_return') || '/'

  if (!code || !stateParam || !expectedState || stateParam !== expectedState) {
    return new Response('Google sign-in could not be verified. Please try again from the sign-in page.', { status: 400 })
  }
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    return new Response('Google sign-in is not set up yet.', { status: 501 })
  }

  const redirectUri = `${url.origin}/api/auth/google/callback`
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, redirect_uri: redirectUri, grant_type: 'authorization_code' }),
  })
  if (!tokenResponse.ok) return new Response('Google sign-in failed. Please try again.', { status: 400 })
  const tokenJson = await tokenResponse.json()
  const idToken = tokenJson.id_token
  if (!idToken) return new Response('Google sign-in failed. Please try again.', { status: 400 })

  // Verify the token's signature and audience via Google's tokeninfo endpoint,
  // rather than parsing the JWT ourselves — simpler to read and audit.
  const verifyResponse = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`)
  if (!verifyResponse.ok) return new Response('Google sign-in could not be verified.', { status: 400 })
  const claims = await verifyResponse.json()
  if (claims.aud !== env.GOOGLE_CLIENT_ID || !claims.email || claims.email_verified !== 'true') {
    return new Response('Google sign-in could not be verified.', { status: 400 })
  }

  const db = await prepareAuthTables()
  const email = String(claims.email).toLowerCase()
  const now = new Date().toISOString()

  // Look up strictly by google_sub first - the only identifier Google itself
  // vouches for. We deliberately do NOT also match by email here: an email
  // is a self-asserted claim until Google confirms it (see emailVerified in
  // app/auth.ts), because /api/auth/signup lets anyone register any email
  // with no ownership check. Matching on email would let someone who
  // pre-registers a victim's address with a password of their choosing
  // silently inherit that victim's account the moment the real owner signs
  // in with Google - and keep their password access to it afterward.
  let account = await db.prepare('SELECT id FROM accounts WHERE google_sub=?').bind(claims.sub).first()
  if (!account) {
    const existingByEmail = await db.prepare('SELECT id,password_hash FROM accounts WHERE email=?').bind(email).first()
    if (existingByEmail) {
      if (existingByEmail.password_hash) {
        // This address already belongs to a password account. Only that
        // account's owner - authenticated with the password - should be able
        // to attach Google to it, not this unauthenticated callback.
        return new Response('An account already exists with this email. Please sign in with your password instead.', { status: 409 })
      }
      // No password on this row, so it was created by an earlier Google
      // sign-in with the same address (e.g. an interrupted flow) - safe to claim.
      account = existingByEmail
      await db.prepare('UPDATE accounts SET google_sub=?,updated_at=? WHERE id=?').bind(claims.sub, now, account.id).run()
    } else {
      const id = crypto.randomUUID()
      await db.prepare('INSERT INTO accounts (id,email,display_name,google_sub,created_at,updated_at) VALUES (?,?,?,?,?,?)')
        .bind(id, email, claims.name || email, claims.sub, now, now).run()
      account = { id }
    }
  }

  // Runs on every Google sign-in, new account or returning - lets a student
  // get swept onto their school's roster even if it registered its domain
  // after this account already existed. See app/org-membership.js.
  await autoEnrollBySchoolEmail(account.id, email, claims.name || email, true)

  const token = await createSession(account.id)
  const responseHeaders = new Headers()
  responseHeaders.set('Location', returnTo)
  responseHeaders.append('Set-Cookie', sessionCookieHeader(token))
  for (const cookie of clearOauthCookies) responseHeaders.append('Set-Cookie', cookie)
  return new Response(null, { status: 302, headers: responseHeaders })
}
