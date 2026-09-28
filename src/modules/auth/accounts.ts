import "server-only";

import type { Touch } from "@/modules/attribution/attribution";
import { database } from "@/lib/db";
import { hashToken, newPublicId, newToken, VERIFY_EMAIL_TTL_SECONDS } from "./tokens";

export type Role = "OWNER" | "ADMIN" | "RECEPTIONIST";

export interface Membership {
  userId: string;
  fullName: string;
  emailVerified: boolean;
  role: Role;
  business: { id: string; publicId: string; name: string };
}

/**
 * Writes everything a new signup owns in one transaction: profile, clinic,
 * OWNER membership, attribution snapshot, first verification token and the
 * audit entry. Returns the raw verification token for the email link.
 */
export async function createAccountRecords(input: {
  userId: string;
  fullName: string;
  clinicName: string;
  visitorId: string | null;
  firstTouch: Touch | null;
  lastTouch: Touch | null;
  ipHash: string | null;
}): Promise<{ verifyToken: string }> {
  const verifyToken = newToken();
  const attribution = { firstTouch: input.firstTouch, lastTouch: input.lastTouch };
  await database().begin(async (tx) => {
    await tx`INSERT INTO profiles (user_id, full_name) VALUES (${input.userId}::uuid, ${input.fullName})`;
    const [business] = await tx<{ id: string; public_id: string }[]>`
      INSERT INTO businesses (public_id, name, acq_visitor_id, signup_attribution)
      VALUES (${newPublicId("c")}, ${input.clinicName}, ${input.visitorId}::uuid, ${JSON.stringify(attribution)}::jsonb)
      RETURNING id, public_id
    `;
    await tx`
      INSERT INTO business_members (business_id, user_id, role)
      VALUES (${business.id}::uuid, ${input.userId}::uuid, 'OWNER')
    `;
    await tx`
      INSERT INTO email_verification_tokens (token_hash, user_id, expires_at)
      VALUES (${hashToken(verifyToken)}, ${input.userId}::uuid, now() + make_interval(secs => ${VERIFY_EMAIL_TTL_SECONDS}))
    `;
    await tx`
      INSERT INTO audit_logs (actor_type, actor_user_id, business_id, action, target_type, target_public_id, ip_hash)
      VALUES ('USER', ${input.userId}::uuid, ${business.id}::uuid, 'auth.signup', 'business', ${business.public_id}, ${input.ipHash})
    `;
  });
  return { verifyToken };
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

/** Issues a fresh verification token; earlier unused ones stay valid until they expire. */
export async function createVerificationToken(userId: string): Promise<string> {
  const token = newToken();
  await database()`
    INSERT INTO email_verification_tokens (token_hash, user_id, expires_at)
    VALUES (${hashToken(token)}, ${userId}::uuid, now() + make_interval(secs => ${VERIFY_EMAIL_TTL_SECONDS}))
  `;
  return token;
}

/** Spends a verification token once and marks the email verified. */
export async function consumeVerificationToken(token: string, ipHash: string | null): Promise<boolean> {
  return database().begin(async (tx) => {
    const [used] = await tx<{ user_id: string }[]>`
      UPDATE email_verification_tokens
      SET used_at = now()
      WHERE token_hash = ${hashToken(token)} AND used_at IS NULL AND expires_at > now()
      RETURNING user_id
    `;
    if (!used) return false;
    await tx`
      UPDATE profiles SET email_verified_at = coalesce(email_verified_at, now())
      WHERE user_id = ${used.user_id}::uuid
    `;
    await tx`
      INSERT INTO audit_logs (actor_type, actor_user_id, action, ip_hash)
      VALUES ('USER', ${used.user_id}::uuid, 'auth.email_verified', ${ipHash})
    `;
    return true;
  });
}

export async function recordAudit(input: { userId: string; action: string; ipHash: string | null }): Promise<void> {
  await database()`
    INSERT INTO audit_logs (actor_type, actor_user_id, action, ip_hash)
    VALUES ('USER', ${input.userId}::uuid, ${input.action}, ${input.ipHash})
  `;
}
