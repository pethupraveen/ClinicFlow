import "server-only";

import type { Sql, TransactionSql } from "postgres";

/** Whitelisted product events (master plan §7). */
export const PRODUCT_EVENTS = [
  "clinic_created",
  "clinic_info_saved",
  "doctor_added",
  "schedule_saved",
  "faq_added",
  "faq_skipped",
] as const;

export type ProductEvent = (typeof PRODUCT_EVENTS)[number];

export async function recordProductEvent(
  sql: Sql | TransactionSql,
  input: { businessId: string; userId: string; name: ProductEvent; properties?: Record<string, string | number | boolean> },
): Promise<void> {
  await sql`
    INSERT INTO product_events (business_id, user_id, name, properties)
    VALUES (${input.businessId}::uuid, ${input.userId}::uuid, ${input.name}, ${JSON.stringify(input.properties ?? {})}::jsonb)
  `;
}
