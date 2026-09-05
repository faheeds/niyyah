'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, HeartHandshake, LoaderCircle, LockKeyhole, Sparkles } from 'lucide-react'

const interestOptions = ['Faith & learning', 'Community meals', 'Volunteering', 'Creative projects', 'Sports & wellbeing', 'Careers & ideas']

const initialForm = {
  firstName: '', lastName: '', email: '', password: '', phone: '', ageGroup: '', postcode: '',
  preferredContact: 'Email', heardAboutUs: '', instagram: '', tiktok: '', otherSocial: '',
  interests: [], consent: false, updatesOptIn: false, referralCode: '',
}

export default function SignupPage() {
  const [form, setForm] = useState(initialForm)
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [eventId, setEventId] = useState('')
  const [alreadyRegistered, setAlreadyRegistered] = useState(false)
  useEffect(()=>{const search=new URLSearchParams(window.location.search);const code=search.get('ref')||'';if(code)setForm(current=>({...current,referralCode:code}));const event=search.get('event')||'';if(event)setEventId(event)},[])

  const update = (event) => {
    const { name, value, type, checked } = event.target
    setForm((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }))
  }

  const toggleInterest = (interest) => {
    setForm((current) => ({
      ...current,
      interests: current.interests.includes(interest) ? current.interests.filter((item) => item !== interest) : [...current.interests, interest],
    }))
  }

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    if (form.interests.length === 0) {
      setError('Choose at least one thing you are interested in.')
      return
    }
    setStatus('submitting')
    try {
      const response = await fetch('/api/signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Please try again.')
      setAlreadyRegistered(!!result.alreadyRegistered)
      setStatus('success')
    } catch (submissionError) {
      setError(submissionError.message)
      setStatus('idle')
    }
  }

  if (status === 'success') {
    const destination = eventId ? `/opportunities?join=${encodeURIComponent(eventId)}` : '/profile'
    const continueHref = alreadyRegistered ? `/signin?return_to=${encodeURIComponent(destination)}` : destination
    return <main className="signup-shell success-shell">
      <section className="signup-success">
        <span className="success-icon"><Check size={34} /></span>
        <span className="signup-kicker">You’re on the journey</span>
        <h1>Welcome, {form.firstName}.</h1>
        <p>{alreadyRegistered ? 'We’ve saved your details. Looks like you already have a Niyyah account with this email — sign in to continue.' : 'We’ve saved your details and set up your account. You can now explore what’s happening and choose your first event.'}</p>
        <a className="signup-submit" href={continueHref}>{alreadyRegistered ? <>Sign in to continue <ArrowRight size={18} /></> : eventId ? <>Continue to that opportunity <ArrowRight size={18} /></> : <>Build my profile <ArrowRight size={18} /></>}</a>
      </section>
    </main>
  }

  return <main className="signup-shell">
    <header className="signup-nav">
      <a className="brand" href="/"><span className="brand-mark"><HeartHandshake size={21} /></span><span><b>Niyyah</b><small>Purpose meets people</small></span></a>
      <a className="back-home" href={eventId ? `/join?event=${encodeURIComponent(eventId)}` : '/join'}><ArrowLeft size={16} /> Back to login options</a>
    </header>

    <div className="signup-layout">
      <aside className="signup-intro">
        <span className="signup-kicker"><Sparkles size={14} /> Join the journey</span>
        <h1>Tell us a little about you.</h1>
        <p>We’ll use this information to match you with nonprofit opportunities and help organizations manage participation.</p>
        <div className="privacy-note"><LockKeyhole size={18} /><span><b>Your details stay private.</b> Social media is optional, and we never sell your information.</span></div>
      </aside>

      <form className="signup-form" onSubmit={submit}>
        {form.referralCode&&<div className="referral-welcome"><Sparkles size={18}/><span><b>A friend passed the Niyyah to you.</b>Create your volunteer account to join their three-person challenge.</span></div>}
        <section className="form-section">
          <div className="section-heading"><span>01</span><div><h2>Your details</h2><p>Fields marked * are required.</p></div></div>
          <div className="field-grid two">
            <label>First name *<input name="firstName" value={form.firstName} onChange={update} autoComplete="given-name" required /></label>
            <label>Last name *<input name="lastName" value={form.lastName} onChange={update} autoComplete="family-name" required /></label>
          </div>
          <div className="field-grid two">
            <label>Email address *<input name="email" type="email" value={form.email} onChange={update} autoComplete="email" required /></label>
            <label>Phone number <span>(optional)</span><input name="phone" type="tel" value={form.phone} onChange={update} autoComplete="tel" /></label>
          </div>
          <div className="field-grid two">
            <label>Create a password *<input name="password" type="password" value={form.password} onChange={update} autoComplete="new-password" minLength={8} required /></label>
            <label>Age range *<select name="ageGroup" value={form.ageGroup} onChange={update} required><option value="">Choose one</option>{['13–15', '16–17', '18–24', '25–34', '35+'].map((age) => <option key={age}>{age}</option>)}</select></label>
          </div>
          <div className="field-grid two">
            <label>Postcode *<input name="postcode" value={form.postcode} onChange={update} autoComplete="postal-code" placeholder="e.g. E1 6AN" required /></label>
          </div>
        </section>

        <section className="form-section">
          <div className="section-heading"><span>02</span><div><h2>What are you into?</h2><p>Choose at least one.</p></div></div>
          <div className="interest-grid">
            {interestOptions.map((interest) => <button type="button" key={interest} className={form.interests.includes(interest) ? 'chosen' : ''} onClick={() => toggleInterest(interest)} aria-pressed={form.interests.includes(interest)}>{form.interests.includes(interest) && <Check size={15} />}{interest}</button>)}
          </div>
          <div className="field-grid two compact-top">
            <label>Preferred contact *<select name="preferredContact" value={form.preferredContact} onChange={update} required>{['Email', 'Text message', 'WhatsApp'].map((item) => <option key={item}>{item}</option>)}</select></label>
            <label>How did you hear about us?<select name="heardAboutUs" value={form.heardAboutUs} onChange={update}><option value="">Choose one</option>{['Friend or family', 'Masjid or community centre', 'School or university', 'Social media', 'Other'].map((item) => <option key={item}>{item}</option>)}</select></label>
          </div>
        </section>

        <section className="form-section optional-section">
          <div className="section-heading"><span>03</span><div><h2>Social media <em>Optional</em></h2><p>Share only what you are comfortable with.</p></div></div>
          <div className="field-grid two">
            <label>Instagram <span>(optional)</span><div className="handle-input"><i>@</i><input name="instagram" value={form.instagram} onChange={update} placeholder="username" /></div></label>
            <label>TikTok <span>(optional)</span><div className="handle-input"><i>@</i><input name="tiktok" value={form.tiktok} onChange={update} placeholder="username" /></div></label>
          </div>
          <label>Another social profile <span>(optional)</span><input name="otherSocial" value={form.otherSocial} onChange={update} placeholder="Platform and username" /></label>
        </section>

        <section className="consent-section">
          <label className="check-row"><input type="checkbox" name="consent" checked={form.consent} onChange={update} required /><span>I agree that Niyyah can use these details to manage my community membership and event participation. *</span></label>
          <label className="check-row"><input type="checkbox" name="updatesOptIn" checked={form.updatesOptIn} onChange={update} /><span>Send me occasional updates about new events. <em>Optional</em></span></label>
        </section>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="signup-submit" type="submit" disabled={status === 'submitting'}>{status === 'submitting' ? <><LoaderCircle className="spin" size={18} /> Saving your details…</> : <>Complete signup <ArrowRight size={18} /></>}</button>
      </form>
    </div>
  </main>
}
