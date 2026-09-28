/** Routes that are rendered per request and get the nonce-based policy. */
const NONCE_CSP_PREFIXES = ["/app", "/signup", "/login", "/forgot-password", "/reset-password", "/verify-email", "/auth"];

export function usesNonceCsp(pathname: string): boolean {
  return NONCE_CSP_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function newNonce(): string {
  return btoa(crypto.randomUUID());
}

export function buildCsp(nonce: string, isDev: boolean): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    // The browser never talks to Supabase; every auth call goes through our server.
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}
