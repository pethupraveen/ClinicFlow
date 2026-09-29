import { redirect } from "next/navigation";
import { requireMember } from "@/modules/auth/guards";
import { computeProgress } from "@/modules/onboarding/steps";
import { getOnboardingFacts } from "@/modules/onboarding/store";

/** Opens the wizard at the first step that still needs doing. */
export default async function OnboardingIndex() {
  const { membership } = await requireMember("/app/onboarding");
  const progress = computeProgress(await getOnboardingFacts(membership.business.id, membership.emailVerified));
  redirect(`/app/onboarding/${progress.next?.number ?? 1}`);
}
