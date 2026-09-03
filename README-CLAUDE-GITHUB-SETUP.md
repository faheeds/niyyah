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

## What this does *not* do yet

- **Backlog sequencing is a soft check, not a hard gate.** The published backlog board (P0/P1/P2/P3) lives outside GitHub, and a GitHub Actions runner has no API access to it. Claude's review reads backlog codes out of branch names/PR descriptions and flags dependency risk in its review comment, but it won't refuse to merge a P2 PR just because a P0 item is still open. If you want this enforced for real, the practical path is exporting the backlog's current state as a JSON file committed to this repo (even a manually-updated one) that the review prompt is told to read.
- **Deployment sequencing isn't wired up.** This repo's current deployment path is the OpenAI Sites hosting referenced in `.openai/hosting.json` / `CLAUDE_HANDOFF.md`, not a `wrangler deploy` you control directly from GitHub Actions — so there isn't yet a staging/production CD workflow here. Once you decide how you actually want this repo deployed going forward, that's a separate, small addition (a `deploy.yml` that runs on merge to `main` for staging, plus a manually-triggered one for production) — happy to build it once the target's confirmed.
