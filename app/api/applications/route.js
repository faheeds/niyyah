import { getChatGPTUser } from '../../chatgpt-auth.ts'
import { prepareCommunityTables } from '../../../db/index.js'

export async function POST(request){
  const user=await getChatGPTUser();if(!user)return Response.json({error:'Sign in required.'},{status:401})
  const {eventId}=await request.json(),db=await prepareCommunityTables()
  const event=await db.prepare("SELECT id,organization_id FROM organization_events WHERE id=? AND status='published' AND event_type='volunteering'").bind(String(eventId||'')).first()
  if(!event)return Response.json({error:'This volunteering request is not available.'},{status:404})
  const now=new Date().toISOString()
  await db.prepare(`INSERT INTO volunteer_applications (id,event_id,organization_id,user_id,applicant_email,applicant_name,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(event_id,user_id) DO NOTHING`).bind(crypto.randomUUID(),event.id,event.organization_id,user.userId,user.email,user.displayName,'new',now,now).run()
  return Response.json({ok:true})
}
