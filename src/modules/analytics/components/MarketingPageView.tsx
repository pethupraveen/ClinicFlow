"use client";

import { useEffect } from "react";
import { trackMarketingPageView } from "../client";
import type { MarketingPage } from "../events";

/** A first-party page view with no third-party script or browser fingerprinting. */
export function MarketingPageView({ page }: { page: MarketingPage }) {
  useEffect(() => {
    void trackMarketingPageView(page);
  }, [page]);
  return null;
}
