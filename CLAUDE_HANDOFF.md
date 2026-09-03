# Niyyah source-code handoff

This archive contains the current local app source, assets, database schema and migrations, dependency lockfile, and hosting configuration. It is a source export, not a production database backup or a portable deployed server.

## Start here

Niyyah connects volunteers with nonprofit and community organizations. Preserve the existing functionality and neutral pastel theme unless asked to change them. Inspect the implementation before assuming a feature is complete; previous pitch copy is not proof of implemented functionality.

## Stack and local development

- React 19 with Vinext (Next.js-style App Router APIs on Vite), JavaScript/JSX and some TypeScript.
- Cloudflare Workers runtime and D1 SQLite database, binding name `DB`.
- Drizzle schema in `db/schema.ts`, SQL migrations in `drizzle/`.
- Styling in `src/styles.css`, Lucide icons, social preview image in `public/og.png`.
- Use a compatible recent Node.js version and pnpm. Install with `pnpm install --frozen-lockfile`, run `pnpm dev`, and validate with `pnpm build`.
- See `package.json` and the lockfile for exact dependencies. The cloud runtime and authentication need configuration before all authenticated flows will run locally. These commands are starting instructions, not a guarantee of host-independent operation.

## Source map

- `app/page.jsx`: public landing page.
- `app/join/`, `app/volunteer-access/`, `app/organizer-access/`: role selection and access flows.
- `app/signup/`: volunteer registration.
- `app/profile/`: profile editing, interests, social handles, activity/progress, friends, referral challenge.
- `app/opportunities/`: opportunity discovery and event signup slots.
- `app/organizer/`: organization workspace, profiles, events, applications and hours approvals.
- `app/help/`: help page.
- `app/api/`: server endpoints for profiles, events, organizers, applications, opportunities, friends, volunteer activity and signup.
- `db/index.js`: D1 queries and table initialization helpers.
- `app/chatgpt-auth.ts`: host-provided identity adapter.
- `vite.config.js`: Vinext, Sites and Cloudflare plugins.

## Important migration dependencies

1. Authentication currently relies on trusted host-injected `oai-authenticated-user-*` headers and the host's `/signin-with-chatgpt` flow. These are NOT a standalone email/password login system. On another host, replace the adapter and authentication links with a real session/authentication provider. Never accept user-supplied identity headers as proof of login; the current trust model requires the original hosting boundary.
2. Database calls import `env` from `cloudflare:workers` and use `env.DB`. Provide your own D1 binding or adapt the data layer for another database. The database ID in `vite.config.js` is a local placeholder, not production credentials.
3. `.openai/hosting.json` identifies the existing Sites deployment and its logical binding. It is preserved as source configuration, not authorization to deploy or access data. Do not assume it creates a usable deployment on a different service.
4. `@openai/sites-vite-plugin` is part of the existing build. If moving hosting, assess and replace its integration deliberately rather than removing dependencies blindly.
5. Live users, signups, organization records, event records and approved hours are not in this ZIP. A separate authorized database migration is required to retain production records on a new host.
6. Audit authorization, input validation, capacity enforcement, date/time handling and identity transitions before public migration. Run end-to-end tests for both roles; successful compilation alone does not verify those workflows.

## Referral challenge behavior

Volunteers share a personal `/signup?ref=...` link. A referred registration is pending until the new user authenticates and loads their profile; the profile endpoint links it by email and completes the referral. The inviter sees progress toward three completed referrals and a completion notification. Inspect `app/api/signup/route.js` and `app/api/profile/route.js` for current rules.

## Product ideas versus code

The 30-day organization trial, subscription pricing and sponsorship models were discussed as business ideas. Do not assume billing, payments or trial enforcement exist. Similarly, inspect friend features before claiming direct social-network contact import. Social handles alone do not provide access to social-network friends.

## Export contents and exclusions

Included: app/server source, styles, public assets, schema/migrations, build configuration, package manifests and lockfile, `.gitignore`, `.openai/hosting.json`, and this guide.

Excluded: `node_modules`, generated builds/caches, Git history, local databases, logs, temporary files, exports, credentials and environment secrets. Install dependencies again. The original live site is unchanged by this export.

## Suggested first request to Claude

Read CLAUDE_HANDOFF.md and inspect this Niyyah project. Help me continue developing it while preserving its existing features and pastel design. First explain how to run it locally and identify which authentication and database integrations need changes for my chosen host. Do not deploy, delete data, or change production settings without my approval.
