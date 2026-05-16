import { readOptionalInstallEnv } from "./install-env";
import { parseInstallAuthProviderList } from "./auth-provider-options";

export const getInstallAuthProviders = () =>
  parseInstallAuthProviderList(readOptionalInstallEnv("BASEBUDDY_AUTH_PROVIDERS"));
