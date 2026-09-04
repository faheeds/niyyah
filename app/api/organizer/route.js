import { getUser } from '../../auth.ts'
import { prepareCommunityTables } from '../../../db/index.js'

const clean=(value,max=200)=>typeof value==='string'?value.trim().slice(0,max):''
const requiredOrganization=['name','organizationType','email','phone','address','postcode','description','safeguardingName','safeguardingEmail']

async function ownedOrganization(db,userId){return db.prepare('SELECT * FROM organizations WHERE owner_user_id = ?').bind(userId).first()}

export async function GET(){
  const user=await getUser(); if(!user)return Response.json({error:'Sign in required.'},{status:401})
  const db=await prepareCommunityTables(), organization=await ownedOrganization(db,user.userId)
  if(!organization)return Response.json({organization:null,events:[],hours:[],applications:[]})
  const [events,hours,applications]=await Promise.all([
    db.prepare(`SELECT e.*,v.compensation_type,v.pay_details,r.gender_appropriateness,r.location_preference,r.travel_required,r.volunteers_needed,r.auto_pause,r.preferred_interests,r.notes,
      (SELECT COUNT(*) FROM volunteer_applications a WHERE a.event_id=e.id AND a.status!='declined') AS signup_count,
      (SELECT COUNT(*) FROM volunteer_applications a WHERE a.event_id=e.id AND a.status='accepted') AS accepted_count
      FROM organization_events e LEFT JOIN volunteer_opportunities v ON v.event_id=e.id LEFT JOIN event_volunteer_requirements r ON r.event_id=e.id WHERE e.organization_id = ? ORDER BY e.start_at DESC`).bind(organization.id).all(),
    db.prepare(`SELECT a.*, p.display_name, m.event_id, e.title AS event_title FROM volunteer_activities a
      JOIN volunteer_activity_organizations m ON m.activity_id=a.id
      LEFT JOIN member_profiles p ON p.user_id=a.user_id
      LEFT JOIN organization_events e ON e.id=m.event_id
      WHERE m.organization_id=? ORDER BY CASE a.status WHEN 'pending' THEN 0 ELSE 1 END, a.activity_date DESC`).bind(organization.id).all(),
    db.prepare(`SELECT a.*,e.title AS event_title,e.start_at,e.postcode AS event_postcode,e.interest AS event_interest,e.age_range,
      p.display_name,p.bio,p.postcode AS volunteer_postcode,p.interests,p.instagram,p.tiktok,p.other_social,cm.phone,
      s.selected_date,s.selected_time,r.location_preference,r.travel_required,r.volunteers_needed,r.preferred_interests,
      COALESCE((SELECT SUM(hours) FROM volunteer_activities h WHERE h.user_id=a.user_id AND h.status='approved'),0) AS verified_hours
      FROM volunteer_applications a JOIN organization_events e ON e.id=a.event_id
      LEFT JOIN member_profiles p ON p.user_id=a.user_id LEFT JOIN community_members cm ON lower(cm.email)=lower(a.applicant_email)
      LEFT JOIN event_signup_slots s ON s.event_id=a.event_id AND s.user_id=a.user_id
      LEFT JOIN event_volunteer_requirements r ON r.event_id=a.event_id
      WHERE a.organization_id=? ORDER BY CASE a.status WHEN 'new' THEN 0 ELSE 1 END,a.created_at DESC`).bind(organization.id).all()
  ])
  const ranked=(applications.results??[]).map(a=>{let score=45;const interests=(()=>{try{return JSON.parse(a.interests||'[]')}catch{return[]}})().map(x=>String(x).toLowerCase());if(interests.some(x=>x.includes(String(a.event_interest||'').toLowerCase())))score+=25;if(a.volunteer_postcode&&String(a.volunteer_postcode).replace(/\s/g,'').slice(0,3).toLowerCase()===String(a.event_postcode).replace(/\s/g,'').slice(0,3).toLowerCase())score+=15;score+=Math.min(15,Math.floor(Number(a.verified_hours||0)/5));return {...a,match_score:Math.min(100,score)}}).sort((a,b)=>b.match_score-a.match_score||String(a.created_at).localeCompare(String(b.created_at)))
  return Response.json({organization,events:events.results??[],hours:hours.results??[],applications:ranked})
}

