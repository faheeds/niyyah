// P2-02: turn a short free-text sentence ("Food pantry every Friday at
// 5pm") into a draft of the "Add an event" form's fields, so an organizer
// can review and adjust rather than typing everything by hand. Calls the
// Anthropic API directly via fetch - configured entirely at request time
// via `env`, same "no-ops when the key isn't set" pattern as
// app/lib/notify.js for Resend, so nothing else breaks before an admin
// adds ANTHROPIC_API_KEY (see README-CLAUDE-GITHUB-SETUP.md section 6c).
//
// `env` is loaded with a dynamic import rather than the static
// `import { env } from 'cloudflare:workers'` used elsewhere, so this file -
// specifically buildDraftRequest/parseDraftReply below - stays importable
// (and unit-testable, see test/ai-draft.test.js) under plain Node. See
// notify.js's own header comment for the full explanation of why.
async function getEnv() {
  try {
    const mod = await import('cloudflare:workers')
    return mod.env || {}
  } catch {
    return {}
  }
}

// Must match the <select> options in the "Interest" field of the event
// form (app/organizer/organizer-client.jsx) - an interest the UI doesn't
// offer would just look broken once applied to the form.
const INTERESTS = ['Faith', 'Social', 'Service', 'Creative', 'Sports', 'Careers', 'Volunteering']

// Small, cheap model - this is a short structured-extraction task, not
// something that needs a large model. Overridable via the ANTHROPIC_MODEL
// variable/secret in case the model name below is retired; check
// https://docs.claude.com/en/docs/about-claude/models for current names.
const DEFAULT_MODEL = 'claude-3-5-haiku-20241022'

const SYSTEM_PROMPT = `You turn one sentence describing a community or volunteering event into a JSON draft of an event form. Reply with ONLY a JSON object, no other text, matching exactly this shape:
{
  "title": string (short event name, under 60 characters),
  "summary": string (1-2 sentences describing the event, under 300 characters),
  "interest": one of ${JSON.stringify(INTERESTS)},
  "ageRange": string (e.g. "All ages", "16+", "18-30"),
  "eventType": "volunteering" or "community",
  "recurs": boolean (true only if the sentence describes something that repeats weekly),
  "volunteersNeeded": number or null (only for eventType "volunteering" - a reasonable guess if not stated, else null)
}
Never invent a specific address, venue name, zip code, or exact date/time even if the sentence is vague about them - leave those for the organizer to fill in. Base every field only on what the sentence actually says or clearly implies; when unsure, prefer a conservative, generic value.`

// Pure and unit-tested: the exact request body sent to /v1/messages.
export function buildDraftRequest(freeText, model) {
  return {
    model: model || DEFAULT_MODEL,
    max_tokens: 400,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: String(freeText || '').trim().slice(0, 500) }],
  }
}

// Pure and unit-tested: turns the model's raw text reply into a draft
// object with only known-safe, clamped fields - the same shape of
// validation saveEvent (app/api/organizer/route.js) applies to a
// human-typed save. This never touches the database directly; it only
// ever pre-fills the client-side form for the organizer to review before
// they hit Save.
export function parseDraftReply(text) {
  let parsed
  try {
    // Models sometimes wrap JSON in a code fence despite instructions not
    // to - strip one if present rather than failing on it.
    const stripped = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')
    parsed = JSON.parse(stripped)
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object') return null
  const title = String(parsed.title || '').trim().slice(0, 160)
  const summary = String(parsed.summary || '').trim().slice(0, 600)
  if (!title || !summary) return null
  const interest = INTERESTS.includes(parsed.interest) ? parsed.interest : 'Volunteering'
  const ageRange = String(parsed.ageRange || '').trim().slice(0, 60) || 'All ages'
  const eventType = parsed.eventType === 'community' ? 'community' : 'volunteering'
  const recurs = parsed.recurs === true
  const volunteersNeededRaw = Number(parsed.volunteersNeeded)
  const volunteersNeeded = eventType === 'volunteering' && Number.isFinite(volunteersNeededRaw) && volunteersNeededRaw > 0
    ? Math.max(1, Math.min(10000, Math.round(volunteersNeededRaw)))
    : null
  return { title, summary, interest, ageRange, eventType, recurs, volunteersNeeded }
}

export async function draftEvent(freeText) {
  const env = await getEnv()
  if (!env.ANTHROPIC_API_KEY) return { ok: false, reason: 'not_configured' }
  const text = String(freeText || '').trim()
  if (!text) return { ok: false, reason: 'invalid_input' }
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(buildDraftRequest(text, env.ANTHROPIC_MODEL)),
    })
    if (!response.ok) {
      console.log(`[ai-draft] Anthropic API returned ${response.status}: ${await response.text().catch(() => '')}`)
      return { ok: false, reason: 'provider_error' }
    }
    const data = await response.json()
    const draft = parseDraftReply(data?.content?.[0]?.text)
    if (!draft) return { ok: false, reason: 'unparseable_reply' }
    return { ok: true, draft }
  } catch (error) {
    console.log(`[ai-draft] Failed to draft an event: ${error?.message || error}`)
    return { ok: false, reason: 'network_error' }
  }
}
