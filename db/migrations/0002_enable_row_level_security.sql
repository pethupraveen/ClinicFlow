-- Supabase exposes the public schema through its Data API. Enabling RLS with
-- no policies denies the anon/authenticated roles; the server connects as the
-- table owner, which bypasses RLS.

ALTER TABLE schema_migrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE demo_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE demo_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_events ENABLE ROW LEVEL SECURITY;
