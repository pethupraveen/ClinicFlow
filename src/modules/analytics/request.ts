import type { NextRequest } from "next/server";

/** Reject cross-site writes; the demo session cookie must never become a CSRF oracle. */
export function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      return new URL(origin).origin === request.nextUrl.origin;
    } catch {
      return false;
    }
  }

  // Browsers may omit Origin on a few same-origin requests. Never accept a
  // request explicitly marked cross-site, but allow non-browser health checks.
  return request.headers.get("sec-fetch-site") !== "cross-site";
}

export async function readSmallJson(request: Request): Promise<unknown | null> {
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > 4_096) return null;

  try {
    const text = await request.text();
    if (text.length === 0 || text.length > 4_096) return null;
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}
