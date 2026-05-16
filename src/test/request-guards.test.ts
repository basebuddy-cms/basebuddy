import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  enforceSameOriginRequest,
  enforceContentLength,
  parseJsonBody,
} from "@/lib/api/request-guards";

describe("request guards", () => {
  it("allows state-changing requests without cookie authentication", () => {
    const request = new Request("https://basebuddy.example/api/projects", {
      headers: {
        origin: "https://attacker.example",
      },
      method: "POST",
    });

    expect(enforceSameOriginRequest(request)).toBeNull();
  });

  it("allows cookie-authenticated state changes from the same origin", () => {
    const request = new Request("https://basebuddy.example/api/projects", {
      headers: {
        cookie: "sb-auth-token=demo",
        host: "basebuddy.example",
        origin: "https://basebuddy.example",
      },
      method: "POST",
    });

    expect(enforceSameOriginRequest(request)).toBeNull();
  });

  it("rejects cookie-authenticated state changes from another origin", async () => {
    const request = new Request("https://basebuddy.example/api/projects", {
      headers: {
        cookie: "sb-auth-token=demo",
        host: "basebuddy.example",
        origin: "https://attacker.example",
      },
      method: "POST",
    });

    const response = enforceSameOriginRequest(request);

    expect(response?.status).toBe(403);
    await expect(response?.json()).resolves.toEqual({
      error: "We couldn't verify this request. Refresh the page and try again.",
    });
  });

  it("does not let a client-supplied forwarded host override the request host", async () => {
    const request = new Request("https://basebuddy.example/api/projects", {
      headers: {
        cookie: "sb-auth-token=demo",
        host: "basebuddy.example",
        origin: "https://attacker.example",
        "x-forwarded-host": "attacker.example",
      },
      method: "POST",
    });

    const response = enforceSameOriginRequest(request);

    expect(response?.status).toBe(403);
    await expect(response?.json()).resolves.toEqual({
      error: "We couldn't verify this request. Refresh the page and try again.",
    });
  });

  it("rejects cookie-authenticated state changes without origin details", async () => {
    const request = new Request("https://basebuddy.example/api/projects", {
      headers: {
        cookie: "sb-auth-token=demo",
        host: "basebuddy.example",
      },
      method: "POST",
    });

    const response = enforceSameOriginRequest(request);

    expect(response?.status).toBe(403);
    await expect(response?.json()).resolves.toEqual({
      error: "We couldn't verify this request. Refresh the page and try again.",
    });
  });

  it("does not enforce origin checks for read-only requests", () => {
    const request = new Request("https://basebuddy.example/api/projects", {
      headers: {
        cookie: "sb-auth-token=demo",
        host: "basebuddy.example",
        origin: "https://attacker.example",
      },
      method: "GET",
    });

    expect(enforceSameOriginRequest(request)).toBeNull();
  });

  it("rejects oversized content-length values before parsing multipart bodies", () => {
    const request = new Request("http://localhost/api/upload", {
      headers: {
        "content-length": String(9_000),
      },
      method: "POST",
    });

    const response = enforceContentLength({
      label: "Upload",
      maxBytes: 8_000,
      request,
    });

    expect(response?.status).toBe(413);
  });

  it("rejects invalid JSON request bodies", async () => {
    const request = new Request("http://localhost/api/demo", {
      body: "{not-valid-json",
      method: "POST",
    });

    const result = await parseJsonBody(
      request,
      z.object({
        name: z.string(),
      }),
    );

    expect(result.errorResponse?.status).toBe(400);
    await expect(result.errorResponse?.json()).resolves.toEqual({
      error: "We couldn't process that request. Please try again.",
    });
  });

  it("rejects schema-invalid JSON payloads", async () => {
    const request = new Request("http://localhost/api/demo", {
      body: JSON.stringify({}),
      method: "POST",
    });

    const result = await parseJsonBody(
      request,
      z.object({
        name: z.string().min(1, "Name is required."),
      }),
    );

    expect(result.errorResponse?.status).toBe(400);
    await expect(result.errorResponse?.json()).resolves.toEqual({
      error: "Some information is missing or invalid. Please review and try again.",
    });
  });

  it("preserves clear custom validation copy without exposing request field paths", async () => {
    const request = new Request("http://localhost/api/demo", {
      body: JSON.stringify({ name: "" }),
      method: "POST",
    });

    const result = await parseJsonBody(
      request,
      z.object({
        name: z.string().min(1, "Enter a profile name first."),
      }),
    );

    expect(result.errorResponse?.status).toBe(400);
    await expect(result.errorResponse?.json()).resolves.toEqual({
      error: "Enter a profile name first.",
    });
  });
});
