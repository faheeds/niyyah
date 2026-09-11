// P1-09: volunteering competitions with Gold/Silver/Bronze-style tiers.
// Kept separate from app/api/organizer/route.js so the "which tier did this
// person earn" rule is unit-tested on its own, independent of the SQL that
// gathers hours and roster members.

// Given a person's total verified hours and a competition's tiers (each
// {name, minHours}), returns the highest tier they've earned, or null if
// they haven't reached the lowest threshold yet. Ties on minHours resolve
// to whichever tier sorts first after the descending sort below - callers
// should avoid giving two tiers the same minHours.
export function tierForHours(hours, tiers) {
  const sorted = [...(tiers || [])].sort((a, b) => b.minHours - a.minHours)
  return sorted.find(t => Number(hours) >= t.minHours) || null
}

// Ranks roster entries (each {..., hours}) highest-hours-first, attaching
// each person's tier. Stable on ties (Array#sort is stable in modern JS
// engines, including Workers) so equal-hours people keep roster order.
export function rankStandings(entries, tiers) {
  return [...(entries || [])]
    .map(entry => ({ ...entry, tier: tierForHours(entry.hours, tiers)?.name || null }))
    .sort((a, b) => Number(b.hours) - Number(a.hours))
}
