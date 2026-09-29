import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/modules/auth/redirects";
import { authClient } from "@/modules/auth/supabase";

/**
 * Google (via Supabase) returns here with a one-time code, which is exchanged
 * for a session. New users continue to /app, whose guard sends anyone without
 * a clinic to /welcome.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const failed = new URL("/login?error=google", request.nextUrl);

  if (!code || code.length > 512) return NextResponse.redirect(failed);
  try {
    const supabase = await authClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error("Google sign-in exchange failed", error.code, error.message);
      return NextResponse.redirect(failed);
    }
  } catch (error) {
    console.error("Google sign-in exchange failed", error);
    return NextResponse.redirect(failed);
  }
  return NextResponse.redirect(new URL(safeNextPath(searchParams.get("next")), request.nextUrl));
}
