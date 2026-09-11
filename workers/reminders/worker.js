import { prepareCommunityTables } from '../../db/index.js'
import { sendEventReminder } from '../../app/lib/notify.js'
import { reminderWindow } from '../../app/lib/reminder-window.js'

// P1-01b: a reminder shortly before an event starts. This lives in its own
// tiny Worker, deployed and scheduled separately from the main app
// (workers/reminders/wrangler.toml, deployed alongside the main Worker by
// .github/workflows/deploy-staging.yml / deploy-production.yml), because
// the main Worker (vite.config.js's `cloudflare()` plugin, via vinext) only
// ever builds a fetch handler - see README-CLAUDE-GITHUB-SETUP.md section
// 6b and the p1-01b-event-reminders backlog item for why a scheduled job
// can't just be added there. It shares the same D1 database (its own `DB`
// binding, pointed at the same database id as the main Worker) and reuses
// the main app's schema bootstrap and email code as-is, so a schema or
// copy change in either place never needs to be duplicated here.
export default {
  async scheduled(_event, _env, ctx) {
    ctx.waitUntil(sendDueReminders())
  },
}

async function sendDueReminders() {
  const db = await prepareCommunityTables()
  const { from, to } = reminderWindow()
  // Only signed-up people (event_signup_slots - every signup gets a row
  // there, see app/api/opportunities/route.js) for published events at
  // approved organizations. Volunteering opportunities only remind an
  // applicant once their application is accepted - a pending or declined
  // applicant isn't actually confirmed to attend (see
  // buildApplicationStatusUpdate in app/lib/notify.js for that same
  // accepted/declined distinction). Community events have no such review
  // step, so every 'going' participant qualifies.
  const due = await db.prepare(`
    SELECT s.id, s.selected_date, s.selected_time,
           e.title AS event_title, e.location_name,
           o.name AS organization_name,
           a.email, a.display_name
    FROM event_signup_slots s
    JOIN organization_events e ON e.id = s.event_id
    JOIN organizations o ON o.id = e.organization_id
    JOIN accounts a ON a.id = s.user_id
    LEFT JOIN volunteer_applications va ON va.event_id = s.event_id AND va.user_id = s.user_id
    WHERE s.reminder_sent_at IS NULL
      AND e.status = 'published' AND o.status = 'approved'
      AND (e.event_type != 'volunteering' OR va.status = 'accepted')
      AND (s.selected_date || 'T' || s.selected_time) BETWEEN ? AND ?
  `).bind(from, to).all()

  for (const row of due.results ?? []) {
    await sendEventReminder({
      to: row.email,
      name: row.display_name,
      eventTitle: row.event_title,
      organizationName: row.organization_name,
      startAt: `${row.selected_date}T${row.selected_time}`,
      locationName: row.location_name,
    })
    // Stamped right after this one send, not batched at the end, so a
    // mid-run failure or timeout never resends to someone already emailed.
    await db.prepare('UPDATE event_signup_slots SET reminder_sent_at=? WHERE id=?').bind(new Date().toISOString(), row.id).run()
  }
}
