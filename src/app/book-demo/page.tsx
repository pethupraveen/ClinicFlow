import type { Metadata } from "next";
import { ComingSoon } from "@/modules/marketing/components/ComingSoon";

// Placeholder until the lead form ships (plan: right after Phase 3).
export const metadata: Metadata = {
  title: "Book a Demo",
  robots: { index: false, follow: true },
};

export default function BookDemoPage() {
  return (
    <ComingSoon
      title="Demo bookings open soon"
      body="You'll be able to request a walkthrough with our team here. In the meantime, the live demo shows the full patient booking flow."
    />
  );
}
