export function PrivacyNotice({ className }: { className?: string }) {
  return (
    <p className={className} id="analytics-privacy-notice">
      ClinicFlow uses first-party, pseudonymous cookies to measure visits and demo completion. We do not use advertising
      trackers or record patient, contact, or appointment information in these analytics.
    </p>
  );
}
