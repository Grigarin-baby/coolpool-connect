/** Safe return paths after traveler sign-in at `/members`. */

export function normalizeTravelerResumeRedirect(candidate: string): string | undefined {
  const pathAndQuery = candidate.split("#")[0].trim();
  if (
    !pathAndQuery.startsWith("/") ||
    pathAndQuery.includes("..") ||
    pathAndQuery.startsWith("//")
  ) {
    return undefined;
  }

  const pathname = pathAndQuery.split("?")[0] ?? "";
  if (
    pathname.startsWith("/auth") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/driver") ||
    pathname.startsWith("/members") ||
    pathname.startsWith("/member")
  ) {
    return undefined;
  }

  const resume =
    pathname.startsWith("/booking/") || pathname === "/trips" || pathname === "/";

  return resume ? pathAndQuery : undefined;
}

export function parseTravelerResumeRedirectParam(raw: unknown): string | undefined {
  return typeof raw === "string" ? normalizeTravelerResumeRedirect(raw) : undefined;
}

/** Search params for `Link` to `/members` from the current app location. */
export function memberPortalLinkSearch(href: string): {
  redirect: string | undefined;
  google_auth: undefined;
} {
  const redirect = normalizeTravelerResumeRedirect(href);
  return { redirect, google_auth: undefined };
}
