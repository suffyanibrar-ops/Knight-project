import assert from "node:assert/strict";
import { existsSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  clearOAuthAccessTokenCache,
  createOAuthState,
  exchangeOAuthCode,
  fetchGscProperties,
  getGscConnectionStatus,
  getOAuthAccessToken,
  parseProperties,
  readGscTokenRecord,
  revokeAndDeleteGscConnection,
  selectGscProperty,
  verifyOAuthState,
  writeGscTokenRecord,
  type GscTokenRecord,
} from "../src/lib/gsc-oauth";

const tokenFile = join(tmpdir(), `knight-gsc-oauth-${process.pid}.json`);
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

function record(): GscTokenRecord {
  return {
    version: 1,
    refreshToken: "test-refresh-token",
    scope: "https://www.googleapis.com/auth/webmasters.readonly",
    tokenType: "Bearer",
    connectedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    accountEmail: null,
    siteUrl: null,
    properties: [{ siteUrl: "sc-domain:knightmedicalbilling.com", permissionLevel: "siteOwner" }],
  };
}

const originalFetch = globalThis.fetch;
try {
  if (existsSync(tokenFile)) rmSync(tokenFile, { force: true });

  // State / PKCE
  const state = createOAuthState(process.env.GSC_OAUTH_STATE_SECRET!);
  ok("PKCE challenge is derived from a verifier", state.challenge.length > 20 && state.verifier.length > 20);
  const verified = verifyOAuthState(state.cookieValue, state.state, process.env.GSC_OAUTH_STATE_SECRET!);
  ok("signed OAuth state verifies", verified?.verifier === state.verifier);
  ok("tampered state is rejected", verifyOAuthState(state.cookieValue, "wrong-state", process.env.GSC_OAUTH_STATE_SECRET!) === null);
  ok("tampered cookie is rejected", verifyOAuthState(`${state.cookieValue}x`, state.state, process.env.GSC_OAUTH_STATE_SECRET!) === null);

  // Secure token file
  writeGscTokenRecord(record());
  ok("token record round-trips", readGscTokenRecord()?.refreshToken === "test-refresh-token");
  ok("token file is mode 600", (statSync(tokenFile).mode & 0o777) === 0o600);
  ok("property selection validates available properties", (await selectGscProperty("sc-domain:knightmedicalbilling.com")).siteUrl === "sc-domain:knightmedicalbilling.com");
  await assert.rejects(async () => {
    const next = readGscTokenRecord()!;
    next.properties = [];
    writeGscTokenRecord(next);
    await selectGscProperty("sc-domain:unknown.example");
  });

  // Refresh token exchange with mock transport
  writeGscTokenRecord(record());
  await selectGscProperty("sc-domain:knightmedicalbilling.com");
  clearOAuthAccessTokenCache();
  let tokenRequestSeen = false;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("oauth2.googleapis.com/token")) {
      tokenRequestSeen = true;
      const body = String(init?.body ?? "");
      ok("refresh uses grant_type=refresh_token", body.includes("grant_type=refresh_token"));
      return new Response(JSON.stringify({ access_token: "test-access-token", expires_in: 3600 }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.includes("searchconsole.googleapis.com/webmasters/v3/sites")) {
      return new Response(JSON.stringify({ siteEntry: [{ siteUrl: "sc-domain:knightmedicalbilling.com", permissionLevel: "siteOwner" }] }), { status: 200, headers: { "content-type": "application/json" } });
    }
    return new Response("{}", { status: 500 });
  }) as typeof fetch;
  const refreshed = await getOAuthAccessToken();
  ok("OAuth access token refreshes for the selected property", refreshed?.token === "test-access-token" && refreshed.siteUrl === "sc-domain:knightmedicalbilling.com");
  ok("refresh flow made a token request", tokenRequestSeen);

  // Property API parsing
  const properties = await fetchGscProperties("test-access-token");
  ok("property list is parsed", properties.length === 1 && properties[0].permissionLevel === "siteOwner");
  ok("empty property payload is safe", parseProperties(null).length === 0);

  // Status: actual connected result from Google
  clearOAuthAccessTokenCache();
  const status = await getGscConnectionStatus();
  ok("status is connected when Google returns the selected property", status.status === "connected" && status.source === "oauth");

  // Authorization code exchange
  globalThis.fetch = (async () => new Response(JSON.stringify({ access_token: "code-access", refresh_token: "new-refresh", expires_in: 3600 }), { status: 200, headers: { "content-type": "application/json" } })) as typeof fetch;
  const exchanged = await exchangeOAuthCode("test-code", "test-verifier");
  ok("authorization code exchange returns refresh token", exchanged.refreshToken === "new-refresh" && exchanged.accessToken === "code-access");

  // Reconnect path from invalid_grant
  globalThis.fetch = (async () => new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400, headers: { "content-type": "application/json" } })) as typeof fetch;
  clearOAuthAccessTokenCache();
  const reconnect = await getGscConnectionStatus();
  ok("invalid refresh token becomes reconnect_required", reconnect.status === "reconnect_required");

  // Disconnect
  globalThis.fetch = (async () => new Response("", { status: 200 })) as typeof fetch;
  await revokeAndDeleteGscConnection();
  ok("disconnect removes the local token file", !existsSync(tokenFile) && readGscTokenRecord() === null);

  console.log(`RESULT pass=${passed} fail=0`);
} finally {
  globalThis.fetch = originalFetch;
  if (existsSync(tokenFile)) rmSync(tokenFile, { force: true });
}
