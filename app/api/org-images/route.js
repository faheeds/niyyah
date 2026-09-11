import { env } from 'cloudflare:workers'
import { isValidOrgImageKey } from '../../lib/org-image.js'

// P2-01: serves organization cover-photo and gallery images out of R2.
// Public and unauthenticated, same as app/api/org-profile/route.js - these
// images only ever back an org's own public landing page, and R2 has no
// public bucket domain configured, so the app itself has to stream them.
// Object keys are content-addressed (a random UUID, never anything
// user-typed - see app/lib/org-image.js), so a long, immutable Cache-Control
// is safe: a changed photo always gets a brand-new key, never the same URL
// with different bytes behind it.
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const key = String(searchParams.get('key') || '')
  if (!isValidOrgImageKey(key)) return new Response('Not found', { status: 404 })
  const object = await env.ORG_IMAGES.get(key)
  if (!object) return new Response('Not found', { status: 404 })
  return new Response(object.body, {
    headers: {
      'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}
