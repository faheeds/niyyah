# Changes made by Claude — September 2026

This picks up from the UX/product review. Everything below was verified against a local dev server (`pnpm dev`) — including a full production build (`pnpm build`), which completed with no errors — before being packaged up. Nothing was deployed; these are source changes only, same as the export I was given.

## Fixed

**1. Mobile layout clipping (the big one).**
Root cause: `.eyebrow-pill` (the "People ready to help..." badge in the hero) had `width: max-content`, which forces it to size to its full unwrapped text width regardless of screen size — about 390–400px. Because it sits inside a CSS Grid column, and grid items default to a minimum size equal to their content's natural width, that one badge was stretching the *entire* hero/discovery grid track wider than the phone screen. Since `<main>` clips overflow instead of allowing it to scroll, the extra width was silently sliced off — which is why the hero text, event cards, filter chips, and footer all looked cut off on the right edge at once. It was one root cause showing up in many places, not many separate bugs.

Fix: capped the badge to `max-width: 100%` so it wraps onto two lines on narrow screens instead of forcing overflow, and added `min-width: 0` to the two grid columns (`.hero-copy`, `.discovery`) as a defensive measure so no future long/unbreakable content can cause the same thing again.
*Files: `src/styles.css`*

**2. "X curated" count didn't update when filtering.**
It was reading the full unfiltered list length instead of the filtered list. One-line fix.
*Files: `src/main.jsx`*

**3. Picking an event and hitting "Sign up" lost that event.**
Selecting a specific opportunity and signing up used to dump you into a generic "choose your journey" screen with no memory of what you picked. I threaded an `?event=<id>` parameter through the whole chain — homepage → `/join` → `/volunteer-access` → both the login redirect (`return_to`) and `/signup` — so that after authenticating, you land back on `/opportunities` with that event's booking dialog already open, shift/time picker and all. Tested end-to-end locally (screenshot-verified) using the dev sign-in stub.
*Files: `src/main.jsx`, `app/join/page.jsx`, `app/volunteer-access/page.jsx`, `app/signup/page.jsx`, `app/opportunities/opportunities-client.jsx`*

**4. Duplicate "Login / Sign Up" in the header.**
Desktop showed both a plain text link and a filled pill button doing the same thing. Removed the redundant text link on wider screens; kept it in the mobile dropdown menu, where it's the only way to reach login (the pill button is hidden there).
*Files: `src/main.jsx`, `src/styles.css`*

**5. Three different taglines across the page.**
The `<title>`, the Open Graph/Twitter share title, and the hero headline all said different things. Aligned the title and share titles to "Niyyah — Good intentions. Real impact." to match the hero.
*Files: `app/layout.jsx`*

**6. Bare, unbranded 404 page.**
Added a real `app/not-found.jsx` that matches the rest of the site (same header, same card style) with a way back home and a link to Help.
*Files: `app/not-found.jsx` (new)*

**7. No favicon.**
Added a simple SVG favicon using the same heart mark and gold color as the in-app brand icon, wired up via the metadata `icons` field.
*Files: `public/favicon.svg` (new), `app/layout.jsx`*

**8. `/profile` crashed with "Unexpected end of JSON input" for any account that hadn't gone through the community-interest sign-up form.**
Root cause: `GET /api/profile` runs a query that joins against a `community_members` table, but the table-prep function that route calls (`prepareCommunityTables()`) never actually created that table — only a separate function used solely by the general sign-up form did. So any real user (or the local dev sign-in stub) who reached `/profile` without ever submitting that other form hit a database error (`no such table: community_members`), the API route had no error handling, and the browser saw an empty response it couldn't parse as JSON. The organizer dashboard's applicant list (`/api/organizer`) has the exact same join and would have hit the same wall. Fixed by creating `community_members` (and its email index) inside `prepareCommunityTables()` too, so it exists no matter which route touches the database first. Verified locally: `/api/profile` now returns a valid 200 response for a fresh account, and a full production build still completes cleanly.
*Files: `db/index.js`*

## Investigated, not code changes

- **The "detail page" the chevron seems to promise:** on closer inspection, the real detail/booking experience already exists — at `/opportunities`, complete with a proper card grid and a date/time picker modal. The public homepage's 8-card list is a deliberately lighter teaser. Rather than build a second, competing detail view for logged-out visitors, fix #3 above makes sure picking a card on the homepage now leads straight into that real experience once you're signed in. If you'd like a lightweight preview for logged-out visitors too, that's a good next scoped task — happy to build it, just flagging it as a product call rather than assuming the answer.
- **The card-vs-summary "mismatched data" I flagged in the review:** this turned out not to be a bug. The card shows the event's location name/address; the "Your pick" strip shows a separate postcode field. Two different real fields, not inconsistent mock data — I was wrong about this one in the original review.
- **The slow/unresponsive mobile menu button and the stray clipboard write I saw during browser testing:** I went through the menu toggle's code carefully and there's nothing there that touches the clipboard or does anything slow — it's a plain state toggle. I couldn't reproduce a code-level cause, and my best guess now is it was an artifact of the remote browser-testing tool itself, not a real bug in the app. I'm flagging this so you don't go looking for something that isn't there; if it happens again on a real device, it's worth another look.

## Not touched (needs your input or is out of scope for this pass)

- Everything behind authentication (organizer dashboard, applicant management, verified-hours approval) — I can't log in as a real user from here, so per the handoff notes this needs a real pass with test credentials.
- Search/date filters, opportunity capacity display, organizer contact info on cards, notifications, sharing, footer legal links, localization — all still on the "Next/Later" list from the original review.
- No deploy was made and no data was touched, per the handoff notes.

## How to verify

```
pnpm install --frozen-lockfile
pnpm dev
```
Then check `/` at a 375px-wide viewport (no more clipped text), the header at desktop width (single Login/Sign Up CTA), and `/this-page-does-not-exist` (branded 404).
