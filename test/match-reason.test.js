import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildMatchReason } from '../app/lib/match-reason.js'

test('no signals - no reason', () => {
  assert.equal(buildMatchReason(false, false, [], 'Youth'), '')
})

test('interest match only', () => {
  assert.equal(buildMatchReason(true, false, [], 'Youth programs'), "Because you're interested in Youth programs.")
})

test('nearby only', () => {
  assert.equal(buildMatchReason(false, true, [], 'Youth'), "Because it's near you.")
})

test('one friend going only', () => {
  assert.equal(buildMatchReason(false, false, ['Amina'], 'Youth'), 'Because Amina is going.')
})

test('multiple friends going only', () => {
  assert.equal(buildMatchReason(false, false, ['Amina', 'Sara', 'Yusuf'], 'Youth'), 'Because 3 friends are going.')
})

test('interest and nearby combine with "and"', () => {
  assert.equal(buildMatchReason(true, true, [], 'Youth'), "Because you're interested in Youth and it's near you.")
})

test('all three signals combine with commas and a final "and"', () => {
  assert.equal(
    buildMatchReason(true, true, ['Amina'], 'Youth'),
    "Because you're interested in Youth, it's near you and Amina is going."
  )
})
