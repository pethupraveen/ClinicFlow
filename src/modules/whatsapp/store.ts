import "server-only";

import { database } from "@/lib/db";
import { ENV, readEnv } from "@/lib/env";
import { recordProductEvent } from "@/modules/onboarding/events";
import { waLink } from "./codes";
import type { Lifecycle } from "./gate";
import { decryptToken, encryptToken } from "./secrets";

export interface SharedNumber {
  phoneNumberId: string;
  token: string;
  displayNumber: string;
}

/** The shared ClinicFlow number, or null until it's configured. */
export function sharedNumber(): SharedNumber | null {
  const phoneNumberId = readEnv(ENV.sharedPhoneNumberId);
  const token = readEnv(ENV.sharedAccessToken);
  const displayNumber = readEnv(ENV.sharedDisplayNumber);
  return phoneNumberId && token && displayNumber ? { phoneNumberId, token, displayNumber } : null;
}

function tokenKey(): string {
  const key = readEnv(ENV.whatsappTokenKey);
  if (!key) throw new Error("WHATSAPP_TOKEN_KEY is not configured.");
  return key;
}

// ---------- routing ----------

export type Route = { kind: "shared"; number: SharedNumber } | { kind: "own"; businessId: string; phoneNumberId: string; token: string } | null;

export async function routeFor(phoneNumberId: string): Promise<Route> {
  const shared = sharedNumber();
  if (shared && shared.phoneNumberId === phoneNumberId) return { kind: "shared", number: shared };
  const [row] = await database()<{ business_id: string; access_token_enc: string }[]>`
    SELECT business_id, access_token_enc FROM whatsapp_connections WHERE phone_number_id = ${phoneNumberId}
  `;
  if (!row) return null;
  return { kind: "own", businessId: row.business_id, phoneNumberId, token: decryptToken(row.access_token_enc, tokenKey()) };
}

export async function businessByCode(code: string): Promise<string | null> {
  const [row] = await database()<{ id: string }[]>`SELECT id FROM businesses WHERE wa_code = ${code}`;
  return row?.id ?? null;
}

export async function sharedRoute(waId: string): Promise<string | null> {
  const [row] = await database()<{ business_id: string }[]>`SELECT business_id FROM shared_number_routes WHERE wa_id = ${waId}`;
  return row?.business_id ?? null;
}

export async function bindSharedRoute(waId: string, businessId: string): Promise<void> {
  await database()`
    INSERT INTO shared_number_routes (wa_id, business_id) VALUES (${waId}, ${businessId}::uuid)
    ON CONFLICT (wa_id) DO UPDATE SET business_id = EXCLUDED.business_id, updated_at = now()
  `;
}

// ---------- idempotency ----------

/** True if this message id hasn't been seen before (and is now claimed). */
export async function claimInbound(messageId: string): Promise<boolean> {
  const rows = await database()`
    INSERT INTO whatsapp_inbound (message_id) VALUES (${messageId}) ON CONFLICT DO NOTHING RETURNING message_id
  `;
  return rows.length > 0;
}

export async function releaseInbound(messageId: string): Promise<void> {
  await database()`DELETE FROM whatsapp_inbound WHERE message_id = ${messageId}`;
}

export async function tagInbound(messageId: string, businessId: string): Promise<void> {
  await database()`UPDATE whatsapp_inbound SET business_id = ${businessId}::uuid WHERE message_id = ${messageId}`;
}

// ---------- gate inputs ----------

export async function gateFacts(businessId: string, waId: string): Promise<{ lifecycle: Lifecycle; name: string; phone: string; lastNoticeAt: Date | null }> {
  const [row] = await database()<{ lifecycle_status: Lifecycle; name: string; phone: string | null; last_notice_at: Date | null }[]>`
    SELECT b.lifecycle_status, b.name, b.phone,
           (SELECT c.last_notice_at FROM conversations c
            WHERE c.business_id = b.id AND c.channel = 'WHATSAPP' AND c.contact = ${waId}) AS last_notice_at
    FROM businesses b WHERE b.id = ${businessId}::uuid
  `;
  return { lifecycle: row.lifecycle_status, name: row.name, phone: row.phone ?? "", lastNoticeAt: row.last_notice_at };
}

export async function markNoticeSent(businessId: string, waId: string): Promise<void> {
  await database()`
    INSERT INTO conversations (business_id, channel, contact, last_notice_at) VALUES (${businessId}::uuid, 'WHATSAPP', ${waId}, now())
    ON CONFLICT (business_id, channel, contact) DO UPDATE SET last_notice_at = now()
  `;
}

