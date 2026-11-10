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
};

export type OAuthState = { state: string; verifier: string; challenge: string; cookieValue: string };

export class GscReconnectError extends Error {
  constructor(message = "Google Search Console authorization expired or was revoked.") {
    super(message);
    this.name = "GscReconnectError";
  }
}

export class GscPropertyAccessError extends Error {
  constructor(message = "This Google account cannot access the selected Search Console property.") {
    super(message);
    this.name = "GscPropertyAccessError";
  }
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
  const response = await fetchImpl(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: params,
    signal: AbortSignal.timeout(15_000),
  });
  const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (!response.ok) {
    const error = clean(body?.error, 120);
    if (error === "invalid_grant" || response.status === 400) throw new GscReconnectError("Google authorization expired or was revoked. Reconnect Search Console.");
    throw new Error(`Google token exchange failed (${response.status}).`);
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
  const response = await fetchImpl(SEARCH_CONSOLE_SITES_URL, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  const body = (await response.json().catch(() => null)) as { siteEntry?: unknown } | null;
  if (response.status === 401) throw new GscReconnectError("Google Search Console authorization expired or was revoked.");
  if (response.status === 403) throw new GscPropertyAccessError();
  if (!response.ok) throw new Error(`Search Console sites request failed (${response.status}).`);
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
    return { configured, status: "reconnect_required", source: "oauth", siteUrl: record.siteUrl, properties: record.properties, accountEmail: record.accountEmail, connectedAt: record.connectedAt, checkedAt, error: "Google OAuth environment variables are incomplete." };
  }
  try {
    const auth = await getOAuthAccessToken(fetchImpl);
    if (!auth) return { configured, status: "not_connected", source: null, siteUrl: null, properties: [], accountEmail: null, connectedAt: null, checkedAt };
    const properties = await fetchGscProperties(auth.token, fetchImpl);
    if (!properties.length) return { configured, status: "property_access_unavailable", source: "oauth", siteUrl: record.siteUrl, properties: [], accountEmail: record.accountEmail, connectedAt: record.connectedAt, checkedAt, error: "No Search Console properties are available to this Google account." };
    if (!record.siteUrl) return { configured, status: "property_selection_required", source: "oauth", siteUrl: null, properties, accountEmail: record.accountEmail, connectedAt: record.connectedAt, checkedAt };
    if (!properties.some((property) => property.siteUrl === record.siteUrl)) {
      return { configured, status: "property_access_unavailable", source: "oauth", siteUrl: record.siteUrl, properties, accountEmail: record.accountEmail, connectedAt: record.connectedAt, checkedAt, error: "The selected property is no longer available to this Google account." };
    }
    return { configured, status: "connected", source: "oauth", siteUrl: record.siteUrl, properties, accountEmail: record.accountEmail, connectedAt: record.connectedAt, checkedAt };
  } catch (error) {
    if (error instanceof GscReconnectError) {
      return { configured, status: "reconnect_required", source: "oauth", siteUrl: record.siteUrl, properties: record.properties, accountEmail: record.accountEmail, connectedAt: record.connectedAt, checkedAt, error: error.message };
    }
    if (error instanceof GscPropertyAccessError) {
      return { configured, status: "property_access_unavailable", source: "oauth", siteUrl: record.siteUrl, properties: record.properties, accountEmail: record.accountEmail, connectedAt: record.connectedAt, checkedAt, error: error.message };
    }
    return { configured, status: "error", source: "oauth", siteUrl: record.siteUrl, properties: record.properties, accountEmail: record.accountEmail, connectedAt: record.connectedAt, checkedAt, error: "Search Console could not be reached. Check the connection and try again." };
  }
}
