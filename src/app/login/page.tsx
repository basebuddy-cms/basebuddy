import React from "react";
import { redirect } from "next/navigation";

import { LoginForm } from "./login-form";
import { getOptionalAuthenticatedUserWithAccount } from "@/lib/control-plane/server";
import {
  getBaseBuddyConfigSetupStatus,
  isBaseBuddyConfigSetupReady,
} from "@/lib/basebuddy-config/setup";
import { getSafeNextPath } from "@/lib/auth/redirects";

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

const getDemoAccess = () => {
  if (process.env.BASEBUDDY_DEMO_LOGIN_ENABLED !== "1") {
    return null;
  }

  const password = process.env.BASEBUDDY_DEMO_USER_PASSWORD?.trim();

  if (!password) {
    return null;
  }

  return {
    email: process.env.BASEBUDDY_DEMO_USER_EMAIL?.trim() || "demo@basebuddycms.com",
    password,
  };
};

export default async function LoginRoute({ searchParams }: LoginRouteProps = {}) {
  const setupStatus = await getBaseBuddyConfigSetupStatus();

  if (!isBaseBuddyConfigSetupReady(setupStatus)) {
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
      demoAccess={getDemoAccess()}
      initialEmail={getSingleSearchParamValue(resolvedSearchParams, "email")?.trim() ?? ""}
      initialError={getSingleSearchParamValue(resolvedSearchParams, "error") ?? null}
      nextPath={nextPath}
    />
  );
}
