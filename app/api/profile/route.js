import { getUser } from '../../auth.ts'
import { prepareCommunityTables } from '../../../db/index.js'

const clean = (value, max = 200) => typeof value === 'string' ? value.trim().slice(0, max) : ''

export async function GET() {
  const user = await getUser()
  if (!user) return Response.json({ error: 'Sign in required.' }, { status: 401 })
  const db = await prepareCommunityTables()
  const now = new Date().toISOString()
  await db.prepare(`INSERT INTO member_profiles (user_id,email,display_name,created_at,updated_at)
    VALUES (?,?,?,?,?) ON CONFLICT(user_id) DO NOTHING`).bind(user.userId,user.email,user.displayName,now,now).run()
  let challenge=await db.prepare('SELECT * FROM volunteer_challenges WHERE inviter_user_id=?').bind(user.userId).first()
  if(!challenge){const inviteCode=crypto.randomUUID().replace(/-/g,'').slice(0,8);await db.prepare('INSERT INTO volunteer_challenges (inviter_user_id,inviter_email,invite_code,created_at) VALUES (?,?,?,?)').bind(user.userId,user.email.toLowerCase(),inviteCode,now).run();challenge={inviter_user_id:user.userId,inviter_email:user.email,invite_code:inviteCode,created_at:now}}
  await db.prepare("UPDATE volunteer_referrals SET invitee_user_id=?,status='completed',completed_at=? WHERE lower(invitee_email)=lower(?) AND status='pending'").bind(user.userId,now,user.email).run()
  const referralRows=await db.prepare(`SELECT r.*,m.first_name,m.last_name FROM volunteer_referrals r LEFT JOIN community_members m ON lower(m.email)=lower(r.invitee_email) WHERE r.inviter_user_id=? ORDER BY r.created_at DESC`).bind(user.userId).all()
  const referrals=referralRows.results??[],completedCount=referrals.filter(item=>item.status==='completed').length
  const profile = await db.prepare('SELECT * FROM member_profiles WHERE user_id = ?').bind(user.userId).first()
  const activities = await db.prepare('SELECT * FROM volunteer_activities WHERE user_id = ? ORDER BY activity_date DESC LIMIT 30').bind(user.userId).all()
  // P0-01: only approved organizations (and their events) should populate the
  // hours-logging dropdown - pending/rejected orgs haven't been checked yet.
  const organizations=await db.prepare("SELECT id,name FROM organizations WHERE status='approved' ORDER BY name").all()
  const events=await db.prepare("SELECT e.id,e.organization_id,e.title FROM organization_events e JOIN organizations o ON o.id=e.organization_id WHERE e.status='published' AND e.event_type='volunteering' AND o.status='approved' ORDER BY e.start_at").all()
  // A volunteer's own roster standing with each organization they've joined
  // or been auto-enrolled in - see app/org-membership.js and
  // app/api/organization-membership/route.js.
  const memberships=await db.prepare(`SELECT m.organization_id,o.name AS organization_name,m.tag,m.status FROM organization_members m JOIN organizations o ON o.id=m.organization_id WHERE m.user_id=? ORDER BY m.created_at DESC`).bind(user.userId).all()
  const totalHours = (activities.results ?? []).filter(item=>item.status==='approved').reduce((sum,item) => sum + Number(item.hours || 0),0)
  return Response.json({ profile:{...profile,interests:JSON.parse(profile.interests || '[]')},activities:activities.results ?? [],organizations:organizations.results??[],events:events.results??[],memberships:memberships.results??[],progress:getProgress(totalHours),challenge:{inviteCode:challenge.invite_code,completedCount,target:3,complete:completedCount>=3,referrals,notifications:referrals.filter(item=>item.status==='completed').map(item=>({id:item.id,message:`${[item.first_name,item.last_name].filter(Boolean).join(' ')||item.invitee_email} joined through your invitation.`,date:item.completed_at}))} })
}

export async function PUT(request) {
  const user = await getUser()
  if (!user) return Response.json({ error:'Sign in required.' },{status:401})
  const body = await request.json()
  const displayName=clean(body.displayName,80), interests=Array.isArray(body.interests)?body.interests.map(v=>clean(v,40)).filter(Boolean).slice(0,8):[]
  if(!displayName) return Response.json({error:'A display name is required.'},{status:400})
  const db=await prepareCommunityTables(), now=new Date().toISOString()
  await db.prepare(`INSERT INTO member_profiles (user_id,email,display_name,bio,postcode,interests,instagram,tiktok,other_social,discoverable,share_activity,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET email=excluded.email,display_name=excluded.display_name,bio=excluded.bio,postcode=excluded.postcode,interests=excluded.interests,instagram=excluded.instagram,tiktok=excluded.tiktok,other_social=excluded.other_social,discoverable=excluded.discoverable,share_activity=excluded.share_activity,updated_at=excluded.updated_at`)
    .bind(user.userId,user.email,displayName,clean(body.bio,280)||null,clean(body.postcode,16)||null,JSON.stringify(interests),clean(body.instagram,80)||null,clean(body.tiktok,80)||null,clean(body.otherSocial,120)||null,body.discoverable?1:0,body.shareActivity?1:0,now,now).run()
  return Response.json({ok:true})
}

function getProgress(hours){
  const levels=[{level:1,name:'First Step',min:0,next:5,badge:'Seed'},{level:2,name:'Helping Hand',min:5,next:20,badge:'Helping Hand'},{level:3,name:'Community Builder',min:20,next:50,badge:'Community Builder'},{level:4,name:'Local Champion',min:50,next:100,badge:'Local Champion'},{level:5,name:'Legacy Maker',min:100,next:null,badge:'Legacy Maker'}]
  const current=[...levels].reverse().find(item=>hours>=item.min)||levels[0]
  const percent=current.next?Math.min(100,Math.round(((hours-current.min)/(current.next-current.min))*100)):100
  return {...current,hours,percent,unlocked:levels.filter(item=>hours>=item.min)}
}
