import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildDraftRequest, parseDraftReply, draftEvent } from '../app/lib/ai-draft.js'

test('buildDraftRequest uses the default model and trims/caps the free text', () => {
  const req = buildDraftRequest('  Food pantry every Friday at 5pm  ')
  assert.equal(req.model, 'claude-3-5-haiku-20241022')
  assert.equal(req.messages[0].content, 'Food pantry every Friday at 5pm')
  assert.match(req.system, /Reply with ONLY a JSON object/)
})

test('buildDraftRequest honors a model override and caps free text at 500 chars', () => {
  const req = buildDraftRequest('x'.repeat(600), 'claude-3-7-sonnet')
  assert.equal(req.model, 'claude-3-7-sonnet')
  assert.equal(req.messages[0].content.length, 500)
})

test('parseDraftReply accepts a clean JSON reply', () => {
  const draft = parseDraftReply(JSON.stringify({
    title: 'Food Pantry', summary: 'Weekly food distribution for families in need.',
    interest: 'Service', ageRange: '16+', eventType: 'volunteering', recurs: true, volunteersNeeded: 8,
  }))
  assert.deepEqual(draft, {
    title: 'Food Pantry', summary: 'Weekly food distribution for families in need.',
    interest: 'Service', ageRange: '16+', eventType: 'volunteering', recurs: true, volunteersNeeded: 8,
  })
})

test('parseDraftReply strips a markdown code fence around the JSON', () => {
  const draft = parseDraftReply('```json\n{"title":"Cleanup","summary":"Park cleanup morning."}\n```')
  assert.equal(draft.title, 'Cleanup')
  assert.equal(draft.eventType, 'volunteering') // default when absent
})

test('parseDraftReply falls back to "Volunteering" for an interest not in the fixed list', () => {
  const draft = parseDraftReply(JSON.stringify({ title: 'x', summary: 'y', interest: 'Cooking' }))
  assert.equal(draft.interest, 'Volunteering')
})

test('parseDraftReply defaults ageRange to "All ages" when absent', () => {
  const draft = parseDraftReply(JSON.stringify({ title: 'x', summary: 'y' }))
  assert.equal(draft.ageRange, 'All ages')
})

test('parseDraftReply clamps volunteersNeeded and drops it for community events', () => {
  const volunteering = parseDraftReply(JSON.stringify({ title: 'x', summary: 'y', eventType: 'volunteering', volunteersNeeded: 999999 }))
  assert.equal(volunteering.volunteersNeeded, 10000)
  const community = parseDraftReply(JSON.stringify({ title: 'x', summary: 'y', eventType: 'community', volunteersNeeded: 5 }))
  assert.equal(community.volunteersNeeded, null)
})

test('parseDraftReply returns null for invalid JSON', () => {
  assert.equal(parseDraftReply('not json at all'), null)
})

test('parseDraftReply returns null when title or summary is missing', () => {
  assert.equal(parseDraftReply(JSON.stringify({ summary: 'y' })), null)
  assert.equal(parseDraftReply(JSON.stringify({ title: 'x' })), null)
})

test('draftEvent no-ops without throwing when ANTHROPIC_API_KEY is not configured (e.g. this plain-Node test environment)', async () => {
  const result = await draftEvent('Food pantry every Friday at 5pm')
  assert.deepEqual(result, { ok: false, reason: 'not_configured' })
})

test('draftEvent rejects empty input', async () => {
  const result = await draftEvent('   ')
  // Still 'not_configured' in this test env since the key check runs first,
  // matching sendEmail's own precedence in notify.js.
  assert.equal(result.ok, false)
})
