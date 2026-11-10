import "server-only";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const SEARCH_CONSOLE_SITES_URL = "https://searchconsole.googleapis.com/webmasters/v3/sites";
export const GSC_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
export const GSC_STATE_COOKIE = "gsc_oauth_state";
export const GSC_STATE_TTL_SECONDS = 10 * 60;
const DEFAULT_TOKEN_FILE = "/var/lib/knight/gsc-oauth-token.json";
const DEFAULT_REDIRECT_URI = "https://www.knightmedicalbilling.com/api/admin/seo/google/callback";

export type GscProperty = { siteUrl: string; permissionLevel: string };

export type GscTokenRecord = {
  version: 1;
  refreshToken: string;
  scope: string;
  tokenType: "Bearer";
  connectedAt: string;
  updatedAt: string;
  accountEmail: string | null;
  siteUrl: string | null;
  properties: GscProperty[];
  lastError?: string | null;
};

export type GscStatus =
  | "not_connected"
  | "connected"
  | "reconnect_required"
  | "property_access_unavailable"
  | "property_selection_required"
  | "temporarily_unavailable"
  | "error";

export type GscConnectionStatus = {
  configured: boolean;
  status: GscStatus;
  source: "oauth" | "service_account" | null;
  siteUrl: string | null;
  properties: GscProperty[];
  accountEmail: string | null;
  connectedAt: string | null;
  checkedAt: string;
  error?: string;
  errorCode?: string;
  retryable?: boolean;
};

export type OAuthState = { state: string; verifier: string; challenge: string; cookieValue: string };

export class GscReconnectError extends Error {
  readonly code: string;
  readonly retryable = false;
  readonly httpStatus?: number;

