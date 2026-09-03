#!/usr/bin/env node
// `pnpm build` generates dist/server/wrangler.json from vite.config.js's
// inline binding config, which (for local dev / the old OpenAI Sites
// hosting path) always uses a placeholder D1 database id. Real deploys
// need the actual per-environment Worker name and D1 database id, which
// only exist as GitHub Actions secrets. This patches the generated config
// in place, after `pnpm build` and before `wrangler deploy`.
//
// Usage: node scripts/patch-wrangler-config.mjs <worker-name> <d1-database-id>

import { readFileSync, writeFileSync } from 'node:fs'

const [, , workerName, databaseId] = process.argv
if (!workerName || !databaseId) {
  console.error('Usage: patch-wrangler-config.mjs <worker-name> <d1-database-id>')
  process.exit(1)
}

const path = 'dist/server/wrangler.json'
const config = JSON.parse(readFileSync(path, 'utf8'))

config.name = workerName
config.topLevelName = workerName

if (!config.d1_databases?.[0]) {
  console.error(`${path} has no d1_databases[0] to patch — build output shape may have changed.`)
  process.exit(1)
}
config.d1_databases[0].database_id = databaseId

writeFileSync(path, JSON.stringify(config, null, 2))
console.log(`Patched ${path}: name=${workerName}, d1_databases[0].database_id=${databaseId}`)
