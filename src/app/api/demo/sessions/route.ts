import { NextRequest, NextResponse } from "next/server";
import { VISITOR_COOKIE, isValidVisitorId } from "@/modules/attribution/attribution";
import { isSameOrigin } from "@/modules/analytics/request";
import { DEMO_COOKIE, DEMO_SESSION_TTL_SECONDS, hashDemoToken, newDemoToken, newSessionId } from "@/modules/analytics/session";
import { AnalyticsStoreUnavailable, createDemoSession, findActiveDemoSession } from "@/modules/analytics/store";

export const runtime = "nodejs";

function empty(status = 204): NextResponse {
  return new NextResponse(null, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return empty(403);

  const visitorId = request.cookies.get(VISITOR_COOKIE)?.value;
  if (!isValidVisitorId(visitorId)) return empty();

  try {
    const existingToken = request.cookies.get(DEMO_COOKIE)?.value;
    if (existingToken && (await findActiveDemoSession(hashDemoToken(existingToken)))) return empty();

    const token = newDemoToken();
    const result = await createDemoSession({
      id: newSessionId(),
      visitorId,
      tokenHash: hashDemoToken(token),
      expiresAt: new Date(Date.now() + DEMO_SESSION_TTL_SECONDS * 1_000),
    });
    if (result === "rate_limited") return empty(429);

    const response = empty();
    response.cookies.set(DEMO_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: DEMO_SESSION_TTL_SECONDS,
    });
    return response;
  } catch (error) {
    if (error instanceof AnalyticsStoreUnavailable) return empty(503);
    console.error("Demo analytics session creation failed", error);
    return empty(503);
  }
}
