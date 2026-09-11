import { test } from 'node:test'
import assert from 'node:assert/strict'
import { reminderWindow } from '../app/lib/reminder-window.js'

test('reminderWindow returns a 60-minute-wide naive UTC window starting now', () => {
  const { from, to } = reminderWindow(new Date('2026-09-20T09:05:00Z'))
  assert.equal(from, '2026-09-20T09:05')
  assert.equal(to, '2026-09-20T10:05')
})

test('reminderWindow rolls over midnight and month/year boundaries correctly', () => {
  assert.deepEqual(reminderWindow(new Date('2026-12-31T23:30:00Z')), { from: '2026-12-31T23:30', to: '2027-01-01T00:30' })
})

test('reminderWindow zero-pads single-digit month/day/hour/minute', () => {
  assert.deepEqual(reminderWindow(new Date('2026-01-05T03:07:00Z')), { from: '2026-01-05T03:07', to: '2026-01-05T04:07' })
})

test('reminderWindow defaults to the real current time when called with no argument', () => {
  const before = Date.now()
  const { from } = reminderWindow()
  const parsed = Date.parse(from.replace('T', 'T') + ':00Z')
  assert.ok(Math.abs(parsed - before) < 60000, 'from should be within a minute of now')
})
