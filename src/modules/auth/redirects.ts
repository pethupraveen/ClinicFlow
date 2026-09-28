export const APP_HOME = "/app";

/**
 * Accepts only same-site paths inside the app for post-login redirects, so a
 * crafted `?next=` can never send someone to another site.
 */
export function safeNextPath(value: unknown, fallback: string = APP_HOME): string {
  if (typeof value !== "string" || value.length > 512) return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  let url: URL;
  try {
    url = new URL(value, "https://placeholder.invalid");
  } catch {
    return fallback;
  }
  if (url.origin !== "https://placeholder.invalid") return fallback;
  const allowed = url.pathname === APP_HOME || url.pathname.startsWith(`${APP_HOME}/`) || url.pathname === "/reset-password";
  return allowed ? `${url.pathname}${url.search}` : fallback;
}
