import { NextResponse, type NextRequest } from "next/server";
import {
  FIRST_TOUCH_COOKIE,
  LAST_TOUCH_COOKIE,
  VISITOR_COOKIE,
  planAttributionCookies,
} from "@/modules/attribution/attribution";

/** True only for a real top-level page load, not RSC fetches or prefetches. */
function isDocumentNavigation(request: NextRequest): boolean {
  if (request.method !== "GET") return false;
  const h = request.headers;
  if (h.has("rsc") || h.has("next-router-prefetch") || h.get("purpose") === "prefetch") return false;
  const dest = h.get("sec-fetch-dest");
  if (dest) return dest === "document";
  return (h.get("accept") ?? "").includes("text/html");
}

export function proxy(request: NextRequest) {
  const response = NextResponse.next();
  if (!isDocumentNavigation(request)) return response;

  const cookies = planAttributionCookies({
    url: request.nextUrl,
    referrer: request.headers.get("referer"),
    siteHost: request.nextUrl.hostname,
    now: new Date(),
    cookies: {
      visitorId: request.cookies.get(VISITOR_COOKIE)?.value,
      firstTouch: request.cookies.get(FIRST_TOUCH_COOKIE)?.value,
      lastTouch: request.cookies.get(LAST_TOUCH_COOKIE)?.value,
    },
    newVisitorId: () => crypto.randomUUID(),
  });

  const secure = request.nextUrl.protocol === "https:";
  for (const cookie of cookies) {
    response.cookies.set(cookie.name, cookie.value, {
      maxAge: cookie.maxAge,
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
    });
  }
  return response;
}

export const config = {
  // Page routes only: skip API, Next internals and any path with a file extension.
  matcher: ["/((?!api/|_next/|.*\\.[a-zA-Z0-9]+$).*)"],
};
