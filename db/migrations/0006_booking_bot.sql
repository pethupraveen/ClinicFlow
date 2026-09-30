-- Phase 6b: booking bot — patients, appointments, conversations.

-- Repair: earlier code passed JSON.stringify(...) into ::jsonb parameters,
-- which postgres.js encodes a second time, so these rows hold a JSON string
-- instead of an object. Unwrap them (safe to re-run).
UPDATE businesses SET signup_attribution = (signup_attribution #>> '{}')::jsonb
  WHERE jsonb_typeof(signup_attribution) = 'string';
UPDATE subscription_events SET data = (data #>> '{}')::jsonb
  WHERE jsonb_typeof(data) = 'string';
UPDATE product_events SET properties = (properties #>> '{}')::jsonb
  WHERE jsonb_typeof(properties) = 'string';

-- Supabase keeps extensions in the `extensions` schema. Default operator
-- classes are found by type, so the exclusion constraint below works
-- whichever schema btree_gist lives in.
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS appointment_seq integer NOT NULL DEFAULT 1000;

CREATE TABLE IF NOT EXISTS patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  phone text NOT NULL CHECK (char_length(phone) <= 80),
  name text CHECK (char_length(name) <= 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, phone)
);

CREATE TABLE IF NOT EXISTS appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  public_id text NOT NULL UNIQUE,
  ref text NOT NULL,
  doctor_id uuid NOT NULL REFERENCES doctors(id),
  patient_id uuid NOT NULL REFERENCES patients(id),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'BOOKED' CHECK (status IN ('BOOKED', 'CANCELLED')),
  channel text NOT NULL CHECK (channel IN ('TEST_CHAT', 'WHATSAPP')),
  is_test boolean NOT NULL DEFAULT false,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (starts_at < ends_at),
  UNIQUE (business_id, ref),
  -- No two real bookings for one doctor may overlap, even under concurrent taps.
  CONSTRAINT appointments_no_double_booking
    EXCLUDE USING gist (doctor_id WITH =, tstzrange(starts_at, ends_at) WITH &&)
    WHERE (status = 'BOOKED' AND NOT is_test)
);

CREATE INDEX IF NOT EXISTS appointments_business_time_idx ON appointments (business_id, starts_at);
CREATE INDEX IF NOT EXISTS appointments_patient_idx ON appointments (patient_id, starts_at);

CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('TEST_CHAT', 'WHATSAPP')),
  contact text NOT NULL CHECK (char_length(contact) <= 80),
  state jsonb NOT NULL DEFAULT '{}',
  needs_human_at timestamptz,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, channel, contact)
);

CREATE TABLE IF NOT EXISTS conversation_messages (
  id bigserial PRIMARY KEY,
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  direction text NOT NULL CHECK (direction IN ('IN', 'OUT')),
  body jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS conversation_messages_conv_idx ON conversation_messages (conversation_id, id);

CREATE TABLE IF NOT EXISTS business_milestones (
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  milestone text NOT NULL,
  reached_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (business_id, milestone)
);

ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_milestones ENABLE ROW LEVEL SECURITY;
