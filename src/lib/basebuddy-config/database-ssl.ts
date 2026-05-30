import { readFileSync } from "node:fs";

export type BaseBuddyPostgresSslConfig =
  | false
  | {
      ca?: string;
      rejectUnauthorized: boolean;
    };

export const BASEBUDDY_DATABASE_SSL_CA_PATH_PARAM = "sslrootcert";

export const getBaseBuddyPostgresSslConfig = (
  connectionString: string,
): BaseBuddyPostgresSslConfig => {
  try {
    const databaseUrl = new URL(connectionString);
    const sslMode = databaseUrl.searchParams.get("sslmode")?.toLowerCase() ?? null;
    const sslRootCertPath = databaseUrl.searchParams.get(BASEBUDDY_DATABASE_SSL_CA_PATH_PARAM);

    if (sslMode === "disable") {
      return false;
    }

    if (sslMode === "no-verify") {
      throw new Error(
        "sslmode=no-verify is not supported. Use sslmode=require or sslmode=verify-full with sslrootcert.",
      );
    }

    if (sslRootCertPath) {
      return {
        ca: readFileSync(sslRootCertPath, "utf8"),
        rejectUnauthorized: true,
      };
    }

    if (sslMode === "require" || sslMode === "verify-ca" || sslMode === "verify-full") {
      return {
        rejectUnauthorized: true,
      };
    }

    if (
      databaseUrl.hostname === "localhost" ||
      databaseUrl.hostname === "127.0.0.1" ||
      databaseUrl.hostname.endsWith(".local")
    ) {
      return false;
    }
  } catch (error) {
    if (error instanceof Error && /sslmode=no-verify/i.test(error.message)) {
      throw error;
    }
  }

  return {
    rejectUnauthorized: true,
  };
};
