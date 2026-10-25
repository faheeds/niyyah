import { redirect } from 'next/navigation'

// The volunteer/organizer choice and the login/signup choice both now live
// on one page (app/join/page.jsx) so Google sign-in is reachable in a single
// click instead of three. This route is kept only so old bookmarks and
// external links to /volunteer-access still land somewhere sensible.
export default async function VolunteerAccess({ searchParams }) {
  const params = (await searchParams) || {}
  const eventId = typeof params.event === 'string' ? params.event : ''
  redirect(eventId ? `/join?role=volunteer&event=${encodeURIComponent(eventId)}` : '/join?role=volunteer')
}
