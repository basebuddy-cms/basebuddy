import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

globalThis.React = React;

vi.mock("@/lib/site-indexing", () => ({
  getSiteRobotsMetadata: () => ({
    follow: false,
    index: false,
  }),
}));

vi.mock("@/app/providers", () => ({
  Providers: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe("root layout setup mode", () => {
  it("renders without reading Supabase or database env", async () => {
    const RootLayout = (await import("@/app/layout")).default;

    const html = renderToStaticMarkup(
      <RootLayout>
        <main>Setup can start</main>
      </RootLayout>,
    );

    expect(html).toContain("Setup can start");
  });
});
