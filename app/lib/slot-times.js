// Generates the sign-up time-slot options shown in the booking dialog.
// Before P1-07 this started counting from an event's exact, organizer-typed
// start time and added an hour repeatedly, so a start time like 1:37 PM
// produced slots at 1:37, 2:37, 3:37, 4:37 - technically fine, but it reads
// as broken to anyone using the app. This rounds the first slot to the
// nearest clean half hour (so hourly increments from it stay clean too),
// and never offers a slot earlier than the event's actual start time.

const THIRTY_MIN = 30 * 60 * 1000
const HOUR = 60 * 60 * 1000

function roundToNearestHalfHour(date) {
  return new Date(Math.round(date.getTime() / THIRTY_MIN) * THIRTY_MIN)
}

export function slotsFor(startIso, endIso, max = 8) {
  const start = new Date(startIso), end = new Date(endIso)
  let cursor = roundToNearestHalfHour(start)
  if (cursor < start) cursor = new Date(cursor.getTime() + THIRTY_MIN)
  const times = []
  while (cursor <= end && times.length < max) {
    times.push(cursor.toTimeString().slice(0, 5))
    cursor = new Date(cursor.getTime() + HOUR)
  }
  return [...new Set(times)]
}
