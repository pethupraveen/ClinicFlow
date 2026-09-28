import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/modules/auth/redirects";
import { authClient } from "@/modules/auth/supabase";

/**
 * Landing point for Supabase's password-recovery email. Exchanges the
 * one-time token hash for a session, then continues to the reset form.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const failed = new URL("/forgot-password?expired=1", request.nextUrl);

  if (!tokenHash || type !== "recovery" || tokenHash.length > 512) return NextResponse.redirect(failed);

  try {
    const supabase = await authClient();
    const { error } = await supabase.auth.verifyOtp({ type: "recovery", token_hash: tokenHash });
    if (error) return NextResponse.redirect(failed);
  } catch (error) {
    console.error("Recovery link exchange failed", error);
    return NextResponse.redirect(failed);
  }
  return NextResponse.redirect(new URL(safeNextPath(searchParams.get("next"), "/reset-password"), request.nextUrl));
}
