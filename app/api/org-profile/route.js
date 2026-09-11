import { prepareCommunityTables } from '../../../db/index.js'
import { currentOccurrence } from '../../lib/recurrence.js'
import { rankStandings, publicLabel, isCompetitionActive } from '../../lib/awards.js'

// P1-10: an organization's own branded landing page. Public and unauthenticated,
// same as app/api/events/route.js — only approved organizations are
// discoverable this way (see P0-01), matching the events feed's own rule.
export async function GET(request){
  const {searchParams}=new URL(request.url)
  const slug=String(searchParams.get('slug')||'').trim(),id=String(searchParams.get('id')||'').trim()
  if(!slug&&!id)return Response.json({error:'Missing organization.'},{status:400})
  const db=await prepareCommunityTables()
  // P1-17: look the organization up WITHOUT the approved-only filter first,
  // so a pending org (created but not yet reviewed) can be told apart from
  // a link that never existed - previously both returned the identical
  // generic 404, which is exactly the confusion a user reported after
  // sharing their own freshly-created organization's link. The approval
  // gate itself is unchanged: a pending org still gets nothing back but
  // its name and pending status - never its events, description, logo,
  // safeguarding contact or competitions.
  const lookup=slug
    ? await db.prepare('SELECT id,name,status FROM organizations WHERE slug=?').bind(slug).first()
    : await db.prepare('SELECT id,name,status FROM organizations WHERE id=?').bind(id).first()
  if(!lookup)return Response.json({error:'Organization not found.'},{status:404})
  if(lookup.status!=='approved')return Response.json({pending:true,organization:{name:lookup.name}})
  const organization=slug
    ? await db.prepare("SELECT id,name,description,website,logo_data_url,brand_color,safeguarding_name,safeguarding_email,slug FROM organizations WHERE slug=? AND status='approved'").bind(slug).first()
    : await db.prepare("SELECT id,name,description,website,logo_data_url,brand_color,safeguarding_name,safeguarding_email,slug FROM organizations WHERE id=? AND status='approved'").bind(id).first()
  if(!organization)return Response.json({error:'Organization not found.'},{status:404})
  const events=await db.prepare(`SELECT e.*,v.compensation_type,v.pay_details FROM organization_events e
    LEFT JOIN volunteer_opportunities v ON v.event_id=e.id
    WHERE e.organization_id=? AND e.status='published' ORDER BY e.start_at ASC LIMIT 40`).bind(organization.id).all()
  const occurrenced=(events.results??[]).map(e=>{const occ=currentOccurrence(e.start_at,e.end_at,e.recurrence);return {...e,start_at:occ.startAt,end_at:occ.endAt}}).sort((a,b)=>String(a.start_at).localeCompare(String(b.start_at)))
  const competitions=await loadActiveCompetitions(db,organization.id)
  return Response.json({organization,events:occurrenced,competitions})
}

// P1-11: shows currently-running competitions on the public org page. Unlike
// the organizer's own Awards tab (app/api/organizer/route.js), this is
// public and unauthenticated, so it (a) only surfaces competitions whose
// date window includes today - not the org's full past/upcoming history -
// and (b) never exposes a volunteer's email or full name, since Niyyah
// volunteers can be minors (see publicLabel in app/lib/awards.js). Only
// roster members with at least one verified hour in the window are
// included, so the page doesn't list every roster member at "0 hrs", and
// the list is capped for page length.
async function loadActiveCompetitions(db,organizationId){
  const todayStr=new Date().toISOString().slice(0,10)
  const rows=await db.prepare('SELECT * FROM award_competitions WHERE organization_id=? ORDER BY start_date DESC').bind(organizationId).all()
  const active=(rows.results??[]).filter(c=>isCompetitionActive({startDate:c.start_date,endDate:c.end_date},todayStr))
  const competitions=[]
  for(const comp of active){
    const tierRows=await db.prepare('SELECT name,min_hours FROM award_tiers WHERE competition_id=? ORDER BY min_hours DESC').bind(comp.id).all()
    const tiers=(tierRows.results??[]).map(t=>({name:t.name,minHours:t.min_hours}))
    const rosterRows=await db.prepare(`SELECT m.id AS membership_id,m.display_name,
      COALESCE((SELECT SUM(hours) FROM volunteer_activities WHERE user_id=m.user_id AND status='approved' AND activity_date>=? AND activity_date<=?),0) AS hours
      FROM organization_members m WHERE m.organization_id=? AND m.status='approved'`).bind(comp.start_date,comp.end_date,organizationId).all()
    const participants=(rosterRows.results??[]).filter(r=>Number(r.hours||0)>0).map(r=>({membershipId:r.membership_id,label:publicLabel(r.display_name),hours:r.hours}))
    const standings=rankStandings(participants,tiers).slice(0,20)
    competitions.push({id:comp.id,name:comp.name,description:comp.description,startDate:comp.start_date,endDate:comp.end_date,tiers,standings})
  }
  return competitions
}