// ---------- clinic view (step 5 / 7) ----------

export interface ClinicWhatsApp {
  code: string;
  lifecycle: Lifecycle;
  wentLiveAt: Date | null;
  own: { displayPhone: string; verifiedName: string } | null;
  /** Where patients should message this clinic, or null if no number is configured yet. */
  link: string | null;
  number: string | null;
  openRequest: { contactPhone: string; preferredTime: string; createdAt: Date } | null;
}

export async function clinicWhatsApp(businessId: string): Promise<ClinicWhatsApp> {
  const sql = database();
  const [b] = await sql<{ wa_code: string; lifecycle_status: Lifecycle; went_live_at: Date | null }[]>`
    SELECT wa_code, lifecycle_status, went_live_at FROM businesses WHERE id = ${businessId}::uuid
  `;
  const [own] = await sql<{ display_phone: string; verified_name: string | null }[]>`
    SELECT display_phone, verified_name FROM whatsapp_connections WHERE business_id = ${businessId}::uuid
  `;
  const [request] = await sql<{ contact_phone: string; preferred_time: string; created_at: Date }[]>`
    SELECT contact_phone, preferred_time, created_at FROM whatsapp_setup_requests
    WHERE business_id = ${businessId}::uuid AND status = 'OPEN'
  `;
  const shared = sharedNumber();
  const number = own ? own.display_phone : (shared?.displayNumber ?? null);
  return {
    code: b.wa_code,
    lifecycle: b.lifecycle_status,
    wentLiveAt: b.went_live_at,
    own: own ? { displayPhone: own.display_phone, verifiedName: own.verified_name ?? "" } : null,
    link: own ? waLink(own.display_phone, null) : shared ? waLink(shared.displayNumber, b.wa_code) : null,
    number,
    openRequest: request ? { contactPhone: request.contact_phone, preferredTime: request.preferred_time, createdAt: request.created_at } : null,
  };
}

export async function hasWhatsAppRoute(businessId: string): Promise<boolean> {
  if (sharedNumber()) return true;
  const rows = await database()`SELECT 1 FROM whatsapp_connections WHERE business_id = ${businessId}::uuid`;
  return rows.length > 0;
}

export async function requestSetup(input: { businessId: string; userId: string; contactPhone: string; preferredTime: string; note: string }): Promise<void> {
  await database().begin(async (tx) => {
    await tx`
      INSERT INTO whatsapp_setup_requests (business_id, requested_by, contact_phone, preferred_time, note)
      VALUES (${input.businessId}::uuid, ${input.userId}::uuid, ${input.contactPhone}, ${input.preferredTime}, ${input.note})
      ON CONFLICT (business_id) WHERE status = 'OPEN'
      DO UPDATE SET contact_phone = EXCLUDED.contact_phone, preferred_time = EXCLUDED.preferred_time, note = EXCLUDED.note
    `;
    await recordProductEvent(tx, { businessId: input.businessId, userId: input.userId, name: "whatsapp_setup_requested" });
  });
}

export async function setLifecycle(businessId: string, userId: string, to: "LIVE" | "PAUSED"): Promise<void> {
  await database().begin(async (tx) => {
    await tx`
      UPDATE businesses
      SET lifecycle_status = ${to}, went_live_at = CASE WHEN ${to} = 'LIVE' THEN coalesce(went_live_at, now()) ELSE went_live_at END
      WHERE id = ${businessId}::uuid
    `;
    await tx`
      INSERT INTO audit_logs (actor_type, actor_user_id, business_id, action)
      VALUES ('USER', ${userId}::uuid, ${businessId}::uuid, ${to === "LIVE" ? "clinic.went_live" : "clinic.paused"})
    `;
    await recordProductEvent(tx, { businessId, userId, name: to === "LIVE" ? "went_live" : "bot_paused" });
  });
}

// ---------- staff (/platform/whatsapp) ----------

export interface StaffRequestRow {
  businessPublicId: string;
  clinicName: string;
  clinicPhone: string;
  contactPhone: string;
  preferredTime: string;
  note: string;
  createdAt: Date;
}

export interface StaffConnectionRow {
  businessPublicId: string;
  clinicName: string;
  displayPhone: string;
  verifiedName: string;
  connectedAt: Date;
}

