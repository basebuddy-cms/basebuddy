import { Suspense } from "react";
import { redirect } from "next/navigation";

import { OnboardingSetupView } from "@/components/projects/onboarding-setup-view";
import { OnboardingShell } from "@/components/projects/onboarding-shell";
import { getOptionalAuthenticatedUserWithAccount } from "@/lib/control-plane/server";
import {
  getBaseBuddyConfigSetupStatus,
  isBaseBuddyConfigSetupReady,
} from "@/lib/basebuddy-config/setup";

type OnboardingRouteSearchParams = Record<string, string | string[] | undefined>;

type OnboardingRouteProps = {
  searchParams?: OnboardingRouteSearchParams | Promise<OnboardingRouteSearchParams>;
};

const getSingleSearchParamValue = (
  searchParams: OnboardingRouteSearchParams | undefined,
  key: string,
) => {
  const value = searchParams?.[key];

  return Array.isArray(value) ? value[0] : value;
};

export default async function OnboardingRoute({ searchParams }: OnboardingRouteProps = {}) {
  const status = await getBaseBuddyConfigSetupStatus();
  const isSetupReady = isBaseBuddyConfigSetupReady(status);
  const resolvedSearchParams = await searchParams;
  const diagnosticsRequested = getSingleSearchParamValue(resolvedSearchParams, "diagnostics") === "1";

  if (isSetupReady && !diagnosticsRequested) {
    const { user } = await getOptionalAuthenticatedUserWithAccount();

    if (user) {
      redirect("/projects");
    }
  }

  return (
    <Suspense fallback={<OnboardingShell />}>
      <OnboardingSetupView
        readOnly={isSetupReady}
        status={status}
      />
    </Suspense>
  );
}
