import { Filter } from 'bad-words'

// A lightweight, automated first line of defense for the free-text fields
// volunteers and organizers type into - event titles/descriptions, member
// bios, organization descriptions - none of which get any human review
// before going live (see P1-06). This flags clearly profane language at
// submission time so it never reaches a page that 13-year-olds can see.
// It is not a substitute for human moderation of harmful-but-not-profane
// content - just the cheap, immediate check the backlog explicitly allows
// ("a person or an automatic filter").
const filter = new Filter()

// Returns a user-facing message to show (and reject the save with) when
// text needs to be revised, or null when it is clean.
export function moderationIssue(text) {
  const value = String(text || '').trim()
  return value && filter.isProfane(value) ? 'Please remove inappropriate language before saving.' : null
}