export async function POST(request){
  const user=await getUser(); if(!user)return Response.json({error:'Sign in required.'},{status:401})
  const body=await request.json(), action=clean(body.action,30), db=await prepareCommunityTables(), now=new Date().toISOString()
  let organization=await ownedOrganization(db,user.userId)
  if(action==='saveOrganization'){
    if(requiredOrganization.some(key=>!clean(body[key],key==='description'?800:160)))return Response.json({error:'Complete all required organization details.'},{status:400})
    const id=organization?.id||crypto.randomUUID()
    await db.prepare(`INSERT INTO organizations (id,owner_user_id,name,organization_type,registration_number,email,phone,website,address,postcode,description,safeguarding_name,safeguarding_email,status,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(owner_user_id) DO UPDATE SET name=excluded.name,organization_type=excluded.organization_type,registration_number=excluded.registration_number,email=excluded.email,phone=excluded.phone,website=excluded.website,address=excluded.address,postcode=excluded.postcode,description=excluded.description,safeguarding_name=excluded.safeguarding_name,safeguarding_email=excluded.safeguarding_email,updated_at=excluded.updated_at`)
      .bind(id,user.userId,clean(body.name,160),clean(body.organizationType,80),clean(body.registrationNumber,80)||null,clean(body.email,160),clean(body.phone,40),clean(body.website,200)||null,clean(body.address,240),clean(body.postcode,20),clean(body.description,800),clean(body.safeguardingName,120),clean(body.safeguardingEmail,160),organization?.status||'pending',organization?.created_at||now,now).run()
    return Response.json({ok:true})
  }
  if(!organization)return Response.json({error:'Create your organization profile first.'},{status:403})
  if(action==='saveEvent'){
    const fields=['title','summary','interest','ageRange','locationName','address','postcode','startAt','endAt']
    const labels={title:'event name',summary:'description',interest:'interest',ageRange:'age range',locationName:'venue',address:'address',postcode:'postcode',startAt:'start date and time',endAt:'end date and time'},missing=fields.filter(key=>!clean(body[key],key==='summary'?600:200))
    if(missing.length)return Response.json({error:`Please complete: ${missing.map(key=>labels[key]).join(', ')}.`},{status:400})
    const datePattern=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/,startAt=clean(body.startAt,40).slice(0,16),endAt=clean(body.endAt,40).slice(0,16),start=new Date(startAt),end=new Date(endAt)
    if(!datePattern.test(startAt)||!datePattern.test(endAt)||Number.isNaN(start.getTime())||Number.isNaN(end.getTime()))return Response.json({error:'Choose a valid start and end date with a time.'},{status:400})
    if(end<=start)return Response.json({error:'The event must end after it starts.'},{status:400})
    const id=clean(body.id,80)||crypto.randomUUID(), existing=body.id?await db.prepare('SELECT id,created_at FROM organization_events WHERE id=? AND organization_id=?').bind(id,organization.id).first():null
    if(body.id&&!existing)return Response.json({error:'Event not found.'},{status:404})
    await db.prepare(`INSERT INTO organization_events (id,organization_id,title,summary,interest,age_range,location_name,address,postcode,start_at,end_at,capacity,event_type,status,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,summary=excluded.summary,interest=excluded.interest,age_range=excluded.age_range,location_name=excluded.location_name,address=excluded.address,postcode=excluded.postcode,start_at=excluded.start_at,end_at=excluded.end_at,capacity=excluded.capacity,event_type=excluded.event_type,status=excluded.status,updated_at=excluded.updated_at`)
      .bind(id,organization.id,clean(body.title,160),clean(body.summary,600),clean(body.interest,80),clean(body.ageRange,60),clean(body.locationName,160),clean(body.address,240),clean(body.postcode,20),startAt,endAt,body.capacity?Math.max(1,Math.min(10000,Number(body.capacity))):null,clean(body.eventType,30)||'community',['draft','published'].includes(body.status)?body.status:'draft',existing?.created_at||now,now).run()
    if(body.eventType==='volunteering')await db.prepare(`INSERT INTO volunteer_opportunities (event_id,compensation_type,pay_details,created_at,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(event_id) DO UPDATE SET compensation_type=excluded.compensation_type,pay_details=excluded.pay_details,updated_at=excluded.updated_at`).bind(id,body.compensationType==='paid'?'paid':'unpaid',clean(body.payDetails,200)||null,now,now).run()
    if(body.eventType==='volunteering')await db.prepare(`INSERT INTO event_volunteer_requirements (event_id,gender_appropriateness,location_preference,travel_required,volunteers_needed,auto_pause,preferred_interests,notes,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(event_id) DO UPDATE SET gender_appropriateness=excluded.gender_appropriateness,location_preference=excluded.location_preference,travel_required=excluded.travel_required,volunteers_needed=excluded.volunteers_needed,auto_pause=excluded.auto_pause,preferred_interests=excluded.preferred_interests,notes=excluded.notes,updated_at=excluded.updated_at`).bind(id,clean(body.genderAppropriateness,80)||'Any gender',clean(body.locationPreference,120)||null,body.travelRequired?1:0,Math.max(1,Math.min(10000,Number(body.volunteersNeeded)||1)),body.autoPause?1:0,clean(body.preferredInterests,240)||null,clean(body.volunteerNotes,500)||null,now,now).run()
    return Response.json({ok:true})
  }
  if(action==='closeEvent'){
    await db.prepare("UPDATE organization_events SET status='closed',updated_at=? WHERE id=? AND organization_id=?").bind(now,clean(body.id,80),organization.id).run();return Response.json({ok:true})
  }
  if(action==='deleteEvent'){
    await db.prepare('DELETE FROM organization_events WHERE id=? AND organization_id=?').bind(clean(body.id,80),organization.id).run(); return Response.json({ok:true})
  }
  if(action==='reviewHours'){
    const status=body.status==='approved'?'approved':body.status==='rejected'?'rejected':null
    if(!status)return Response.json({error:'Invalid review decision.'},{status:400})
    const mapped=await db.prepare('SELECT activity_id FROM volunteer_activity_organizations WHERE activity_id=? AND organization_id=?').bind(clean(body.activityId,80),organization.id).first()
    if(!mapped)return Response.json({error:'Hours request not found.'},{status:404})
    await db.prepare('UPDATE volunteer_activities SET status=? WHERE id=?').bind(status,mapped.activity_id).run(); return Response.json({ok:true})
  }
  if(action==='reviewApplication'){
    const status=['shortlisted','accepted','declined'].includes(body.status)?body.status:null;if(!status)return Response.json({error:'Invalid application status.'},{status:400})
    await db.prepare('UPDATE volunteer_applications SET status=?,updated_at=? WHERE id=? AND organization_id=?').bind(status,now,clean(body.applicationId,80),organization.id).run();return Response.json({ok:true})
  }
  return Response.json({error:'Unknown action.'},{status:400})
}
