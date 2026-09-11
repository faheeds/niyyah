import { getUser } from '../../auth.ts'
import { prepareCommunityTables } from '../../../db/index.js'
import { resolveOrganizationAccess } from '../../org-admins.js'
import { currentOccurrence } from '../../lib/recurrence.js'
import { moderationIssue } from '../../lib/content-filter.js'
import { sendApplicationStatusUpdate, sendNewOrgApprovalRequest } from '../../lib/notify.js'
import { ADMIN_EMAILS } from '../../admin-emails.js'
import { slugify } from '../../lib/org-slug.js'
import { rankStandings } from '../../lib/awards.js'
import { draftEvent } from '../../lib/ai-draft.js'
import { buildRankingReason } from '../../lib/ranking-reason.js'
import { parseDataUrlImage, extensionForMime, buildOrgImageKey } from '../../lib/org-image.js'
import { env } from 'cloudflare:workers'

const clean=(value,max=200)=>typeof value==='string'?value.trim().slice(0,max):''
const requiredOrganization=['name','organizationType','email','phone','address','postcode','description','safeguardingName','safeguardingEmail']
const THEME_PRESETS=['warm','minimal','vibrant']
// Owner and admin can edit events, applications, hour reviews and the email
// domain list; staff is limited to roster/hours approval (see the action
// gates in POST below). Admin management itself is owner-only.
const canManageOrg=role=>role==='owner'||role==='admin'
// P1-10: a stable slug for an organization's public landing page link
// (app/api/org-profile/route.js) - generated once from the org's name the
// first time it saves a profile, and never touched again afterward (see the
// saveOrganization action) so a link an organization has already shared
// never breaks, even if they rename later.
const nextAvailableSlug=async(db,desired)=>{
  let candidate=desired,suffix=2
  while(await db.prepare('SELECT 1 FROM organizations WHERE slug=?').bind(candidate).first()){
    candidate=`${desired}-${suffix}`; suffix+=1
  }
  return candidate
}
const HEX_COLOR=/^#[0-9a-f]{6}$/i

