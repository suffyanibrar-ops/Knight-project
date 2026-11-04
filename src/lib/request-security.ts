import "server-only";

/**
 * Cross-site request protection for API route handlers.
 *
 * Next.js Server Actions already enforce an Origin/Host check. Plain route
 * handlers do not, so state-changing POSTs verify that the request originated
 * from our own site. Requests without an Origin header (curl, server-to-server,
 * same-origin form posts) are allowed only when they are clearly not
 * cross-origin browser requests.
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");

  // No Origin header: not a cross-origin browser request (curl, health checks,
  // server-side fetches, or a same-origin navigation).
  if (!origin) return true;

  const host = request.headers.get("host");
  if (!host) return false;

  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/** Consistent JSON 403 for blocked cross-origin writes. */
export function forbiddenResponse() {
  return Response.json({ ok: false, error: "Request blocked: cross-origin submissions are not allowed." }, { status: 403 });
}
