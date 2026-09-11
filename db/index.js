import { env } from 'cloudflare:workers'

// Each prepare*Tables() function re-runs its full CREATE TABLE/INDEX IF NOT
// EXISTS list on every call, and every route that touches the database calls
// one of these on every request - that batch has grown from a handful of
// statements to ~35 (organization_email_domains/organization_members/
// organization_admins and their indexes, added across the roster and
// multi-admin PRs) without anyone noticing, because it's cheap in isolation.
// Combined with a request that also does real work - PBKDF2 password hashing
// on sign-up/sign-in chief among them - it was enough to blow Workers' CPU
// time limit, which surfaces only as a generic 500 (the catch block in every
// route swallows the real error). These module-level flags make the bootstrap
// batch run once per isolate instead of once per request - a cold start still
// creates anything missing, but a warm isolate (the overwhelming majority of
// requests) skips 35 no-op statements it already knows succeeded.
let membersTablesReady = false
let authTablesReady = false
let communityTablesReady = false

export async function prepareMembersTable() {
  const db = env.DB
  if (membersTablesReady) return db
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS community_members (
      id TEXT PRIMARY KEY NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      phone TEXT,
      age_group TEXT NOT NULL,
      postcode TEXT NOT NULL,
      interests TEXT NOT NULL,
      preferred_contact TEXT NOT NULL,
      heard_about_us TEXT,
      instagram TEXT,
      tiktok TEXT,
      other_social TEXT,
      updates_opt_in INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`),
    db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_community_members_email ON community_members(email)'),
    db.prepare(`CREATE TABLE IF NOT EXISTS volunteer_challenges (
      inviter_user_id TEXT PRIMARY KEY NOT NULL,
      inviter_email TEXT NOT NULL,
      invite_code TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS volunteer_referrals (
      id TEXT PRIMARY KEY NOT NULL,
      inviter_user_id TEXT NOT NULL,
      invitee_email TEXT NOT NULL UNIQUE,
      invitee_user_id TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL,
      completed_at TEXT,
      UNIQUE(inviter_user_id,invitee_email)
    )`),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_referrals_inviter_status ON volunteer_referrals(inviter_user_id,status)'),
  ])
  await db.prepare('PRAGMA optimize').run()
  membersTablesReady = true
  return db
}

export async function prepareAuthTables() {
  const db = env.DB
  if (authTablesReady) return db
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY NOT NULL,
      email TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      password_hash TEXT,
      password_salt TEXT,
      google_sub TEXT UNIQUE,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS auth_sessions (
      id TEXT PRIMARY KEY NOT NULL,
      account_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    )`),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_auth_sessions_account ON auth_sessions(account_id)'),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires ON auth_sessions(expires_at)'),
  ])
  await db.prepare('PRAGMA optimize').run()
  authTablesReady = true
  return db
}

