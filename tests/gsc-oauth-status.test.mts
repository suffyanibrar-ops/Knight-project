import assert from "node:assert/strict";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  clearOAuthAccessTokenCache,
  getGscConnectionStatus,
  readGscTokenRecord,
  writeGscTokenRecord,
  type GscTokenRecord,
} from "../src/lib/gsc-oauth";

const tokenFile = join(tmpdir(), `knight-gsc-status-${process.pid}.json`);
process.env.GSC_OAUTH_TOKEN_FILE = tokenFile;
process.env.GOOGLE_OAUTH_CLIENT_ID = "test-client-id";
process.env.GOOGLE_OAUTH_CLIENT_SECRET = "test-client-secret";
process.env.GOOGLE_OAUTH_REDIRECT_URI = "http://localhost:3000/api/admin/seo/google/callback";
process.env.GSC_OAUTH_STATE_SECRET = "test-state-secret-that-is-long-enough";

let passed = 0;
function ok(name: string, condition: boolean, detail = "") {
  if (!condition) throw new Error(`FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  passed += 1;
  console.log(`PASS ${name}`);
}

const record = (): GscTokenRecord => ({
  version: 1, refreshToken: "test-refresh-token", scope: "https://www.googleapis.com/auth/webmasters.readonly",
  tokenType: "Bearer", connectedAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  accountEmail: null, siteUrl: "sc-domain:knightmedicalbilling.com",
  properties: [{ siteUrl: "sc-domain:knightmedicalbilling.com", permissionLevel: "siteOwner" }], lastError: null,
});

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const tokenOk = () => json({ access_token: "test-access-token", expires_in: 3600 });
const sitesOk = (property = "sc-domain:knightmedicalbilling.com") => json({ siteEntry: [{ siteUrl: property, permissionLevel: "siteOwner" }] });
type FetchMock = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

const originalFetch = globalThis.fetch;
const originalError = console.error;
const logs: string[] = [];
console.error = (...args: unknown[]) => { logs.push(args.map(String).join(" ")); };

function resetLogs() { logs.length = 0; }
function prepare() {
  writeGscTokenRecord(record());
  clearOAuthAccessTokenCache();
  resetLogs();
}
function mock(fetchMock: FetchMock) { globalThis.fetch = fetchMock as typeof fetch; }

try {
  if (existsSync(tokenFile)) rmSync(tokenFile, { force: true });

  // 1. Valid token + sites 200 + property present.
  prepare();
  let tokenCalls = 0;
  mock(async (input) => {
    if (String(input).includes("oauth2.googleapis.com/token")) { tokenCalls += 1; return tokenOk(); }
    return sitesOk();
  });
  const connected = await getGscConnectionStatus();
  ok("connected: valid token, sites 200, selected property present", connected.status === "connected" && connected.errorCode === undefined && connected.retryable === false, JSON.stringify(connected));
  ok("connected: token was refreshed once", tokenCalls === 1, String(tokenCalls));

  // 2. Search Console HTTP 401 → reconnect.
  prepare();
  mock(async (input) => String(input).includes("oauth2.googleapis.com/token") ? tokenOk() : json({ error: "unauthorized" }, 401));
  const sites401 = await getGscConnectionStatus();
  ok("401: classified as reconnect_required", sites401.status === "reconnect_required" && sites401.errorCode === "gsc_sites_401", JSON.stringify(sites401));
  ok("401: token remains untouched", readGscTokenRecord()?.refreshToken === "test-refresh-token");

  // 3. Search Console HTTP 403 → property access unavailable.
  prepare();
  mock(async (input) => String(input).includes("oauth2.googleapis.com/token") ? tokenOk() : json({ error: "forbidden" }, 403));
  const sites403 = await getGscConnectionStatus();
  ok("403: classified as property_access_unavailable", sites403.status === "property_access_unavailable" && sites403.errorCode === "gsc_sites_403", JSON.stringify(sites403));
  ok("403: selected property remains unchanged", readGscTokenRecord()?.siteUrl === "sc-domain:knightmedicalbilling.com");

  // 4. Selected property missing → property access unavailable.
  prepare();
  mock(async (input) => String(input).includes("oauth2.googleapis.com/token") ? tokenOk() : sitesOk("https://example.com/"));
  const missing = await getGscConnectionStatus();
  ok("missing property: classified as property_access_unavailable", missing.status === "property_access_unavailable" && missing.errorCode === "gsc_property_missing", JSON.stringify(missing));

  // 5. HTTP 429 → retry once, then temporarily unavailable.
  prepare();
  let rateTokenCalls = 0;
  let rateSiteCalls = 0;
  mock(async (input) => {
    if (String(input).includes("oauth2.googleapis.com/token")) { rateTokenCalls += 1; return tokenOk(); }
    rateSiteCalls += 1;
    return json({ error: "rate_limited" }, 429);
  });
  const rateLimited = await getGscConnectionStatus();
  ok("429: retries exactly once", rateTokenCalls === 2 && rateSiteCalls === 2, JSON.stringify({ rateTokenCalls, rateSiteCalls }));
  ok("429: classified as temporarily_unavailable", rateLimited.status === "temporarily_unavailable" && rateLimited.retryable === true, JSON.stringify(rateLimited));
  ok("429: token and property are unchanged", readGscTokenRecord()?.refreshToken === "test-refresh-token" && readGscTokenRecord()?.siteUrl === "sc-domain:knightmedicalbilling.com");

  // 6. HTTP 5xx → retry once, then temporarily unavailable.
  prepare();
  let fiveTokenCalls = 0;
  let fiveSiteCalls = 0;
  mock(async (input) => {
    if (String(input).includes("oauth2.googleapis.com/token")) { fiveTokenCalls += 1; return tokenOk(); }
    fiveSiteCalls += 1;
    return json({ error: "backend" }, 503);
  });
  const unavailable = await getGscConnectionStatus();
  ok("503: retries exactly once", fiveTokenCalls === 2 && fiveSiteCalls === 2, JSON.stringify({ fiveTokenCalls, fiveSiteCalls }));
  ok("503: classified as temporarily_unavailable", unavailable.status === "temporarily_unavailable" && unavailable.retryable === true, JSON.stringify(unavailable));

  // 7. Timeout / network failure → retry once, then temporarily unavailable.
  prepare();
  let timeoutTokenCalls = 0;
  let timeoutSiteCalls = 0;
  mock(async (input) => {
    if (String(input).includes("oauth2.googleapis.com/token")) { timeoutTokenCalls += 1; return tokenOk(); }
    timeoutSiteCalls += 1;
    const error = new Error("request timed out");
    error.name = "TimeoutError";
    throw error;
  });
  const timeout = await getGscConnectionStatus();
  ok("timeout: retries exactly once", timeoutTokenCalls === 2 && timeoutSiteCalls === 2, JSON.stringify({ timeoutTokenCalls, timeoutSiteCalls }));
  ok("timeout: classified as temporarily_unavailable", timeout.status === "temporarily_unavailable" && timeout.errorCode === "gsc_timeout", JSON.stringify(timeout));

  // 8. Unexpected HTTP status → sanitized generic error, no retry.
  prepare();
  let unexpectedSiteCalls = 0;
  mock(async (input) => {
    if (String(input).includes("oauth2.googleapis.com/token")) return tokenOk();
    unexpectedSiteCalls += 1;
    return json({ error: "teapot" }, 418);
  });
  const unexpected = await getGscConnectionStatus();
  ok("unexpected: classified as generic error", unexpected.status === "error" && unexpected.errorCode === "gsc_sites_418" && unexpected.retryable === false, JSON.stringify(unexpected));
  ok("unexpected: no automatic retry", unexpectedSiteCalls === 1, String(unexpectedSiteCalls));

  // 9. Sanitized logging and no sensitive values.
  const serializedLogs = logs.join("\n");
  ok("logs contain structured diagnostic event", serializedLogs.includes("gsc_status_check_failed"));
  ok("logs contain no access token", !serializedLogs.includes("test-access-token"));
  ok("logs contain no refresh token or client secret", !serializedLogs.includes("test-refresh-token") && !serializedLogs.includes("test-client-secret"));
  ok("logs contain no authorization code or cookies", !serializedLogs.includes("authorization_code") && !serializedLogs.includes("cookie"));

  // 10. Failed check did not delete token file.
  ok("failed checks preserved the token file", existsSync(tokenFile) && readGscTokenRecord() !== null);
  ok("failed check did not modify selected property", readGscTokenRecord()?.siteUrl === "sc-domain:knightmedicalbilling.com");

  console.log(`RESULT pass=${passed} fail=0`);
} finally {
  globalThis.fetch = originalFetch;
  console.error = originalError;
  if (existsSync(tokenFile)) rmSync(tokenFile, { force: true });
}
