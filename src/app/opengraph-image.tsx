import { ImageResponse } from "next/og";
import { getTrialPlan } from "@/modules/subscriptions/plans";

export const alt = "ClinicFlow WhatsApp — Your Clinic's WhatsApp Receptionist";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  const { trialDays } = getTrialPlan();
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "linear-gradient(135deg, #e7f4ee 0%, #ffffff 60%)",
          color: "#11201b",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 36, fontWeight: 800 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: "#0b6e4f",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 40,
            }}
          >
            +
          </div>
          <span>ClinicFlow</span>
          <span style={{ color: "#0b6e4f" }}>WhatsApp</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2 }}>
            Your Clinic&apos;s WhatsApp Receptionist
          </div>
          <div style={{ fontSize: 32, color: "#33423d", lineHeight: 1.3 }}>
            Patients book appointments and get clinic information through WhatsApp.
          </div>
        </div>
        <div style={{ display: "flex", gap: 16, fontSize: 28, fontWeight: 700 }}>
          <div style={{ background: "#0b6e4f", color: "#fff", padding: "14px 28px", borderRadius: 14 }}>
            Try Live Demo
          </div>
          <div
            style={{ border: "3px solid #0b6e4f", color: "#0b6e4f", padding: "11px 26px", borderRadius: 14 }}
          >
            {`${trialDays}-Day Free Trial · No Credit Card`}
          </div>
        </div>
      </div>
    ),
    size,
  );
}
