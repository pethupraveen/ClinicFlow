import "server-only";

import type { TransactionSql } from "postgres";
import { database } from "@/lib/db";
import { getTrialPlan } from "@/modules/subscriptions/plans";
import { trialEndsAt, type SubscriptionStatus } from "./dates";

export interface CurrentSubscription {
  planCode: string;
  status: SubscriptionStatus;
  trialStartedAt: Date | null;
  trialEndsAt: Date | null;
  timeZone: string;
}

/** Starts a clinic's trial inside the caller's transaction (the clinic-creation one). */
export async function createTrialSubscription(
  tx: TransactionSql,
  input: { businessId: string; userId: string; timeZone: string; now: Date },
): Promise<void> {
  const plan = getTrialPlan();
  const endsAt = trialEndsAt(input.now, plan.trialDays, input.timeZone);
  const [sub] = await tx<{ id: string }[]>`
    INSERT INTO subscriptions (business_id, plan_code, status, trial_started_at, trial_ends_at, price_paise_snapshot)
    VALUES (${input.businessId}::uuid, ${plan.code}, 'TRIAL', ${input.now.toISOString()}::timestamptz,
            ${endsAt.toISOString()}::timestamptz, ${plan.pricePaise})
    RETURNING id
  `;
  await tx`
    INSERT INTO subscription_events (subscription_id, business_id, type, to_status, actor_type, actor_user_id, data)
    VALUES (${sub.id}::uuid, ${input.businessId}::uuid, 'TRIAL_STARTED', 'TRIAL', 'USER', ${input.userId}::uuid,
            ${JSON.stringify({ trialDays: plan.trialDays })}::jsonb)
  `;
}

/** The clinic's current subscription, or its most recent one if none is current. */
export async function findSubscription(businessId: string): Promise<CurrentSubscription | null> {
  const rows = await database()<{
    plan_code: string;
    status: SubscriptionStatus;
    trial_started_at: Date | null;
    trial_ends_at: Date | null;
    time_zone: string;
  }[]>`
    SELECT s.plan_code, s.status, s.trial_started_at, s.trial_ends_at, b.time_zone
    FROM subscriptions s
    JOIN businesses b ON b.id = s.business_id
    WHERE s.business_id = ${businessId}::uuid
    ORDER BY (s.status IN ('TRIAL', 'ACTIVE', 'PAST_DUE')) DESC, s.created_at DESC
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) return null;
  return {
    planCode: row.plan_code,
    status: row.status,
    trialStartedAt: row.trial_started_at,
    trialEndsAt: row.trial_ends_at,
    timeZone: row.time_zone,
  };
}

/**
 * Saves every trial that has run out as EXPIRED and logs TRIAL_EXPIRED, in
 * one statement. Running it again expires nothing new, so retries are safe.
 */
export async function expireDueTrials(now: Date): Promise<number> {
  const rows = await database()`
    WITH expired AS (
      UPDATE subscriptions
      SET status = 'EXPIRED', expired_at = trial_ends_at, updated_at = now()
      WHERE status = 'TRIAL' AND trial_ends_at <= ${now.toISOString()}::timestamptz
      RETURNING id, business_id, trial_ends_at
    )
    INSERT INTO subscription_events (subscription_id, business_id, type, from_status, to_status, actor_type, data)
    SELECT id, business_id, 'TRIAL_EXPIRED', 'TRIAL', 'EXPIRED', 'SYSTEM',
           jsonb_build_object('trialEndsAt', trial_ends_at)
    FROM expired
    RETURNING id
  `;
  return rows.length;
}
