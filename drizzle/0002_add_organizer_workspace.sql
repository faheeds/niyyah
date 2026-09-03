CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY NOT NULL, owner_user_id TEXT NOT NULL UNIQUE, name TEXT NOT NULL, organization_type TEXT NOT NULL,
  registration_number TEXT, email TEXT NOT NULL, phone TEXT NOT NULL, website TEXT, address TEXT NOT NULL, postcode TEXT NOT NULL,
  description TEXT NOT NULL, safeguarding_name TEXT NOT NULL, safeguarding_email TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS organization_events (
  id TEXT PRIMARY KEY NOT NULL, organization_id TEXT NOT NULL, title TEXT NOT NULL, summary TEXT NOT NULL, interest TEXT NOT NULL,
  age_range TEXT NOT NULL, location_name TEXT NOT NULL, address TEXT NOT NULL, postcode TEXT NOT NULL, start_at TEXT NOT NULL,
  end_at TEXT NOT NULL, capacity INTEGER, event_type TEXT NOT NULL DEFAULT 'community', status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS volunteer_activity_organizations (
  activity_id TEXT PRIMARY KEY NOT NULL, organization_id TEXT NOT NULL, event_id TEXT, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_org_status ON organization_events(organization_id,status,start_at);
CREATE INDEX IF NOT EXISTS idx_events_public ON organization_events(status,start_at);
CREATE INDEX IF NOT EXISTS idx_activity_org ON volunteer_activity_organizations(organization_id);
