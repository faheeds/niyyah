import { getUser } from '../../auth.ts'
import { prepareCommunityTables } from '../../../db/index.js'
import { currentOccurrence } from '../../lib/recurrence.js'
import { sendSignupConfirmation } from '../../lib/notify.js'
import { buildMatchReason } from '../../lib/match-reason.js'

const parse=value=>{try{return JSON.parse(value||'[]')}catch{return[]}}
const area=postcode=>String(postcode||'').toUpperCase().replace(/\s/g,'').slice(0,3)

export async function GET(){
  const user=await getUser();if(!user)return Response.json({error:'Sign in required.'},{status:401})
  const db=await prepareCommunityTables(),profile=await db.prepare('SELECT interests,postcode FROM member_profiles WHERE user_id=?').bind(user.userId).first()
  const events=await db.prepare(`SELECT e.*,o.name AS organization_name,o.safeguarding_name,o.safeguarding_email,v.compensation_type,v.pay_details,s.selected_date,s.selected_time,
    CASE WHEN va.user_id IS NOT NULL OR ep.user_id IS NOT NULL THEN 1 ELSE 0 END AS joined
    FROM organization_events e JOIN organizations o ON o.id=e.organization_id
    LEFT JOIN volunteer_opportunities v ON v.event_id=e.id
    LEFT JOIN volunteer_applications va ON va.event_id=e.id AND va.user_id=?
    LEFT JOIN event_participations ep ON ep.event_id=e.id AND ep.user_id=?
    LEFT JOIN event_signup_slots s ON s.event_id=e.id AND s.user_id=?
    WHERE e.status='published' AND o.status='approved' ORDER BY e.start_at`).bind(user.userId,user.userId,user.userId).all()
  const friends=await db.prepare(`SELECT CASE WHEN requester_id=? THEN recipient_id ELSE requester_id END AS friend_id FROM member_connections WHERE status='accepted' AND (requester_id=? OR recipient_id=?)`).bind(user.userId,user.userId,user.userId).all()
  const friendIds=(friends.results??[]).map(x=>x.friend_id),friendMap={}
  for(const friendId of friendIds){
    const rows=await db.prepare(`SELECT x.event_id,p.display_name FROM (SELECT event_id,user_id FROM volunteer_applications UNION ALL SELECT event_id,user_id FROM event_participations) x JOIN member_profiles p ON p.user_id=x.user_id WHERE x.user_id=?`).bind(friendId).all()
    for(const row of rows.results??[])(friendMap[row.event_id]??=[]).push(row.display_name)
  }
  const interests=parse(profile?.interests).map(x=>String(x).toLowerCase()),userArea=area(profile?.postcode)
  const occurrenced=(events.results??[]).map(e=>{const occ=currentOccurrence(e.start_at,e.end_at,e.recurrence);return {...e,start_at:occ.startAt,end_at:occ.endAt}})
  const ranked=occurrenced.map(e=>{const interestMatch=interests.some(i=>i.includes(String(e.interest).toLowerCase())||String(e.interest).toLowerCase().includes(i.split(' ')[0]));const nearby=!!userArea&&area(e.postcode)===userArea;const friendNames=friendMap[e.id]??[];return {...e,interestMatch,nearby,friendNames,matchReason:buildMatchReason(interestMatch,nearby,friendNames,e.interest),score:(interestMatch?4:0)+(nearby?3:0)+(friendNames.length?2:0)}}).sort((a,b)=>b.score-a.score||String(a.start_at).localeCompare(String(b.start_at)))
  return Response.json({profile:{interests:parse(profile?.interests),postcode:profile?.postcode||''},opportunities:ranked})
}

export async function POST(request){
  const user=await getUser();if(!user)return Response.json({error:'Sign in required.'},{status:401})
  const {eventId,date,time}=await request.json(),db=await prepareCommunityTables(),event=await db.prepare("SELECT e.id,e.organization_id,e.event_type,e.start_at,e.end_at,e.recurrence,e.title,e.location_name,o.name AS organization_name FROM organization_events e JOIN organizations o ON o.id=e.organization_id WHERE e.id=? AND e.status='published' AND o.status='approved'").bind(String(eventId||'')).first()
  if(!event)return Response.json({error:'Opportunity not found.'},{status:404})
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(date||''))||!/^\d{2}:\d{2}$/.test(String(time||'')))return Response.json({error:'Choose a valid date and time slot.'},{status:400})
  const occ=currentOccurrence(event.start_at,event.end_at,event.recurrence)
  const chosen=new Date(`${date}T${time}`),start=new Date(occ.startAt),end=new Date(occ.endAt)
  if(Number.isNaN(chosen.getTime())||chosen<new Date(start.toISOString().slice(0,10)+'T00:00')||chosen>new Date(end.toISOString().slice(0,10)+'T23:59'))return Response.json({error:'That slot is outside the event dates.'},{status:400})
  const now=new Date().toISOString()
  let isNewSignup=false
  if(event.event_type==='volunteering'){
    const inserted=await db.prepare(`INSERT INTO volunteer_applications (id,event_id,organization_id,user_id,applicant_email,applicant_name,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(event_id,user_id) DO NOTHING`).bind(crypto.randomUUID(),event.id,event.organization_id,user.userId,user.email,user.displayName,'new',now,now).run()
    isNewSignup=!!inserted?.meta?.changes
    const requirement=await db.prepare('SELECT volunteers_needed,auto_pause FROM event_volunteer_requirements WHERE event_id=?').bind(event.id).first()
    if(requirement?.auto_pause){const count=await db.prepare("SELECT COUNT(*) AS total FROM volunteer_applications WHERE event_id=? AND status!='declined'").bind(event.id).first();if(Number(count?.total||0)>=Number(requirement.volunteers_needed||1))await db.prepare("UPDATE organization_events SET status='closed',updated_at=? WHERE id=?").bind(now,event.id).run()}
  }
  else {
    const inserted=await db.prepare(`INSERT INTO event_participations (id,event_id,user_id,status,created_at,updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT(event_id,user_id) DO NOTHING`).bind(crypto.randomUUID(),event.id,user.userId,'going',now,now).run()
    isNewSignup=!!inserted?.meta?.changes
  }
  await db.prepare(`INSERT INTO event_signup_slots (id,event_id,user_id,selected_date,selected_time,created_at,updated_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(event_id,user_id) DO UPDATE SET selected_date=excluded.selected_date,selected_time=excluded.selected_time,updated_at=excluded.updated_at`).bind(crypto.randomUUID(),event.id,user.userId,date,time,now,now).run()
  // Only the first time someone signs up - not every time they change their slot - see P1-01.
  if(isNewSignup)await sendSignupConfirmation({to:user.email,name:user.displayName,eventTitle:event.title,organizationName:event.organization_name,startAt:`${date}T${time}`,locationName:event.location_name})
  return Response.json({ok:true})
}