  constructor(message = "Google Search Console authorization expired or was revoked.", code = "gsc_reconnect", httpStatus?: number) {
    super(message);
    this.name = "GscReconnectError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

export class GscPropertyAccessError extends Error {
  readonly code: string;
  readonly retryable = false;
  readonly httpStatus?: number;

  constructor(message = "This Google account cannot access the selected Search Console property.", code = "gsc_property_access", httpStatus?: number) {
    super(message);
    this.name = "GscPropertyAccessError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

export class GscTemporaryError extends Error {
  readonly code: string;
  readonly retryable = true;
  readonly httpStatus?: number;

  constructor(code: string, message = "Search Console is temporarily unavailable.", httpStatus?: number) {
    super(message);
    this.name = "GscTemporaryError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

export class GscOAuthError extends Error {
  readonly code: string;
  readonly retryable = false;
  readonly httpStatus?: number;

  constructor(code: string, message = "Google OAuth returned an unexpected response.", httpStatus?: number) {
    super(message);
    this.name = "GscOAuthError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

const SAFE_ERROR_CODE = /^[a-z0-9_]{1,80}$/;

function safeErrorCode(value: unknown, fallback: string): string {
  const code = typeof value === "string" ? value.toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 80) : "";
  return SAFE_ERROR_CODE.test(code) ? code : fallback;
}

function httpStatusOf(error: unknown): number | undefined {
  if (error && typeof error === "object" && "httpStatus" in error) {
    const value = (error as { httpStatus?: unknown }).httpStatus;
    return typeof value === "number" && Number.isInteger(value) ? value : undefined;
  }
  return undefined;
}

function classifyNetworkError(error: unknown, context: "token" | "sites"): GscTemporaryError | GscOAuthError {
  const name = error instanceof Error ? error.name : "";
  if (name === "AbortError" || name === "TimeoutError") return new GscTemporaryError("gsc_timeout", "Google did not respond in time.");
  if (name === "TypeError" || name === "FetchError" || /fetch failed|network|econn|enotfound|eai_again/i.test(error instanceof Error ? error.message : "")) {
    return new GscTemporaryError("gsc_network", "Google could not be reached.");
  }
  return new GscOAuthError(`${context}_fetch_error`, "Google returned an unexpected network response.");
}

function logGscFailure(operation: string, error: unknown, property: string | null, retryable: boolean): void {
  const safe = {
    event: "gsc_status_check_failed",
    operation,
    errorName: error instanceof Error ? error.name.slice(0, 80) : "UnknownError",
    errorCode: error instanceof GscReconnectError || error instanceof GscPropertyAccessError || error instanceof GscTemporaryError || error instanceof GscOAuthError ? error.code : "gsc_unknown",
    httpStatus: httpStatusOf(error) ?? null,
    selectedProperty: property,
    retryable,
  };
  // Structured, sanitized only: no messages, headers, tokens, codes or cookies.
  console.error("[gsc-oauth]", JSON.stringify(safe));
}

function clean(value: unknown, max = 500): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function oauthConfig(): { clientId: string; clientSecret: string; redirectUri: string; stateSecret: string } | null {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim() ?? "";
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim() ?? "";
  const stateSecret = process.env.GSC_OAUTH_STATE_SECRET?.trim() ?? "";
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim() || DEFAULT_REDIRECT_URI;
  if (!clientId || !clientSecret || !stateSecret) return null;
  return { clientId, clientSecret, redirectUri, stateSecret };
}

export function oauthConfigured(): boolean {
  return oauthConfig() !== null;
}

export function tokenFilePath(): string {
  const configured = process.env.GSC_OAUTH_TOKEN_FILE?.trim();
  if (!configured) return DEFAULT_TOKEN_FILE;
  if (!isAbsolute(configured)) throw new Error("GSC_OAUTH_TOKEN_FILE must be an absolute path outside public assets.");
  return resolve(configured);
}

function assertSafeTokenPath(file: string): void {
  const publicDir = `${resolve(process.cwd(), "public")}/`;
  if (`${file}/`.startsWith(publicDir) || file === resolve(process.cwd(), "public")) {
    throw new Error("GSC_OAUTH_TOKEN_FILE must not be inside the public directory.");
  }
  if (file.includes(`${join(process.cwd(), ".git")}`) || file.includes(`${join(process.cwd(), ".next")}`)) {
    throw new Error("GSC_OAUTH_TOKEN_FILE must not be inside application build or Git directories.");
  }
}

export function readGscTokenRecord(): GscTokenRecord | null {
  try {
    const file = tokenFilePath();
    assertSafeTokenPath(file);
    if (!existsSync(file)) return null;
    const parsed = JSON.parse(readFileSync(file, "utf8")) as Partial<GscTokenRecord>;
    if (!parsed || parsed.version !== 1 || typeof parsed.refreshToken !== "string" || !parsed.refreshToken.trim()) return null;
    return {
      version: 1,
      refreshToken: parsed.refreshToken,
      scope: clean(parsed.scope, 300) || GSC_SCOPE,
      tokenType: "Bearer",
      connectedAt: clean(parsed.connectedAt, 80) || new Date(0).toISOString(),
      updatedAt: clean(parsed.updatedAt, 80) || new Date(0).toISOString(),
      accountEmail: clean(parsed.accountEmail, 320) || null,
      siteUrl: clean(parsed.siteUrl, 500) || null,
      properties: Array.isArray(parsed.properties) ? parsed.properties.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const row = item as Record<string, unknown>;
        const siteUrl = clean(row.siteUrl, 500);
        const permissionLevel = clean(row.permissionLevel, 80) || "unknown";
        return siteUrl ? [{ siteUrl, permissionLevel }] : [];
      }).slice(0, 200) : [],
      lastError: clean(parsed.lastError, 500) || null,
    };
  } catch {
    return null;
  }
}

export function writeGscTokenRecord(record: GscTokenRecord): void {
  const file = tokenFilePath();
  assertSafeTokenPath(file);
  const dir = dirname(file);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const temporary = join(dir, `.${process.pid}.${randomBytes(8).toString("hex")}.tmp`);
  try {
    writeFileSync(temporary, `${JSON.stringify(record, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    renameSync(temporary, file);
    chmodSync(file, 0o600);
  } finally {
    try { if (existsSync(temporary)) unlinkSync(temporary); } catch { /* ignore cleanup failure */ }
  }
}

export function deleteGscTokenRecord(): void {
  try {
    const file = tokenFilePath();
    assertSafeTokenPath(file);
    if (existsSync(file)) unlinkSync(file);
  } catch {
    /* disconnect is allowed to complete even when no token exists */
  }
}

export function tokenFileExists(): boolean {
  try {
    const file = tokenFilePath();
    assertSafeTokenPath(file);
    return existsSync(file) && statSync(file).isFile();
  } catch {
    return false;
  }
}

export function createOAuthState(secret: string): OAuthState {
  if (!secret) throw new Error("GSC_OAUTH_STATE_SECRET is required.");
  const state = randomBytes(32).toString("hex");
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const encoded = Buffer.from(JSON.stringify({ state, verifier, createdAt: Date.now() })).toString("base64url");
  const signature = createHmac("sha256", secret).update(encoded).digest("base64url");
  return { state, verifier, challenge, cookieValue: `${encoded}.${signature}` };
}

export function verifyOAuthState(cookieValue: string | undefined, suppliedState: string, secret: string): { state: string; verifier: string } | null {
  if (!cookieValue || !suppliedState || !secret) return null;
  const [encoded, signature, ...extra] = cookieValue.split(".");
  if (!encoded || !signature || extra.length) return null;
  const expected = createHmac("sha256", secret).update(encoded).digest("base64url");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as { state?: unknown; verifier?: unknown; createdAt?: unknown };
    if (payload.state !== suppliedState || typeof payload.verifier !== "string" || typeof payload.createdAt !== "number") return null;
    if (Date.now() - payload.createdAt > GSC_STATE_TTL_SECONDS * 1000) return null;
    return { state: payload.state, verifier: payload.verifier };
  } catch {
    return null;
  }
}

export function buildGoogleAuthUrl(config: NonNullable<ReturnType<typeof oauthConfig>>, state: OAuthState): string {
  const url = new URL(GOOGLE_AUTH_URL);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GSC_SCOPE);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", state.state);
  url.searchParams.set("code_challenge", state.challenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

type FetchLike = typeof fetch;

async function tokenRequest(params: URLSearchParams, fetchImpl: FetchLike = fetch): Promise<Record<string, unknown>> {
  let response: Response;
  try {
    response = await fetchImpl(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: params,
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    throw classifyNetworkError(error, "token");
  }
  const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (!response.ok) {
    const providerError = safeErrorCode(body?.error, "token_error");
    if (providerError === "invalid_grant" || response.status === 401) {
      throw new GscReconnectError("Google authorization expired or was revoked. Reconnect Search Console.", providerError === "invalid_grant" ? "gsc_invalid_grant" : "gsc_token_401", response.status);
    }
    if (response.status === 429 || response.status >= 500) {
      throw new GscTemporaryError(`gsc_token_${response.status}`, "Google token service is temporarily unavailable.", response.status);
    }
    throw new GscOAuthError(`gsc_token_${response.status}`, "Google rejected the OAuth token request.", response.status);
  }
  return body ?? {};
}

export async function exchangeOAuthCode(code: string, verifier: string, fetchImpl: FetchLike = fetch): Promise<{ refreshToken: string | null; accessToken: string; expiresIn: number }> {
  const config = oauthConfig();
  if (!config) throw new Error("Google OAuth is not configured.");
  const body = await tokenRequest(new URLSearchParams({
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
    grant_type: "authorization_code",
    code_verifier: verifier,
  }), fetchImpl);
  const accessToken = clean(body.access_token, 4000);
  if (!accessToken) throw new Error("Google did not return an access token.");
  return {
    accessToken,
    refreshToken: clean(body.refresh_token, 4000) || null,
    expiresIn: Math.max(60, Number(body.expires_in) || 3600),
  };
}

let accessTokenCache: { refreshToken: string; accessToken: string; expiresAt: number } | null = null;

export async function getOAuthAccessToken(fetchImpl: FetchLike = fetch): Promise<{ token: string; siteUrl: string } | null> {
  const record = readGscTokenRecord();
  if (!record) return null;
  if (!record.siteUrl) throw new Error("Choose a Search Console property before requesting metrics.");
  if (accessTokenCache && accessTokenCache.refreshToken === record.refreshToken && accessTokenCache.expiresAt > Date.now() + 60_000) {
    return { token: accessTokenCache.accessToken, siteUrl: record.siteUrl };
  }
  const config = oauthConfig();
  if (!config) throw new GscReconnectError("Google OAuth is not configured. Reconnect Search Console.");
  const body = await tokenRequest(new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: record.refreshToken,
    grant_type: "refresh_token",
  }), fetchImpl);
  const accessToken = clean(body.access_token, 4000);
  if (!accessToken) throw new GscReconnectError("Google did not refresh the Search Console access token.");
  const expiresIn = Math.max(60, Number(body.expires_in) || 3600);
  accessTokenCache = { refreshToken: record.refreshToken, accessToken, expiresAt: Date.now() + expiresIn * 1000 };
  return { token: accessToken, siteUrl: record.siteUrl };
}

export function clearOAuthAccessTokenCache(): void {
  accessTokenCache = null;
}

export async function fetchGscProperties(accessToken: string, fetchImpl: FetchLike = fetch): Promise<GscProperty[]> {
  let response: Response;
  try {
    response = await fetchImpl(SEARCH_CONSOLE_SITES_URL, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    throw classifyNetworkError(error, "sites");
  }
  const body = (await response.json().catch(() => null)) as { siteEntry?: unknown } | null;
  if (response.status === 401) throw new GscReconnectError("Google Search Console authorization expired or was revoked.", "gsc_sites_401", response.status);
  if (response.status === 403) throw new GscPropertyAccessError("This Google account cannot access Search Console properties.", "gsc_sites_403", response.status);
  if (response.status === 429 || response.status >= 500) throw new GscTemporaryError(`gsc_sites_${response.status}`, "Search Console is temporarily unavailable.", response.status);
  if (!response.ok) throw new GscOAuthError(`gsc_sites_${response.status}`, "Search Console returned an unexpected response.", response.status);
  return parseProperties(body?.siteEntry);
}

export function parseProperties(value: unknown): GscProperty[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const siteUrl = clean(row.siteUrl, 500);
    if (!siteUrl) return [];
    return [{ siteUrl, permissionLevel: clean(row.permissionLevel, 80) || "unknown" }];
  }).slice(0, 200);
}

export async function selectGscProperty(siteUrl: string): Promise<GscTokenRecord> {
  const record = readGscTokenRecord();
  if (!record) throw new Error("Connect Search Console first.");
  const selected = clean(siteUrl, 500);
  if (!record.properties.some((property) => property.siteUrl === selected)) {
    throw new Error("That property is not available to the connected Google account.");
  }
  const next: GscTokenRecord = { ...record, siteUrl: selected, updatedAt: new Date().toISOString(), lastError: null };
  writeGscTokenRecord(next);
  clearOAuthAccessTokenCache();
  return next;
}

export async function revokeAndDeleteGscConnection(fetchImpl: FetchLike = fetch): Promise<void> {
  const record = readGscTokenRecord();
  clearOAuthAccessTokenCache();
  if (record) {
    try {
      const config = oauthConfig();
      if (config) {
        await fetchImpl(GOOGLE_REVOKE_URL, {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ token: record.refreshToken }),
          signal: AbortSignal.timeout(10_000),
        });
      }
    } catch {
      /* local disconnect must still succeed if Google is unreachable */
    }
  }
  deleteGscTokenRecord();
}

function serviceAccountConfigured(): boolean {
  return Boolean(process.env.GSC_SITE_URL?.trim() && (process.env.GSC_SERVICE_ACCOUNT_JSON?.trim() || process.env.GSC_SERVICE_ACCOUNT_FILE?.trim()));
}

export function getGscConnectionSummary(): { connected: boolean; source: "oauth" | "service_account" | null; siteUrl: string | null } {
  const record = readGscTokenRecord();
  if (record?.siteUrl) return { connected: true, source: "oauth", siteUrl: record.siteUrl };
  if (serviceAccountConfigured()) return { connected: true, source: "service_account", siteUrl: process.env.GSC_SITE_URL?.trim() ?? null };
  return { connected: false, source: null, siteUrl: null };
}

export async function getGscConnectionStatus(fetchImpl: FetchLike = fetch): Promise<GscConnectionStatus> {
  const configured = oauthConfigured();
  const checkedAt = new Date().toISOString();
  const record = readGscTokenRecord();
  if (!record) {
    if (serviceAccountConfigured()) {
      return { configured, status: "connected", source: "service_account", siteUrl: process.env.GSC_SITE_URL?.trim() ?? null, properties: [], accountEmail: null, connectedAt: null, checkedAt };
    }
    return { configured, status: "not_connected", source: null, siteUrl: null, properties: [], accountEmail: null, connectedAt: null, checkedAt };
  }
  if (!configured) {
    return { configured, status: "reconnect_required", source: "oauth", siteUrl: record.siteUrl, properties: record.properties, accountEmail: record.accountEmail, connectedAt: record.connectedAt, checkedAt, error: "Google OAuth environment variables are incomplete.", errorCode: "gsc_not_configured", retryable: false };
  }

  const base = { configured, source: "oauth" as const, siteUrl: record.siteUrl, properties: record.properties, accountEmail: record.accountEmail, connectedAt: record.connectedAt, checkedAt };
  const failure = (error: unknown): GscConnectionStatus => {
    if (error instanceof GscReconnectError) {
      return { ...base, status: "reconnect_required", error: error.message, errorCode: error.code, retryable: false };
    }
    if (error instanceof GscPropertyAccessError) {
      return { ...base, status: "property_access_unavailable", error: error.message, errorCode: error.code, retryable: false };
    }
    if (error instanceof GscTemporaryError) {
      return { ...base, status: "temporarily_unavailable", error: "Search Console is temporarily unavailable. Please try again.", errorCode: error.code, retryable: true };
    }
    if (error instanceof GscOAuthError) {
      return { ...base, status: "error", error: "We couldn't verify Search Console right now. Please try again.", errorCode: error.code, retryable: false };
    }
    return { ...base, status: "error", error: "We couldn't verify Search Console right now. Please try again.", errorCode: "gsc_unknown", retryable: false };
  };

  const attempt = async (): Promise<GscProperty[] | null> => {
    const auth = await getOAuthAccessToken(fetchImpl);
    if (!auth) return null;
    return fetchGscProperties(auth.token, fetchImpl);
  };

  let properties: GscProperty[] | null;
  try {
    properties = await attempt();
  } catch (error) {
    const initial = failure(error);
    logGscFailure("status_check", error, record.siteUrl, initial.retryable === true);
    if (!initial.retryable) return initial;
    // Transient failure: clear only the in-memory access-token cache and retry once.
    // The persistent refresh token and the selected property are never modified.
    clearOAuthAccessTokenCache();
    try {
      properties = await attempt();
    } catch (retryError) {
      logGscFailure("status_retry", retryError, record.siteUrl, true);
      return failure(retryError);
    }
  }

  if (!properties) return { configured, status: "not_connected", source: null, siteUrl: null, properties: [], accountEmail: null, connectedAt: null, checkedAt };
  if (!properties.length) {
    const error = new GscPropertyAccessError("No Search Console properties are available to this Google account.", "gsc_no_properties");
    logGscFailure("property_check", error, record.siteUrl, false);
    return { ...base, status: "property_access_unavailable", properties: [], error: error.message, errorCode: error.code, retryable: false };
  }
  if (!record.siteUrl) {
    return { ...base, status: "property_selection_required", siteUrl: null, properties, retryable: false };
  }
  if (!properties.some((property) => property.siteUrl === record.siteUrl)) {
    const error = new GscPropertyAccessError("The selected property is no longer available to this Google account.", "gsc_property_missing");
    logGscFailure("property_check", error, record.siteUrl, false);
    return { ...base, status: "property_access_unavailable", properties, error: error.message, errorCode: error.code, retryable: false };
  }
  return { ...base, status: "connected", properties, retryable: false };
}
