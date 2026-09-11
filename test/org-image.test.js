import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseDataUrlImage, extensionForMime, buildOrgImageKey, isValidOrgImageKey } from '../app/lib/org-image.js'

// A tiny 1x1 red PNG, base64-encoded - small enough to embed directly.
const TINY_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='

test('parseDataUrlImage decodes a well-formed image data URL', () => {
  const result = parseDataUrlImage(TINY_PNG)
  assert.ok(result)
  assert.equal(result.mime, 'image/png')
  assert.ok(result.bytes instanceof Uint8Array)
  assert.ok(result.bytes.length > 0)
})

test('parseDataUrlImage rejects a non-image data URL', () => {
  assert.equal(parseDataUrlImage('data:text/plain;base64,aGVsbG8='), null)
})

test('parseDataUrlImage rejects a plain string that is not a data URL at all', () => {
  assert.equal(parseDataUrlImage('not-a-data-url'), null)
  assert.equal(parseDataUrlImage(''), null)
  assert.equal(parseDataUrlImage(null), null)
  assert.equal(parseDataUrlImage(undefined), null)
})

test('parseDataUrlImage rejects an oversized payload', () => {
  const huge = 'data:image/png;base64,' + 'A'.repeat(9 * 1024 * 1024)
  assert.equal(parseDataUrlImage(huge), null)
})

test('parseDataUrlImage rejects malformed base64 without throwing', () => {
  assert.equal(parseDataUrlImage('data:image/png;base64,not-valid-base64!!!'), null)
})

test('extensionForMime maps known image types', () => {
  assert.equal(extensionForMime('image/png'), 'png')
  assert.equal(extensionForMime('image/jpeg'), 'jpg')
  assert.equal(extensionForMime('image/webp'), 'webp')
  assert.equal(extensionForMime('image/gif'), 'gif')
})

test('extensionForMime returns null for an unknown type', () => {
  assert.equal(extensionForMime('image/tiff'), null)
  assert.equal(extensionForMime('application/pdf'), null)
})

test('buildOrgImageKey namespaces by organization and purpose', () => {
  const key = buildOrgImageKey('org-123', 'cover', 'jpg', 'abc-uuid')
  assert.equal(key, 'org/org-123/cover/abc-uuid.jpg')
})

test('isValidOrgImageKey accepts a key this app would actually build', () => {
  assert.equal(isValidOrgImageKey(buildOrgImageKey('org-123', 'gallery', 'png', '11111111-1111-1111-1111-111111111111')), true)
})

test('isValidOrgImageKey rejects keys outside the expected shape', () => {
  assert.equal(isValidOrgImageKey('org/org-123/cover/abc.exe'), false)
  assert.equal(isValidOrgImageKey('org/org-123/banner/abc.jpg'), false)
  assert.equal(isValidOrgImageKey('../../etc/passwd'), false)
  assert.equal(isValidOrgImageKey(''), false)
  assert.equal(isValidOrgImageKey(null), false)
})
