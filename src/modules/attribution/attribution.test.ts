import { describe, expect, it } from "vitest";
import {
  FIRST_TOUCH_COOKIE,
  LAST_TOUCH_COOKIE,
  VISITOR_COOKIE,
  cleanParam,
  decodeTouch,
  encodeTouch,
  planAttributionCookies,
  touchFromRequest,
  type Touch,
} from "./attribution";

const NOW = new Date("2026-09-24T10:00:00.000Z");
const HOST = "clinicflow.in";
const VID = "3f2b1c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";

function touch(url: string, referrer: string | null = null) {
  return touchFromRequest({ url: new URL(url), referrer, siteHost: HOST, now: NOW });
}

function plan(url: string, cookies: Parameters<typeof planAttributionCookies>[0]["cookies"], referrer: string | null = null) {
  return planAttributionCookies({
    url: new URL(url),
    referrer,
    siteHost: HOST,
    now: NOW,
    cookies,
    newVisitorId: () => VID,
  });
}

describe("touchFromRequest", () => {
  it("reads UTM parameters from an Instagram campaign link", () => {
    const { touch: t, isCampaign } = touch(
      "https://clinicflow.in/?utm_source=Instagram&utm_medium=social&utm_campaign=clinic_launch",
    );
    expect(t).toMatchObject({
      source: "instagram",
      medium: "social",
      campaign: "clinic_launch",
      landingPath: "/",
      at: NOW.toISOString(),
    });
    expect(isCampaign).toBe(true);
  });

  it("infers instagram/social from the in-app browser referrer when UTMs are missing", () => {
    const { touch: t } = touch("https://clinicflow.in/", "https://l.instagram.com/");
    expect(t).toMatchObject({ source: "instagram", medium: "social", referrerHost: "l.instagram.com" });
  });

  it("infers google/organic from a search referrer", () => {
    expect(touch("https://clinicflow.in/", "https://www.google.co.in/").touch).toMatchObject({
      source: "google",
      medium: "organic",
    });
  });

  it("attributes ad click ids without storing their value", () => {
    const g = touch("https://clinicflow.in/?gclid=abc123").touch;
    expect(g).toMatchObject({ source: "google", medium: "cpc", clickIdType: "gclid" });
    expect(JSON.stringify(g)).not.toContain("abc123");

    const f = touch("https://clinicflow.in/?fbclid=xyz", "https://l.instagram.com/").touch;
    expect(f).toMatchObject({ source: "instagram", medium: "paid_social", clickIdType: "fbclid" });
  });

  it("uses an unknown external referrer as a referral", () => {
    expect(touch("https://clinicflow.in/", "https://dentistblog.example/post").touch).toMatchObject({
      source: "dentistblog.example",
      medium: "referral",
    });
  });

  it("treats a same-site referrer as direct and not a campaign", () => {
    const { touch: t, isCampaign } = touch("https://clinicflow.in/", "https://www.clinicflow.in/pricing");
    expect(t).toMatchObject({ source: "(direct)", medium: "(none)" });
    expect(t.referrerHost).toBeUndefined();
    expect(isCampaign).toBe(false);
  });

  it("ignores non-http referrers", () => {
    expect(touch("https://clinicflow.in/", "android-app://com.instagram.android").touch.source).toBe("(direct)");
  });

  it("strips markup and caps the length of hostile parameters", () => {
    const hostile = "<script>alert(1)</script>" + "a".repeat(500);
    const t = touch(`https://clinicflow.in/?utm_source=x&utm_campaign=${encodeURIComponent(hostile)}`).touch;
    expect(t.campaign).not.toMatch(/[<>()]/);
    expect(t.campaign!.length).toBeLessThanOrEqual(100);
  });
});

describe("cleanParam", () => {
  it("keeps non-latin letters (e.g. Tamil/Hindi campaign names)", () => {
    expect(cleanParam("சென்னை_launch")).toBe("சென்னை_launch");
  });
  it("returns undefined for empty or fully-stripped input", () => {
    expect(cleanParam("")).toBeUndefined();
    expect(cleanParam("<>\"'")).toBeUndefined();
  });
});

describe("encodeTouch / decodeTouch", () => {
  it("round-trips a touch", () => {
    const t = touch("https://clinicflow.in/?utm_source=instagram&utm_medium=social&utm_campaign=launch").touch;
    expect(decodeTouch(encodeTouch(t))).toEqual(JSON.parse(encodeTouch(t)));
  });

  it("rejects malformed, oversized or incomplete cookies", () => {
    expect(decodeTouch(undefined)).toBeNull();
    expect(decodeTouch("not json")).toBeNull();
    expect(decodeTouch("[]")).toBeNull();
    expect(decodeTouch(JSON.stringify({ source: "x" }))).toBeNull();
    expect(decodeTouch("x".repeat(2000))).toBeNull();
  });

  it("re-sanitises values from a tampered cookie", () => {
    const tampered: Touch = {
      source: "<b>Instagram</b>",
      medium: "social",
      landingPath: "/<script>",
      at: NOW.toISOString(),
    };
    const decoded = decodeTouch(JSON.stringify(tampered))!;
    expect(decoded.source).toBe("binstagram/b");
    expect(decoded.landingPath).not.toMatch(/[<>]/);
  });
});

describe("planAttributionCookies", () => {
  const names = (cookies: { name: string }[]) => cookies.map((c) => c.name).sort();

  it("sets visitor id, first touch and last touch on a first visit", () => {
    const cookies = plan("https://clinicflow.in/?utm_source=instagram&utm_medium=social", {});
    expect(names(cookies)).toEqual([FIRST_TOUCH_COOKIE, LAST_TOUCH_COOKIE, VISITOR_COOKIE].sort());
    expect(cookies.find((c) => c.name === VISITOR_COOKIE)!.value).toBe(VID);
  });

  it("never overwrites first touch; a new campaign updates last touch only", () => {
    const first = plan("https://clinicflow.in/?utm_source=instagram&utm_medium=social", {});
    const ft = first.find((c) => c.name === FIRST_TOUCH_COOKIE)!.value;
    const lt = first.find((c) => c.name === LAST_TOUCH_COOKIE)!.value;

    const later = plan("https://clinicflow.in/?utm_source=google&utm_medium=cpc", {
      visitorId: VID,
      firstTouch: ft,
      lastTouch: lt,
    });
    expect(names(later)).toEqual([LAST_TOUCH_COOKIE]);
    expect(decodeTouch(later[0].value)!.source).toBe("google");
  });

  it("sets nothing on a direct repeat visit", () => {
    const first = plan("https://clinicflow.in/?utm_source=instagram", {});
    const get = (n: string) => first.find((c) => c.name === n)!.value;
    expect(
      plan("https://clinicflow.in/", { visitorId: VID, firstTouch: get(FIRST_TOUCH_COOKIE), lastTouch: get(LAST_TOUCH_COOKIE) }),
    ).toEqual([]);
  });

  it("replaces an invalid visitor id and a corrupt first-touch cookie", () => {
    const cookies = plan("https://clinicflow.in/", { visitorId: "../../etc", firstTouch: "garbage" });
    expect(names(cookies)).toEqual([FIRST_TOUCH_COOKIE, LAST_TOUCH_COOKIE, VISITOR_COOKIE].sort());
  });
});
