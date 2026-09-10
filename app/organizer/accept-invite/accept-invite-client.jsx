'use client'
import { useEffect,useState } from 'react'
import { ArrowRight,CheckCircle2,LoaderCircle,TriangleAlert } from 'lucide-react'

export default function AcceptInviteClient({ token }) {
  const [status,setStatus] = useState('loading')
  const [message,setMessage] = useState('')

  useEffect(() => {
    if (!token) { setStatus('error'); setMessage('This invite link is missing its token.'); return }
    fetch('/api/organization-admin-invite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) })
      .then(async r => {
        const json = await r.json()
        if (r.ok) { setStatus('ok'); setMessage(json.organizationName) }
        else { setStatus('error'); setMessage(json.error || 'This invite link is invalid or has already been used.') }
      })
      .catch(() => { setStatus('error'); setMessage('Something went wrong. Please try again.') })
  }, [token])

  if (status === 'loading') return <main className="member-loading"><LoaderCircle className="spin"/><span>Confirming your invite…</span></main>
  if (status === 'ok') return <main className="member-loading"><CheckCircle2/><span>You now have admin access to {message}.</span><a className="profile-save" href="/organizer">Go to your organizer workspace <ArrowRight size={16}/></a></main>
  return <main className="member-loading"><TriangleAlert/><span>{message}</span><a className="profile-save" href="/organizer">Go to organizer <ArrowRight size={16}/></a></main>
}
