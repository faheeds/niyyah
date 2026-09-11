import { defineConfig } from 'vite'
import vinext from 'vinext'
import { sites } from '@openai/sites-vite-plugin'
import hostingConfig from './.openai/hosting.json' with { type: 'json' }

const SITE_CREATOR_PLACEHOLDER_DATABASE_ID = '00000000-0000-4000-8000-000000000000'

const localBindingConfig = {
  main: 'vinext/server/fetch-handler',
  compatibility_flags: ['nodejs_compat'],
  d1_databases: hostingConfig.d1 ? [{
    binding: hostingConfig.d1,
    database_name: 'niyyah-community-d1',
    database_id: SITE_CREATOR_PLACEHOLDER_DATABASE_ID,
  }] : [],
  // P2-01: cover photos and gallery images for organization landing pages
  // (app/api/org-images/route.js). One shared bucket across staging and
  // production - unlike d1_databases above, an R2 binding only needs a
  // bucket *name*, not a per-environment id, so there's nothing here for
  // scripts/patch-wrangler-config.mjs to patch at deploy time. Object keys
  // are namespaced by organization id, which is already unique per
  // environment's own D1 database, so the two environments can't collide.
  r2_buckets: [{
    binding: 'ORG_IMAGES',
    bucket_name: 'niyyah-community-images',
  }],
}

export default defineConfig(async () => {
  process.env.WRANGLER_WRITE_LOGS ??= 'false'
  process.env.WRANGLER_LOG_PATH ??= '.wrangler/logs'
  process.env.MINIFLARE_REGISTRY_PATH ??= '.wrangler/registry'
  const { cloudflare } = await import('@cloudflare/vite-plugin')

  return {
    plugins: [
      vinext(),
      sites(),
      cloudflare({
        viteEnvironment: { name: 'rsc', childEnvironments: ['ssr'] },
        config: localBindingConfig,
      }),
    ],
  }
})
