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

// P1-11: the public organization page shows competition standings to
// anyone, unauthenticated - including for orgs whose volunteers are minors.
// Full names are fine on the organizer's own (logged-in, org-scoped) Awards
// tab, but not appropriate to publish. This reduces a display name to
// "First L." the same way many youth platforms label public leaderboards.
// A single-word name (or no name on file) is returned as-is / generically.
export function publicLabel(displayName) {
  const parts = String(displayName || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return 'A Niyyah volunteer'
  if (parts.length === 1) return parts[0]
  return `${parts[0]} ${parts[parts.length - 1][0]}.`
}

// P1-11: whether a competition's date window (start_date/end_date, both
// plain YYYY-MM-DD strings - see the naive-date convention in
// app/lib/recurrence.js) includes "today". Used to decide which
// competitions surface on the public org page: only the currently-running
// ones, not the organizer's full past/upcoming history.
export function isCompetitionActive(competition, today) {
  return String(competition.startDate) <= today && today <= String(competition.endDate)
}
