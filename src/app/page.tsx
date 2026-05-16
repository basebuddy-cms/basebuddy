import { redirect } from "next/navigation";

import {
  getOptionalAuthenticatedUserWithAccount,
  getProjectsPageBootstrap,
} from "@/lib/control-plane/server";
import {
  getControlPlaneSchemaSetupSection,
  getInstallSetupStatus,
  isInstallSetupReady,
} from "@/lib/self-host/install-runtime";

export default async function HomePage() {
  const controlPlaneSchemaSection = await getControlPlaneSchemaSetupSection();
  const setupStatus = getInstallSetupStatus({ controlPlaneSchemaSection });

  if (!isInstallSetupReady(setupStatus)) {
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
