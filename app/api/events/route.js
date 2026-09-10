import { prepareCommunityTables } from '../../../db/index.js'
import { currentOccurrence } from '../../lib/recurrence.js'

export async function GET(){
  const db=await prepareCommunityTables()
  // Only show events from organizations Niyyah has approved (see P0-01) — a
  // brand-new "pending" organization's events must not be publicly discoverable.
  const events=await db.prepare(`SELECT e.*, o.name AS organization_name, v.compensation_type, v.pay_details FROM organization_events e JOIN organizations o ON o.id=e.organization_id LEFT JOIN volunteer_opportunities v ON v.event_id=e.id WHERE e.status='published' AND o.status='approved' ORDER BY e.start_at ASC LIMIT 40`).all()
  // Weekly events store only their first occurrence (see P1-02) — shift to
  // whichever occurrence is current/next so this never surfaces a stale date,
  // then re-sort: the SQL ORDER BY above was over the unshifted anchor dates,
  // so a long-past-anchored weekly event would otherwise keep an early slot
  // in the LIMIT 40 despite its real (shifted) date sorting much later.
  const occurrenced=(events.results??[]).map(e=>{const occ=currentOccurrence(e.start_at,e.end_at,e.recurrence);return {...e,start_at:occ.startAt,end_at:occ.endAt}}).sort((a,b)=>String(a.start_at).localeCompare(String(b.start_at)))
  return Response.json({events:occurrenced})
}
