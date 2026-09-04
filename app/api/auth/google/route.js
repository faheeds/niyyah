import { env } from 'cloudflare:workers'

// Step 1 of Google sign-in: send the browser to Google's consent screen.
// Requires the GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET secrets to be set on
// the Worker (see README-CLAUDE-GITHUB-SETUP.md) — until then this returns a
// clear error instead of crashing.
export async function GET(request) {
  if (!env.GOOGLE_CLIENT_ID) {
    return new Response('Google sign-in is not set up yet. Ask an admin to add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.', { status: 501 })
  }
  const url = new URL(request.url)
  const returnToRaw = url.searchParams.get('return_to') || '/'
  const returnTo = returnToRaw.startsWith('/') && !returnToRaw.startsWith('//') ? returnToRaw : '/'
  const state = Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b => b.toString(16).padStart(2, '0')).join('')
  const redirectUri = `${url.origin}/api/auth/google/callback`

  const authorizeUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  authorizeUrl.searchParams.set('client_id', env.GOOGLE_CLIENT_ID)
  authorizeUrl.searchParams.set('redirect_uri', redirectUri)
  authorizeUrl.searchParams.set('response_type', 'code')
  authorizeUrl.searchParams.set('scope', 'openid email profile')
  authorizeUrl.searchParams.set('state', state)
  authorizeUrl.searchParams.set('prompt', 'select_account')

  const responseHeaders = new Headers()
  responseHeaders.set('Location', authorizeUrl.toString())
  responseHeaders.append('Set-Cookie', `niyyah_oauth_state=${state}; Path=/; Max-Age=600; HttpOnly; Secure; SameSite=Lax`)
  responseHeaders.append('Set-Cookie', `niyyah_oauth_return=${encodeURIComponent(returnTo)}; Path=/; Max-Age=600; HttpOnly; Secure; SameSite=Lax`)
  return new Response(null, { status: 302, headers: responseHeaders })
}
