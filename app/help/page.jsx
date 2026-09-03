import { ArrowLeft,Building2,CircleHelp,HeartHandshake,Mail,ShieldCheck,Users } from 'lucide-react'
import '../../src/styles.css'

const topics=[
  {icon:<Users/>,title:'For volunteers',copy:'Create your profile, choose interests, discover matched events and select a date and time before signing up.'},
  {icon:<Building2/>,title:'For organizers',copy:'Create an organization profile, publish opportunities, manage applicants and approve verified volunteer hours.'},
  {icon:<ShieldCheck/>,title:'Safety and privacy',copy:'You control profile discovery and activity sharing. Organizations receive contact details only through the applicant workflow.'},
]
export default function HelpPage(){return <main className="help-shell"><header className="signup-nav"><a className="brand" href="/"><span className="brand-mark"><HeartHandshake size={21}/></span><span><b>Niyyah</b><small>Help center</small></span></a><a className="back-home" href="/"><ArrowLeft size={16}/> Back home</a></header><section className="help-hero"><span className="signup-kicker"><CircleHelp size={14}/> Niyyah help</span><h1>How can we help?</h1><p>Choose your journey, learn how the platform works, or get support with an account or event.</p><a className="primary" href="/join">Login or sign up</a></section><div className="help-grid">{topics.map(item=><article key={item.title}><span>{item.icon}</span><h2>{item.title}</h2><p>{item.copy}</p></article>)}</div><section className="help-contact"><Mail/><div><h2>Need more help?</h2><p>Use the public contact information provided by the organization running an event, or return to your profile to review your registrations.</p></div><a href="/profile">Open my profile</a></section></main>}
