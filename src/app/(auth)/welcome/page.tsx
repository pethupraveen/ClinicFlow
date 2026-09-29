import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { findMembership } from "@/modules/auth/accounts";
import { WelcomeForm } from "@/modules/auth/components/AuthForms";
import { AuthShell } from "@/modules/auth/components/AuthShell";
import { getSessionUser } from "@/modules/auth/guards";

export const metadata: Metadata = { title: "Set up your clinic" };

/** First-time setup after Google sign-in. */
export default async function WelcomePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (await findMembership(user.id)) redirect("/app");
  return (
    <AuthShell title="One last step" subtitle={`Signed in as ${user.email}. What's your clinic called?`}>
      <WelcomeForm defaultName={user.name ?? undefined} />
    </AuthShell>
  );
}
