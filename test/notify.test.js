import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildSignupConfirmation, buildApplicationStatusUpdate, buildEventReminder, buildNewOrgPendingReview, sendSignupConfirmation, sendApplicationStatusUpdate, sendEventReminder, sendNewOrgApprovalRequest } from '../app/lib/notify.js'

test('buildSignupConfirmation includes event, org, date and venue', () => {
  const { subject, text } = buildSignupConfirmation({
    name: 'Amina', eventTitle: 'Food Pantry', organizationName: 'Islamic Center of Eastside',
    startAt: '2026-09-20T10:00', locationName: 'Community Hall',
  })
  assert.equal(subject, "You're signed up: Food Pantry")
  assert.match(text, /Hi Amina,/)
  assert.match(text, /"Food Pantry" with Islamic Center of Eastside/)
  assert.match(text, /at Community Hall/)
  assert.match(text, /Sunday, September 20 at 10:00 AM/)
})

test('buildSignupConfirmation falls back gracefully with no name or venue', () => {
  const { text } = buildSignupConfirmation({ eventTitle: 'Cleanup', organizationName: 'Masjid Team', startAt: 'not-a-date', locationName: '' })
  assert.match(text, /Hi there,/)
  assert.match(text, /"Cleanup" with Masjid Team\./) // no " on ", no " at "
})

test('buildApplicationStatusUpdate: accepted', () => {
  const message = buildApplicationStatusUpdate({ name: 'Yusuf', eventTitle: 'Youth Night', organizationName: 'MAPS', status: 'accepted' })
  assert.equal(message.subject, "You're confirmed: Youth Night")
  assert.match(message.text, /MAPS accepted your application for "Youth Night"/)
})

test('buildApplicationStatusUpdate: declined', () => {
  const message = buildApplicationStatusUpdate({ name: 'Sara', eventTitle: 'Open House', organizationName: 'ICE', status: 'declined' })
  assert.equal(message.subject, 'Update on your application: Open House')
  assert.match(message.text, /ICE wasn't able to take your application/)
})

test('buildApplicationStatusUpdate returns null for a non-notifiable status (e.g. shortlisted)', () => {
  assert.equal(buildApplicationStatusUpdate({ eventTitle: 'x', organizationName: 'y', status: 'shortlisted' }), null)
  assert.equal(buildApplicationStatusUpdate({ eventTitle: 'x', organizationName: 'y', status: 'new' }), null)
})

test('sendSignupConfirmation no-ops without throwing when no email provider is configured (e.g. this plain-Node test environment)', async () => {
  const result = await sendSignupConfirmation({ to: 'volunteer@example.com', eventTitle: 'Cleanup', organizationName: 'Org', startAt: '2026-09-20T10:00', locationName: 'Park' })
  assert.equal(result.sent, false)
})

test('sendApplicationStatusUpdate no-ops for shortlisted without calling out to email at all', async () => {
  const result = await sendApplicationStatusUpdate({ to: 'volunteer@example.com', eventTitle: 'x', organizationName: 'y', status: 'shortlisted' })
  assert.deepEqual(result, { sent: false, reason: 'not_notifiable' })
})

test('buildEventReminder includes event, org, time and venue', () => {
  const { subject, text } = buildEventReminder({
    name: 'Amina', eventTitle: 'Food Pantry', organizationName: 'Islamic Center of Eastside',
    startAt: '2026-09-20T10:00', locationName: 'Community Hall',
  })
  assert.equal(subject, 'Starting soon: Food Pantry')
  assert.match(text, /Hi Amina,/)
  assert.match(text, /"Food Pantry" with Islamic Center of Eastside is starting soon/)
  assert.match(text, /Sunday, September 20 at 10:00 AM/)
  assert.match(text, /at Community Hall/)
})

test('buildEventReminder falls back gracefully with no name or venue', () => {
  const { text } = buildEventReminder({ eventTitle: 'Cleanup', organizationName: 'Masjid Team', startAt: 'not-a-date', locationName: '' })
  assert.match(text, /Hi there,/)
  assert.match(text, /"Cleanup" with Masjid Team is starting soon\.\n/) // no " - ", no " at "
})

test('sendEventReminder no-ops without throwing when no email provider is configured', async () => {
  const result = await sendEventReminder({ to: 'volunteer@example.com', eventTitle: 'Cleanup', organizationName: 'Org', startAt: '2026-09-20T10:00', locationName: 'Park' })
  assert.equal(result.sent, false)
})

test('buildNewOrgPendingReview includes the org name and who signed up', () => {
  const { subject, text } = buildNewOrgPendingReview({ organizationName: 'Medina Cares', organizerEmail: 'organizer@example.com' })
  assert.equal(subject, 'New organization awaiting review: Medina Cares')
  assert.match(text, /Organization: Medina Cares/)
  assert.match(text, /Signed up by: organizer@example\.com/)
  assert.match(text, /\/admin/)
})

test('buildNewOrgPendingReview falls back gracefully with no organizer email', () => {
  const { text } = buildNewOrgPendingReview({ organizationName: 'Masjid Team' })
  assert.match(text, /Signed up by: unknown/)
})

test('sendNewOrgApprovalRequest no-ops without throwing when no email provider is configured', async () => {
  const result = await sendNewOrgApprovalRequest({ to: ['admin@example.com'], organizationName: 'Org', organizerEmail: 'owner@example.com' })
  assert.equal(result.sent, false)
})

test('sendNewOrgApprovalRequest accepts multiple admin recipients without throwing', async () => {
  const result = await sendNewOrgApprovalRequest({ to: ['admin1@example.com', 'admin2@example.com'], organizationName: 'Org', organizerEmail: 'owner@example.com' })
  assert.equal(result.sent, false)
})
