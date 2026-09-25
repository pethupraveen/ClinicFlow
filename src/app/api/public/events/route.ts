import { NextRequest, NextResponse } from "next/server";
import { VISITOR_COOKIE, isValidVisitorId } from "@/modules/attribution/attribution";
import { parseMarketingPageView } from "@/modules/analytics/events";
import { isSameOrigin, readSmallJson } from "@/modules/analytics/request";
import { AnalyticsStoreUnavailable, recordMarketingPageView } from "@/modules/analytics/store";

export const runtime = "nodejs";

function empty(status = 204): NextResponse {
  return new NextResponse(null, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return empty(403);
  const page = parseMarketingPageView(await readSmallJson(request));
  const visitorId = request.cookies.get(VISITOR_COOKIE)?.value;
  if (!page) return empty(400);
  if (!isValidVisitorId(visitorId)) return empty();

  try {
    const result = await recordMarketingPageView(visitorId, page);
    return empty(result === "rate_limited" ? 429 : 204);
  } catch (error) {
    if (error instanceof AnalyticsStoreUnavailable) return empty(503);
    console.error("Marketing analytics event write failed", error);
    return empty(503);
  }
}
