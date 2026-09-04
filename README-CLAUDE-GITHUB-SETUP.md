# Setting up Claude-controlled GitHub for Niyyah

This repo is wired for: every PR gets an automated build check plus an automated Claude review, and merges to `main` happen automatically once both pass — no human approval step. This doc is the one-time setup to make that real. None of it can be done from this sandbox (no GitHub access here), so it's written as steps for you to run.

## 1. Create the GitHub repository

1. Create a new **private** repo on GitHub (e.g. `niyyah`), empty — no README/license/gitignore from GitHub's side, since this folder already has all of that.
2. From this project folder:
   ```bash
   git remote add origin https://github.com/<your-org-or-user>/niyyah.git
   git branch -M main
   git push -u origin main
   ```
3. Add your 4 contributors as collaborators (Settings → Collaborators), or as members of a team with write access if this is under an org.

## 2. Install the Claude GitHub App

This is what lets `.github/workflows/claude-review.yml` authenticate as Claude rather than a shared personal token, and it's also what a contributor's own interactive Claude Code sessions use for anything beyond the automated review.

**Easiest path** — from a local machine with `gh auth login` already done and admin rights on the new repo, inside this project folder, run a Claude Code session and use its `/install-github-app` command. It will install the app, add the `ANTHROPIC_API_KEY` (or `CLAUDE_CODE_OAUTH_TOKEN`) secret, and open a PR with the workflow files (which already exist here, so it should mostly no-op on that part).

**Manual path**, if you'd rather not do that:
1. Go to https://github.com/apps/claude and install it, scoped to the new repo.
2. In the repo: Settings → Secrets and variables → Actions → New repository secret.
   - Name: `ANTHROPIC_API_KEY`
   - Value: an API key from the Claude Console (console.anthropic.com) — use a key on a plan billed to the org, not one contributor's personal subscription, since this secret is shared across all 4 people's PRs.

If you'd rather install the app once and reuse it across future repos too, install it at the **organization** level instead of per-repo, and set `ANTHROPIC_API_KEY` as an **organization-level** Actions secret so new repos pick it up without repeating this step.

## 3. Turn on auto-merge and branch protection

Both of these are required for the "auto-merge once CI and Claude's review pass" policy to actually hold — without them, `gh pr merge --auto` in the workflow either fails outright or (worse) merges immediately without waiting for CI.

1. Settings → General → Pull Requests → check **Allow auto-merge**.
2. Settings → Branches → Add branch protection rule for `main`:
   - Require a pull request before merging (this alone blocks direct pushes to `main`, which you want — even Claude only ever merges through a PR).
   - Require status checks to pass before merging → search for and require **`build`** (the CI job name from `.github/workflows/ci.yml`) — it won't appear in the list until the workflow has run at least once, so open one throwaway PR first if needed.
   - Require branches to be up to date before merging.
   - You do *not* need "Require approvals" here — the policy you chose is that Claude's own review is the gate, not a second human review. If you ever want a human in the loop for specific paths, that's a `CODEOWNERS` file plus a required-reviewers rule layered on top; not set up here.

## 4. Sanity-check it

Open a small test PR (e.g. a comment or whitespace tweak) against `main` and confirm:
- The `CI / build` check runs and passes.
- The `Claude review & auto-merge` workflow runs, and either leaves an approving review + turns on auto-merge (PR should show "Auto-merge enabled" and merge itself within a minute or two of CI finishing), or requests changes with a specific comment.

## 5. Cloudflare deployment (staging auto-deploy, manual production)

The app currently runs `pnpm build` and deploys via the OpenAI Sites hosting referenced in `.openai/hosting.json` — a separate platform, not something `wrangler deploy` from GitHub Actions can drive. To deploy this repo to Cloudflare Workers yourself instead:

1. **Create two D1 databases** in your own Cloudflare account — one for staging, one for production:
   ```bash
   npx wrangler login
   npx wrangler d1 create niyyah-community-staging
   npx wrangler d1 create niyyah-community-production
   ```
   Each command prints a `database_id` — save both.
