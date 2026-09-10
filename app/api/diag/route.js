import { env } from 'cloudflare:workers'
import { hashPassword, createSession, destroySession } from '../../auth.ts'
import { autoEnrollBySchoolEmail } from '../../org-membership.js'
import { prepareCommunityTables, prepareAuthTables, diagReadiness } from '../../../db/index.js'

// TEMPORARY diagnostic route - not linked from any UI, deleted in the very
// next commit regardless of what it finds. Exists only to see the real
// thrown error/stack for one step of sign-up at a time, since every route's
// catch block turns any failure into a generic 500 with no detail, and a
// Workers CPU-limit kill isn't catchable at all - bundling every step into
// one request would hide exactly the failure this is trying to observe.
// Gated on a Worker secret (env.DIAG_KEY, not committed) rather than a value
// in source. Every write this makes is cleaned up or otherwise inert:
// createSession's row is destroyed before responding, and
// autoEnrollBySchoolEmail runs against the reserved diag.invalid domain
// (RFC 2606), which can never match a real organization's registered domain.
const STEPS = ['hashPassword', 'prepareAuthTables', 'prepareCommunityTables', 'createSession', 'autoEnrollBySchoolEmail']

export async function GET(request) {
  const url = new URL(request.url)
  if (!env.DIAG_KEY || url.searchParams.get('key') !== env.DIAG_KEY) return new Response('Not found', { status: 404 })
  const step = url.searchParams.get('step')
  if (!STEPS.includes(step)) return Response.json({ error: 'Pass ?step= one of: ' + STEPS.join(', ') }, { status: 400 })

  const readinessBefore = diagReadiness()
  try {
    let result
    if (step === 'hashPassword') result = { hashLength: (await hashPassword('DiagTestPassword123!')).hash.length }
    else if (step === 'prepareAuthTables') { await prepareAuthTables(); result = 'ok' }
    else if (step === 'prepareCommunityTables') { await prepareCommunityTables(); result = 'ok' }
    else if (step === 'createSession') {
      const token = await createSession('diag-throwaway-account-id')
      await destroySession(token)
      result = { tokenLength: token.length }
    } else if (step === 'autoEnrollBySchoolEmail') {
      await autoEnrollBySchoolEmail('diag-throwaway-account-id', 'diag@diag.invalid', 'Diag', false)
      result = 'ok'
    }
    return Response.json({ step, ok: true, result, readinessBefore })
  } catch (e) {
    return Response.json({ step, ok: false, error: String(e), name: e?.name, stack: String(e?.stack || '').slice(0, 800), cause: e?.cause ? String(e.cause) : undefined, readinessBefore }, { status: 500 })
  }
}
