import { describe, expect, it } from "vitest";

import {
  getEffectivePermissionKeys,
  getProjectMemberPermissionState,
  normalizePermissionKeys,
  toggleProjectMemberPermission,
} from "@/lib/control-plane/member-permission-overrides";

describe("member permission overrides", () => {
  it("normalizes permission keys to the canonical lowercase control-plane shape", () => {
    expect(
      normalizePermissionKeys([
        " Content.Write.All ",
        "content.write.all",
        "",
        "MAPPING.READ",
      ]),
    ).toEqual(["content.write.all", "mapping.read"]);
  });

  it("lets deny overrides remove inherited permissions", () => {
    expect(
      getEffectivePermissionKeys({
        allowPermissionKeys: [],
        denyPermissionKeys: ["content.write.all"],
        inheritedPermissionKeys: ["content.read.all", "content.write.all"],
      }),
    ).toEqual(["content.read.all"]);
  });

  it("lets allow overrides add non-inherited permissions", () => {
    expect(
      getEffectivePermissionKeys({
        allowPermissionKeys: ["mapping.read"],
        denyPermissionKeys: [],
        inheritedPermissionKeys: ["content.read.all"],
      }),
    ).toEqual(["content.read.all", "mapping.read"]);
  });

  it("turns inherited permissions off by creating a deny override", () => {
    expect(
      toggleProjectMemberPermission({
        allowPermissionKeys: [],
        denyPermissionKeys: [],
        inheritedPermissionKeys: ["content.publish.all"],
        nextEnabled: false,
        permissionKey: "content.publish.all",
      }),
    ).toEqual({
      allowPermissionKeys: [],
      denyPermissionKeys: ["content.publish.all"],
    });
  });

  it("turns non-inherited permissions on by creating an allow override", () => {
    expect(
      toggleProjectMemberPermission({
        allowPermissionKeys: [],
        denyPermissionKeys: [],
        inheritedPermissionKeys: ["content.read.all"],
        nextEnabled: true,
        permissionKey: "mapping.write",
      }),
    ).toEqual({
      allowPermissionKeys: ["mapping.write"],
      denyPermissionKeys: [],
    });
  });

  it("describes permission source for the UI", () => {
    expect(
      getProjectMemberPermissionState({
        allowPermissionKeys: [],
        denyPermissionKeys: ["member.manage"],
        inheritedPermissionKeys: ["member.manage"],
        permissionKey: "member.manage",
      }),
    ).toEqual({
      effective: false,
      mode: "deny",
      statusText: "Removed for this member",
    });
  });
});
