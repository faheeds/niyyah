// The naive-datetime window workers/reminders/worker.js's Cron Trigger uses
// to find event_signup_slots due for a reminder - see app/lib/recurrence.js's
// header comment for why the app's event times are naive Y-M-D/H:M strings
// treated as UTC-equivalent on Workers, rather than timezone-aware Dates.
//
// The Cron Trigger fires every 15 minutes (see workers/reminders/wrangler.toml).
// A 60-minute-wide window means an occurrence is never skipped between ticks
// even if one tick is late or fails - each row is only ever reminded once,
// since workers/reminders/worker.js stamps reminder_sent_at right after
// sending and only ever selects rows where it's still NULL. In practice this
// means a reminder goes out 45-60 minutes before an event starts.
const WINDOW_MINUTES = 60

function naive(date) {
  const pad = n => String(n).padStart(2, '0')
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`
}

export function reminderWindow(now = new Date()) {
  return { from: naive(now), to: naive(new Date(now.getTime() + WINDOW_MINUTES * 60000)) }
}
