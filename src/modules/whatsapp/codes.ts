import { randomBytes } from "node:crypto";

/** No 0/1/O/I/L/U, so codes survive being read aloud or typed by hand. */
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";
const CODE_RE = new RegExp(`\\bC-?([${ALPHABET}]{5})\\b`, "i");

export function newWaCode(): string {
  let code = "";
  for (const byte of randomBytes(5)) code += ALPHABET[byte % ALPHABET.length];
  return `C-${code}`;
}

/** Finds a clinic code such as "C-7K2M9" (or "c7k2m9") anywhere in a message. */
export function findWaCode(text: string): string | null {
  const match = CODE_RE.exec(text);
  return match ? `C-${match[1].toUpperCase()}` : null;
}

/** Digits-only WhatsApp number → wa.me link that pre-fills the clinic code. */
export function waLink(displayNumber: string, code: string | null): string {
  const digits = displayNumber.replace(/\D/g, "");
  return code ? `https://wa.me/${digits}?text=${encodeURIComponent(`Hi ${code}`)}` : `https://wa.me/${digits}`;
}
