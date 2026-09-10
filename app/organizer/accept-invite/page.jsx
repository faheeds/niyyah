import { requireUser } from '../../auth.ts'
import AcceptInviteClient from './accept-invite-client.jsx'
import '../../../src/styles.css'

export const dynamic = 'force-dynamic'

export default async function AcceptInvitePage({ searchParams }) {
  const params = (await searchParams) || {}
  const token = typeof params.token === 'string' ? params.token : ''
  const user = await requireUser(`/organizer/accept-invite${token ? `?token=${encodeURIComponent(token)}` : ''}`)
  return <AcceptInviteClient token={token} />
}
