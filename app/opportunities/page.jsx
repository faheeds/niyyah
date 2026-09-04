import { requireUser } from '../auth.ts'
import OpportunitiesClient from './opportunities-client.jsx'
export const dynamic='force-dynamic'
export default async function OpportunitiesPage(){const user=await requireUser('/opportunities');return <OpportunitiesClient user={{displayName:user.displayName}}/>}
