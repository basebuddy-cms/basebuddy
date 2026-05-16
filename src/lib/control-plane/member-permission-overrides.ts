export const normalizePermissionKeys = (permissionKeys: readonly string[]) =>
  [
    ...new Set(
      permissionKeys
        .map((permissionKey) => permissionKey.trim().toLowerCase())
        .filter(Boolean),
    ),
  ].sort();

export const getEffectivePermissionKeys = ({
  allowPermissionKeys,
  denyPermissionKeys,
  inheritedPermissionKeys,
}: {
  allowPermissionKeys: readonly string[];
  denyPermissionKeys: readonly string[];
  inheritedPermissionKeys: readonly string[];
}) => {
  const allowedKeys = new Set(normalizePermissionKeys(allowPermissionKeys));
  const deniedKeys = new Set(normalizePermissionKeys(denyPermissionKeys));
  const inheritedKeys = normalizePermissionKeys(inheritedPermissionKeys);

  for (const permissionKey of inheritedKeys) {
    allowedKeys.add(permissionKey);
  }

  for (const permissionKey of deniedKeys) {
    allowedKeys.delete(permissionKey);
  }

  return [...allowedKeys].sort();
};

export const getProjectMemberPermissionState = ({
  allowPermissionKeys,
  denyPermissionKeys,
  inheritedPermissionKeys,
  permissionKey,
}: {
  allowPermissionKeys: readonly string[];
  denyPermissionKeys: readonly string[];
  inheritedPermissionKeys: readonly string[];
  permissionKey: string;
}) => {
  const normalizedPermissionKey = permissionKey.trim().toLowerCase();
  const inherited = normalizePermissionKeys(inheritedPermissionKeys).includes(normalizedPermissionKey);
  const denied = normalizePermissionKeys(denyPermissionKeys).includes(normalizedPermissionKey);
  const allowed = normalizePermissionKeys(allowPermissionKeys).includes(normalizedPermissionKey);
  const effective = denied ? false : allowed || inherited;

  if (denied) {
    return {
      effective,
      mode: "deny" as const,
      statusText: "Removed for this member",
    };
  }

  if (allowed && !inherited) {
    return {
      effective,
      mode: "allow" as const,
      statusText: "Extra permission for this member",
    };
  }

  if (inherited) {
    return {
      effective,
      mode: "inherited" as const,
      statusText: "From role",
    };
  }

  return {
    effective,
    mode: "none" as const,
    statusText: "Not granted",
  };
};

export const toggleProjectMemberPermission = ({
  allowPermissionKeys,
  denyPermissionKeys,
  inheritedPermissionKeys,
  nextEnabled,
  permissionKey,
}: {
  allowPermissionKeys: readonly string[];
  denyPermissionKeys: readonly string[];
  inheritedPermissionKeys: readonly string[];
  nextEnabled: boolean;
  permissionKey: string;
}) => {
  const normalizedPermissionKey = permissionKey.trim().toLowerCase();
  const inherited = normalizePermissionKeys(inheritedPermissionKeys).includes(normalizedPermissionKey);
  const nextAllowKeys = new Set(normalizePermissionKeys(allowPermissionKeys));
  const nextDenyKeys = new Set(normalizePermissionKeys(denyPermissionKeys));

  nextAllowKeys.delete(normalizedPermissionKey);
  nextDenyKeys.delete(normalizedPermissionKey);

  if (inherited && !nextEnabled) {
    nextDenyKeys.add(normalizedPermissionKey);
  }

  if (!inherited && nextEnabled) {
    nextAllowKeys.add(normalizedPermissionKey);
  }

  return {
    allowPermissionKeys: [...nextAllowKeys].sort(),
    denyPermissionKeys: [...nextDenyKeys].sort(),
  };
};