export async function staffOverview(): Promise<{ requests: StaffRequestRow[]; connections: StaffConnectionRow[] }> {
  const sql = database();
  const requests = await sql<{ public_id: string; name: string; phone: string | null; contact_phone: string; preferred_time: string; note: string; created_at: Date }[]>`
    SELECT b.public_id, b.name, b.phone, r.contact_phone, r.preferred_time, r.note, r.created_at
    FROM whatsapp_setup_requests r JOIN businesses b ON b.id = r.business_id
    WHERE r.status = 'OPEN' ORDER BY r.created_at
  `;
  const connections = await sql<{ public_id: string; name: string; display_phone: string; verified_name: string | null; connected_at: Date }[]>`
    SELECT b.public_id, b.name, c.display_phone, c.verified_name, c.connected_at
    FROM whatsapp_connections c JOIN businesses b ON b.id = c.business_id
    ORDER BY c.connected_at DESC
  `;
  return {
    requests: requests.map((r) => ({
      businessPublicId: r.public_id,
      clinicName: r.name,
      clinicPhone: r.phone ?? "",
      contactPhone: r.contact_phone,
      preferredTime: r.preferred_time,
      note: r.note,
      createdAt: r.created_at,
    })),
    connections: connections.map((c) => ({
      businessPublicId: c.public_id,
      clinicName: c.name,
      displayPhone: c.display_phone,
      verifiedName: c.verified_name ?? "",
      connectedAt: c.connected_at,
    })),
  };
}

export async function businessIdByPublicId(publicId: string): Promise<string | null> {
  const [row] = await database()<{ id: string }[]>`SELECT id FROM businesses WHERE public_id = ${publicId}`;
  return row?.id ?? null;
}

/** Stores (or replaces) a clinic's own number; the token is encrypted first. Closes its open request. */
export async function connectOwnNumber(input: {
  businessId: string;
  staffUserId: string;
  phoneNumberId: string;
  token: string;
  displayPhone: string;
  verifiedName: string;
}): Promise<void> {
  const sealed = encryptToken(input.token, tokenKey());
  const displayDigits = input.displayPhone.replace(/\D/g, "");
  await database().begin(async (tx) => {
    await tx`
      INSERT INTO whatsapp_connections (business_id, phone_number_id, display_phone, verified_name, access_token_enc, connected_by)
      VALUES (${input.businessId}::uuid, ${input.phoneNumberId}, ${displayDigits}, ${input.verifiedName}, ${sealed}, (SELECT user_id FROM profiles WHERE user_id = ${input.staffUserId}::uuid))
      ON CONFLICT (business_id) DO UPDATE SET phone_number_id = EXCLUDED.phone_number_id, display_phone = EXCLUDED.display_phone,
        verified_name = EXCLUDED.verified_name, access_token_enc = EXCLUDED.access_token_enc,
        connected_by = EXCLUDED.connected_by, connected_at = now()
    `;
    await tx`
      UPDATE whatsapp_setup_requests SET status = 'DONE', resolved_at = now()
      WHERE business_id = ${input.businessId}::uuid AND status = 'OPEN'
    `;
    await tx`
      INSERT INTO audit_logs (actor_type, actor_user_id, business_id, action, metadata)
      VALUES ('PLATFORM_ADMIN', (SELECT user_id FROM profiles WHERE user_id = ${input.staffUserId}::uuid), ${input.businessId}::uuid, 'whatsapp.connected',
              ${tx.json({ phoneNumberId: input.phoneNumberId })})
    `;
    await recordProductEvent(tx, { businessId: input.businessId, userId: null, name: "whatsapp_connected" });
  });
}

export async function disconnectOwnNumber(businessId: string, staffUserId: string): Promise<void> {
  await database().begin(async (tx) => {
    await tx`DELETE FROM whatsapp_connections WHERE business_id = ${businessId}::uuid`;
    await tx`
      INSERT INTO audit_logs (actor_type, actor_user_id, business_id, action)
      VALUES ('PLATFORM_ADMIN', (SELECT user_id FROM profiles WHERE user_id = ${staffUserId}::uuid), ${businessId}::uuid, 'whatsapp.disconnected')
    `;
  });
}

export async function closeRequest(businessId: string): Promise<void> {
  await database()`
    UPDATE whatsapp_setup_requests SET status = 'DONE', resolved_at = now()
    WHERE business_id = ${businessId}::uuid AND status = 'OPEN'
  `;
}
