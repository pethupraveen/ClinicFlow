import { NextResponse, type NextRequest } from "next/server";
import { clientIpHash, consumeLimit, LIMITS } from "@/modules/auth/rateLimit";
import { safeNextPath } from "@/modules/auth/redirects";
import { authClient } from "@/modules/auth/supabase";

/**
 * Starts "Continue with Google". A plain link (not a form) points here, so the
 * CSP's form-action 'self' never has to allow the redirect to Google. The PKCE
 * verifier is stored in an HttpOnly cookie for /auth/callback.
 */
export async function GET(request: NextRequest) {
  const failed = new URL("/login?error=google", request.nextUrl);
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));
  try {
    if (!(await consumeLimit(LIMITS.googleStartPerIp, await clientIpHash()))) return NextResponse.redirect(failed);

    const callback = new URL("/auth/callback", request.nextUrl);
    callback.searchParams.set("next", next);
    const supabase = await authClient();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callback.toString(), queryParams: { prompt: "select_account" } },
    });
    if (error || !data.url) {
      console.error("Starting Google sign-in failed", error?.code, error?.message);
      return NextResponse.redirect(failed);
    }
    return NextResponse.redirect(data.url);
  } catch (error) {
    console.error("Starting Google sign-in failed", error);
    return NextResponse.redirect(failed);
  }
}
