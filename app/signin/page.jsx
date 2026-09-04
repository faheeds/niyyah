'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, HeartHandshake, LoaderCircle, LockKeyhole, Sparkles } from 'lucide-react'

export default function SigninPage() {
  const [mode, setMode] = useState('signin')
  const [returnTo, setReturnTo] = useState('/')
  const [form, setForm] = useState({ email: '', password: '', displayName: '' })
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')

  useEffect(() => {
    const search = new URLSearchParams(window.location.search)
    const rt = search.get('return_to') || '/'
    setReturnTo(rt.startsWith('/') && !rt.startsWith('//') ? rt : '/')
    if (search.get('mode') === 'signup') setMode('signup')
  }, [])

  const update = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    setStatus('submitting')
    try {
      const endpoint = mode === 'signup' ? '/api/auth/signup' : '/api/auth/signin'
      const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Please try again.')
      window.location.href = returnTo
    } catch (submissionError) {
      setError(submissionError.message)
      setStatus('idle')
    }
  }

  const googleHref = `/api/auth/google?return_to=${encodeURIComponent(returnTo)}`

  return <main className="signup-shell">
    <header className="signup-nav">
      <a className="brand" href="/"><span className="brand-mark"><HeartHandshake size={21} /></span><span><b>Niyyah</b><small>Purpose meets people</small></span></a>
      <a className="back-home" href="/join"><ArrowLeft size={16} /> Change journey</a>
    </header>

    <div className="signup-layout">
      <aside className="signup-intro">
        <span className="signup-kicker"><Sparkles size={14} /> {mode === 'signup' ? 'Create your account' : 'Welcome back'}</span>
        <h1>{mode === 'signup' ? 'Set up your Niyyah account.' : 'Sign in to Niyyah.'}</h1>
        <p>{mode === 'signup' ? 'One account gets you into your profile, applications and volunteer hours — from any device.' : 'Use the same email or Google account you signed up with.'}</p>
        <div className="privacy-note"><LockKeyhole size={18} /><span><b>Your details stay private.</b> We never share your email or password, and passwords are never stored in plain text.</span></div>
      </aside>

      <form className="signup-form" onSubmit={submit}>
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

        {mode === 'signup' && <label>Your name *<input name="displayName" value={form.displayName} onChange={update} autoComplete="name" required /></label>}
        <label>Email address *<input name="email" type="email" value={form.email} onChange={update} autoComplete="email" required /></label>
        <label>Password *<input name="password" type="password" value={form.password} onChange={update} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} minLength={mode === 'signup' ? 8 : undefined} required /></label>

        {error && <p className="form-error" role="alert">{error}</p>}

        <button className="signup-submit" type="submit" disabled={status === 'submitting'}>
          {status === 'submitting' ? <><LoaderCircle className="spin" size={18} /> {mode === 'signup' ? 'Creating account…' : 'Signing in…'}</> : <>{mode === 'signup' ? 'Create account' : 'Sign in'} <ArrowRight size={18} /></>}
        </button>
        <button type="button" className="signin-switch" onClick={() => setMode(mode === 'signup' ? 'signin' : 'signup')}>
          {mode === 'signup' ? 'Already have an account? Sign in' : 'New here? Create an account'}
        </button>
      </form>
    </div>
  </main>
}
