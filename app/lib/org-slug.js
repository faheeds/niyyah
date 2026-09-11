// P1-10: every organization's branded landing page lives at a stable,
// readable link (e.g. /org?slug=medina-cares) instead of a raw id - see
// app/api/org-profile/route.js and the saveOrganization action in
// app/api/organizer/route.js, which calls slugify() once, the first time an
// organization saves its profile, and never regenerates it afterward so a
// link an organization has already shared never breaks.

// Turns a name into a URL-safe slug: lowercase, accents stripped, anything
// that isn't a-z/0-9 collapsed to a single hyphen, leading/trailing hyphens
// trimmed. Never returns an empty string - callers still need to check the
// result against existing slugs for uniqueness (see nextAvailableSlug in
// app/api/organizer/route.js).
export function slugify(name) {
  const base = String(name || '')
    .toLowerCase()
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '')
  return base || 'organization'
}
