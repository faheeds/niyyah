import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { prepareAuthTables } from '../db/index.js'

// Real sign-in for Niyyah, replacing the old ChatGPT-hosted-only adapter (see
// CLAUDE_HANDOFF.md). Accounts and sessions live in D1 (see prepareAuthTables
// in db/index.js); identity comes from either a Google sign-in or an email +
// password the person set themselves — never from a trusted header again.

export type NiyyahUser = { userId: string; displayName: string; email: string; fullName: string | null }

const SESSION_COOKIE = 'niyyah_session'
const SESSION_DAYS = 30

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export function readCookie(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null
  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=')
    if (separator === -1) continue
    const key = part.slice(0, separator).trim()
    if (key === name) return decodeURIComponent(part.slice(separator + 1).trim())
  }
  return null
}

export async function hashPassword(password: string, saltB64?: string): Promise<{ hash: string; salt: string }> {
  const salt = saltB64 ? fromBase64(saltB64) : crypto.getRandomValues(new Uint8Array(16))
  const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 120000, hash: 'SHA-256' }, keyMaterial, 256)
  return { hash: toBase64(new Uint8Array(bits)), salt: toBase64(salt) }
}

export async function verifyPassword(password: string, hash: string, salt: string): Promise<boolean> {
  const attempt = await hashPassword(password, salt)
  if (attempt.hash.length !== hash.length) return false
  let diff = 0
  for (let i = 0; i < hash.length; i++) diff |= attempt.hash.charCodeAt(i) ^ hash.charCodeAt(i)
  return diff === 0
}

export function sessionCookieHeader(token: string): string {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${SESSION_DAYS * 24 * 60 * 60}; HttpOnly; Secure; SameSite=Lax`
}

export function clearSessionCookieHeader(): string {
  return `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`
}

export function readSessionToken(cookieHeader: string | null): string | null {
  return readCookie(cookieHeader, SESSION_COOKIE)
}

export async function createSession(accountId: string): Promise<string> {
  const db = await prepareAuthTables()
  const token = toBase64(crypto.getRandomValues(new Uint8Array(32))).replace(/[^a-zA-Z0-9]/g, '')
  const now = new Date()
  const expires = new Date(now.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000)
  await db.prepare('INSERT INTO auth_sessions (id,account_id,created_at,expires_at) VALUES (?,?,?,?)').bind(token, accountId, now.toISOString(), expires.toISOString()).run()
  return token
}

export async function destroySession(token: string | null): Promise<void> {
  if (!token) return
  const db = await prepareAuthTables()
  await db.prepare('DELETE FROM auth_sessions WHERE id=?').bind(token).run()
}

export async function getUser(): Promise<NiyyahUser | null> {
  const requestHeaders = await headers()
  const token = readSessionToken(requestHeaders.get('cookie'))
  if (!token) return null
  const db = await prepareAuthTables()
  const row: any = await db.prepare(`SELECT a.id,a.email,a.display_name FROM auth_sessions s JOIN accounts a ON a.id=s.account_id WHERE s.id=? AND s.expires_at>?`).bind(token, new Date().toISOString()).first()
  if (!row) return null
  return { userId: row.id, email: row.email, displayName: row.display_name, fullName: row.display_name }
}

export async function requireUser(returnTo: string): Promise<NiyyahUser> {
  const user = await getUser()
  if (user) return user
  redirect(`/signin?return_to=${encodeURIComponent(returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : '/')}`)
}
