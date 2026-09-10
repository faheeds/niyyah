import { prepareAuthTables } from '../../../../db/index.js'
import { hashPassword, createSession, sessionCookieHeader } from '../../../auth.ts'
import { ADMIN_EMAILS } from '../../../admin-emails.js'
import { autoEnrollBySchoolEmail } from '../../../org-membership.js'
import { claimAdminInvites } from '../../../org-admins.js'

const clean = (value, max = 200) => typeof value === 'string' ? value.trim().slice(0, max) : ''

export async function POST(request) {
  try {
    const body = await request.json()
    const email = clean(body.email, 160).toLowerCase()
    const displayName = clean(body.displayName, 120) || email.split('@')[0]
    const password = typeof body.password === 'string' ? body.password : ''
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) return Response.json({ error: 'Enter a valid email address.' }, { status: 400 })
    // Never let a password sign-up claim an admin address - see app/admin-emails.js.
    if (ADMIN_EMAILS.includes(email)) return Response.json({ error: 'This address is reserved. Contact an administrator if this is you.' }, { status: 409 })
    if (password.length < 8) return Response.json({ error: 'Choose a password with at least 8 characters.' }, { status: 400 })

    const db = await prepareAuthTables()
    const existing = await db.prepare('SELECT id FROM accounts WHERE email=?').bind(email).first()
    if (existing) return Response.json({ error: 'An account with that email already exists. Try signing in instead.' }, { status: 409 })

    const { hash, salt } = await hashPassword(password)
    const id = crypto.randomUUID(), now = new Date().toISOString()
    await db.prepare('INSERT INTO accounts (id,email,display_name,password_hash,password_salt,created_at,updated_at) VALUES (?,?,?,?,?,?,?)')
      .bind(id, email, displayName, hash, salt, now, now).run()
    await autoEnrollBySchoolEmail(id, email, displayName, false)
    await claimAdminInvites(id, email)

    const token = await createSession(id)
    return Response.json({ ok: true }, { headers: { 'Set-Cookie': sessionCookieHeader(token) } })
  } catch {
    return Response.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
