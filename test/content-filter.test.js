// Sanity checks for the automated content filter used at submission time
// on the free-text fields volunteers and organizers type into (event
// titles/descriptions, member bios, organization descriptions) - see
// P1-06. Uses Node's built-in test runner, same as test/recurrence.test.js.
// Run with: node --test test/content-filter.test.js

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { moderationIssue } from '../app/lib/content-filter.js'

test('clean text passes', () => {
  assert.equal(moderationIssue('Join us for a Saturday morning food bank sort.'), null)
})

test('empty/whitespace/undefined text passes (required-field checks handle blanks separately)', () => {
  assert.equal(moderationIssue(''), null)
  assert.equal(moderationIssue('   '), null)
  assert.equal(moderationIssue(undefined), null)
  assert.equal(moderationIssue(null), null)
})

test('profane text is flagged with a user-facing message', () => {
  const issue = moderationIssue('you are a fucking idiot')
  assert.equal(typeof issue, 'string')
  assert.ok(issue.length > 0)
})

test('profanity mixed into otherwise normal text is still flagged', () => {
  assert.notEqual(moderationIssue('This event is complete shit and a waste of time.'), null)
})

test('flag is case-insensitive', () => {
  assert.notEqual(moderationIssue('SHIT'), null)
})

test('non-string input never throws', () => {
  assert.doesNotThrow(() => moderationIssue(12345))
  assert.doesNotThrow(() => moderationIssue({}))
})
