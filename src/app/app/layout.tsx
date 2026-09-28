import type { Metadata } from "next";
import { connection } from "next/server";

export const metadata: Metadata = {
  title: "My clinic",
  robots: { index: false, follow: false },
};

// Always per request: every page here is personal, and the CSP nonce needs it.
export default async function AppLayout({ children }: LayoutProps<"/app">) {
  await connection();
  return children;
}
