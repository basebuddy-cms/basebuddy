import type { EmailOtpType } from "@supabase/supabase-js";

import { ensureProfile } from "@/lib/control-plane/server";
import { createClient } from "@/lib/supabase/server";

const prepareAuthenticatedProfile = async (
  supabase: Awaited<ReturnType<typeof createClient>>,
) => {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return false;
  }

  const profileResult = await ensureProfile(supabase, user);

  return !profileResult.error && !profileResult.setupRequired;
};

export const exchangeServerAuthCode = async (code: string) => {
  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (!error) {
    return {
      ok: await prepareAuthenticatedProfile(supabase),
    };
  }

  return {
    ok: false,
  };
};

export const confirmServerAuthIdentity = async ({
  code,
  tokenHash,
  type,
}: {
  code?: string | null;
  tokenHash?: string | null;
  type?: EmailOtpType | null;
}) => {
  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return {
        ok: await prepareAuthenticatedProfile(supabase),
      };
    }
  }

  if (tokenHash) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type ?? "email",
    });

    if (!error) {
      return {
        ok: await prepareAuthenticatedProfile(supabase),
      };
    }
  }

  return {
    ok: false,
  };
};
