// Sanity checks for currentOccurrence's week-boundary arithmetic - see the
// P1-02 review thread. No test framework exists in this repo yet, so this
// uses Node's built-in test runner (node:test, available since Node 18) and
// nothing else. Run with: node --test test/recurrence.test.js

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { currentOccurrence } from '../app/lib/recurrence.js'

const START = '2026-06-01T16:00'
const END = '2026-06-01T18:00'

function occ(nowIso) {
  return currentOccurrence(START, END, 'weekly', new Date(nowIso))
}

test('still upcoming - returns the anchor unchanged', () => {
  assert.deepEqual(occ('2026-06-01T10:00Z'), { startAt: START, endAt: END })
})

test('in progress - returns the anchor unchanged', () => {
  assert.deepEqual(occ('2026-06-01T17:00Z'), { startAt: START, endAt: END })
})

// Regression for the bug flagged in review: 30 min after the anchor ends,
// same calendar day - must already roll to next week, not stay on a
// just-finished occurrence.
test('same day, just after the anchor ends - rolls to next week', () => {
  assert.deepEqual(occ('2026-06-01T18:30Z'), { startAt: '2026-06-08T16:00', endAt: '2026-06-08T18:00' })
})

test('next calendar day - next week', () => {
  assert.deepEqual(occ('2026-06-02T09:00Z'), { startAt: '2026-06-08T16:00', endAt: '2026-06-08T18:00' })
})

test('one week later, before that occurrence ends - still that week', () => {
  assert.deepEqual(occ('2026-06-08T10:00Z'), { startAt: '2026-06-08T16:00', endAt: '2026-06-08T18:00' })
})

// Regression: exact same failure mode one week further out.
test('one week later, just after that occurrence ends - rolls forward again', () => {
  assert.deepEqual(occ('2026-06-08T19:00Z'), { startAt: '2026-06-15T16:00', endAt: '2026-06-15T18:00' })
})

test('exact end-instant boundary counts as ended', () => {
  assert.deepEqual(occ('2026-06-01T18:00Z'), { startAt: '2026-06-08T16:00', endAt: '2026-06-08T18:00' })
})

test('non-weekly recurrence - returned unchanged regardless of now', () => {
  assert.deepEqual(currentOccurrence(START, END, null, new Date('2026-09-01T00:00Z')), { startAt: START, endAt: END })
  assert.deepEqual(currentOccurrence(START, END, undefined, new Date('2026-09-01T00:00Z')), { startAt: START, endAt: END })
})

// A US DST spring-forward (2027-03-14) falls between the anchor and `now` -
// millisecond/epoch arithmetic would be liable to drift the wall-clock hour
// here; calendar-day arithmetic must not.
test('DST boundary crossed while rolling forward - time of day is preserved', () => {
  const result = currentOccurrence(START, END, 'weekly', new Date('2027-03-20T20:00Z'))
  assert.equal(result.startAt.endsWith('T16:00'), true)
  assert.equal(result.endAt.endsWith('T18:00'), true)
})

test('far future - still lands on the correct weekday, 16 weeks out', () => {
  const result = currentOccurrence(START, END, 'weekly', new Date('2026-09-15T12:00Z'))
  assert.deepEqual(result, { startAt: '2026-09-21T16:00', endAt: '2026-09-21T18:00' })
})
