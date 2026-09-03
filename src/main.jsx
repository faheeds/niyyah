'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { ArrowRight, CalendarDays, Check, ChevronRight, Clock3, HeartHandshake, MapPin, Menu, Sparkles, X } from 'lucide-react'
import './styles.css'

const opportunities = [
  {
    id: 'icob-halaqa', letter: 'H', eyebrow: 'Learn and grow together', title: 'Essentials of Islam Halaqa', place: 'Islamic Center of Bothell', category: 'Faith', distance: 'Bothell', date: 'Every Thursday', tone: 'gold', url: 'https://bothellmosque.org/calendar/',
  },
  {
    id: 'icob-family-night', letter: 'F', eyebrow: 'Faith, friendship and family', title: 'Friday Family Night', place: 'Islamic Center of Bothell', category: 'Social', distance: 'Bothell', date: 'Every Friday', tone: 'mint', ageRange: 'Kids 6–12', url: 'https://bothellmosque.org/calendar/',
  },
  {
    id: 'icoe-open-house', letter: 'O', eyebrow: 'Meet your Muslim neighbours', title: 'Community Open House', place: 'Islamic Center of Eastside', category: 'Social', distance: 'Bellevue', date: 'Every Sunday', tone: 'cream', url: 'https://eastsidemosque.com/page.php?page_id=11',
  },
  {
    id: 'icoe-food-pantry', letter: 'P', eyebrow: 'Help local families in need', title: 'Food Pantry Donations', place: 'Islamic Center of Eastside', category: 'Service', distance: 'Bellevue', date: 'Every Friday', tone: 'gold', url: 'https://www.eastsidemosque.com/',
  },
  {
    id: 'ics-volunteer', letter: 'V', eyebrow: 'Give your time and skills', title: 'Masjid Volunteer Team', place: 'Islamic Center of Seattle', category: 'Service', distance: 'SeaTac', date: 'Ongoing', tone: 'mint', url: 'https://www.assalammasjid.com/index.php/volunteer',
  },
  {
    id: 'maps-youth', letter: 'Y', eyebrow: 'Lead, serve and build community', title: 'MAPS Youth', place: 'Muslim Association of Puget Sound', category: 'Youth', distance: 'Redmond', date: 'Ongoing', tone: 'cream', ageRange: 'Ages 13–18', url: 'https://mapsredmond.org/maps-youth-2/',
  },
]

function App() {
  const [eventList,setEventList]=useState(opportunities)
  const [selected, setSelected] = useState(opportunities[0])
  const [joined, setJoined] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [filter, setFilter] = useState('All')

  useEffect(()=>{fetch('/api/events').then(r=>r.json()).then(({events})=>{if(events?.length){const localEvents=events.map((item,index)=>({id:item.id,letter:item.title.slice(0,1).toUpperCase(),eyebrow:item.summary,title:item.title,place:item.location_name,category:item.interest,distance:item.postcode,date:new Date(item.start_at).toLocaleString([],{weekday:'short',hour:'2-digit',minute:'2-digit'}),tone:['gold','mint','cream'][index%3],ageRange:item.age_range,eventType:item.event_type,compensation:item.compensation_type,payDetails:item.pay_details}));setEventList([...localEvents,...opportunities]);setSelected(localEvents[0])}}).catch(()=>{})},[])
  const visible = useMemo(() => filter === 'All' ? eventList : eventList.filter((item) => item.category === filter), [filter,eventList])
  const filters=useMemo(()=>['All',...new Set(eventList.map(item=>item.category))],[eventList])

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
    setMenuOpen(false)
  }

  const chooseEvent = (item) => {
    setSelected(item)
    setJoined(false)
  }
  const joinSelected=async()=>{if(selected.url){window.open(selected.url,'_blank','noopener,noreferrer');return}const continueUrl=`/join?event=${encodeURIComponent(selected.id)}`;if(selected.eventType!=='volunteering'){location.href=continueUrl;return}const r=await fetch('/api/applications',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({eventId:selected.id})});if(r.status===401){location.href=continueUrl;return}if(r.ok)setJoined(true)}

  return (
      <main>
      <header className="nav shell" aria-label="Main navigation">
        <a className="brand" href="#top" aria-label="Niyyah home">
          <span className="brand-mark"><HeartHandshake size={21} /></span>
          <span><b>Niyyah</b><small>Purpose meets people</small></span>
        </a>
        <nav className={menuOpen ? 'nav-links open' : 'nav-links'}>
          <a href="/profile">Volunteers</a>
          <a href="/help">Help</a>
          <a href="/join" className="nav-login">Login / Sign Up</a>
        </nav>
        <a className="join-top" href="/join"><Sparkles size={16} /> Login / Sign Up</a>
        <button className="menu-button" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle navigation" aria-expanded={menuOpen}>{menuOpen ? <X /> : <Menu />}</button>
      </header>

      <section className="hero shell" id="top">
        <div className="hero-copy">
          <div className="eyebrow-pill"><span /> People ready to help. Organizations ready to act.</div>
          <h1>Good intentions. <em>Real impact.</em> One place to start.</h1>
          <div className="hero-actions">
            <a className="primary" href="/join">Find your path <ArrowRight size={18} /></a>
          </div>
          <p className="intro">Niyyah connects people who want to contribute with nonprofit organizations that need their time, skills and energy—making it easier to discover opportunities, take part and build a verified record of impact.</p>
          <div className="neighbours">
            <div className="faces"><span>AK</span><span>MR</span><span>SA</span><span>YI</span></div>
            <div><b>146 neighbours</b><small>are finding their next thing</small></div>
          </div>
        </div>

        <div className="discovery" id="opportunities">
          <div className="picker">
            <div className="picker-heading"><div><span className="kicker">Across Greater Seattle</span><h2>Pick your next thing</h2></div><span className="nearby">{visible.length} curated</span></div>
            <div className="filters" aria-label="Filter opportunities">
              {filters.map((item) => <button key={item} className={filter === item ? 'active' : ''} onClick={() => setFilter(item)}>{item}</button>)}
            </div>
            <div className="cards">
              {visible.map((item) => (
                <button key={item.id} className={`event-card ${selected.id === item.id ? 'selected' : ''}`} onClick={() => chooseEvent(item)} aria-pressed={selected.id === item.id}>
                  <span className={`letter ${item.tone}`}>{item.letter}</span>
                  <span className="event-copy"><small>{item.eyebrow}</small><b>{item.title}</b><span>{item.place}{item.ageRange?` · ${item.ageRange}`:''}{item.compensation?` · ${item.compensation==='paid'?item.payDetails||'Paid':'Unpaid'}`:''}</span></span>
                  <ChevronRight size={19} />
                </button>
              ))}
            </div>
            <div className="selection">
              <div><small>Your pick</small><b>{selected.title}</b><span><MapPin size={13} /> {selected.distance} <CalendarDays size={13} /> {selected.date}</span></div>
              <button className={joined ? 'confirmed' : ''} onClick={joinSelected}>{joined ? <><Check size={16} /> You’re on the list</> : <>{selected.url?'View official details':selected.eventType==='volunteering'?'Sign up':'I’m interested'} <ArrowRight size={16} /></>}</button>
            </div>
          </div>
          <div className="discovery-footer"><span><MapPin size={16} /> Curated around <b>Greater Seattle</b></span><span><CalendarDays size={15} /> Recurring &amp; upcoming</span></div>
        </div>
      </section>

      <footer className="shell"><span>Built for the ones who want to be part of something.</span><span><Clock3 size={15} /> No endless feed. Just the next good thing.</span><span>NYH / 001</span></footer>
      </main>
  )
}

export default App
