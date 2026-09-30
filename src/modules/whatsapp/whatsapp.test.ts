import { createHmac, randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { isStaffEmail } from "@/modules/platform/staffList";
import { findWaCode, newWaCode, waLink } from "./codes";
import { gateFor } from "./gate";
import { parseWebhook, toGraphMessage } from "./messages";
import { decryptToken, encryptToken, validSignature } from "./secrets";

describe("clinic codes", () => {
  it("generates readable codes and finds them in messages, case-insensitively", () => {
    const code = newWaCode();
    expect(code).toMatch(/^C-[2-9A-HJKMNP-TV-Z]{5}$/);
    expect(findWaCode(`Hi ${code}`)).toBe(code);
    expect(findWaCode(`hi ${code.toLowerCase()} please`)).toBe(code);
    expect(findWaCode(`Hi ${code.replace("-", "")}`)).toBe(code);
    expect(findWaCode("Hi there")).toBeNull();
    expect(findWaCode("C-O1LIU")).toBeNull(); // ambiguous characters never appear in codes
  });

  it("builds wa.me links with the code pre-filled", () => {
    expect(waLink("15551234567", "C-7K2M9")).toBe("https://wa.me/15551234567?text=Hi%20C-7K2M9");
    expect(waLink("+91 98765 43210", null)).toBe("https://wa.me/919876543210");
  });
});

describe("token encryption", () => {
  const key = randomBytes(32).toString("base64");

  it("round-trips and never stores the plain token", () => {
    const sealed = encryptToken("EAAG-secret-token", key);
    expect(sealed).not.toContain("secret");
    expect(sealed).not.toBe(encryptToken("EAAG-secret-token", key)); // fresh IV each time
    expect(decryptToken(sealed, key)).toBe("EAAG-secret-token");
  });

  it("rejects tampering, a wrong key, and a bad key size", () => {
    const sealed = encryptToken("token", key);
    const parts = sealed.split(".");
    parts[3] = Buffer.from("tampered").toString("base64url");
    expect(() => decryptToken(parts.join("."), key)).toThrow();
    expect(() => decryptToken(sealed, randomBytes(32).toString("base64"))).toThrow();
    expect(() => encryptToken("x", randomBytes(16).toString("base64"))).toThrow(/32 bytes/);
  });
});

describe("webhook signature", () => {
  const body = '{"object":"whatsapp_business_account"}';
  const sign = (b: string, secret: string) => `sha256=${createHmac("sha256", secret).update(b).digest("hex")}`;

  it("accepts only an HMAC of the exact raw body with the app secret", () => {
    expect(validSignature(body, sign(body, "app-secret"), "app-secret")).toBe(true);
    expect(validSignature(body + " ", sign(body, "app-secret"), "app-secret")).toBe(false);
    expect(validSignature(body, sign(body, "other"), "app-secret")).toBe(false);
    expect(validSignature(body, null, "app-secret")).toBe(false);
    expect(validSignature(body, "sha256=abc", "app-secret")).toBe(false);
  });
});

function webhook(messages: unknown[], phoneNumberId = "123456789") {
  return { object: "whatsapp_business_account", entry: [{ changes: [{ value: { metadata: { phone_number_id: phoneNumberId }, messages } }] }] };
}

describe("parseWebhook", () => {
  it("maps text, button and list replies; media becomes unsupported", () => {
    const parsed = parseWebhook(
      webhook([
        { from: "919876543210", id: "wamid.1", type: "text", text: { body: "Hi C-7K2M9" } },
        { from: "919876543210", id: "wamid.2", type: "interactive", interactive: { type: "list_reply", list_reply: { id: "m:book", title: "📅 Book appointment" } } },
        { from: "919876543210", id: "wamid.3", type: "interactive", interactive: { type: "button_reply", button_reply: { id: "c:yes", title: "✅ Confirm" } } },
        { from: "919876543210", id: "wamid.4", type: "image", image: { id: "x" } },
      ]),
    );
    expect(parsed.map((m) => m.input)).toEqual([
      { kind: "text", text: "Hi C-7K2M9" },
      { kind: "choice", id: "m:book" },
      { kind: "choice", id: "c:yes" },
      null,
    ]);
    expect(parsed[1]).toMatchObject({ phoneNumberId: "123456789", from: "919876543210", messageId: "wamid.2", label: "📅 Book appointment" });
  });

  it("ignores statuses, other objects and malformed senders", () => {
    expect(parseWebhook({ object: "page", entry: [] })).toEqual([]);
    expect(parseWebhook({ object: "whatsapp_business_account", entry: [{ changes: [{ value: { statuses: [{ id: "x" }] } }] }] })).toEqual([]);
    expect(parseWebhook(webhook([{ from: "not-a-number", id: "w", type: "text", text: { body: "x" } }]))).toEqual([]);
    expect(parseWebhook(null)).toEqual([]);
  });
});

describe("toGraphMessage", () => {
  it("maps bot messages onto WhatsApp's interactive formats", () => {
    expect(toGraphMessage("91", { kind: "text", text: "Hello" })).toMatchObject({ type: "text", text: { body: "Hello" } });
    expect(toGraphMessage("91", { kind: "buttons", text: "Confirm?", buttons: [{ id: "c:yes", title: "Yes" }] })).toMatchObject({
      type: "interactive",
      interactive: { type: "button", body: { text: "Confirm?" }, action: { buttons: [{ type: "reply", reply: { id: "c:yes", title: "Yes" } }] } },
    });
    const list = toGraphMessage("91", { kind: "list", text: "Pick", button: "Choose", rows: [{ id: "d:1", title: "Dr A", description: "Dentist" }] });
    expect(list).toMatchObject({
      type: "interactive",
      interactive: { type: "list", action: { button: "Choose", sections: [{ rows: [{ id: "d:1", title: "Dr A", description: "Dentist" }] }] } },
    });
  });
});

describe("gateFor", () => {
  const now = new Date("2026-10-01T06:00:00Z");
  const base = { clinicName: "Smile Clinic", clinicPhone: "+91 90000 00000", lastNoticeAt: null, now };

  it("lets patients through only when live and the trial is valid", () => {
    expect(gateFor({ ...base, lifecycle: "LIVE", subscription: "TRIAL" })).toEqual({ kind: "bot" });
    expect(gateFor({ ...base, lifecycle: "LIVE", subscription: "ACTIVE" })).toEqual({ kind: "bot" });
  });

  it("sends a 'not yet' notice before go-live or while paused, and an 'unavailable' one after expiry", () => {
    expect(gateFor({ ...base, lifecycle: "ONBOARDING", subscription: "TRIAL" })).toMatchObject({ kind: "notice", text: expect.stringContaining("isn't taking WhatsApp bookings yet. Please call us on +91 90000 00000") });
    expect(gateFor({ ...base, lifecycle: "PAUSED", subscription: "TRIAL" }).kind).toBe("notice");
    expect(gateFor({ ...base, lifecycle: "LIVE", subscription: "EXPIRED" })).toMatchObject({ kind: "notice", text: expect.stringContaining("currently unavailable") });
  });

  it("sends at most one notice per patient per 24 hours", () => {
    const recent = new Date(now.getTime() - 23 * 3_600_000);
    const old = new Date(now.getTime() - 25 * 3_600_000);
    expect(gateFor({ ...base, lifecycle: "ONBOARDING", subscription: "TRIAL", lastNoticeAt: recent })).toEqual({ kind: "silent" });
    expect(gateFor({ ...base, lifecycle: "ONBOARDING", subscription: "TRIAL", lastNoticeAt: old }).kind).toBe("notice");
  });
});

describe("isStaffEmail", () => {
  it("matches the configured list exactly, ignoring case and spaces", () => {
    expect(isStaffEmail("Praveen@Sprig.store", "a@b.co, praveen@sprig.store")).toBe(true);
    expect(isStaffEmail("praveen@sprig.store.evil.com", "praveen@sprig.store")).toBe(false);
    expect(isStaffEmail("x@y.z", undefined)).toBe(false);
    expect(isStaffEmail("x@y.z", "")).toBe(false);
  });
});
