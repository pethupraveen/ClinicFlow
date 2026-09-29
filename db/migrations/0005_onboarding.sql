-- Phase 6a: onboarding wizard — clinic info, doctors, weekly hours, FAQ.
-- Step completion is derived from these tables, never stored as flags.

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS phone text CHECK (char_length(phone) <= 20),
  ADD COLUMN IF NOT EXISTS address text CHECK (char_length(address) <= 300),
  ADD COLUMN IF NOT EXISTS city text CHECK (char_length(city) <= 80),
  ADD COLUMN IF NOT EXISTS maps_url text CHECK (char_length(maps_url) <= 500),
  ADD COLUMN IF NOT EXISTS lifecycle_status text NOT NULL DEFAULT 'ONBOARDING'
    CHECK (lifecycle_status IN ('ONBOARDING', 'LIVE', 'PAUSED', 'PENDING_DELETION')),
  ADD COLUMN IF NOT EXISTS went_live_at timestamptz,
  ADD COLUMN IF NOT EXISTS activated_at timestamptz;

CREATE TABLE IF NOT EXISTS business_onboarding (
  business_id uuid PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  faq_skipped_at timestamptz,
  bot_tested_at timestamptz,
  last_step smallint NOT NULL DEFAULT 1 CHECK (last_step BETWEEN 1 AND 7)
);

INSERT INTO business_onboarding (business_id, started_at)
SELECT id, created_at FROM businesses
ON CONFLICT (business_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS doctors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  public_id text NOT NULL UNIQUE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  specialty text NOT NULL DEFAULT '' CHECK (char_length(specialty) <= 80),
  appointment_minutes smallint NOT NULL CHECK (appointment_minutes IN (10, 15, 20, 30)),
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS doctors_business_idx ON doctors (business_id, created_at);

CREATE TABLE IF NOT EXISTS doctor_hours (
  id bigserial PRIMARY KEY,
  doctor_id uuid NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 1 AND 7), -- ISO: 1 = Monday
  start_time time NOT NULL,
  end_time time NOT NULL,
  CHECK (start_time < end_time)
);

CREATE INDEX IF NOT EXISTS doctor_hours_doctor_idx ON doctor_hours (doctor_id, weekday, start_time);

CREATE TABLE IF NOT EXISTS faqs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  public_id text NOT NULL UNIQUE,
  question text NOT NULL CHECK (char_length(question) BETWEEN 1 AND 200),
  answer text NOT NULL CHECK (char_length(answer) BETWEEN 1 AND 1000),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS faqs_business_idx ON faqs (business_id, sort_order, created_at);

CREATE TABLE IF NOT EXISTS product_events (
  id bigserial PRIMARY KEY,
  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(user_id) ON DELETE SET NULL,
  name text NOT NULL,
  properties jsonb NOT NULL DEFAULT '{}',
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS product_events_name_time_idx ON product_events (name, occurred_at);
CREATE INDEX IF NOT EXISTS product_events_business_time_idx ON product_events (business_id, occurred_at);

ALTER TABLE business_onboarding ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctor_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE faqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_events ENABLE ROW LEVEL SECURITY;
