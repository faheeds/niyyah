import { prepareCommunityTables } from '../../../db/index.js'

export async function GET(){
  const db=await prepareCommunityTables()
  // Only show events from organizations Niyyah has approved (see P0-01) — a
  // brand-new "pending" organization's events must not be publicly discoverable.
  const events=await db.prepare(`SELECT e.*, o.name AS organization_name, v.compensation_type, v.pay_details FROM organization_events e JOIN organizations o ON o.id=e.organization_id LEFT JOIN volunteer_opportunities v ON v.event_id=e.id WHERE e.status='published' AND o.status='approved' ORDER BY e.start_at ASC LIMIT 40`).all()
  return Response.json({events:events.results??[]})
}
