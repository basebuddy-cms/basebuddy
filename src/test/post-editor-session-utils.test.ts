import { describe, expect, it } from "vitest";

import { getReadOnlyAccessMessage } from "@/hooks/post-editor-session/utils";

describe("post editor session utils", () => {
  it("uses product-ready read-only messages", () => {
    expect(
      getReadOnlyAccessMessage({
        postTitle: "Slash testing",
        reason: "permission_lost",
      }),
    ).toBe("You no longer have permission to edit Slash testing.");

    expect(
      getReadOnlyAccessMessage({
        postTitle: "Slash testing",
        reason: "session_expired",
      }),
    ).toBe("Your editing access expired for Slash testing. Retry to continue editing.");

    expect(
      getReadOnlyAccessMessage({
        postTitle: "Slash testing",
        reason: "refresh_failed",
      }),
    ).toBe("We couldn't confirm editing access for Slash testing. Retry to continue editing.");
  });
});
