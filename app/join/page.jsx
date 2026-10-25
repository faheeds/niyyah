'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft, Building2, HeartHandshake, LogIn, Sparkles, UserPlus, Users } from 'lucide-react'
import '../../src/styles.css'

export default function JoinPage() {
  const [role, setRole] = useState('volunteer')
  const [eventId, setEventId] = useState('')
  const [emailOpen, setEmailOpen] = useState(false)

  useEffect(() => {
    const search = new URLSearchParams(window.location.search)
    const event = search.get('event') || ''
    if (event) setEventId(event)
    if (search.get('role') === 'organizer') setRole('organizer')
  }, [])

  const isVolunteer = role === 'volunteer'
  const returnTo = isVolunteer ? (eventId ? `/opportunities?join=${encodeURIComponent(eventId)}` : '/profile') : '/organizer'
  const googleHref = `/api/auth/google?return_to=${encodeURIComponent(returnTo)}`
  const emailLoginHref = `/signin?return_to=${encodeURIComponent(returnTo)}`
  const signupHref = isVolunteer
    ? (eventId ? `/signup?event=${encodeURIComponent(eventId)}` : '/signup')
    : `/signin?mode=signup&return_to=${encodeURIComponent(returnTo)}`
  const destinationCopy = isVolunteer
    ? (eventId ? 'After signing in, you’ll go straight back to the opportunity you picked.' : 'After signing in, you’ll go directly to your volunteer profile.')
    : 'After signing in, you’ll land in the organizer workspace.'

  return <main className="join-shell">
    <header className="signup-nav">
      <a className="brand" href="/"><span className="brand-mark"><HeartHandshake size={21} /></span><span><b>Niyyah</b><small>Purpose meets people</small></span></a>
      <a className="back-home" href="/"><ArrowLeft size={16} /> Back home</a>
    </header>

    <section className="access-card">
      <span className="join-path-icon">{isVolunteer ? <Users /> : <Building2 />}</span>
      <span className="signup-kicker"><Sparkles size={14} /> Login or sign up</span>
      <h1>Welcome to Niyyah.</h1>
      <p>{isVolunteer
        ? 'Discover matched opportunities, join events and build a verified record of impact.'
        : 'Publish events, manage volunteer requests and approve verified hours.'}{eventId && isVolunteer ? ' We’ll take you back to the opportunity you picked once you’re signed in.' : ''}</p>

      <div className="role-toggle" role="group" aria-label="Choose your journey">
        <button type="button" className={isVolunteer ? 'active' : ''} aria-pressed={isVolunteer} onClick={() => setRole('volunteer')}><Users size={14} /> Volunteer</button>
        <button type="button" className={!isVolunteer ? 'active' : ''} aria-pressed={!isVolunteer} onClick={() => setRole('organizer')}><Building2 size={14} /> Organizer</button>
      </div>

      <a className="signin-google" href={googleHref}>
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
          <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
          <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.85.86-3.04.86-2.34 0-4.32-1.58-5.03-3.71H.96v2.33A9 9 0 0 0 9 18z" />
          <path fill="#FBBC05" d="M3.97 10.71a5.4 5.4 0 0 1 0-3.42V4.96H.96a9 9 0 0 0 0 8.08l3.01-2.33z" />
          <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.96l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
        </svg>
        Continue with Google
      </a>

      <div className="signin-divider"><span>or</span></div>

      {!emailOpen
        ? <button type="button" className="secondary-action email-reveal" onClick={() => setEmailOpen(true)}>Continue with email</button>
        : <div className="access-actions">
          <a className="secondary-action" href={emailLoginHref}><LogIn size={15} /> Log in</a>
          <a className="secondary-action" href={signupHref}><UserPlus size={15} /> Sign up</a>
        </div>}

      <small>{destinationCopy}</small>
    </section>
  </main>
}
