import React from "react";
import { redirect } from "next/navigation";

import { LoginForm } from "./login-form";
import { getOptionalAuthenticatedUserWithAccount } from "@/lib/control-plane/server";
import { getInstallAuthProviders } from "@/lib/self-host/auth-providers";
import {
  getControlPlaneSchemaSetupSection,
  getInstallSetupStatus,
  isInstallSetupReady,
} from "@/lib/self-host/install-runtime";
import { getSafeNextPath } from "@/lib/supabase/auth";

type LoginRouteSearchParams = Record<string, string | string[] | undefined>;

type LoginRouteProps = {
  searchParams?: LoginRouteSearchParams | Promise<LoginRouteSearchParams>;
};

const getSingleSearchParamValue = (
  searchParams: LoginRouteSearchParams | undefined,
  key: string,
) => {
  const value = searchParams?.[key];

  return Array.isArray(value) ? value[0] : value;
};

const getLoginRedirectPath = (value: string | null | undefined) => {
  const nextPath = getSafeNextPath(value);

  if (nextPath === "/login" || nextPath.startsWith("/login?") || nextPath.startsWith("/login#")) {
    return "/projects";
  }

  return nextPath;
};

export default async function LoginRoute({ searchParams }: LoginRouteProps = {}) {
  const controlPlaneSchemaSection = await getControlPlaneSchemaSetupSection();
  const setupStatus = getInstallSetupStatus({ controlPlaneSchemaSection });

  if (!isInstallSetupReady(setupStatus)) {
    redirect("/onboarding");
  }

  const resolvedSearchParams = await searchParams;
  const nextPath = getLoginRedirectPath(getSingleSearchParamValue(resolvedSearchParams, "next"));
  const { user } = await getOptionalAuthenticatedUserWithAccount();

  if (user) {
    redirect(nextPath);
  }

  return (
    <LoginForm
      enabledProviders={getInstallAuthProviders()}
      initialEmail={getSingleSearchParamValue(resolvedSearchParams, "email")?.trim() ?? ""}
      initialError={getSingleSearchParamValue(resolvedSearchParams, "error") ?? null}
      nextPath={nextPath}
    />
  );
}
