import { ArrowLeft,ArrowRight,HeartHandshake,LogIn,Sparkles,UserPlus,Users } from 'lucide-react'
import '../../src/styles.css'

export default async function VolunteerAccess({ searchParams }) {
  const params = (await searchParams) || {}
  const eventId = typeof params.event === 'string' ? params.event : ''
  const returnTo = eventId ? `/opportunities?join=${encodeURIComponent(eventId)}` : '/profile'
  const loginHref = `/signin-with-chatgpt?return_to=${encodeURIComponent(returnTo)}`
  const signupHref = eventId ? `/signup?event=${encodeURIComponent(eventId)}` : '/signup'
  const destinationCopy = eventId ? 'Both paths take you straight back to the opportunity you picked.' : 'Both paths finish at your volunteer profile.'
  return <main className="access-shell"><header className="signup-nav"><a className="brand" href="/"><span className="brand-mark"><HeartHandshake size={21}/></span><span><b>Niyyah</b><small>Volunteer access</small></span></a><a className="back-home" href={eventId?`/join?event=${encodeURIComponent(eventId)}`:'/join'}><ArrowLeft size={16}/> Change journey</a></header><section className="access-card"><span className="join-path-icon"><Users/></span><span className="signup-kicker"><Sparkles size={14}/> Volunteer journey</span><h1>Welcome, volunteer.</h1><p>Log in to return to your profile, or create an account to start matching with opportunities. {destinationCopy}</p><div className="access-actions"><a className="primary" href={loginHref} target="_top"><LogIn size={17}/> Volunteer login</a><a className="secondary-action" href={signupHref}><UserPlus size={17}/> Volunteer sign up <ArrowRight size={15}/></a></div><small>{eventId?'After login or signup, you’ll go straight back to that opportunity.':'After login or signup, you’ll go directly to your volunteer profile.'}</small></section></main>
}
