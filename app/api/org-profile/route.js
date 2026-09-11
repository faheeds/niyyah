import { prepareCommunityTables } from '../../../db/index.js'
import { currentOccurrence } from '../../lib/recurrence.js'

// P1-10: an organization's own branded landing page. Public and unauthenticated,
// same as app/api/events/route.js — only approved organizations are
// discoverable this way (see P0-01), matching the events feed's own rule.
export async function GET(request){
  const {searchParams}=new URL(request.url)
  const slug=String(searchParams.get('slug')||'').trim(),id=String(searchParams.get('id')||'').trim()
  if(!slug&&!id)return Response.json({error:'Missing organization.'},{status:400})
  const db=await prepareCommunityTables()
  const organization=slug
    ? await db.prepare("SELECT id,name,description,website,logo_data_url,brand_color,safeguarding_name,safeguarding_email,slug FROM organizations WHERE slug=? AND status='approved'").bind(slug).first()
    : await db.prepare("SELECT id,name,description,website,logo_data_url,brand_color,safeguarding_name,safeguarding_email,slug FROM organizations WHERE id=? AND status='approved'").bind(id).first()
  if(!organization)return Response.json({error:'Organization not found.'},{status:404})
  const events=await db.prepare(`SELECT e.*,v.compensation_type,v.pay_details FROM organization_events e
    LEFT JOIN volunteer_opportunities v ON v.event_id=e.id
    WHERE e.organization_id=? AND e.status='published' ORDER BY e.start_at ASC LIMIT 40`).bind(organization.id).all()
  const occurrenced=(events.results??[]).map(e=>{const occ=currentOccurrence(e.start_at,e.end_at,e.recurrence);return {...e,start_at:occ.startAt,end_at:occ.endAt}}).sort((a,b)=>String(a.start_at).localeCompare(String(b.start_at)))
  return Response.json({organization,events:occurrenced})
}
