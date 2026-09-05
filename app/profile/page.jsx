import { requireUser } from '../auth.ts'
import ProfileClient from './profile-client.jsx'

export const dynamic = 'force-dynamic'

export default async function ProfilePage() {
  const user = await requireUser('/profile')
  return <ProfileClient user={{ userId: user.userId, email: user.email, displayName: user.displayName }} />
}
