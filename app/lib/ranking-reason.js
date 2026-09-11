// P2-03: a short, human line explaining why an applicant scores the way
// they do - the ranking in app/api/organizer/route.js already knows
// *which* signals contributed (interest match, proximity, verified
// hours); this turns that into something an organizer can read, the same
// idea as buildMatchReason (app/lib/match-reason.js) for P2-01's
// opportunity recommendations. Deliberately rule-based rather than a real
// AI call - like P2-01, the underlying signals are already fully known
// and deterministic, so a template explains them instantly and for free
// on every applicant row, with nothing to configure and nothing that can
// fail or go stale.
export function buildRankingReason({ interestMatch, nearby, hoursBonus, eventInterest }) {
  const reasons = []
  if (interestMatch) reasons.push(`their interests include ${eventInterest}`)
  if (nearby) reasons.push('they live nearby')
  if (hoursBonus >= 10) reasons.push('a strong track record of verified hours on Niyyah')
  else if (hoursBonus > 0) reasons.push('some verified hours on Niyyah')
  if (!reasons.length) return 'No strong match signals yet - worth reading their bio directly.'
  if (reasons.length === 1) return `Ranked higher because ${reasons[0]}.`
  return `Ranked higher because ${reasons.slice(0, -1).join(', ')} and ${reasons[reasons.length - 1]}.`
}
