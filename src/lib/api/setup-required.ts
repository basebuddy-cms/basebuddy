import { NextResponse } from "next/server";

import { APP_SETUP_REQUIRED_MESSAGE } from "@/lib/control-plane/server";
import { validateInstallRuntimeConfiguration } from "@/lib/self-host/install-runtime";

export const getSetupRequiredApiResponse = () => {
  try {
    validateInstallRuntimeConfiguration();
    return null;
  } catch {
    return NextResponse.json(
      {
        error: APP_SETUP_REQUIRED_MESSAGE,
        setupRequired: true,
      },
      { status: 503 },
    );
  }
};
