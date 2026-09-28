import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  FIRST_TOUCH_COOKIE,
  LAST_TOUCH_COOKIE,
  VISITOR_COOKIE,
  planAttributionCookies,
} from "@/modules/attribution/attribution";
import { AUTH_COOKIE_OPTIONS, authConfig } from "@/modules/auth/config";
import { buildCsp, newNonce, usesNonceCsp } from "@/modules/auth/csp";

/** True only for a real top-level page load, not RSC fetches or prefetches. */
function isDocumentNavigation(request: NextRequest): boolean {
  if (request.method !== "GET") return false;
  const h = request.headers;
  if (h.has("rsc") || h.has("next-router-prefetch") || h.get("purpose") === "prefetch") return false;
  const dest = h.get("sec-fetch-dest");
  if (dest) return dest === "document";
  return (h.get("accept") ?? "").includes("text/html");
}

type PendingCookie = { name: string; value: string; options: Record<string, unknown> };

/**
 * Refreshes the Supabase session so server components (which cannot write
 * cookies) always see a valid one. Updated cookies are written onto the
 * request for this render and returned for the response.
 */
async function refreshSession(request: NextRequest): Promise<{ cookies: PendingCookie[]; headers: Record<string, string> }> {
  const out = { cookies: [] as PendingCookie[], headers: {} as Record<string, string> };
  const config = authConfig();
  if (!config) return out;
  const supabase = createServerClient(config.url, config.anonKey, {
    cookieOptions: AUTH_COOKIE_OPTIONS,
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        out.cookies.push(...cookiesToSet);
        Object.assign(out.headers, headers);
      },
    },
  });
  try {
    await supabase.auth.getClaims();
  } catch (error) {
    console.error("Session refresh failed", error);
  }
  return out;
}

export async function proxy(request: NextRequest) {
  const authScoped = usesNonceCsp(request.nextUrl.pathname);
  const session = authScoped ? await refreshSession(request) : null;

  let response: NextResponse;
  let csp: string | null = null;
  if (authScoped) {
    const nonce = newNonce();
    csp = buildCsp(nonce, process.env.NODE_ENV === "development");
    // Built after the refresh, so the render sees the updated auth cookies.
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-nonce", nonce);
    requestHeaders.set("Content-Security-Policy", csp);
    response = NextResponse.next({ request: { headers: requestHeaders } });
    response.headers.set("Content-Security-Policy", csp);
    for (const { name, value, options } of session?.cookies ?? []) response.cookies.set(name, value, options);
    for (const [key, value] of Object.entries(session?.headers ?? {})) response.headers.set(key, value);
  } else {
    response = NextResponse.next();
  }

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
