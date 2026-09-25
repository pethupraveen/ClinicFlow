-- Phase 3: pseudonymous marketing and demo analytics.
-- Run with `npm run db:migrate` after DATABASE_URL is available.

CREATE TABLE IF NOT EXISTS schema_migrations (
  name text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS demo_sessions (
  id uuid PRIMARY KEY,
  visitor_id uuid NOT NULL,
  token_hash char(64) NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS demo_sessions_visitor_created_idx
  ON demo_sessions (visitor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS demo_sessions_token_active_idx
  ON demo_sessions (token_hash, expires_at DESC);

CREATE TABLE IF NOT EXISTS demo_events (
  id bigserial PRIMARY KEY,
  demo_session_id uuid NOT NULL REFERENCES demo_sessions(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (name IN (
    'demo_started',
    'demo_booking_started',
    'demo_booking_confirmed',
    'demo_dashboard_viewed',
    'demo_completed',
    'demo_restarted',
    'demo_trial_cta_clicked',
    'demo_book_demo_cta_clicked'
  )),
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS demo_events_session_time_idx
  ON demo_events (demo_session_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS marketing_events (
  id bigserial PRIMARY KEY,
  visitor_id uuid NOT NULL,
  name text NOT NULL CHECK (name IN ('marketing_page_viewed')),
  page text NOT NULL CHECK (page IN ('landing', 'demo')),
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS marketing_events_visitor_time_idx
  ON marketing_events (visitor_id, occurred_at DESC);
