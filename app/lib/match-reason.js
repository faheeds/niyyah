// P2-01: a short, human line explaining why an opportunity was recommended -
// the scoring in app/api/opportunities/route.js already knows *whether* an
// event matches someone's interests, area and friends; this just turns that
// into something a person can read, instead of leaving the ranking silent.
export function buildMatchReason(interestMatch, nearby, friendNames, interest) {
  const names = friendNames || []
  const reasons = []
  if (interestMatch) reasons.push(`you're interested in ${interest}`)
  if (nearby) reasons.push("it's near you")
  if (names.length) reasons.push(`${names.length === 1 ? names[0] + ' is' : names.length + ' friends are'} going`)
  if (!reasons.length) return ''
  if (reasons.length === 1) return `Because ${reasons[0]}.`
  return `Because ${reasons.slice(0, -1).join(', ')} and ${reasons[reasons.length - 1]}.`
}
