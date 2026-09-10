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
//
// organization_events.start_at/end_at are NAIVE local datetime strings with
// no timezone offset - "2026-06-02T18:00", not "...Z" (see the
// /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/ validation in app/api/organizer/route.js).
// This module must never round-trip them through a timezone-aware `Date`
// the way `new Date(str).getTime()` plus millisecond arithmetic does: a
// string with no offset is parsed as the RUNNING PROCESS's local time (which
// is DST-observing in local dev, even though it's UTC on Workers), so
// shifting by a fixed 7*24*60*60*1000ms silently moves the wall-clock hour
// whenever a DST boundary falls in between. The output must also stay in
// this same naive HH:MM form - returning `.toISOString()` (a trailing Z)
// gets parsed by every client's `new Date(...)` as UTC instead, shifting
// the displayed time by the viewer's own UTC offset.
//
// So everything below works on the naive Y-M-D/H-M components directly.
// Date.UTC is used purely as DST-free calendar-day counting machinery -
// never as a stand-in for the real wall-clock instant, which this app does
// not track a timezone for (see P2-07 in the backlog).

const NAIVE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/
const DAY_MS = 24 * 60 * 60 * 1000

function parseNaive(value) {
  const m = NAIVE.exec(String(value || ''))
  if (!m) return null
  return { y: +m[1], mo: +m[2], d: +m[3], h: +m[4], mi: +m[5] }
}

function pad(n) { return String(n).padStart(2, '0') }

function format(part) {
  return `${part.y}-${pad(part.mo)}-${pad(part.d)}T${pad(part.h)}:${pad(part.mi)}`
}

// Whole calendar days between two naive Y-M-D dates (ignoring time of day),
// via Date.UTC - a DST-free way to count days, not a real instant.
function daysBetween(a, b) {
  return Math.round((Date.UTC(b.y, b.mo - 1, b.d) - Date.UTC(a.y, a.mo - 1, a.d)) / DAY_MS)
}

function addDays(part, days) {
  const shifted = new Date(Date.UTC(part.y, part.mo - 1, part.d + days))
  return { y: shifted.getUTCFullYear(), mo: shifted.getUTCMonth() + 1, d: shifted.getUTCDate(), h: part.h, mi: part.mi }
}

export function currentOccurrence(startAt, endAt, recurrence, now = new Date()) {
  if (recurrence !== 'weekly') return { startAt, endAt }
  const start = parseNaive(startAt), end = parseNaive(endAt)
  if (!start || !end) return { startAt, endAt }
  const nowPart = { y: now.getUTCFullYear(), mo: now.getUTCMonth() + 1, d: now.getUTCDate(), h: now.getUTCHours(), mi: now.getUTCMinutes() }
  // Still upcoming or in progress - the anchor occurrence is the current one.
  if (Date.UTC(end.y, end.mo - 1, end.d, end.h, end.mi) > Date.UTC(nowPart.y, nowPart.mo - 1, nowPart.d, nowPart.h, nowPart.mi)) {
    return { startAt: format(start), endAt: format(end) }
  }
  // daysBetween is calendar-day granular and can't tell "today's occurrence
  // hasn't happened yet" from "it ended earlier today" - so pick the week by
  // floor, then advance once more only if that candidate occurrence's real
  // end instant (date AND time) has already passed.
  const nowUTC = Date.UTC(nowPart.y, nowPart.mo - 1, nowPart.d, nowPart.h, nowPart.mi)
  let weeks = Math.floor(daysBetween(end, nowPart) / 7)
  const candidate = addDays(end, weeks * 7)
  if (Date.UTC(candidate.y, candidate.mo - 1, candidate.d, candidate.h, candidate.mi) <= nowUTC) weeks += 1
  return { startAt: format(addDays(start, weeks * 7)), endAt: format(addDays(end, weeks * 7)) }
}
