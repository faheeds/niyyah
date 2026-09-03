import { requireChatGPTUser } from '../chatgpt-auth.ts'
import OpportunitiesClient from './opportunities-client.jsx'
export const dynamic='force-dynamic'
export default async function OpportunitiesPage(){const user=await requireChatGPTUser('/opportunities');return <OpportunitiesClient user={{displayName:user.displayName}}/>}
