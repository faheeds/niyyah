import { prepareAuthTables } from '../../../../db/index.js'
import { verifyPassword, createSession, sessionCookieHeader } from '../../../auth.ts'
import { autoEnrollBySchoolEmail } from '../../../org-membership.js'

export async function POST(request) {
  try {
    const body = await request.json()
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const password = typeof body.password === 'string' ? body.password : ''
    if (!email || !password) return Response.json({ error: 'Enter your email and password.' }, { status: 400 })

    const db = await prepareAuthTables()
    const account = await db.prepare('SELECT id,password_hash,password_salt,display_name FROM accounts WHERE email=?').bind(email).first()
    if (!account || !account.password_hash || !account.password_salt) return Response.json({ error: 'Incorrect email or password.' }, { status: 401 })

    const ok = await verifyPassword(password, account.password_hash, account.password_salt)
    if (!ok) return Response.json({ error: 'Incorrect email or password.' }, { status: 401 })

    // Idempotent - lets a student get swept onto their school's roster on a
    // later sign-in even if the org registered its domain after this
    // account already existed. See app/org-membership.js.
    await autoEnrollBySchoolEmail(account.id, email, account.display_name)

    const token = await createSession(account.id)
    return Response.json({ ok: true }, { headers: { 'Set-Cookie': sessionCookieHeader(token) } })
  } catch {
    return Response.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
