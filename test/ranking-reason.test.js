import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildRankingReason } from '../app/lib/ranking-reason.js'

test('buildRankingReason cites interest match, proximity and hours together', () => {
  const reason = buildRankingReason({ interestMatch: true, nearby: true, hoursBonus: 12, eventInterest: 'Service' })
  assert.equal(reason, "Ranked higher because their interests include Service, they live nearby and a strong track record of verified hours on Niyyah.")
})

test('buildRankingReason with a single signal has no comma/and', () => {
  const reason = buildRankingReason({ interestMatch: true, nearby: false, hoursBonus: 0, eventInterest: 'Faith' })
  assert.equal(reason, 'Ranked higher because their interests include Faith.')
})

test('buildRankingReason distinguishes a light hours bonus from a strong one', () => {
  const light = buildRankingReason({ interestMatch: false, nearby: false, hoursBonus: 5, eventInterest: 'Service' })
  assert.match(light, /^Ranked higher because some verified hours on Niyyah\.$/)
  const strong = buildRankingReason({ interestMatch: false, nearby: false, hoursBonus: 15, eventInterest: 'Service' })
  assert.match(strong, /^Ranked higher because a strong track record of verified hours on Niyyah\.$/)
})

test('buildRankingReason falls back when nothing contributed', () => {
  const reason = buildRankingReason({ interestMatch: false, nearby: false, hoursBonus: 0, eventInterest: 'Service' })
  assert.equal(reason, 'No strong match signals yet - worth reading their bio directly.')
})

test('buildRankingReason joins two signals with "and", no comma', () => {
  const reason = buildRankingReason({ interestMatch: true, nearby: true, hoursBonus: 0, eventInterest: 'Sports' })
  assert.equal(reason, "Ranked higher because their interests include Sports and they live nearby.")
})
