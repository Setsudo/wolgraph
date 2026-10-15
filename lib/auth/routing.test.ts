import { describe, expect, it } from "vitest";
import { decideRedirect, sanitizeNext } from "./routing";

describe("decideRedirect", () => {
  it.each(["/day/2026-10-15", "/day", "/trends", "/trends/week", "/categories"])(
    "sends signed-out %s to login with next",
    (path) => {
      expect(decideRedirect(path, false)).toBe(`/login?next=${encodeURIComponent(path)}`);
    },
  );

  it.each(["/day/2026-10-15", "/trends", "/categories"])("lets signed-in %s through", (path) => {
    expect(decideRedirect(path, true)).toBeNull();
  });

  it("sends signed-in /login to /", () => {
    expect(decideRedirect("/login", true)).toBe("/");
  });

  it("lets signed-out /login through", () => {
    expect(decideRedirect("/login", false)).toBeNull();
  });

  it("never redirects the auth callback", () => {
    expect(decideRedirect("/auth/callback", false)).toBeNull();
    expect(decideRedirect("/auth/callback", true)).toBeNull();
  });

  it.each(["/_next/static/chunks/app.js", "/favicon.ico", "/logo.svg", "/fonts/x.woff2"])(
    "never redirects static asset %s",
    (path) => {
      expect(decideRedirect(path, false)).toBeNull();
      expect(decideRedirect(path, true)).toBeNull();
    },
  );

  it("does not treat lookalike prefixes as protected", () => {
    expect(decideRedirect("/dayz", false)).toBeNull();
    expect(decideRedirect("/trendsetter", false)).toBeNull();
  });

  it("leaves everything else alone", () => {
    expect(decideRedirect("/", false)).toBeNull();
    expect(decideRedirect("/", true)).toBeNull();
    expect(decideRedirect("/about", false)).toBeNull();
  });
});

describe("sanitizeNext", () => {
  it.each([
    ["/day/2026-10-15", "/day/2026-10-15"],
    ["/trends?period=week", "/trends?period=week"],
    ["/", "/"],
  ])("keeps relative path %s", (input, expected) => {
    expect(sanitizeNext(input)).toBe(expected);
  });

  it.each([
    null,
    undefined,
    "",
    "trends",
    "https://evil.example/",
    "//evil.example/path",
    "/\\evil.example",
    "/\\/evil.example",
    "javascript:alert(1)",
    "/\tevil",
    " /trends",
  ])("rejects %s", (input) => {
    expect(sanitizeNext(input)).toBe("/");
  });
});
