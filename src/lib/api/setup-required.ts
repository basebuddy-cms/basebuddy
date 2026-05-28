import { NextResponse } from "next/server";

import {
  BASEBUDDY_SETUP_REQUIRED_MESSAGE,
  getBaseBuddyConfigSetupStatus,
  isBaseBuddyConfigSetupReady,
} from "@/lib/basebuddy-config/setup";

export const getSetupRequiredApiResponse = async () => {
  const status = await getBaseBuddyConfigSetupStatus();

  if (isBaseBuddyConfigSetupReady(status)) {
    return null;
  }

  return NextResponse.json(
    {
      error: BASEBUDDY_SETUP_REQUIRED_MESSAGE,
      setupRequired: true,
    },
    { status: 503 },
  );
};