export async function prepareCommunityTables() {
  const db = env.DB
  if (communityTablesReady) return db
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS community_members (
      id TEXT PRIMARY KEY NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      phone TEXT,
      age_group TEXT NOT NULL,
      postcode TEXT NOT NULL,
      interests TEXT NOT NULL,
      preferred_contact TEXT NOT NULL,
      heard_about_us TEXT,
      instagram TEXT,
      tiktok TEXT,
      other_social TEXT,
      updates_opt_in INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`),
    db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_community_members_email ON community_members(email)'),
    db.prepare(`CREATE TABLE IF NOT EXISTS member_profiles (
      user_id TEXT PRIMARY KEY NOT NULL,
      email TEXT NOT NULL,
      display_name TEXT NOT NULL,
      bio TEXT,
      postcode TEXT,
      interests TEXT NOT NULL DEFAULT '[]',
      instagram TEXT,
      tiktok TEXT,
      other_social TEXT,
      discoverable INTEGER NOT NULL DEFAULT 0,
      share_activity INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS volunteer_activities (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      organization TEXT NOT NULL,
      role TEXT NOT NULL,
      hours INTEGER NOT NULL CHECK(hours > 0 AND hours <= 1000),
      activity_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'self_reported',
      created_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS member_connections (
      id TEXT PRIMARY KEY NOT NULL,
      requester_id TEXT NOT NULL,
      recipient_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      CHECK(requester_id != recipient_id),
      UNIQUE(requester_id, recipient_id)
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY NOT NULL,
      owner_user_id TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      organization_type TEXT NOT NULL,
      registration_number TEXT,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      website TEXT,
      address TEXT NOT NULL,
      postcode TEXT NOT NULL,
      description TEXT NOT NULL,
      safeguarding_name TEXT NOT NULL,
      safeguarding_email TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS organization_email_domains (
      id TEXT PRIMARY KEY NOT NULL,
      organization_id TEXT NOT NULL,
      domain TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(organization_id, domain)
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS organization_members (
      id TEXT PRIMARY KEY NOT NULL,
      organization_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      email TEXT NOT NULL,
      display_name TEXT NOT NULL,
      tag TEXT NOT NULL DEFAULT 'external',
      status TEXT NOT NULL DEFAULT 'pending',
      source TEXT NOT NULL DEFAULT 'self_requested',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(organization_id, user_id)
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS organization_admins (
      id TEXT PRIMARY KEY NOT NULL,
      organization_id TEXT NOT NULL,
      user_id TEXT,
      email TEXT NOT NULL,
      display_name TEXT,
      role TEXT NOT NULL DEFAULT 'staff',
      status TEXT NOT NULL DEFAULT 'invited',
      invite_token TEXT,
      invited_by_user_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(organization_id, email)
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS organization_events (
      id TEXT PRIMARY KEY NOT NULL,
      organization_id TEXT NOT NULL,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      interest TEXT NOT NULL,
      age_range TEXT NOT NULL,
      location_name TEXT NOT NULL,
      address TEXT NOT NULL,
      postcode TEXT NOT NULL,
      start_at TEXT NOT NULL,
      end_at TEXT NOT NULL,
      capacity INTEGER,
      event_type TEXT NOT NULL DEFAULT 'community',
      status TEXT NOT NULL DEFAULT 'draft',
      recurrence TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS volunteer_activity_organizations (
      activity_id TEXT PRIMARY KEY NOT NULL,
      organization_id TEXT NOT NULL,
      event_id TEXT,
      created_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS volunteer_opportunities (
      event_id TEXT PRIMARY KEY NOT NULL,
      compensation_type TEXT NOT NULL DEFAULT 'unpaid',
      pay_details TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS volunteer_applications (
      id TEXT PRIMARY KEY NOT NULL,
      event_id TEXT NOT NULL,
      organization_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      applicant_email TEXT NOT NULL,
      applicant_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'new',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(event_id,user_id)
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS event_participations (
      id TEXT PRIMARY KEY NOT NULL,
      event_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'going',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(event_id,user_id)
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS event_signup_slots (
      id TEXT PRIMARY KEY NOT NULL,
      event_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      selected_date TEXT NOT NULL,
      selected_time TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(event_id,user_id)
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS event_volunteer_requirements (
      event_id TEXT PRIMARY KEY NOT NULL,
      gender_appropriateness TEXT NOT NULL DEFAULT 'Any gender',
      location_preference TEXT,
      travel_required INTEGER NOT NULL DEFAULT 0,
      volunteers_needed INTEGER NOT NULL DEFAULT 1,
      auto_pause INTEGER NOT NULL DEFAULT 1,
      preferred_interests TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS volunteer_challenges (
      inviter_user_id TEXT PRIMARY KEY NOT NULL,
      inviter_email TEXT NOT NULL,
      invite_code TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS volunteer_referrals (
      id TEXT PRIMARY KEY NOT NULL,
      inviter_user_id TEXT NOT NULL,
      invitee_email TEXT NOT NULL UNIQUE,
      invitee_user_id TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL,
      completed_at TEXT,
      UNIQUE(inviter_user_id,invitee_email)
    )`),
    // P1-09: an organizer-run competition over a date range, with its own
    // custom award tiers (Gold/Silver/Bronze or whatever names they choose).
    // Participants are the org's roster (organization_members) - see
    // app/lib/awards.js for how a person's hours map to a tier.
    db.prepare(`CREATE TABLE IF NOT EXISTS award_competitions (
      id TEXT PRIMARY KEY NOT NULL,
      organization_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS award_tiers (
      id TEXT PRIMARY KEY NOT NULL,
      competition_id TEXT NOT NULL,
      name TEXT NOT NULL,
      min_hours INTEGER NOT NULL CHECK(min_hours > 0),
      sort_order INTEGER NOT NULL,
      created_at TEXT NOT NULL
    )`),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_profiles_discoverable ON member_profiles(discoverable, display_name)'),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_activities_user_date ON volunteer_activities(user_id, activity_date DESC)'),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_connections_recipient_status ON member_connections(recipient_id, status)'),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_events_org_status ON organization_events(organization_id, status, start_at)'),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_events_public ON organization_events(status, start_at)'),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_activity_org ON volunteer_activity_organizations(organization_id)'),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_applications_org_status ON volunteer_applications(organization_id,status,created_at)'),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_participations_event ON event_participations(event_id,status)'),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_signup_slots_event_date ON event_signup_slots(event_id,selected_date,selected_time)'),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_requirements_needed ON event_volunteer_requirements(volunteers_needed,auto_pause)'),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_referrals_inviter_status ON volunteer_referrals(inviter_user_id,status)'),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_org_domains_domain ON organization_email_domains(domain)'),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_org_members_org_status ON organization_members(organization_id,status)'),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_org_members_user ON organization_members(user_id)'),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_org_admins_org ON organization_admins(organization_id,status)'),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_org_admins_user ON organization_admins(user_id)'),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_org_admins_email ON organization_admins(email)'),
    db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_org_admins_token ON organization_admins(invite_token)'),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_award_competitions_org ON award_competitions(organization_id,start_date DESC)'),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_award_tiers_competition ON award_tiers(competition_id,min_hours DESC)'),
  ])
  // organization_events predates the `recurrence` column (added for P1-02 -
  // see app/lib/recurrence.js), so CREATE TABLE IF NOT EXISTS above is a
  // no-op against any database bootstrapped before this change. SQLite has
  // no ADD COLUMN IF NOT EXISTS, so this runs once per isolate (guarded by
  // communityTablesReady like the rest of this function) and tolerates
  // already having the column.
  try {
    await db.prepare('ALTER TABLE organization_events ADD COLUMN recurrence TEXT').run()
  } catch (e) {
    if (!String(e).toLowerCase().includes('duplicate column')) throw e
  }
  await db.prepare('PRAGMA optimize').run()
  communityTablesReady = true
  return db
}
