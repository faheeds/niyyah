import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

export type ChatGPTUser = { userId: string; displayName: string; email: string; fullName: string | null }

export async function getChatGPTUser(): Promise<ChatGPTUser | null> {
  const requestHeaders = await headers()
  const userId = requestHeaders.get('oai-authenticated-user-id')
  const email = requestHeaders.get('oai-authenticated-user-email')
  if (!userId || !email) return null
  const encoded = requestHeaders.get('oai-authenticated-user-full-name')
  let fullName: string | null = null
  if (encoded && requestHeaders.get('oai-authenticated-user-full-name-encoding') === 'percent-encoded-utf-8') {
    try { fullName = decodeURIComponent(encoded) } catch { fullName = null }
  }
  return { userId, email, fullName, displayName: fullName ?? email }
}

export async function requireChatGPTUser(returnTo: string): Promise<ChatGPTUser> {
  const user = await getChatGPTUser()
  if (user) return user
  redirect(`/signin-with-chatgpt?return_to=${encodeURIComponent(returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : '/')}`)
}
