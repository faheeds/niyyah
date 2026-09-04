import { readSessionToken, destroySession, clearSessionCookieHeader } from '../../../auth.ts'

export async function GET(request) {
  const url = new URL(request.url)
  const returnTo = url.searchParams.get('return_to') || '/'
  const token = readSessionToken(request.headers.get('cookie'))
  await destroySession(token)
  return new Response(null, { status: 302, headers: { Location: returnTo, 'Set-Cookie': clearSessionCookieHeader() } })
}
