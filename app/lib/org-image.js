// P2-01: shared, framework-agnostic helpers for organization cover-photo and
// gallery uploads (app/api/organizer/route.js's uploadOrgImage action) and
// for serving them back out (app/api/org-images/route.js). Kept pure and
// import-only-web-APIs (atob, not any Workers/Node-specific global) so this
// stays unit-testable under plain Node, the same reasoning notify.js's
// getEnv() documents for staying importable outside the Workers runtime.

const MIME_EXTENSIONS = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' }
const DATA_URL_RE = /^data:(image\/(?:png|jpeg|webp|gif));base64,([a-zA-Z0-9+/]+=*)$/
// A resized cover/gallery photo (see the client-side canvas resize before
// upload) should land well under this - generous headroom for a phone photo
// that slipped through resize, without letting someone upload something
// wildly oversized to a public, unauthenticated-to-read bucket.
const MAX_BASE64_LENGTH = 8 * 1024 * 1024 // ~6MB decoded

// Parses a data: URL into {mime, bytes} for handing to R2's put(), or null
// if it isn't a well-formed, reasonably-sized image data URL. Never throws -
// every caller treats null as "reject with a friendly error", not a crash.
export function parseDataUrlImage(dataUrl) {
  if (typeof dataUrl !== 'string' || dataUrl.length > MAX_BASE64_LENGTH) return null
  const match = DATA_URL_RE.exec(dataUrl)
  if (!match) return null
  const [, mime, base64] = match
  try {
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return { mime, bytes }
  } catch {
    return null
  }
}

export function extensionForMime(mime) {
  return MIME_EXTENSIONS[mime] || null
}

// Object keys are namespaced by organization id and purpose so an org's
// photos are trivially listable/cleanable later, and carry a random UUID
// rather than the original filename so nothing user-supplied ends up in the
// key itself.
export function buildOrgImageKey(organizationId, purpose, ext, uuid) {
  return `org/${organizationId}/${purpose}/${uuid}.${ext}`
}

// app/api/org-images/route.js validates an incoming ?key= against this
// before ever calling R2 - defense in depth, since a key built any other way
// couldn't have been produced by an upload this app made.
const KEY_RE = /^org\/[a-zA-Z0-9_-]+\/(cover|gallery)\/[a-f0-9-]+\.(png|jpe?g|webp|gif)$/
export function isValidOrgImageKey(key) {
  return typeof key === 'string' && KEY_RE.test(key)
}
