import "server-only";

import type { JSONValue } from "postgres";
import type { Touch } from "@/modules/attribution/attribution";
import { database } from "@/lib/db";
import { recordProductEvent } from "@/modules/onboarding/events";
import { DEFAULT_TIME_ZONE } from "@/modules/trial/dates";
import { createTrialSubscription } from "@/modules/trial/store";
import { newPublicId } from "./tokens";

export type Role = "OWNER" | "ADMIN" | "RECEPTIONIST";

export interface Membership {
  userId: string;
  fullName: string;
  emailVerified: boolean;
  role: Role;
  business: { id: string; publicId: string; name: string };
}

/**
 * Writes everything a new clinic owner owns in one transaction: profile,
 * clinic, OWNER membership, TRIAL subscription, onboarding row, attribution
 * snapshot, the audit entry and the clinic_created product event.
 * Returns false if this user already has a profile (a double submit).
 */
export async function createAccountRecords(input: {
  userId: string;
  fullName: string;
  clinicName: string;
  emailVerified: boolean;
  visitorId: string | null;
  firstTouch: Touch | null;
  lastTouch: Touch | null;
  ipHash: string | null;
}): Promise<boolean> {
  const attribution = { firstTouch: input.firstTouch, lastTouch: input.lastTouch };
  return database().begin(async (tx) => {
    const inserted = await tx`
      INSERT INTO profiles (user_id, full_name, email_verified_at)
      VALUES (${input.userId}::uuid, ${input.fullName}, ${input.emailVerified ? new Date().toISOString() : null}::timestamptz)
      ON CONFLICT (user_id) DO NOTHING
      RETURNING user_id
    `;
    if (inserted.length === 0) return false;
    const [business] = await tx<{ id: string; public_id: string }[]>`
      INSERT INTO businesses (public_id, name, time_zone, acq_visitor_id, signup_attribution)
      VALUES (${newPublicId("c")}, ${input.clinicName}, ${DEFAULT_TIME_ZONE}, ${input.visitorId}::uuid,
              ${tx.json(attribution as unknown as JSONValue)})
      RETURNING id, public_id
    `;
    await tx`
      INSERT INTO business_members (business_id, user_id, role)
      VALUES (${business.id}::uuid, ${input.userId}::uuid, 'OWNER')
    `;
    await createTrialSubscription(tx, {
      businessId: business.id,
      userId: input.userId,
      timeZone: DEFAULT_TIME_ZONE,
      now: new Date(),
    });
    await tx`INSERT INTO business_onboarding (business_id) VALUES (${business.id}::uuid)`;
    await recordProductEvent(tx, { businessId: business.id, userId: input.userId, name: "clinic_created" });
    await tx`
      INSERT INTO audit_logs (actor_type, actor_user_id, business_id, action, target_type, target_public_id, ip_hash)
      VALUES ('USER', ${input.userId}::uuid, ${business.id}::uuid, 'auth.signup', 'business', ${business.public_id}, ${input.ipHash})
    `;
    return true;
  });
}

/** The signed-in user's clinic. Phase 4 has one membership per user. */
export async function findMembership(userId: string): Promise<Membership | null> {
  const rows = await database()<{
    full_name: string;
    email_verified_at: Date | null;
    role: Role;
    business_id: string;
    public_id: string;
    name: string;
  }[]>`
    SELECT p.full_name, p.email_verified_at, m.role, b.id AS business_id, b.public_id, b.name
    FROM profiles p
    JOIN business_members m ON m.user_id = p.user_id
    JOIN businesses b ON b.id = m.business_id
    WHERE p.user_id = ${userId}::uuid
    ORDER BY m.created_at
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) return null;
  return {
    userId,
    fullName: row.full_name,
    emailVerified: row.email_verified_at !== null,
    role: row.role,
    business: { id: row.business_id, publicId: row.public_id, name: row.name },
  };
}