2. **Create a Cloudflare API token** (My Profile → API Tokens → Create Token) scoped to your account with `Workers Scripts: Edit` and `D1: Edit` permissions. Note your Account ID too (right sidebar of any Cloudflare dashboard page).
3. In the GitHub repo, set up two **Environments** (Settings → Environments → New environment): `staging` and `production`. For `production`, add a required reviewer if you want a human gate on top of the confirmation prompt in the workflow — the confirmation input alone stops accidental clicks, not a determined one.
4. Add these as **repository secrets** (Settings → Secrets and variables → Actions), or scope `CLOUDFLARE_D1_DATABASE_ID_*` to their respective environment instead if you'd rather keep staging/production credentials separated:
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`
   - `CLOUDFLARE_D1_DATABASE_ID_STAGING`
   - `CLOUDFLARE_D1_DATABASE_ID_PRODUCTION`
5. That's it — `.github/workflows/deploy-staging.yml` deploys to the `niyyah-community-staging` Worker automatically on every merge to `main`; `.github/workflows/deploy-production.yml` only runs when you manually trigger it (Actions tab → "Deploy (production)" → Run workflow), and requires typing `niyyah-community` to confirm.

This was verified in this sandbox as far as it can be without your Cloudflare credentials: `pnpm build` was run for real, `scripts/patch-wrangler-config.mjs` was run against its actual output and confirmed to patch the right fields, and `wrangler deploy --config dist/server/wrangler.json --dry-run` succeeded — resolving the D1 binding and the static assets directory correctly. What wasn't and couldn't be tested here is a real authenticated deploy. **Before trusting the CI workflows, do one deploy by hand first:**
```bash
pnpm build
node scripts/patch-wrangler-config.mjs niyyah-community-staging <your-staging-database-id>
npx wrangler deploy --config dist/server/wrangler.json
```
Confirm the app actually works against the fresh D1 database (the schema self-creates on first request via the `prepare*Table*` functions in `db/index.js` — you don't need to run the `drizzle/` migrations separately for the app to function, though they're there for reference/schema history). Once that works, the GitHub Actions versions are doing exactly the same thing.

## 6. Google sign-in (optional — email/password works without it)

The app has its own standalone login (`app/auth.ts`): email+password works immediately with zero setup. Google sign-in is an added convenience and needs a one-time Google Cloud Console setup plus two config values.

1. **Create an OAuth client** at [console.cloud.google.com](https://console.cloud.google.com) → APIs & Services → Credentials → Create Credentials → OAuth client ID.
   - If prompted, configure the OAuth consent screen first (External, app name "Niyyah", your email as support/developer contact — this doesn't need Google verification for a small number of users, just click through past the "unverified app" testing warnings, or add testers under Audience).
   - Application type: **Web application**.
   - Authorized redirect URIs — add one per environment you deploy:
     - Staging: `https://niyyah-community-staging.faheed-subhani.workers.dev/api/auth/google/callback`
     - Production (once you have the URL): `https://<your-production-worker>.workers.dev/api/auth/google/callback`
   - Save. Google shows a **Client ID** and **Client Secret** — copy both.
2. **Add them to Cloudflare**, not GitHub Actions — the Worker reads them at request time via `env`, not at build time:
   - `GOOGLE_CLIENT_ID` can be a plain (non-secret) variable: Cloudflare dashboard → Workers & Pages → your Worker → Settings → Variables → add `GOOGLE_CLIENT_ID` as text.
   - `GOOGLE_CLIENT_SECRET` must be encrypted: either the same Variables screen with the "Encrypt" toggle on, or from your machine with `npx wrangler secret put GOOGLE_CLIENT_SECRET --name niyyah-community-staging` (repeat with `--name niyyah-community` for production once that Worker exists).
3. That's it — until these are set, the "Continue with Google" button shows a plain "Google sign-in is not set up yet" message instead of erroring, and email+password sign-in/sign-up keeps working normally.

## What this does *not* do yet

- **Backlog sequencing is a soft check, not a hard gate.** The published backlog board (P0/P1/P2/P3) lives outside GitHub, and a GitHub Actions runner has no API access to it. Claude's review reads backlog codes out of branch names/PR descriptions and flags dependency risk in its review comment, but it won't refuse to merge a P2 PR just because a P0 item is still open. If you want this enforced for real, the practical path is exporting the backlog's current state as a JSON file committed to this repo (even a manually-updated one) that the review prompt is told to read.
- **No smoke test after deploy.** `deploy-staging.yml` deploys and stops; it doesn't hit the staging URL afterward to confirm it's actually serving. Worth adding once the app has a cheap health-check route.
