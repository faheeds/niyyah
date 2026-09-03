CREATE TABLE IF NOT EXISTS event_participations (id TEXT PRIMARY KEY NOT NULL,event_id TEXT NOT NULL,user_id TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'going',created_at TEXT NOT NULL,updated_at TEXT NOT NULL,UNIQUE(event_id,user_id));
CREATE INDEX IF NOT EXISTS idx_participations_event ON event_participations(event_id,status);
