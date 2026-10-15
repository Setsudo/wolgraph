const PROTECTED_PREFIXES = ["/day", "/trends", "/categories"];
const STATIC_ASSET = /\.(?:svg|png|jpe?g|gif|webp|ico|css|js|map|txt|woff2?)$/i;

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/**
 * Where to send a request given its path and whether it has a signed-in user,
 * or null to let it through.
 */
export function decideRedirect(pathname: string, hasUser: boolean): string | null {
  if (matchesPrefix(pathname, "/auth/callback")) return null;
  if (pathname.startsWith("/_next/") || STATIC_ASSET.test(pathname)) return null;

  if (matchesPrefix(pathname, "/login")) return hasUser ? "/" : null;

  if (!hasUser && PROTECTED_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix))) {
    return `/login?${new URLSearchParams({ next: pathname })}`;
  }
  return null;
}

/**
 * Returns `next` if it is a same-origin relative path ("/..."), otherwise "/".
 * Rejects protocol-relative ("//host") and backslash tricks ("/\\host").
 */
export function sanitizeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
  if (next.includes("\\") || [...next].some((c) => c.charCodeAt(0) < 0x20)) return "/";
  const base = "http://localhost";
  try {
    const url = new URL(next, base);
    if (url.origin !== base) return "/";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}
