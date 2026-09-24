import type { Metadata } from "next";
import { LandingPage } from "@/modules/marketing/LandingPage";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default function Home() {
  return <LandingPage />;
}
