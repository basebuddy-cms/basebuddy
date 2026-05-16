export type InstallAuthProvider = "github" | "google" | "magic_link" | "password";

export const DEFAULT_INSTALL_AUTH_PROVIDERS: InstallAuthProvider[] = [
  "github",
  "google",
  "magic_link",
  "password",
];

const INSTALL_AUTH_PROVIDER_SET = new Set<InstallAuthProvider>(DEFAULT_INSTALL_AUTH_PROVIDERS);

export const parseInstallAuthProviderList = (rawValue: string | null): InstallAuthProvider[] => {
  if (!rawValue) {
    return DEFAULT_INSTALL_AUTH_PROVIDERS;
  }

  const values = rawValue
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const unsupportedValues = values.filter(
    (value): value is string => !INSTALL_AUTH_PROVIDER_SET.has(value as InstallAuthProvider),
  );

  if (unsupportedValues.length > 0) {
    throw new Error(
      `BASEBUDDY_AUTH_PROVIDERS includes unsupported sign-in methods: ${unsupportedValues.join(
        ", ",
      )}.`,
    );
  }

  return values.filter((value, index) => values.indexOf(value) === index) as InstallAuthProvider[];
};
