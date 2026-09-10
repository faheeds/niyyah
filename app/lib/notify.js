// Sends transactional email through Resend (https://resend.com). Configured
// entirely at request time via `env` (see app/api/auth/google/route.js for
// the same pattern with Google's secrets): when RESEND_API_KEY isn't set
// yet, every call below no-ops instead of throwing, so signing up, applying
// to an event, and reviewing applications all keep working normally before
// an admin finishes the one-time Resend setup (see
// README-CLAUDE-GITHUB-SETUP.md). Failures (Resend down, bad address, rate
// limit) are logged and swallowed for the same reason - a flaky email
// provider should never block someone joining an event or an organizer
// reviewing an application.
//
// `env` is loaded with a dynamic import, rather than the static
// `import { env } from 'cloudflare:workers'` used elsewhere, so this file -
// specifically buildSignupConfirmation/buildApplicationStatusUpdate below -
// stays importable (and unit-testable, see test/notify.test.js) under plain
// Node, which has no 'cloudflare:workers' module to resolve. In the actual
// Workers runtime this resolves exactly like the static form; it only ever
// hits the catch below in a non-Workers environment, where "not configured"
// is the right no-op anyway.
async function getEnv() {
  try {
    const mod = await import('cloudflare:workers')
    return mod.env || {}
  } catch {
    return {}
  }
}

async function sendEmail({ to, subject, text }) {
  const env = await getEnv()
  if (!env.RESEND_API_KEY) {
    console.log(`[notify] RESEND_API_KEY not set - skipping email to ${to}: ${subject}`)
    return { sent: false, reason: 'not_configured' }
  }
  if (!to || !subject || !text) return { sent: false, reason: 'invalid_input' }
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.RESEND_FROM_ADDRESS || 'Niyyah <notifications@niyyah.app>',
        to: [to],
        subject,
        text,
      }),
    })
    if (!response.ok) {
      console.log(`[notify] Resend returned ${response.status} sending to ${to}: ${await response.text().catch(() => '')}`)
      return { sent: false, reason: 'provider_error' }
    }
    return { sent: true }
  } catch (error) {
    console.log(`[notify] Failed to send email to ${to}: ${error?.message || error}`)
    return { sent: false, reason: 'network_error' }
  }
}

function formatWhen(iso) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('en-US', { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

// P1-01: confirmation that someone's sign-up for an event or volunteering
// opportunity went through, sent right after app/api/opportunities/route.js
// records it. Message-building is a separate, pure, exported function so
// the copy itself is unit-testable without touching env/fetch at all.
export function buildSignupConfirmation({ name, eventTitle, organizationName, startAt, locationName }) {
  const when = formatWhen(startAt)
  const subject = `You're signed up: ${eventTitle}`
  const text = [
    `Hi ${name || 'there'},`,
    '',
    `You're confirmed for "${eventTitle}" with ${organizationName}${when ? ` on ${when}` : ''}${locationName ? ` at ${locationName}` : ''}.`,
    '',
    "We'll send you a reminder before it starts. See you there!",
    '',
    '— Niyyah',
  ].join('\n')
  return { subject, text }
}
export function sendSignupConfirmation({ to, ...rest }) {
  return sendEmail({ to, ...buildSignupConfirmation(rest) })
}

// P1-01: sent when an organizer changes a volunteer application's status
// (app/api/organizer/route.js, action:'reviewApplication'). 'shortlisted' is
// an internal review step, not a decision, so it deliberately does not
// notify - only the two outcomes a volunteer actually needs to hear about.
const APPLICATION_STATUS_MESSAGES = {
  accepted: (eventTitle, organizationName) => `Good news - ${organizationName} accepted your application for "${eventTitle}". You're confirmed to volunteer.`,
  declined: (eventTitle, organizationName) => `${organizationName} wasn't able to take your application for "${eventTitle}" this time. Keep exploring - there are more opportunities waiting for you on Niyyah.`,
}
export function buildApplicationStatusUpdate({ name, eventTitle, organizationName, status }) {
  const build = APPLICATION_STATUS_MESSAGES[status]
  if (!build) return null
  const subject = status === 'accepted' ? `You're confirmed: ${eventTitle}` : `Update on your application: ${eventTitle}`
  const text = [`Hi ${name || 'there'},`, '', build(eventTitle, organizationName), '', '— Niyyah'].join('\n')
  return { subject, text }
}
export function sendApplicationStatusUpdate({ to, ...rest }) {
  const message = buildApplicationStatusUpdate(rest)
  if (!message) return Promise.resolve({ sent: false, reason: 'not_notifiable' })
  return sendEmail({ to, ...message })
}
