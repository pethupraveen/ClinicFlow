/**
 * Marketing attribution: which channel brought a visitor here.
 *
 * Runs in the proxy on every page navigation and writes three httpOnly cookies:
 *   cf_vid — anonymous visitor id, joins page views → demo → signup → paid
 *   cf_ft  — first touch, written once and never overwritten
 *   cf_lt  — last touch, refreshed whenever a visit carries campaign info
 *
 * Signup and lead capture (later phases) copy these onto the user, business
 * and lead rows. Cookie contents are always re-validated with `decodeTouch`
 * before use, never trusted as-is.
 */

export const VISITOR_COOKIE = "cf_vid";
export const FIRST_TOUCH_COOKIE = "cf_ft";
export const LAST_TOUCH_COOKIE = "cf_lt";

const DAY = 24 * 60 * 60;
export const VISITOR_MAX_AGE = 365 * DAY;
export const FIRST_TOUCH_MAX_AGE = 90 * DAY;
export const LAST_TOUCH_MAX_AGE = 30 * DAY;

const MAX_PARAM_LENGTH = 100;
const MAX_PATH_LENGTH = 200;
const MAX_COOKIE_LENGTH = 1024;

export interface Touch {
  source: string;
  medium: string;
  campaign?: string;
  content?: string;
  term?: string;
  referrerHost?: string;
  landingPath: string;
  /** Which ad click id was present (the id itself is not stored). */
  clickIdType?: "gclid" | "fbclid";
  /** ISO timestamp. */
  at: string;
}

export interface CookieToSet {
  name: string;
  value: string;
  maxAge: number;
}

/** Keep letters, digits and a few separators; cap length. Empty → undefined. */
export function cleanParam(value: string | null | undefined, lowercase = false): string | undefined {
  if (!value) return undefined;
  let cleaned = value.normalize("NFKC").replace(/[^\p{L}\p{M}\p{N} _\-.+~/:|]/gu, "").trim();
  if (lowercase) cleaned = cleaned.toLowerCase();
  cleaned = cleaned.slice(0, MAX_PARAM_LENGTH);
  return cleaned || undefined;
}

function cleanPath(pathname: string): string {
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return path.replace(/[^\w\-./~%]/g, "").slice(0, MAX_PATH_LENGTH) || "/";
}

function referrerHostOf(referrer: string | null | undefined): string | undefined {
  if (!referrer) return undefined;
  try {
    const url = new URL(referrer);
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
    return url.hostname.toLowerCase().replace(/^www\./, "").slice(0, MAX_PARAM_LENGTH);
  } catch {
    return undefined;
  }
}

const KNOWN_REFERRERS: Array<{ match: RegExp; source: string; medium: string }> = [
  { match: /(^|\.)instagram\.com$/, source: "instagram", medium: "social" },
  { match: /(^|\.)(facebook\.com|fb\.com|fb\.me)$/, source: "facebook", medium: "social" },
  { match: /(^|\.)(t\.co|twitter\.com|x\.com)$/, source: "x", medium: "social" },
  { match: /(^|\.)linkedin\.com$/, source: "linkedin", medium: "social" },
  { match: /(^|\.)youtube\.com$/, source: "youtube", medium: "social" },
  { match: /(^|\.)google\.[a-z.]+$/, source: "google", medium: "organic" },
  { match: /(^|\.)bing\.com$/, source: "bing", medium: "organic" },
  { match: /(^|\.)duckduckgo\.com$/, source: "duckduckgo", medium: "organic" },
];

/**
 * Derives a touch from one page request. `isCampaign` is true when the visit
 * says something about its origin (UTM params, an ad click id, or an external
 * referrer) — only those visits update the last-touch cookie.
 */
