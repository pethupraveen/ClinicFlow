import type { BotInput, BotMessage } from "@/modules/bot/engine";

// ---------- inbound: Meta webhook payload → patient messages ----------

export interface InboundMessage {
  phoneNumberId: string;
  /** Patient's WhatsApp ID (their number, digits only). */
  from: string;
  messageId: string;
  /** Raw text, used to find a clinic code on the shared number. */
  text: string;
  /** What the bot should see; null for media or anything unsupported. */
  input: BotInput | null;
  label?: string;
}

type Json = Record<string, unknown>;
const obj = (v: unknown): Json => (v && typeof v === "object" && !Array.isArray(v) ? (v as Json) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string => (typeof v === "string" ? v : "");

/** Extracts incoming messages; statuses (sent/delivered/read) and malformed parts are ignored. */
export function parseWebhook(payload: unknown): InboundMessage[] {
  const out: InboundMessage[] = [];
  if (obj(payload).object !== "whatsapp_business_account") return out;
  for (const entry of arr(obj(payload).entry)) {
    for (const change of arr(obj(entry).changes)) {
      const value = obj(obj(change).value);
      const phoneNumberId = str(obj(value.metadata).phone_number_id);
      for (const raw of arr(value.messages)) {
        const m = obj(raw);
        const from = str(m.from);
        const messageId = str(m.id);
        if (!/^\d{5,20}$/.test(from) || !messageId || !/^\d{5,30}$/.test(phoneNumberId)) continue;
        out.push({ phoneNumberId, from, messageId, ...toInput(m) });
      }
    }
  }
  return out;
}

function toInput(m: Json): Pick<InboundMessage, "text" | "input" | "label"> {
  if (m.type === "text") {
    const text = str(obj(m.text).body).slice(0, 1000);
    return { text, input: { kind: "text", text } };
  }
  if (m.type === "interactive") {
    const i = obj(m.interactive);
    const reply = obj(i.type === "list_reply" ? i.list_reply : i.button_reply);
    const id = str(reply.id).slice(0, 200);
    const title = str(reply.title);
    return id ? { text: title, input: { kind: "choice", id }, label: title } : { text: "", input: null };
  }
  if (m.type === "button") {
    // Quick-reply buttons on template messages.
    const text = str(obj(m.button).text);
    return { text, input: { kind: "text", text } };
  }
  return { text: "", input: null };
}

// ---------- outbound: bot messages → Graph API payloads ----------

const BODY_MAX = 1024;
const LIST_BUTTON_MAX = 20;

export function toGraphMessage(to: string, message: BotMessage): Json {
  const base = { messaging_product: "whatsapp", recipient_type: "individual", to };
  const body = { text: message.text.slice(0, BODY_MAX) };
  switch (message.kind) {
    case "text":
      return { ...base, type: "text", text: { body: message.text.slice(0, 4096), preview_url: false } };
    case "buttons":
      return {
        ...base,
        type: "interactive",
        interactive: {
          type: "button",
          body,
          action: { buttons: message.buttons.map((b) => ({ type: "reply", reply: { id: b.id, title: b.title } })) },
        },
      };
    case "list":
      return {
        ...base,
        type: "interactive",
        interactive: {
          type: "list",
          body,
          action: {
            button: message.button.slice(0, LIST_BUTTON_MAX),
            sections: [
              {
                title: message.button.slice(0, 24),
                rows: message.rows.map((r) => ({ id: r.id, title: r.title, ...(r.description ? { description: r.description } : {}) })),
              },
            ],
          },
        },
      };
  }
}
