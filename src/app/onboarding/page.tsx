import { Suspense } from "react";
import fs from "node:fs/promises";
import path from "node:path";
import { redirect } from "next/navigation";

import { OnboardingSetupView } from "@/components/projects/onboarding-setup-view";
import { OnboardingShell } from "@/components/projects/onboarding-shell";
import { getOptionalAuthenticatedUserWithAccount } from "@/lib/control-plane/server";
import {
  getControlPlaneSchemaSetupSection,
  getInstallSetupStatus,
  isInstallSetupReady,
} from "@/lib/self-host/install-runtime";

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

const getBaselineMigrationSql = async () => {
  try {
    return await fs.readFile(
      path.join(process.cwd(), "supabase/migrations/20260420130000_basebuddy_self_host_baseline.sql"),
      "utf8",
    );
  } catch {
    return undefined;
  }
};

export default async function OnboardingRoute({ searchParams }: OnboardingRouteProps = {}) {
  const [controlPlaneSchemaSection, migrationSql] = await Promise.all([
    getControlPlaneSchemaSetupSection(),
    getBaselineMigrationSql(),
  ]);
  const status = getInstallSetupStatus({ controlPlaneSchemaSection });
  const isSetupReady = isInstallSetupReady(status);
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
        migrationSql={migrationSql}
        readOnly={isSetupReady}
        status={status}
      />
    </Suspense>
  );
}
