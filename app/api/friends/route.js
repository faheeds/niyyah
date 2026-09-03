import { getChatGPTUser } from '../../chatgpt-auth.ts'
import { prepareCommunityTables } from '../../../db/index.js'

export async function GET(request){
  const user=await getChatGPTUser(); if(!user)return Response.json({error:'Sign in required.'},{status:401})
  const db=await prepareCommunityTables(), q=new URL(request.url).searchParams.get('q')?.trim().slice(0,80)||''
  const people=q?await db.prepare(`SELECT user_id,display_name,bio,interests,instagram,tiktok FROM member_profiles WHERE discoverable=1 AND user_id!=? AND (display_name LIKE ? OR instagram LIKE ? OR tiktok LIKE ?) LIMIT 12`).bind(user.userId,`%${q}%`,`%${q}%`,`%${q}%`).all():{results:[]}
  const feed=await db.prepare(`SELECT p.display_name,a.organization,a.role,a.hours,a.activity_date FROM volunteer_activities a JOIN member_profiles p ON p.user_id=a.user_id WHERE p.share_activity=1 AND a.user_id IN (SELECT CASE WHEN requester_id=? THEN recipient_id ELSE requester_id END FROM member_connections WHERE (requester_id=? OR recipient_id=?) AND status='accepted') ORDER BY a.activity_date DESC LIMIT 20`).bind(user.userId,user.userId,user.userId).all()
  const requests=await db.prepare(`SELECT c.id,p.display_name FROM member_connections c JOIN member_profiles p ON p.user_id=c.requester_id WHERE c.recipient_id=? AND c.status='pending'`).bind(user.userId).all()
  return Response.json({people:(people.results||[]).map(p=>({...p,interests:JSON.parse(p.interests||'[]')})),feed:feed.results||[],requests:requests.results||[]})
}

export async function POST(request){
  const user=await getChatGPTUser(); if(!user)return Response.json({error:'Sign in required.'},{status:401})
  const body=await request.json(),db=await prepareCommunityTables(),now=new Date().toISOString()
  if(body.action==='accept'&&body.connectionId){await db.prepare(`UPDATE member_connections SET status='accepted',updated_at=? WHERE id=? AND recipient_id=?`).bind(now,String(body.connectionId),user.userId).run();return Response.json({ok:true})}
  const friendId=String(body.friendId||''); if(!friendId||friendId===user.userId)return Response.json({error:'Choose a valid member.'},{status:400})
  await db.prepare(`INSERT INTO member_connections (id,requester_id,recipient_id,status,created_at,updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT(requester_id,recipient_id) DO NOTHING`).bind(crypto.randomUUID(),user.userId,friendId,'pending',now,now).run()
  return Response.json({ok:true})
}
