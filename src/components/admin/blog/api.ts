"use client";

/**
 * Tiny client for the admin blog JSON APIs.
 *
 * Every endpoint is session-guarded server-side; a 401 here means the admin
 * session expired, so the browser is sent back to the sign-in screen instead of
 * showing a misleading "save failed" message. Non-2xx responses are turned into
 * `ApiError`s carrying the server's message (e.g. taxonomy delete conflicts).
 */
export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function apiFetch<T>(input: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has("content-type")) headers.set("content-type", "application/json");

  const response = await fetch(input, { ...init, headers, cache: "no-store" });

  if (response.status === 401) {
    if (typeof window !== "undefined") window.location.assign("/admin/login");
    throw new ApiError("Your session expired. Redirecting to sign in…", 401);
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  const record = payload && typeof payload === "object" && !Array.isArray(payload) ? (payload as Record<string, unknown>) : null;

  if (!response.ok || record?.ok === false) {
    const message = typeof record?.error === "string" ? record.error : `Request failed (${response.status}).`;
    throw new ApiError(message, response.status);
  }

  return payload as T;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : "Something went wrong. Please try again.";
}
