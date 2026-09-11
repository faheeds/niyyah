import OrgLandingClient from './org-landing-client.jsx'
import '../../src/styles.css'

// P1-10: a public, unauthenticated branded page for one organization - no
// requireUser here, matching app/join/page.jsx and the public /api/events
// feed. The slug is read server-side and handed to the client component,
// the same way app/organizer/accept-invite/page.jsx passes its token.
export const dynamic = 'force-dynamic'

export default async function OrgLandingPage({ searchParams }) {
  const params = (await searchParams) || {}
  const slug = typeof params.slug === 'string' ? params.slug : ''
  return <OrgLandingClient slug={slug} />
}
