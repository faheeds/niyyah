// Recurring events store their FIRST occurrence in start_at/end_at - see
// P1-02 in the product backlog and the `recurrence` column on
// organization_events (db/index.js). Everywhere the app shows or validates
// against an event's date, it derives the occurrence happening now or next
// from that anchor, so a "weekly" event never looks stale once its original
// date has passed, and so sign-up slots validate against a real upcoming
// window instead of the anchor's original (possibly long-past) dates.
//
// Only 'weekly' is supported today. Anything else (including null/undefined)
// is treated as a one-time event and returned unchanged.

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

export function currentOccurrence(startAt, endAt, recurrence, now = new Date()) {
  if (recurrence !== 'weekly') return { startAt, endAt }
  const start = new Date(startAt), end = new Date(endAt)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return { startAt, endAt }
  // Still upcoming or in progress - the anchor occurrence is the current one.
  if (end.getTime() > now.getTime()) return { startAt, endAt }
  const duration = end.getTime() - start.getTime()
  const weeksElapsed = Math.ceil((now.getTime() - end.getTime()) / WEEK_MS)
  const shiftedStart = new Date(start.getTime() + weeksElapsed * WEEK_MS)
  const shiftedEnd = new Date(shiftedStart.getTime() + duration)
  return { startAt: shiftedStart.toISOString(), endAt: shiftedEnd.toISOString() }
}
