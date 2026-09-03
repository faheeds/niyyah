import { requireChatGPTUser } from '../chatgpt-auth.ts'
import ProfileClient from './profile-client.jsx'

export const dynamic = 'force-dynamic'

export default async function ProfilePage() {
  const user = await requireChatGPTUser('/profile')
  return <ProfileClient user={{ userId: user.userId, email: user.email, displayName: user.displayName }} />
}
