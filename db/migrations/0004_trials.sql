-- Phase 5: every clinic gets a TRIAL subscription.
-- Plans stay in plans.seed.json until Phase 10, so subscriptions reference
-- them by code rather than by a plans(id) foreign key.

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS time_zone text NOT NULL DEFAULT 'Asia/Kolkata';

CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  plan_code text NOT NULL,
  status text NOT NULL CHECK (status IN ('TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED')),
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  grace_ends_at timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  cancelled_at timestamptz,
  expired_at timestamptz,
  price_paise_snapshot integer,
  provider text,
  provider_customer_id text,
  provider_subscription_id text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status <> 'TRIAL' OR (trial_started_at IS NOT NULL AND trial_ends_at > trial_started_at))
);

-- Exactly one current subscription per clinic.
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_one_current
  ON subscriptions (business_id) WHERE status IN ('TRIAL', 'ACTIVE', 'PAST_DUE');

-- The daily expiry job scans only live trials.
CREATE INDEX IF NOT EXISTS subscriptions_trial_due_idx
  ON subscriptions (trial_ends_at) WHERE status = 'TRIAL';

CREATE TABLE IF NOT EXISTS subscription_events (
  id bigserial PRIMARY KEY,
  subscription_id uuid NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES businesses(id),
  type text NOT NULL,
  from_status text,
  to_status text,
  actor_type text NOT NULL CHECK (actor_type IN ('SYSTEM', 'USER', 'PLATFORM_ADMIN', 'PROVIDER')),
  actor_user_id uuid REFERENCES profiles(user_id) ON DELETE SET NULL,
  data jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS subscription_events_business_time_idx
  ON subscription_events (business_id, created_at DESC);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_events ENABLE ROW LEVEL SECURITY;

-- Backfill: clinics created before Phase 5 get a trial from their signup
-- date. 15 matches trialDays in plans.seed.json at the time of writing; the
-- trial ends at local midnight at the start of day 15 (signup day = day 0).
WITH backfilled AS (
  INSERT INTO subscriptions (business_id, plan_code, status, trial_started_at, trial_ends_at, price_paise_snapshot)
  SELECT b.id, 'TRIAL', 'TRIAL', b.created_at,
         (((b.created_at AT TIME ZONE b.time_zone)::date + 15)::timestamp AT TIME ZONE b.time_zone),
         0
  FROM businesses b
  WHERE NOT EXISTS (SELECT 1 FROM subscriptions s WHERE s.business_id = b.id)
  RETURNING id, business_id
)
INSERT INTO subscription_events (subscription_id, business_id, type, to_status, actor_type, data)
SELECT id, business_id, 'TRIAL_STARTED', 'TRIAL', 'SYSTEM', '{"backfilled": true}'::jsonb
FROM backfilled;
