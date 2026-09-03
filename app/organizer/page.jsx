import { requireChatGPTUser } from '../chatgpt-auth.ts'
import OrganizerClient from './organizer-client.jsx'

export const dynamic='force-dynamic'
export default async function OrganizerPage(){const user=await requireChatGPTUser('/organizer');return <OrganizerClient user={{email:user.email,displayName:user.displayName}}/>}
