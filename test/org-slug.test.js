import { test } from 'node:test'
import assert from 'node:assert/strict'
import { slugify } from '../app/lib/org-slug.js'

test('lowercases and hyphenates a normal name', () => {
  assert.equal(slugify('Medina Cares'), 'medina-cares')
})

test('collapses punctuation and repeated separators into one hyphen', () => {
  assert.equal(slugify('Al-Huda   Youth  Center!'), 'al-huda-youth-center')
})

test('trims leading and trailing hyphens', () => {
  assert.equal(slugify('  --Niyyah Youth-- '), 'niyyah-youth')
})

test('strips accents down to their base letters', () => {
  assert.equal(slugify('Café Résumé Org'), 'cafe-resume-org')
})

test('falls back to a default for empty or missing input', () => {
  assert.equal(slugify(''), 'organization')
  assert.equal(slugify(null), 'organization')
  assert.equal(slugify(undefined), 'organization')
})

test('caps length at 60 characters with no trailing hyphen', () => {
  const slug = slugify('A'.repeat(80))
  assert.ok(slug.length <= 60)
  assert.ok(!slug.endsWith('-'))
})
