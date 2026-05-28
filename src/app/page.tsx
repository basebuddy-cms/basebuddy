import { redirect } from "next/navigation";

import {
  getOptionalAuthenticatedUserWithAccount,
  getProjectsPageBootstrap,
} from "@/lib/control-plane/server";
import {
  getBaseBuddyConfigSetupStatus,
  isBaseBuddyConfigSetupReady,
} from "@/lib/basebuddy-config/setup";

export default async function HomePage() {
  const setupStatus = await getBaseBuddyConfigSetupStatus();

  if (!isBaseBuddyConfigSetupReady(setupStatus)) {
    return redirect("/onboarding");
  }

  const { user } = await getOptionalAuthenticatedUserWithAccount();

  if (!user) {
    return redirect("/login");
  }

  const { projects, setupRequired } = await getProjectsPageBootstrap();

  if (setupRequired) {
    return redirect("/onboarding");
  }

  return redirect(projects.length > 0 ? "/projects" : "/projects#new-project");
}
