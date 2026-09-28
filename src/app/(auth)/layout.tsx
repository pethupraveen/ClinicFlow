import type { Metadata } from "next";
import { connection } from "next/server";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

// Rendered per request so Next.js can apply the proxy's CSP nonce.
export default async function AuthLayout({ children }: LayoutProps<"/">) {
  await connection();
  return children;
}