export async function GET(){
  const user=await getUser(); if(!user)return Response.json({error:'Sign in required.'},{status:401})
  const db=await prepareCommunityTables()
  const {organization,role}=await resolveOrganizationAccess(db,user.userId)
  if(!organization)return Response.json({organization:null,role:null,events:[],hours:[],applications:[],members:[],emailDomains:[],admins:[]})
  const [events,hours,applications,members,emailDomains,admins]=await Promise.all([
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
      WHERE a.organization_id=? ORDER BY CASE a.status WHEN 'new' THEN 0 ELSE 1 END,a.created_at DESC`).bind(organization.id).all(),
    db.prepare(`SELECT id,email,display_name,tag,status,source,created_at FROM organization_members WHERE organization_id=? ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END, created_at DESC`).bind(organization.id).all(),
    db.prepare('SELECT domain FROM organization_email_domains WHERE organization_id=? ORDER BY domain').bind(organization.id).all(),
    db.prepare(`SELECT id,email,display_name,role,status,invite_token,created_at FROM organization_admins WHERE organization_id=? ORDER BY CASE status WHEN 'invited' THEN 0 ELSE 1 END, created_at DESC`).bind(organization.id).all(),
  ])
  const ranked=(applications.results??[]).map(a=>{let score=45;const interests=(()=>{try{return JSON.parse(a.interests||'[]')}catch{return[]}})().map(x=>String(x).toLowerCase());const interestMatch=interests.some(x=>x.includes(String(a.event_interest||'').toLowerCase()));if(interestMatch)score+=25;const nearby=!!(a.volunteer_postcode&&String(a.volunteer_postcode).replace(/\s/g,'').slice(0,3).toLowerCase()===String(a.event_postcode).replace(/\s/g,'').slice(0,3).toLowerCase());if(nearby)score+=15;const hoursBonus=Math.min(15,Math.floor(Number(a.verified_hours||0)/5));score+=hoursBonus;return {...a,match_score:Math.min(100,score),ranking_reason:buildRankingReason({interestMatch,nearby,hoursBonus,eventInterest:a.event_interest})}}).sort((a,b)=>b.match_score-a.match_score||String(a.created_at).localeCompare(String(b.created_at)))
  // Only the owner can act on the admin roster (see the action gates in
  // POST below), so only the owner receives it - staff/admin never see
  // teammates' emails or a still-live invite token over the wire.
  // Keep start_at/end_at as the true anchor (editEvent in organizer-client.jsx
  // pre-fills the edit form from it - shifting it here would walk a weekly
  // event's date forward by a week on every save). Display/list logic gets
  // the current-or-next occurrence as separate next_start_at/next_end_at
  // fields instead - see P1-02 review feedback on PR for organizer-client.jsx
  // staleness in both the upcoming/past split and the event list label.
  const eventsWithOccurrence=(events.results??[]).map(e=>{const occ=currentOccurrence(e.start_at,e.end_at,e.recurrence);return {...e,next_start_at:occ.startAt,next_end_at:occ.endAt}})
  const competitions=await loadCompetitions(db,organization.id)
  return Response.json({organization,role,events:eventsWithOccurrence,hours:hours.results??[],applications:ranked,members:members.results??[],emailDomains:emailDomains.results??[],admins:role==='owner'?admins.results??[]:[],competitions})
}

// P1-09: each competition's standings are the org's approved roster, ranked
// by a person's total *verified* hours anywhere on Niyyah within the
// competition's date window (not only hours logged with this org) - see the
// backlog card for why. Small org rosters make the per-competition query
// here fine; revisit if an org's roster grows into the thousands.
async function loadCompetitions(db,organizationId){
  const rows=await db.prepare('SELECT * FROM award_competitions WHERE organization_id=? ORDER BY start_date DESC').bind(organizationId).all()
  const competitions=[]
  for(const comp of rows.results??[]){
    const tierRows=await db.prepare('SELECT name,min_hours FROM award_tiers WHERE competition_id=? ORDER BY min_hours DESC').bind(comp.id).all()
    const tiers=(tierRows.results??[]).map(t=>({name:t.name,minHours:t.min_hours}))
    const rosterRows=await db.prepare(`SELECT m.id AS membership_id,m.display_name,m.email,
      COALESCE((SELECT SUM(hours) FROM volunteer_activities WHERE user_id=m.user_id AND status='approved' AND activity_date>=? AND activity_date<=?),0) AS hours
      FROM organization_members m WHERE m.organization_id=? AND m.status='approved'`).bind(comp.start_date,comp.end_date,organizationId).all()
    const standings=rankStandings((rosterRows.results??[]).map(r=>({membershipId:r.membership_id,displayName:r.display_name,email:r.email,hours:r.hours})),tiers)
    competitions.push({...comp,tiers,standings})
  }
  return competitions
}

export async function POST(request){
  const user=await getUser(); if(!user)return Response.json({error:'Sign in required.'},{status:401})
  const body=await request.json(), action=clean(body.action,30), db=await prepareCommunityTables(), now=new Date().toISOString()
  const {organization:existingAccess,role}=await resolveOrganizationAccess(db,user.userId)
  let organization=existingAccess
  if(action==='saveOrganization'){
    // A brand-new organization (organization===null) can only be reached by
    // its future owner - staff/admin only ever exist tied to an org that
    // already has one. So the only real gate here is: an existing org's
    // settings are owner/admin, never staff.
    if(organization&&!canManageOrg(role))return Response.json({error:'Only an owner or admin can edit organization settings.'},{status:403})
    if(requiredOrganization.some(key=>!clean(body[key],key==='description'?800:160)))return Response.json({error:'Complete all required organization details.'},{status:400})
    const orgContentIssue=moderationIssue(body.name)||moderationIssue(body.description)||moderationIssue(body.safeguardingName)||moderationIssue(body.tagline)||moderationIssue(body.missionQuote)||moderationIssue(body.missionAuthor)
    if(orgContentIssue)return Response.json({error:orgContentIssue},{status:400})
    // P1-10: logo/brand color are optional and editable on every save.
    // logoDataUrl is a client-resized data: URL (see organizer-client.jsx) -
    // capped well under D1's row-size limit since it's the only large field
    // on this row. brandColor is a plain #rrggbb hex string.
    const logoDataUrl=typeof body.logoDataUrl==='string'?body.logoDataUrl:''
    if(logoDataUrl&&(!logoDataUrl.startsWith('data:image/')||logoDataUrl.length>350000))
      return Response.json({error:'Choose a smaller logo image.'},{status:400})
    const brandColor=clean(body.brandColor,7)
    if(brandColor&&!HEX_COLOR.test(brandColor))return Response.json({error:'Brand color must be a hex code like #174C3D.'},{status:400})
    // P2-01: page-design settings - a theme preset (defaults to 'vibrant',
    // today's only look, so existing organizations are unaffected until
    // they visit the new Page design card), an optional tagline/mission
    // quote, three show/hide toggles (default on), and the cover photo /
    // gallery URLs uploadOrgImage below already wrote to R2. Booleans arrive
    // as JSON true/false from organizer-client.jsx's toggle switches; only
    // an explicit false turns a section off, so older clients that don't
    // send these fields yet still default every toggle on.
    const themePreset=THEME_PRESETS.includes(body.themePreset)?body.themePreset:'vibrant'
    const tagline=clean(body.tagline,140)
    const missionQuote=clean(body.missionQuote,320)
    const missionAuthor=clean(body.missionAuthor,80)
    const showStats=body.showStats===false?0:1
    const showGallery=body.showGallery===false?0:1
    const showLeaderboard=body.showLeaderboard===false?0:1
    const coverPhotoUrl=clean(body.coverPhotoUrl,300)
    // Gallery is capped at 4 photos here - the authoritative enforcement
    // point - regardless of what the client sends, since uploadOrgImage
    // below is a pure upload action that never touches this row itself.
    const galleryUrls=Array.isArray(body.gallery)?body.gallery.filter(url=>typeof url==='string'&&url).slice(0,4):[]
    const galleryJson=galleryUrls.length?JSON.stringify(galleryUrls):null
    const id=organization?.id||crypto.randomUUID()
    // Edit stays tied to whoever actually created the organization, even
    // when an admin (not the owner) is the one saving the form.
    const ownerUserId=organization?.owner_user_id||user.userId
    const slug=organization?.slug||await nextAvailableSlug(db,slugify(body.name))
    await db.prepare(`INSERT INTO organizations (id,owner_user_id,name,organization_type,registration_number,email,phone,website,address,postcode,description,safeguarding_name,safeguarding_email,slug,logo_data_url,brand_color,theme_preset,tagline,mission_quote,mission_author,show_stats,show_gallery,show_leaderboard,cover_photo_url,gallery_json,status,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(owner_user_id) DO UPDATE SET name=excluded.name,organization_type=excluded.organization_type,registration_number=excluded.registration_number,email=excluded.email,phone=excluded.phone,website=excluded.website,address=excluded.address,postcode=excluded.postcode,description=excluded.description,safeguarding_name=excluded.safeguarding_name,safeguarding_email=excluded.safeguarding_email,logo_data_url=excluded.logo_data_url,brand_color=excluded.brand_color,theme_preset=excluded.theme_preset,tagline=excluded.tagline,mission_quote=excluded.mission_quote,mission_author=excluded.mission_author,show_stats=excluded.show_stats,show_gallery=excluded.show_gallery,show_leaderboard=excluded.show_leaderboard,cover_photo_url=excluded.cover_photo_url,gallery_json=excluded.gallery_json,updated_at=excluded.updated_at`)
      .bind(id,ownerUserId,clean(body.name,160),clean(body.organizationType,80),clean(body.registrationNumber,80)||null,clean(body.email,160),clean(body.phone,40),clean(body.website,200)||null,clean(body.address,240),clean(body.postcode,20),clean(body.description,800),clean(body.safeguardingName,120),clean(body.safeguardingEmail,160),slug,logoDataUrl||null,brandColor||null,themePreset,tagline||null,missionQuote||null,missionAuthor||null,showStats,showGallery,showLeaderboard,coverPhotoUrl||null,galleryJson,organization?.status||'pending',organization?.created_at||now,now).run()
    // P1-20: `organization` here is whatever resolveOrganizationAccess found
    // BEFORE this insert/upsert ran, so `!organization` means this call just
    // created the org row for the first time (as opposed to an existing
    // organization editing its own profile). Admins previously had no way to
    // know a new organization was waiting in their approve/reject queue
    // (app/api/admin-organizations/route.js) other than checking it
    // themselves - this tells every admin the moment one shows up.
    if(!organization)await sendNewOrgApprovalRequest({to:ADMIN_EMAILS,organizationName:clean(body.name,160),organizerEmail:user.email})
    return Response.json({ok:true,slug})
  }
  if(!organization)return Response.json({error:'Create your organization profile first.'},{status:403})
  if(['saveEvent','draftEvent','closeEvent','deleteEvent','reviewApplication','addEmailDomain','removeEmailDomain','saveCompetition','deleteCompetition','uploadOrgImage'].includes(action)&&!canManageOrg(role))
    return Response.json({error:'You do not have permission to do that.'},{status:403})
  if(['inviteAdmin','updateAdminRole','removeAdmin'].includes(action)&&role!=='owner')
    return Response.json({error:'Only the organization owner can manage admins.'},{status:403})
  // P2-01: uploads a cover photo or gallery photo to R2 and hands back the
  // URL app/api/org-images/route.js will serve it from - this action never
  // touches the organizations row itself (see saveOrganization above), the
  // client folds the returned URL into its normal Save like any other
  // field. Kept separate from saveOrganization because these are real
  // files, not JSON - unlike the logo, which is small enough to travel as a
  // base64 field on the same save.
  if(action==='uploadOrgImage'){
    const purpose=body.purpose==='gallery'?'gallery':body.purpose==='cover'?'cover':null
    if(!purpose)return Response.json({error:'Unknown photo type.'},{status:400})
    const parsed=parseDataUrlImage(body.dataUrl)
    if(!parsed)return Response.json({error:'Choose a valid image under 6MB.'},{status:400})
    const ext=extensionForMime(parsed.mime)
    if(!ext)return Response.json({error:'Please use a PNG, JPEG, WebP or GIF image.'},{status:400})
    const key=buildOrgImageKey(organization.id,purpose,ext,crypto.randomUUID())
    await env.ORG_IMAGES.put(key,parsed.bytes,{httpMetadata:{contentType:parsed.mime}})
    return Response.json({ok:true,url:`/api/org-images?key=${encodeURIComponent(key)}`})
  }
  if(action==='draftEvent'){
    // P2-02: pre-fills the client-side "Add an event" form from a sentence
    // the organizer types - never inserted into the database directly, so
    // this deliberately skips the fuller validation saveEvent below does
    // (no address/date checks needed here) but still runs the same
    // profanity check on the organizer's own free text before it's sent
    // anywhere external.
    const text=clean(body.text,500)
    if(!text)return Response.json({error:'Describe the event in a sentence first.'},{status:400})
    const textIssue=moderationIssue(text)
    if(textIssue)return Response.json({error:textIssue},{status:400})
    const result=await draftEvent(text)
    if(!result.ok){
      if(result.reason==='not_configured')return Response.json({error:'AI drafting is not set up yet - ask an admin to add the ANTHROPIC_API_KEY secret.'},{status:503})
      return Response.json({error:'Could not draft that right now - try rephrasing, or fill in the form by hand.'},{status:502})
    }
    return Response.json({ok:true,draft:result.draft})
  }
  if(action==='saveEvent'){
    const fields=['title','summary','interest','ageRange','locationName','address','postcode','startAt','endAt']
    const labels={title:'event name',summary:'description',interest:'interest',ageRange:'age range',locationName:'venue',address:'address',postcode:'zip code',startAt:'start date and time',endAt:'end date and time'},missing=fields.filter(key=>!clean(body[key],key==='summary'?600:200))
    if(missing.length)return Response.json({error:`Please complete: ${missing.map(key=>labels[key]).join(', ')}.`},{status:400})
    const eventContentIssue=moderationIssue(body.title)||moderationIssue(body.summary)
    if(eventContentIssue)return Response.json({error:eventContentIssue},{status:400})
    const datePattern=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/,startAt=clean(body.startAt,40).slice(0,16),endAt=clean(body.endAt,40).slice(0,16),start=new Date(startAt),end=new Date(endAt)
    if(!datePattern.test(startAt)||!datePattern.test(endAt)||Number.isNaN(start.getTime())||Number.isNaN(end.getTime()))return Response.json({error:'Choose a valid start and end date with a time.'},{status:400})
    if(end<=start)return Response.json({error:'The event must end after it starts.'},{status:400})
    const id=clean(body.id,80)||crypto.randomUUID(), existing=body.id?await db.prepare('SELECT id,created_at FROM organization_events WHERE id=? AND organization_id=?').bind(id,organization.id).first():null
    if(body.id&&!existing)return Response.json({error:'Event not found.'},{status:404})
    // Only 'weekly' is a supported recurrence today (see P1-02 / app/lib/recurrence.js) - anything else, including
    // absent, is a one-time event. Never trust an arbitrary client-supplied string into this column.
    const recurrence=body.recurrence==='weekly'?'weekly':null
    await db.prepare(`INSERT INTO organization_events (id,organization_id,title,summary,interest,age_range,location_name,address,postcode,start_at,end_at,capacity,event_type,status,recurrence,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,summary=excluded.summary,interest=excluded.interest,age_range=excluded.age_range,location_name=excluded.location_name,address=excluded.address,postcode=excluded.postcode,start_at=excluded.start_at,end_at=excluded.end_at,capacity=excluded.capacity,event_type=excluded.event_type,status=excluded.status,recurrence=excluded.recurrence,updated_at=excluded.updated_at`)
      .bind(id,organization.id,clean(body.title,160),clean(body.summary,600),clean(body.interest,80),clean(body.ageRange,60),clean(body.locationName,160),clean(body.address,240),clean(body.postcode,20),startAt,endAt,body.capacity?Math.max(1,Math.min(10000,Number(body.capacity))):null,clean(body.eventType,30)||'community',['draft','published'].includes(body.status)?body.status:'draft',recurrence,existing?.created_at||now,now).run()
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
  if(action==='saveCompetition'){
    const name=clean(body.name,160)
    if(!name)return Response.json({error:'Give the competition a name.'},{status:400})
    const compContentIssue=moderationIssue(body.name)||moderationIssue(body.description)
    if(compContentIssue)return Response.json({error:compContentIssue},{status:400})
    const datePattern=/^\d{4}-\d{2}-\d{2}$/,startDate=clean(body.startDate,10),endDate=clean(body.endDate,10)
    if(!datePattern.test(startDate)||!datePattern.test(endDate))return Response.json({error:'Choose a valid start and end date.'},{status:400})
    if(endDate<startDate)return Response.json({error:'The competition must end on or after it starts.'},{status:400})
    const tiers=(Array.isArray(body.tiers)?body.tiers:[]).map(t=>({name:clean(t?.name,60),minHours:Math.max(1,Math.min(100000,Math.round(Number(t?.minHours))||0))})).filter(t=>t.name&&t.minHours>0)
    if(!tiers.length)return Response.json({error:'Add at least one award tier with a name and hour threshold.'},{status:400})
    const id=clean(body.id,80)||crypto.randomUUID(), existing=body.id?await db.prepare('SELECT id,created_at FROM award_competitions WHERE id=? AND organization_id=?').bind(id,organization.id).first():null
    if(body.id&&!existing)return Response.json({error:'Competition not found.'},{status:404})
    await db.prepare(`INSERT INTO award_competitions (id,organization_id,name,description,start_date,end_date,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET name=excluded.name,description=excluded.description,start_date=excluded.start_date,end_date=excluded.end_date,updated_at=excluded.updated_at`)
      .bind(id,organization.id,name,clean(body.description,600)||null,startDate,endDate,existing?.created_at||now,now).run()
    // Tiers are small in number and fully replaced on every save (no partial
    // tier edits from the UI), so drop-and-reinsert is simpler than diffing.
    await db.prepare('DELETE FROM award_tiers WHERE competition_id=?').bind(id).run()
    for(const [index,t] of tiers.entries())await db.prepare('INSERT INTO award_tiers (id,competition_id,name,min_hours,sort_order,created_at) VALUES (?,?,?,?,?,?)').bind(crypto.randomUUID(),id,t.name,t.minHours,index,now).run()
    return Response.json({ok:true})
  }
  if(action==='deleteCompetition'){
    const id=clean(body.id,80)
    // Scope to this org before touching award_tiers - without this check a
    // caller could pass another organization's competition id and wipe its
    // tiers even though the award_competitions row itself stays protected
    // by the AND organization_id=? below (caught in review).
    const owned=await db.prepare('SELECT id FROM award_competitions WHERE id=? AND organization_id=?').bind(id,organization.id).first()
    if(!owned)return Response.json({error:'Competition not found.'},{status:404})
    await db.prepare('DELETE FROM award_tiers WHERE competition_id=?').bind(id).run()
    await db.prepare('DELETE FROM award_competitions WHERE id=? AND organization_id=?').bind(id,organization.id).run()
    return Response.json({ok:true})
  }
  if(action==='reviewHours'){
    // P0-01: an org that isn't approved yet shouldn't be able to verify hours -
    // those hours feed volunteers' verified totals, levels and badges.
    if(organization.status!=='approved')return Response.json({error:'Your organization must be approved before you can review volunteer hours.'},{status:403})
    const status=body.status==='approved'?'approved':body.status==='rejected'?'rejected':null
    if(!status)return Response.json({error:'Invalid review decision.'},{status:400})
    const mapped=await db.prepare('SELECT activity_id FROM volunteer_activity_organizations WHERE activity_id=? AND organization_id=?').bind(clean(body.activityId,80),organization.id).first()
    if(!mapped)return Response.json({error:'Hours request not found.'},{status:404})
    await db.prepare('UPDATE volunteer_activities SET status=? WHERE id=?').bind(status,mapped.activity_id).run(); return Response.json({ok:true})
  }
  if(action==='reviewApplication'){
    const status=['shortlisted','accepted','declined'].includes(body.status)?body.status:null;if(!status)return Response.json({error:'Invalid application status.'},{status:400})
    const applicationId=clean(body.applicationId,80)
    const application=await db.prepare('SELECT a.applicant_email,a.applicant_name,e.title AS event_title FROM volunteer_applications a JOIN organization_events e ON e.id=a.event_id WHERE a.id=? AND a.organization_id=?').bind(applicationId,organization.id).first()
    await db.prepare('UPDATE volunteer_applications SET status=?,updated_at=? WHERE id=? AND organization_id=?').bind(status,now,applicationId,organization.id).run()
    // See P1-01 - only 'accepted'/'declined' actually notify (sendApplicationStatusUpdate no-ops for 'shortlisted').
    if(application)await sendApplicationStatusUpdate({to:application.applicant_email,name:application.applicant_name,eventTitle:application.event_title,organizationName:organization.name,status})
    return Response.json({ok:true})
  }
  if(action==='addEmailDomain'){
    const domain=clean(body.domain,120).toLowerCase()
    if(!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(domain))return Response.json({error:'Enter a valid domain, like medinaacademy.org.'},{status:400})
    await db.prepare('INSERT INTO organization_email_domains (id,organization_id,domain,created_at) VALUES (?,?,?,?) ON CONFLICT(organization_id,domain) DO NOTHING').bind(crypto.randomUUID(),organization.id,domain,now).run()
    return Response.json({ok:true})
  }
  if(action==='removeEmailDomain'){
    await db.prepare('DELETE FROM organization_email_domains WHERE organization_id=? AND domain=?').bind(organization.id,clean(body.domain,120).toLowerCase()).run()
    return Response.json({ok:true})
  }
  if(action==='approveMember'){
    await db.prepare("UPDATE organization_members SET status='approved',updated_at=? WHERE id=? AND organization_id=?").bind(now,clean(body.membershipId,80),organization.id).run()
    return Response.json({ok:true})
  }
  if(action==='removeMember'){
    const membershipId=clean(body.membershipId,80)
    const member=await db.prepare('SELECT source FROM organization_members WHERE id=? AND organization_id=?').bind(membershipId,organization.id).first()
    if(member?.source==='school_email'){
      // Auto-enrollment re-runs on every sign-in and ON CONFLICT DO NOTHING
      // only skips rows that still exist, so a hard delete here would let
      // the student silently reappear, approved, on their next sign-in.
      await db.prepare("UPDATE organization_members SET status='removed',updated_at=? WHERE id=? AND organization_id=?").bind(now,membershipId,organization.id).run()
    }else{
      await db.prepare('DELETE FROM organization_members WHERE id=? AND organization_id=?').bind(membershipId,organization.id).run()
    }
    return Response.json({ok:true})
  }
  if(action==='inviteAdmin'){
    const email=clean(body.email,160).toLowerCase()
    if(!/^\S+@\S+\.\S+$/.test(email))return Response.json({error:'Enter a valid email address.'},{status:400})
    if(email===String(user.email||'').toLowerCase())return Response.json({error:"You're already the owner."},{status:400})
    const inviteRole=body.role==='admin'?'admin':'staff'
    // Whoever holds this link claims the seat (see acceptAdminInvite in
    // app/org-admins.js) - the email above is only a label for this list
    // until then, never itself a grant of access.
    const inviteToken=Array.from(crypto.getRandomValues(new Uint8Array(24))).map(b=>b.toString(16).padStart(2,'0')).join('')
    await db.prepare(`INSERT INTO organization_admins (id,organization_id,user_id,email,display_name,role,status,invite_token,invited_by_user_id,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(organization_id,email) DO UPDATE SET role=excluded.role,updated_at=excluded.updated_at,
      invite_token=CASE WHEN organization_admins.status='invited' THEN excluded.invite_token ELSE organization_admins.invite_token END`)
      .bind(crypto.randomUUID(),organization.id,null,email,clean(body.displayName,120)||null,inviteRole,'invited',inviteToken,user.userId,now,now).run()
    const current=await db.prepare('SELECT invite_token,status FROM organization_admins WHERE organization_id=? AND email=?').bind(organization.id,email).first()
    const origin=new URL(request.url).origin
    return Response.json({ok:true,inviteUrl:current?.status==='invited'&&current.invite_token?`${origin}/organizer/accept-invite?token=${current.invite_token}`:null})
  }
  if(action==='updateAdminRole'){
    const newRole=body.role==='admin'?'admin':'staff'
    await db.prepare("UPDATE organization_admins SET role=?,updated_at=? WHERE id=? AND organization_id=?").bind(newRole,now,clean(body.adminId,80),organization.id).run()
    return Response.json({ok:true})
  }
  if(action==='removeAdmin'){
    await db.prepare('DELETE FROM organization_admins WHERE id=? AND organization_id=?').bind(clean(body.adminId,80),organization.id).run()
    return Response.json({ok:true})
  }
  return Response.json({error:'Unknown action.'},{status:400})
}
