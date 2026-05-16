import { afterEach, describe, expect, it, vi } from "vitest";

import {
  deleteProjectMutation,
  postProjectContentMutation,
  requestProjectContentMutation,
  saveProjectPostSidebarConfigMutation,
  updateProjectSettingsMutation,
} from "@/components/editor/project-editor/mutations";
import { createDefaultContentPostSidebarConfig } from "@/lib/content-runtime/shared";

const mockFetch = (response: Response) => {
  const fetchMock = vi.fn(async () => response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
};

describe("project editor mutations", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts content actions through the content route", async () => {
    const fetchMock = mockFetch(Response.json({ post: { id: "post-1" } }));

    const payload = await postProjectContentMutation<{ post: { id: string } }>({
      action: {
        action: "create_post",
      },
      fallbackMessage: "Could not create the post right now.",
      projectId: "project-1",
    });

    expect(payload).toEqual({ post: { id: "post-1" } });
    expect(fetchMock).toHaveBeenCalledWith("/api/projects/project-1/content", {
      body: JSON.stringify({ action: "create_post" }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    });
  });

  it("throws route error messages from failed content mutations", async () => {
    mockFetch(Response.json({ error: "Nope." }, { status: 400 }));

    await expect(
      postProjectContentMutation({
        action: {
          action: "create_post",
        },
        fallbackMessage: "Could not create the post right now.",
        projectId: "project-1",
      }),
    ).rejects.toThrow("Nope.");
  });

  it("returns raw content mutation response state for callers with custom error handling", async () => {
    const fetchMock = mockFetch(Response.json({ error: "Session changed." }, { status: 409 }));

    const result = await requestProjectContentMutation({
      action: {
        action: "update_post",
        postId: "post-1",
      },
      projectId: "project-1",
    });

    expect(result).toEqual({
      ok: false,
      payload: {
        error: "Session changed.",
      },
      status: 409,
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/projects/project-1/content", {
      body: JSON.stringify({
        action: "update_post",
        postId: "post-1",
      }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    });
  });

  it("patches project settings with the expected payload", async () => {
    const fetchMock = mockFetch(
      Response.json({
        project: {
          id: "project-1",
          name: "Demo",
          slug: "demo",
          websiteUrl: null,
        },
      }),
    );

    await updateProjectSettingsMutation({
      currentSlug: "old-demo",
      name: "Demo",
      projectId: "project-1",
      slug: "demo",
      websiteUrl: null,
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/projects/project-1/settings", {
      body: JSON.stringify({
        currentSlug: "old-demo",
        name: "Demo",
        slug: "demo",
        websiteUrl: null,
      }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "PATCH",
    });
  });

  it("saves post sidebar config through the sidebar settings route", async () => {
    const postSidebarConfig = createDefaultContentPostSidebarConfig();
    const fetchMock = mockFetch(
      Response.json({
        postSidebarConfig,
      }),
    );

    await saveProjectPostSidebarConfigMutation({
      postSidebarConfig,
      projectId: "project-1",
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/projects/project-1/settings/sidebar-fields", {
      body: JSON.stringify({
        postSidebarConfig,
        source: "manual",
      }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "PUT",
    });
  });

  it("deletes projects through the settings route", async () => {
    const fetchMock = mockFetch(Response.json({ success: true }));

    await deleteProjectMutation({ projectId: "project-1" });

    expect(fetchMock).toHaveBeenCalledWith("/api/projects/project-1/settings", {
      method: "DELETE",
    });
  });
});
