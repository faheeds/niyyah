import { readSessionToken, destroySession, clearSessionCookieHeader } from '../../../auth.ts'

export async function GET(request) {
  const url = new URL(request.url)
  const returnToRaw = url.searchParams.get('return_to') || '/'
  // Never redirect off-site after sign-out - same guard as app/api/auth/google/route.js
  // and requireUser() in app/auth.ts, so a crafted return_to can't turn this into an
  // open-redirect phishing link from Niyyah's own domain.
  const returnTo = returnToRaw.startsWith('/') && !returnToRaw.startsWith('//') ? returnToRaw : '/'
  const token = readSessionToken(request.headers.get('cookie'))
  await destroySession(token)
  return new Response(null, { status: 302, headers: { Location: returnTo, 'Set-Cookie': clearSessionCookieHeader() } })
}
