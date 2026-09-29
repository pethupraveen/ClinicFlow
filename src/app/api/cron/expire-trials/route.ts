import { NextResponse, type NextRequest } from "next/server";
import { checkCronAuth } from "@/modules/trial/cronAuth";
import { expireDueTrials } from "@/modules/trial/store";

export const runtime = "nodejs";

/** Daily Vercel Cron job (see vercel.json): saves trials that have run out as EXPIRED. */
export async function GET(request: NextRequest) {
  const auth = checkCronAuth(request.headers.get("authorization"), process.env.CRON_SECRET);
  if (auth === "not-configured") return NextResponse.json({ error: "CRON_SECRET is not set" }, { status: 503 });
  if (auth === "unauthorized") return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const expired = await expireDueTrials(new Date());
    console.log(`Trial expiry job: ${expired} trial(s) expired`);
    return NextResponse.json({ expired }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Trial expiry job failed", error);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
