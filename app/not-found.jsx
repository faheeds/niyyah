import { ArrowLeft, Compass, HeartHandshake } from 'lucide-react'
import '../src/styles.css'

export default function NotFound() {
  return <main className="access-shell">
    <header className="signup-nav">
      <a className="brand" href="/"><span className="brand-mark"><HeartHandshake size={21} /></span><span><b>Niyyah</b><small>Purpose meets people</small></span></a>
      <a className="back-home" href="/"><ArrowLeft size={16} /> Back home</a>
    </header>
    <section className="access-card">
      <span className="join-path-icon"><Compass /></span>
      <h1>This page wandered off.</h1>
      <p>We couldn’t find what you were looking for. It may have moved, or the link might not be quite right.</p>
      <div className="access-actions">
        <a className="primary" href="/">Back to Niyyah</a>
        <a className="secondary-action" href="/help">Visit help center</a>
      </div>
    </section>
  </main>
}
