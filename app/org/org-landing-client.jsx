'use client'
import { useEffect,useState } from 'react'
import { ArrowRight,CalendarDays,Clock3,HeartHandshake,LoaderCircle,MapPin,ShieldCheck,Star } from 'lucide-react'

// P2-01: gallery_json is a plain JSON array of /api/org-images URLs (see
// app/api/organizer/route.js) - degrades to an empty gallery on anything
// unexpected rather than crashing the public page.
const parseGallery=raw=>{if(!raw)return[];try{const parsed=JSON.parse(raw);return Array.isArray(parsed)?parsed.filter(url=>typeof url==='string'):[]}catch{return[]}}
const emptyState={loading:false,error:'',pending:false,organization:null,events:[],competitions:[],stats:null}

export default function OrgLandingClient({slug}){
  const [state,setState]=useState({...emptyState,loading:true})
  useEffect(()=>{
    if(!slug){setState({...emptyState,error:"This organization's page link looks incomplete."});return}
    fetch(`/api/org-profile?slug=${encodeURIComponent(slug)}`)
      .then(r=>r.json())
      .then(json=>setState(json.error?{...emptyState,error:json.error}:{...emptyState,pending:!!json.pending,organization:json.organization,events:json.events||[],competitions:json.competitions||[],stats:json.stats||null}))
      .catch(()=>setState({...emptyState,error:'Something went wrong loading this page.'}))
  },[slug])

  if(state.loading)return <main className="org-landing-loading"><LoaderCircle className="spin"/>Loading…</main>
  // P1-17: a pending org (found, but not yet approved by Niyyah) gets its
  // own message instead of the generic not-found one - the organizer's own
  // name is shown for context (they shared this exact link), but nothing
  // else about the organization is exposed, matching the API's own gate.
  if(state.pending)return <main className="org-landing-shell"><header className="org-landing-nav"><a href="/"><HeartHandshake size={16}/> Niyyah</a></header><section className="org-landing-notfound org-landing-pending"><span className="org-landing-pending-badge"><Clock3 size={13}/> Under review</span><h1>{state.organization?.name||'This organization'}&rsquo;s page isn&rsquo;t public yet</h1><p>Niyyah reviews every new organization before its page goes live. This usually doesn&rsquo;t take long &mdash; check back soon.</p><a className="primary" href="/">Explore Niyyah <ArrowRight size={16}/></a></section></main>
  if(state.error||!state.organization)return <main className="org-landing-shell"><header className="org-landing-nav"><a href="/"><HeartHandshake size={16}/> Niyyah</a></header><section className="org-landing-notfound"><h1>We couldn't find that page</h1><p>{state.error||'This organization link may have moved or is no longer active.'}</p><a className="primary" href="/">Explore Niyyah <ArrowRight size={16}/></a></section></main>

  const {organization,events,competitions,stats}=state,accent=organization.brand_color||'#174c3d'
  // P2-01: 'vibrant' is the default look (today's only one), so an
  // organization that never visits the Page design card renders exactly as
  // before. The other two presets only really come alive once a cover photo
  // is uploaded; until then they fall back to a themed gradient (see
  // .theme-warm/.theme-minimal in src/styles.css) rather than a blank block.
  const preset=organization.theme_preset||'vibrant'
  const gallery=organization.show_gallery!==0?parseGallery(organization.gallery_json):[]
  const hasStats=stats&&(stats.volunteers>0||stats.hours>0||stats.events>0)
  const showStats=organization.show_stats!==0&&hasStats
  const showLeaderboard=organization.show_leaderboard!==0&&competitions.length>0
  const coverStyle=organization.cover_photo_url?{backgroundImage:`url(${organization.cover_photo_url})`}:{}
  const logo=organization.logo_data_url?<img className="org-landing-logo" src={organization.logo_data_url} alt={`${organization.name} logo`}/>:<span className="org-landing-logo-fallback">{organization.name.slice(0,1).toUpperCase()}</span>
  const metaRow=<div className="org-landing-meta">
    {organization.website&&<a href={organization.website} target="_blank" rel="noreferrer">{organization.website.replace(/^https?:\/\//,'')}</a>}
    {organization.safeguarding_name&&<span><ShieldCheck size={13}/> Safety contact: {organization.safeguarding_name}</span>}
  </div>
  const statsBand=showStats&&<div className="org-landing-stats">
    <div><b>{stats.volunteers}</b><small>Volunteer{stats.volunteers===1?'':'s'}</small></div>
    <div><b>{stats.hours}</b><small>Hours logged</small></div>
    <div><b>{stats.events}</b><small>Event{stats.events===1?'':'s'} run</small></div>
  </div>

  return <main className="org-landing-shell" style={{'--org-accent':accent}}>
    <header className="org-landing-nav"><a href="/"><HeartHandshake size={16}/> Powered by Niyyah</a></header>

    {preset==='warm'&&<section className={`org-landing-hero theme-warm${organization.cover_photo_url?' has-cover':''}`} style={coverStyle}>
      <div className="org-landing-hero-inner">
        {logo}
        <h1>{organization.name}</h1>
        {organization.tagline&&<p className="org-landing-tagline">{organization.tagline}</p>}
        {metaRow}
      </div>
    </section>}

    {preset==='minimal'&&<section className="org-landing-hero theme-minimal">
      <div className="org-landing-hero-copy">
        {organization.organization_type&&<span className="org-landing-eyebrow">{organization.organization_type}</span>}
        <h1>{organization.name}</h1>
        {organization.tagline&&<p className="org-landing-tagline">{organization.tagline}</p>}
        <p className="org-landing-desc">{organization.description}</p>
        {metaRow}
      </div>
      <div className={`org-landing-hero-art${organization.cover_photo_url?' has-cover':''}`} style={coverStyle}>
        {logo}
        {hasStats&&<div className="org-landing-art-stat"><b>{stats.events}</b><small>event{stats.events===1?'':'s'} run</small></div>}
      </div>
    </section>}

    {preset==='vibrant'&&<section className={`org-landing-hero theme-vibrant${organization.cover_photo_url?' has-cover':''}`} style={coverStyle}>
      {logo}
      <h1>{organization.name}</h1>
      {organization.tagline&&<p className="org-landing-tagline">{organization.tagline}</p>}
      <p>{organization.description}</p>
      {metaRow}
      {statsBand}
    </section>}

    {preset!=='vibrant'&&statsBand&&<section className="org-landing-stats-section">{statsBand}</section>}

    {organization.mission_quote&&<section className="org-landing-quote"><blockquote><p>&ldquo;{organization.mission_quote}&rdquo;</p>{organization.mission_author&&<cite>&mdash; {organization.mission_author}</cite>}</blockquote></section>}

    {gallery.length>0&&<section className="org-landing-gallery"><div className="org-landing-gallery-grid">{gallery.map((url,i)=><img key={url} src={url} alt={`${organization.name} photo ${i+1}`}/>)}</div></section>}

    {showLeaderboard&&<section className="org-landing-leaderboard">
      <h2><Star size={20}/> Volunteering leaderboard</h2>
      {competitions.map(comp=><div key={comp.id} className="org-landing-competition">
        <div className="org-landing-competition-head"><h3>{comp.name}</h3><span>{comp.startDate} &ndash; {comp.endDate}</span></div>
        {comp.description&&<p>{comp.description}</p>}
        <div className="tier-badges">{comp.tiers.map(t=><span key={t.name} className="tier-badge">{t.name} &middot; {t.minHours}+ hrs</span>)}</div>
        {comp.standings.length?<ol className="standings-list">{comp.standings.map((s,i)=><li key={s.membershipId}><span><b>#{i+1}</b> {s.label}</span><span>{s.hours} hrs</span>{s.tier?<span className="tier-badge earned">{s.tier}</span>:<span className="tier-badge none">No tier yet</span>}</li>)}</ol>:<p className="org-landing-empty">No verified hours logged yet in this competition &mdash; check back soon.</p>}
      </div>)}
    </section>}
    <section className="org-landing-events">
      <h2>Upcoming with {organization.name}</h2>
      {events.length?<div className="org-landing-event-grid">{events.map(item=><article key={item.id} className="org-landing-event"><span className="org-landing-event-kind">{item.event_type==='volunteering'?'Volunteer task':'Community event'}</span><h3>{item.title}</h3><p>{item.summary}</p><span><CalendarDays size={13}/>{new Date(item.start_at).toLocaleString([],{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}</span><span><MapPin size={13}/>{item.location_name}</span><a className="org-landing-join" href="/opportunities">Sign up on Niyyah <ArrowRight size={13}/></a></article>)}</div>:<p className="org-landing-empty">No published events right now — check back soon.</p>}
    </section>
    <footer className="org-landing-footer">This page is built and hosted by <a href="/">Niyyah</a>, a platform connecting volunteers with local organizations.</footer>
  </main>
}
