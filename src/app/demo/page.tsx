import type { Metadata } from "next";
import { ComingSoon } from "@/modules/marketing/components/ComingSoon";

// Placeholder until Phase 2 (interactive demo) ships.
export const metadata: Metadata = {
  title: "Live Demo",
  robots: { index: false, follow: true },
};

export default function DemoPage() {
  return (
    <ComingSoon
      title="The live demo is almost ready"
      body="Soon you'll be able to book a sample appointment at a demo clinic right here — no sign-up needed."
    />
  );
}
