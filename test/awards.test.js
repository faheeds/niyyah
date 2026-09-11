import { test } from 'node:test'
import assert from 'node:assert/strict'
import { tierForHours, rankStandings } from '../app/lib/awards.js'

const TIERS = [
  { name: 'Bronze', minHours: 10 },
  { name: 'Silver', minHours: 25 },
  { name: 'Gold', minHours: 50 },
]

test('below the lowest tier earns nothing', () => {
  assert.equal(tierForHours(5, TIERS), null)
})

test('exactly at a threshold earns that tier', () => {
  assert.equal(tierForHours(10, TIERS)?.name, 'Bronze')
  assert.equal(tierForHours(25, TIERS)?.name, 'Silver')
  assert.equal(tierForHours(50, TIERS)?.name, 'Gold')
})

test('between thresholds earns the lower tier', () => {
  assert.equal(tierForHours(24, TIERS)?.name, 'Bronze')
})

test('above the top tier still earns the top tier', () => {
  assert.equal(tierForHours(500, TIERS)?.name, 'Gold')
})

test('works with tiers given out of order', () => {
  const shuffled = [TIERS[2], TIERS[0], TIERS[1]]
  assert.equal(tierForHours(30, shuffled)?.name, 'Silver')
})

test('no tiers configured - never earns anything', () => {
  assert.equal(tierForHours(1000, []), null)
})

test('rankStandings sorts highest hours first and attaches tier names', () => {
  const ranked = rankStandings(
    [
      { displayName: 'Amina', hours: 5 },
      { displayName: 'Yusuf', hours: 60 },
      { displayName: 'Sara', hours: 25 },
    ],
    TIERS
  )
  assert.deepEqual(ranked.map(r => r.displayName), ['Yusuf', 'Sara', 'Amina'])
  assert.equal(ranked[0].tier, 'Gold')
  assert.equal(ranked[1].tier, 'Silver')
  assert.equal(ranked[2].tier, null)
})