export function touchFromRequest(input: {
  url: URL;
  referrer: string | null;
  siteHost: string;
  now: Date;
}): { touch: Touch; isCampaign: boolean } {
  const { url, now } = input;
  const q = url.searchParams;
  const siteHost = input.siteHost.toLowerCase().replace(/^www\./, "");

  let referrerHost = referrerHostOf(input.referrer);
  if (referrerHost === siteHost) referrerHost = undefined;

  const clickIdType = q.get("gclid") ? "gclid" : q.get("fbclid") ? "fbclid" : undefined;

  let source = cleanParam(q.get("utm_source"), true);
  let medium = cleanParam(q.get("utm_medium"), true);
  const hasUtm = Boolean(source || medium || q.get("utm_campaign"));

  if (!source) {
    const known = referrerHost ? KNOWN_REFERRERS.find((r) => r.match.test(referrerHost!)) : undefined;
    if (clickIdType === "gclid") {
      source = "google";
      medium ??= "cpc";
    } else if (clickIdType === "fbclid") {
      source = known?.source ?? "facebook";
      medium ??= "paid_social";
    } else if (known) {
      source = known.source;
      medium ??= known.medium;
    } else if (referrerHost) {
      source = referrerHost;
      medium ??= "referral";
    } else {
      source = "(direct)";
      medium ??= "(none)";
    }
  }

  const touch: Touch = {
    source,
    medium: medium ?? "(none)",
    campaign: cleanParam(q.get("utm_campaign")),
    content: cleanParam(q.get("utm_content")),
    term: cleanParam(q.get("utm_term")),
    referrerHost,
    landingPath: cleanPath(url.pathname),
    clickIdType,
    at: now.toISOString(),
  };

  return { touch, isCampaign: hasUtm || Boolean(clickIdType) || Boolean(referrerHost) };
}

export function encodeTouch(touch: Touch): string {
  // Drop undefined keys so the cookie stays small.
  return JSON.stringify(Object.fromEntries(Object.entries(touch).filter(([, v]) => v !== undefined)));
}

/** Parses and re-validates a touch cookie. Anything malformed → null. */
export function decodeTouch(raw: string | undefined | null): Touch | null {
  if (!raw || raw.length > MAX_COOKIE_LENGTH) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const d = data as Record<string, unknown>;
  const str = (v: unknown, lower = false) => (typeof v === "string" ? cleanParam(v, lower) : undefined);

  const source = str(d.source, true);
  const medium = str(d.medium, true);
  const at = typeof d.at === "string" && !Number.isNaN(Date.parse(d.at)) ? new Date(d.at).toISOString() : undefined;
  if (!source || !medium || !at || typeof d.landingPath !== "string") return null;

  return {
    source,
    medium,
    campaign: str(d.campaign),
    content: str(d.content),
    term: str(d.term),
    referrerHost: str(d.referrerHost, true),
    landingPath: cleanPath(d.landingPath),
    clickIdType: d.clickIdType === "gclid" || d.clickIdType === "fbclid" ? d.clickIdType : undefined,
    at,
  };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function isValidVisitorId(value: string | undefined | null): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

/** Decides which attribution cookies a page response should set. Pure. */
export function planAttributionCookies(input: {
  url: URL;
  referrer: string | null;
  siteHost: string;
  now: Date;
  cookies: { visitorId?: string; firstTouch?: string; lastTouch?: string };
  newVisitorId: () => string;
}): CookieToSet[] {
  const out: CookieToSet[] = [];
  const { touch, isCampaign } = touchFromRequest(input);
  const encoded = encodeTouch(touch);

  if (!isValidVisitorId(input.cookies.visitorId)) {
    out.push({ name: VISITOR_COOKIE, value: input.newVisitorId(), maxAge: VISITOR_MAX_AGE });
  }

  const hasFirstTouch = decodeTouch(input.cookies.firstTouch) !== null;
  if (!hasFirstTouch) {
    out.push({ name: FIRST_TOUCH_COOKIE, value: encoded, maxAge: FIRST_TOUCH_MAX_AGE });
  }

  // A new campaign visit becomes the last touch. The very first visit is
  // also recorded as last touch so the pair is always complete.
  if (isCampaign || !hasFirstTouch || decodeTouch(input.cookies.lastTouch) === null) {
    out.push({ name: LAST_TOUCH_COOKIE, value: encoded, maxAge: LAST_TOUCH_MAX_AGE });
  }

  return out;
}
