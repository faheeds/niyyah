import { requireUser } from '../auth.ts'
import AdminClient from './admin-client.jsx'

export const dynamic='force-dynamic'
export default async function AdminPage(){const user=await requireUser('/admin');return <AdminClient user={{email:user.email,displayName:user.displayName}}/>}
