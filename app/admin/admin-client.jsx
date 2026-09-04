'use client'
import { useEffect,useState } from 'react'
import { ArrowLeft,Ban,Building2,Check,HeartHandshake,LoaderCircle,Mail,Phone,ShieldCheck } from 'lucide-react'

export default function AdminClient({user}){
  const [data,setData]=useState(null),[busy,setBusy]=useState(''),[notice,setNotice]=useState('')
  const load=async()=>{const r=await fetch('/api/admin-organizations'),json=await r.json();setData(json)}
  useEffect(()=>{load()},[])
  const decide=async(organizationId,decision)=>{setBusy(organizationId);setNotice('');const r=await fetch('/api/admin-organizations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({organizationId,decision})}),json=await r.json();setBusy('');if(!r.ok){setNotice(json.error||'We could not save that.');return}await load()}
  if(!data)return <main className="member-loading"><LoaderCircle className="spin"/>Opening the admin review queue…</main>
  if(data.error)return <main className="member-loading">{data.error}</main>
  const pending=data.organizations.filter(o=>o.status==='pending'),reviewed=data.organizations.filter(o=>o.status!=='pending')
  return <main className="member-shell organizer-shell">
    <header className="member-nav"><a className="brand" href="/"><span className="brand-mark"><HeartHandshake size={21}/></span><span><b>Niyyah</b><small>Admin review</small></span></a><a className="back-home" href="/"><ArrowLeft size={16}/> Public site</a>{user&&<small className="admin-signed-in-as">Signed in as {user.displayName||user.email}</small>}<a className="signout-link" href="/api/auth/signout?return_to=/">Sign out</a></header>
    {notice&&<div className="member-notice">{notice}</div>}
    <section className="member-card wide hours-queue">
      <div className="card-title"><span><ShieldCheck size={15}/></span><div><h2>Organizations waiting for approval</h2><p>Nobody's events show up for volunteers to join until you approve their organization here.</p></div></div>
      {pending.length?pending.map(org=><article key={org.id}>
        <div className="mini-avatar">{(org.name||'?').slice(0,1).toUpperCase()}</div>
        <div><h3>{org.name}</h3><p>{org.organization_type} · {org.postcode}</p><span><Mail size={11}/> {org.email} · <Phone size={11}/> {org.phone}</span><small>{org.description}</small></div>
        <div className="review-actions">
          <button disabled={busy===org.id} onClick={()=>decide(org.id,'rejected')}><Ban size={13}/> Reject</button>
          <button disabled={busy===org.id} onClick={()=>decide(org.id,'approved')}>{busy===org.id?<LoaderCircle className="spin" size={13}/>:<Check size={13}/>} Approve</button>
        </div>
      </article>):<p className="empty-copy">No organizations are waiting right now.</p>}
    </section>
    <section className="member-card wide event-manager">
      <div className="card-title"><span><Building2 size={15}/></span><div><h2>Already reviewed</h2><p>Every organization that's been approved or rejected so far.</p></div></div>
      {reviewed.length?reviewed.map(org=><article key={org.id}><div><h3>{org.name}</h3><p>{org.organization_type} · {org.postcode}</p></div><span className={`org-status ${org.status}`}>{org.status}</span></article>):<p className="empty-copy">Nothing reviewed yet.</p>}
    </section>
  </main>
}
