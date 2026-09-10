// Sanity checks for the sign-up slot rounding fix - see P1-07 ("Fix weird
// sign-up times like 2:37 PM"). Same pattern as the other test/*.test.js
// files - Node's built-in test runner, no framework.
// Run with: node --test test/slot-times.test.js

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { slotsFor } from '../app/lib/slot-times.js'

test('an odd organizer-typed start time produces only clean, on-the-hour slots', () => {
  // Old behavior: 13:37, 14:37, 15:37, 16:37, 17:37 - the exact bug P1-07
  // names ("2:37, 3:37, 4:37").
  const slots = slotsFor('2026-09-10T13:37', '2026-09-10T18:00')
  for (const time of slots) assert.match(time, /:00$/, `${time} should be a clean on-the-hour slot`)
})

test('never offers a slot earlier than the event actually starts', () => {
  // 13:07 rounds down to 13:00, which is before the real 13:07 start - the
  // first slot must bump forward, never backward.
  const slots = slotsFor('2026-09-10T13:07', '2026-09-10T18:00')
  const first = new Date(`2000-01-01T${slots[0]}`)
  const start = new Date('2000-01-01T13:07')
  assert.ok(first >= start, `first slot ${slots[0]} should not precede the 13:07 start`)
})

test('an already-clean start time is left unchanged', () => {
  const slots = slotsFor('2026-09-10T14:00', '2026-09-10T17:00')
  assert.deepEqual(slots, ['14:00', '15:00', '16:00', '17:00'])
})

test('rounds to the nearest half hour when that lands after the start', () => {
  // 14:22 is nearer 14:30 (8 min away) than 14:00 (22 min away), and 14:30
  // is still after 14:22, so no forward bump is needed.
  const slots = slotsFor('2026-09-10T14:22', '2026-09-10T18:00')
  assert.equal(slots[0], '14:30')
})

test('never exceeds the event end time', () => {
  const slots = slotsFor('2026-09-10T13:00', '2026-09-10T14:15')
  for (const time of slots) {
    const t = new Date(`2000-01-01T${time}`)
    assert.ok(t <= new Date('2000-01-01T14:15'), `${time} should not be after the 14:15 end`)
  }
})

test('caps at the requested max slot count', () => {
  const slots = slotsFor('2026-09-10T09:00', '2026-09-11T09:00', 8)
  assert.equal(slots.length, 8)
})
