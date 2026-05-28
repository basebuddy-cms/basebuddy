import {
  BASEBUDDY_SESSION_COOKIE_NAME,
  createExpiredBaseBuddySessionCookieOptions,
  createBaseBuddyConfigSession,
  createBaseBuddySessionCookieOptions,
  getBaseBuddyConfigSessionByToken,
  parseSignedBaseBuddySessionCookieValue,
  removeBaseBuddyConfigSessionByToken,
  shouldUseSecureBaseBuddySessionCookie,
  type LocalAuthenticatedUser,
} from "@/lib/basebuddy-config/auth";
import { loadBaseBuddyConfig } from "@/lib/basebuddy-config/store";
import { requireBaseBuddyAuthSecret } from "@/lib/basebuddy-config/env";
import { getUserDisplayName } from "@/lib/control-plane/utils";

export type LocalAuthenticatedUserAccount = {
  avatarUrl: string | null;
  email: string | null;
  name: string;
};

export type LocalAuthenticatedSession = {
  account: LocalAuthenticatedUserAccount;
  user: LocalAuthenticatedUser;
};

type CookieReader = {
  get: (name: string) => { value: string } | undefined;
};

type CookieWriter = {
  set: (
    name: string,
    value: string,
    options: ReturnType<typeof createBaseBuddySessionCookieOptions>,
  ) => void;
};

type ExpiringCookieWriter = {
  set: (
    name: string,
    value: string,
    options: ReturnType<typeof createExpiredBaseBuddySessionCookieOptions>,
  ) => void;
};

type TimeProvider = () => Date;

export const getLocalAuthenticatedUserAccount = (
  user: LocalAuthenticatedUser,
): LocalAuthenticatedUserAccount => ({
  avatarUrl: user.avatarUrl,
  email: user.email,
  name: getUserDisplayName(user.email, user.name),
});

export const createLocalAuthenticatedSession = async ({
  cookies,
  now,
  request,
  userId,
}: {
  cookies: CookieWriter;
  now?: TimeProvider;
  request?: Request;
  userId: string;
}) => {
  const session = await createBaseBuddyConfigSession({
    now,
    userId,
  });

  cookies.set(
    BASEBUDDY_SESSION_COOKIE_NAME,
    session.cookieValue,
    createBaseBuddySessionCookieOptions({
      expiresAt: session.expiresAt,
      secure: shouldUseSecureBaseBuddySessionCookie(request),
    }),
  );

  return session;
};

export const clearLocalAuthenticatedSession = async ({
  cookies,
  request,
}: {
  cookies: CookieReader & ExpiringCookieWriter;
  request?: Request;
}) => {
  const config = await loadBaseBuddyConfig().catch(() => null);
  const cookieValue = cookies.get(BASEBUDDY_SESSION_COOKIE_NAME)?.value ?? null;
  const token = config
    ? parseSignedBaseBuddySessionCookieValue({
        authSecret: requireBaseBuddyAuthSecret(),
        cookieValue,
      })
    : null;
  const session = token
    ? await getBaseBuddyConfigSessionByToken({
        token,
      })
    : null;

  await removeBaseBuddyConfigSessionByToken(token);

  cookies.set(
    BASEBUDDY_SESSION_COOKIE_NAME,
    "",
    createExpiredBaseBuddySessionCookieOptions({
      secure: shouldUseSecureBaseBuddySessionCookie(request),
    }),
  );

  return session;
};

export const getLocalAuthenticatedSessionFromCookieValue = async (
  cookieValue: string | null | undefined,
  options: {
    now?: TimeProvider;
  } = {},
): Promise<LocalAuthenticatedSession | null> => {
  const config = await loadBaseBuddyConfig().catch(() => null);

  if (!config) {
    return null;
  }

  const token = parseSignedBaseBuddySessionCookieValue({
    authSecret: requireBaseBuddyAuthSecret(),
    cookieValue,
  });

  if (!token) {
    return null;
  }

  const session = await getBaseBuddyConfigSessionByToken({
    now: options.now,
    token,
  });

  if (!session) {
    return null;
  }

  return {
    account: getLocalAuthenticatedUserAccount(session.user),
    user: session.user,
  };
};

export const getLocalAuthenticatedSessionFromCookies = async (
  cookies: CookieReader,
): Promise<LocalAuthenticatedSession | null> =>
  getLocalAuthenticatedSessionFromCookieValue(
    cookies.get(BASEBUDDY_SESSION_COOKIE_NAME)?.value,
  );
