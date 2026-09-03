import { getChatGPTUser } from '../../chatgpt-auth.ts'
import { prepareCommunityTables } from '../../../db/index.js'

export async function POST(request){
  const user=await getChatGPTUser(); if(!user)return Response.json({error:'Sign in required.'},{status:401})
  const body=await request.json(), organizationId=String(body.organizationId||''), eventId=String(body.eventId||''), role=String(body.role||'').trim().slice(0,100), hours=Number(body.hours), date=String(body.date||'')
  if(!organizationId||!role||!Number.isInteger(hours)||hours<1||hours>1000||!/^\d{4}-\d{2}-\d{2}$/.test(date))return Response.json({error:'Complete every activity field.'},{status:400})
  const db=await prepareCommunityTables(), organization=await db.prepare('SELECT id,name FROM organizations WHERE id=?').bind(organizationId).first()
  if(!organization)return Response.json({error:'Choose a Niyyah organization.'},{status:400})
  if(eventId){const event=await db.prepare('SELECT id FROM organization_events WHERE id=? AND organization_id=?').bind(eventId,organization.id).first();if(!event)return Response.json({error:'That event is not available.'},{status:400})}
  const id=crypto.randomUUID(),now=new Date().toISOString()
  await db.batch([db.prepare('INSERT INTO volunteer_activities (id,user_id,organization,role,hours,activity_date,status,created_at) VALUES (?,?,?,?,?,?,?,?)').bind(id,user.userId,organization.name,role,hours,date,'pending',now),db.prepare('INSERT INTO volunteer_activity_organizations (activity_id,organization_id,event_id,created_at) VALUES (?,?,?,?)').bind(id,organization.id,eventId||null,now)])
  return Response.json({ok:true})
}
