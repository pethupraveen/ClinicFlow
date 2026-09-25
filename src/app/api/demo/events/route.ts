import { NextRequest, NextResponse } from "next/server";
import { parseDemoEvents } from "@/modules/analytics/events";
import { isSameOrigin, readSmallJson } from "@/modules/analytics/request";
import { DEMO_COOKIE, hashDemoToken } from "@/modules/analytics/session";
import { AnalyticsStoreUnavailable, recordDemoEvents } from "@/modules/analytics/store";

export const runtime = "nodejs";

function empty(status = 204): NextResponse {
  return new NextResponse(null, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return empty(403);
  const events = parseDemoEvents(await readSmallJson(request));
  if (!events) return empty(400);

  const token = request.cookies.get(DEMO_COOKIE)?.value;
  if (!token) return empty();

  try {
    const result = await recordDemoEvents(hashDemoToken(token), events);
    return empty(result === "rate_limited" ? 429 : 204);
  } catch (error) {
    if (error instanceof AnalyticsStoreUnavailable) return empty(503);
    console.error("Demo analytics event write failed", error);
    return empty(503);
  }
}
