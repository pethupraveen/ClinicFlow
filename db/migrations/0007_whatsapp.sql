-- Phase 6c: WhatsApp — shared number routing, clinic-owned numbers, Go Live.

-- Short patient-facing clinic code for the shared number, e.g. C-7K2M9.
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS wa_code text;

-- Backfill existing clinics. translate() maps md5's hex digits onto an
-- alphabet without 0/1/O/I/L/U so codes are easy to read aloud.
UPDATE businesses
SET wa_code = 'C-' || translate(upper(substr(md5(random()::text || id::text), 1, 5)), '0123456789ABCDEF', '23456789ABCDEFGH')
WHERE wa_code IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS businesses_wa_code_key ON businesses (wa_code);

CREATE TABLE IF NOT EXISTS whatsapp_connections (
  business_id uuid PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  phone_number_id text NOT NULL UNIQUE CHECK (phone_number_id ~ '^[0-9]{5,30}$'),
  waba_id text,
  display_phone text NOT NULL,
  verified_name text,
  access_token_enc text NOT NULL,
  connected_by uuid REFERENCES profiles(user_id) ON DELETE SET NULL,
  connected_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS whatsapp_setup_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  requested_by uuid REFERENCES profiles(user_id) ON DELETE SET NULL,
  contact_phone text NOT NULL CHECK (char_length(contact_phone) <= 20),
  preferred_time text NOT NULL DEFAULT '' CHECK (char_length(preferred_time) <= 80),
  note text NOT NULL DEFAULT '' CHECK (char_length(note) <= 500),
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'DONE')),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

-- At most one open request per clinic.
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_setup_requests_one_open
  ON whatsapp_setup_requests (business_id) WHERE status = 'OPEN';

-- Idempotency: Meta redelivers webhooks; each message id is processed once.
CREATE TABLE IF NOT EXISTS whatsapp_inbound (
  message_id text PRIMARY KEY CHECK (char_length(message_id) <= 200),
  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE,
  received_at timestamptz NOT NULL DEFAULT now()
);

-- Which clinic a patient is talking to on the shared number.
CREATE TABLE IF NOT EXISTS shared_number_routes (
  wa_id text PRIMARY KEY CHECK (wa_id ~ '^[0-9]{5,20}$'),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Throttles "not taking bookings" notices to one per patient per 24 h.
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS last_notice_at timestamptz;

ALTER TABLE whatsapp_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_setup_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_inbound ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_number_routes ENABLE ROW LEVEL SECURITY;
