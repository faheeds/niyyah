import { prepareMembersTable, prepareAuthTables } from '../../../db/index.js'
import { hashPassword, createSession, sessionCookieHeader } from '../../auth.ts'
import { ADMIN_EMAILS } from '../../admin-emails.js'
import { autoEnrollBySchoolEmail } from '../../org-membership.js'

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
    const password = typeof body.password === 'string' ? body.password : ''

    if (!firstName || !lastName || !email || !/^\S+@\S+\.\S+$/.test(email) || !allowedAgeGroups.has(ageGroup) || !postcode || !allowedContacts.has(preferredContact) || interests.length === 0 || body.consent !== true) {
      return Response.json({ error: 'Please complete all required fields.' }, { status: 400 })
    }
    // Never let this form claim an admin address either - see app/admin-emails.js.
    if (ADMIN_EMAILS.includes(email)) {
      return Response.json({ error: 'This address is reserved. Contact an administrator if this is you.' }, { status: 409 })
    }
    if (password.length < 8) {
      return Response.json({ error: 'Choose a password with at least 8 characters.' }, { status: 400 })
    }

    const now = new Date().toISOString()

    // This form is the main volunteer sign-up funnel (see /join -> /volunteer-access ->
    // "Volunteer sign up"), and /profile requires a real session (requireUser()). So this
    // also creates the person's login account here, using the password they just chose,
    // rather than leaving them at a dead end with community details saved but no way to
    // sign in. If an account with this email already exists, we do NOT log the submitter
    // in - that would let anyone log into someone else's account just by knowing their
    // email and submitting this form with a different password. Those requests get sent
    // to sign in normally instead.
    //
    // Done before the community_members write below (not after) so a failure here - a
    // hashing error, or a UNIQUE race on accounts.email - can't leave a community_members
    // row saved with no way for that person to ever sign in.
    const authDb = await prepareAuthTables()
    const existingAccount = await authDb.prepare('SELECT id FROM accounts WHERE email=?').bind(email).first()
    let sessionCookie = null
    let accountId = existingAccount?.id || null
    if (!existingAccount) {
      const { hash, salt } = await hashPassword(password)
      accountId = crypto.randomUUID()
      const displayName = `${firstName} ${lastName}`.trim() || email
      await authDb.prepare('INSERT INTO accounts (id,email,display_name,password_hash,password_salt,created_at,updated_at) VALUES (?,?,?,?,?,?,?)')
        .bind(accountId, email, displayName, hash, salt, now, now).run()
      sessionCookie = sessionCookieHeader(await createSession(accountId))
    }
    // Runs whether the account is brand new or already existed - lets a
    // student whose school registers its domain later get swept in the next
    // time they submit this form too. See app/org-membership.js.
    await autoEnrollBySchoolEmail(accountId, email, `${firstName} ${lastName}`.trim() || email)

    const db = await prepareMembersTable()
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

    return Response.json(
      { ok: true, alreadyRegistered: !sessionCookie },
      sessionCookie ? { headers: { 'Set-Cookie': sessionCookie } } : undefined,
    )
  } catch {
    return Response.json({ error: 'We could not save your signup. Please try again.' }, { status: 500 })
  }
}
