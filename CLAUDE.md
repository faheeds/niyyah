# Niyyah — project conventions

Niyyah connects volunteers with nonprofit and community organizations. This file is read by every Claude Code session that touches this repo — the four contributors working interactively, and the automated review/merge bot defined in `.github/workflows/claude-review.yml`. Keep it accurate; it is the single shared source of truth for how this codebase is worked on.

Background on the app itself (stack, source map, migration caveats around auth and the D1 database) lives in `CLAUDE_HANDOFF.md` — read that first. This file is about *process*: how we branch, review, sequence, and merge.

## Stack quick reference

- React 19 on Vinext (Next.js-style App Router on Vite), JS/JSX with some TypeScript.
- Cloudflare Workers + D1 (binding `DB`), Drizzle schema in `db/schema.ts`, raw SQL table setup in `db/index.js`.
- Install with `pnpm install --frozen-lockfile`. Validate every change with `pnpm build` before opening a PR — this is also what CI runs.
- Node version is pinned in `.nvmrc`.

## The backlog is the source of truth for priority

Product priority lives in the shared backlog board (P0 → P1 → P2 → P3), not in this repo. When reviewing a PR, check the PR description or branch name for the backlog item code (e.g. `p0-01-org-verification`) and weigh sequencing against it:

- A P1/P2/P3 PR that depends on a P0 item which is still open or in progress is a **flag, not an automatic block** — note it in the review so a human can decide, since this repo has no automated read access to the live backlog board.
- Don't hold up independent work waiting on unrelated higher-priority items. Sequencing is about real dependencies (e.g. "attendee RSVP" depends on "org verification"), not strict numeric order.

Branch naming: `<backlog-code>` or `<backlog-code>-<short-slug>`, e.g. `p0-02-pass-niyyah-contrast`. This is what lets a reviewer (human or Claude) connect a PR back to the backlog item and its dependencies.

## The schema-drift rule (non-negotiable)

This codebase has already shipped one production bug from this exact pattern: `app/api/profile/route.js` queried a `community_members` table that `prepareCommunityTables()` in `db/index.js` never actually created, causing a silent "Unexpected end of JSON input" failure.

So, on every PR that touches `db/index.js`, a migration, or any query against a new table/column:

1. The table or column must be created by one of the `prepare*Table*` functions in `db/index.js` (or a migration in `drizzle/`) **in the same PR** that starts querying it.
2. Grep the PR diff for every new table/column name and confirm it appears on both the write side (schema/prepare function) and the read side (the route querying it). A PR that adds a query against a table it doesn't also create should be **requested changes**, not approved.
3. Never assume a table exists because it's referenced elsewhere in the code — verify against `db/index.js`.

## Branching, PRs, and review

- Branch off `main`. One backlog item per branch/PR where practical.
- Open a PR against `main` as soon as there's something reviewable — don't let branches live long uncommunicated.
- Every PR gets two automated gates before it can merge:
  1. **CI** (`.github/workflows/ci.yml`) — `pnpm install --frozen-lockfile && pnpm build` must pass.
  2. **Claude review** (`.github/workflows/claude-review.yml`) — an automated pass against this file and the schema-drift rule above. It re-runs on every push to the PR.
- If Claude's review is clean and CI is green, the PR **auto-merges** (squash, branch deleted after merge) — no human approval is required in the loop. This is a deliberate choice: the four contributors are validating their own features before opening the PR, and CI + review are the safety net.
- If Claude requests changes, push fixes to the same branch — the review re-runs automatically on the new commits.
- Because merges are automatic, PR descriptions matter: say what the change does, which backlog item it's for, and how it was validated (screenshots, manual test steps, etc.) so the history stays readable even without a human approval step.

## What the automated reviewer should focus on

In rough priority order:

1. **Correctness of the schema-drift rule above** — this is the highest-value check given the app's history.
2. Auth/identity handling — this app has its own standalone auth system (`app/auth.ts`): email+password (PBKDF2-hashed) and Google OAuth, both resolving to a session cookie (`niyyah_session`) backed by the `auth_sessions`/`accounts` tables. All server code reads identity via `getUser()`/`requireUser()` from `app/auth.ts` — never approve a change that trusts a new source of "who is this user" (a header, a query param, a different cookie) without going through this existing adapter.
3. Anything that touches capacity limits, hours-approval status transitions, or referral-completion logic — these have subtle state machines; check that new code respects existing status values instead of inventing new ones.
4. Build correctness (imports, unused/missing deps) — CI covers `pnpm build` failing outright, but flag things like dead imports or obviously unused state even if the build still passes.
5. Consistency with the existing pastel visual theme in `src/styles.css` — flag as a nit, not a blocker, unless it's a clear regression.

Keep review comments specific and actionable — reference the exact file/line, and say what to change, not just that something's wrong.

## Deployment

- Every merge to `main` auto-deploys to the `niyyah-community-staging` Cloudflare Worker via `.github/workflows/deploy-staging.yml`.
- Production (`niyyah-community`) only deploys when someone manually triggers `.github/workflows/deploy-production.yml` from the Actions tab — never automatically, and never as part of the review/merge flow.
- Both workflows run `pnpm build`, then `scripts/patch-wrangler-config.mjs` to inject the real Worker name and D1 database id (build output otherwise contains a placeholder database id), then `wrangler deploy`. See `README-CLAUDE-GITHUB-SETUP.md` for the one-time Cloudflare account setup this depends on.
- The D1 schema self-creates on first request (`prepare*Table*` functions in `db/index.js`) — a deploy doesn't need a separate migration-apply step for the app to function. `drizzle/` is schema history/reference, not an applied migration pipeline.
- Both workflows also deploy a second, small Worker (`workers/reminders/`) right after the main one — it only exports a `scheduled` handler (a Cron Trigger, every 15 minutes) that sends event-start reminder emails, since the main Worker only ever builds a `fetch` handler. Same D1 database, its own Worker name and Resend secrets — see `README-CLAUDE-GITHUB-SETUP.md` section 6b.
