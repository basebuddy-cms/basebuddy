import { describe, expect, it, vi } from "vitest";

import { bindContentProjectContext } from "@/lib/content-runtime/server-bound-context";

describe("bindContentProjectContext", () => {
  it("reuses the resolved context for the same project id and falls back for other projects", async () => {
    const resolvedContext = {
      projectId: "project-1",
      projectSlug: "project-one",
    };
    const getProjectContext = vi.fn(async (projectId: string) =>
      projectId === "project-2" ? { projectId, projectSlug: "project-two" } : null,
    );

    const boundDependencies = bindContentProjectContext(
      {
        anotherDependency: "kept-intact",
        getProjectContext,
      },
      resolvedContext,
    );

    await expect(boundDependencies.getProjectContext("project-1")).resolves.toBe(resolvedContext);
    await expect(boundDependencies.getProjectContext("project-2")).resolves.toEqual({
      projectId: "project-2",
      projectSlug: "project-two",
    });
    expect(boundDependencies.anotherDependency).toBe("kept-intact");
    expect(getProjectContext).toHaveBeenCalledTimes(1);
    expect(getProjectContext).toHaveBeenCalledWith("project-2");
  });
});
