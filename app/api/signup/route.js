import { prepareMembersTable } from '../../../db/index.js'

const allowedAgeGroups = new Set(['13–15', '16–17', '18–24', '25–34', '35+'])
const allowedContacts = new Set(['Email', 'Text message', 'WhatsApp'])

function clean(value, max = 160) {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

export async function POST(request) {
  try {
    const body = await request.json()
    const firstName = clean(body.firstName, 60)
    const lastName = clean(body.lastName, 60)
    const email = clean(body.email, 160).toLowerCase()
    const ageGroup = clean(body.ageGroup, 20)
    const postcode = clean(body.postcode, 16).toUpperCase()
    const preferredContact = clean(body.preferredContact, 30)
    const interests = Array.isArray(body.interests) ? body.interests.map((item) => clean(item, 40)).filter(Boolean).slice(0, 8) : []

    if (!firstName || !lastName || !email || !/^\S+@\S+\.\S+$/.test(email) || !allowedAgeGroups.has(ageGroup) || !postcode || !allowedContacts.has(preferredContact) || interests.length === 0 || body.consent !== true) {
      return Response.json({ error: 'Please complete all required fields.' }, { status: 400 })
    }

    const db = await prepareMembersTable()
    const now = new Date().toISOString()
    await db.prepare(`INSERT INTO community_members (
      id, first_name, last_name, email, phone, age_group, postcode, interests,
      preferred_contact, heard_about_us, instagram, tiktok, other_social,
      updates_opt_in, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(email) DO UPDATE SET
      first_name = excluded.first_name,
      last_name = excluded.last_name,
      phone = excluded.phone,
      age_group = excluded.age_group,
      postcode = excluded.postcode,
      interests = excluded.interests,
      preferred_contact = excluded.preferred_contact,
      heard_about_us = excluded.heard_about_us,
      instagram = excluded.instagram,
      tiktok = excluded.tiktok,
      other_social = excluded.other_social,
      updates_opt_in = excluded.updates_opt_in,
      updated_at = excluded.updated_at`)
      .bind(
        crypto.randomUUID(), firstName, lastName, email, clean(body.phone, 30) || null,
        ageGroup, postcode, JSON.stringify(interests), preferredContact,
        clean(body.heardAboutUs, 80) || null, clean(body.instagram, 80) || null,
        clean(body.tiktok, 80) || null, clean(body.otherSocial, 120) || null,
        body.updatesOptIn === true ? 1 : 0, now, now,
      ).run()

    const referralCode=clean(body.referralCode,24)
    if(referralCode){
      const challenge=await db.prepare('SELECT inviter_user_id,inviter_email FROM volunteer_challenges WHERE invite_code=?').bind(referralCode).first()
      if(challenge&&String(challenge.inviter_email).toLowerCase()!==email)await db.prepare(`INSERT INTO volunteer_referrals (id,inviter_user_id,invitee_email,status,created_at) VALUES (?,?,?,?,?) ON CONFLICT(invitee_email) DO NOTHING`).bind(crypto.randomUUID(),challenge.inviter_user_id,email,'pending',now).run()
    }

    return Response.json({ ok: true })
  } catch {
    return Response.json({ error: 'We could not save your signup. Please try again.' }, { status: 500 })
  }
}
