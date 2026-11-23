import assert from "node:assert/strict";

let passed = 0;
function ok(name: string, condition: boolean, detail = "") {
  if (!condition) throw new Error(`FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  passed += 1;
  console.log(`PASS ${name}`);
}

const ORIGIN = "https://www.knightmedicalbilling.com";
const APEX = "https://knightmedicalbilling.com";

try {
  const host = await import("../src/lib/canonical-host");
  const { NextRequest } = await import("next/server");
  const { proxy } = await import("../src/proxy");

  // ---------- host normalisation ----------
  ok("apex is recognised", host.isApexHost("knightmedicalbilling.com"));
  ok("apex with port is recognised", host.isApexHost("knightmedicalbilling.com:443"));
  ok("apex with trailing dot is recognised", host.isApexHost("KNIGHTMEDICALBILLING.COM."));
  ok("comma-separated proxy chain uses the first hop", host.normaliseRequestHost("knightmedicalbilling.com, proxy.internal") === "knightmedicalbilling.com");
  ok("www is not apex", !host.isApexHost("www.knightmedicalbilling.com"));

  // ---------- redirect generation ----------
  ok("homepage apex redirects to canonical origin", host.canonicalHostRedirect({ host: "knightmedicalbilling.com", pathname: "/" }) === `${ORIGIN}/`);
  ok("path is preserved", host.canonicalHostRedirect({ host: "knightmedicalbilling.com", pathname: "/services/medical-billing-and-coding" }) === `${ORIGIN}/services/medical-billing-and-coding`);
  ok("query string is preserved",
    host.canonicalHostRedirect({ host: "knightmedicalbilling.com", pathname: "/about", search: "?utm_source=x&utm_medium=email" }) === `${ORIGIN}/about?utm_source=x&utm_medium=email`);
  ok("a search value without the leading ? is handled",
    host.canonicalHostRedirect({ host: "knightmedicalbilling.com", pathname: "/about", search: "page=2" }) === `${ORIGIN}/about?page=2`);
  ok("https is always used", host.canonicalHostRedirect({ host: "knightmedicalbilling.com", pathname: "/about" })?.startsWith("https://"));
  ok("www host is never redirected", host.canonicalHostRedirect({ host: "www.knightmedicalbilling.com", pathname: "/about" }) === null);
  ok("localhost is never redirected", host.canonicalHostRedirect({ host: "localhost:3000", pathname: "/about" }) === null);
  ok("preview/unknown hosts are never redirected", host.canonicalHostRedirect({ host: "preview.example.com", pathname: "/about" }) === null);
  ok("API routes are not host-redirected", host.canonicalHostRedirect({ host: "knightmedicalbilling.com", pathname: "/api/health" }) === null);
  ok("static assets are not host-redirected", host.canonicalHostRedirect({ host: "knightmedicalbilling.com", pathname: "/images/logo.png" }) === null);
  ok("POST is never downgraded by a 301", host.canonicalHostRedirect({ host: "knightmedicalbilling.com", pathname: "/admin/login", method: "POST" }) === null);
  ok("HEAD is redirected like GET", host.canonicalHostRedirect({ host: "knightmedicalbilling.com", pathname: "/about", method: "HEAD" }) === `${ORIGIN}/about`);

  // No possible loop: an apex request only ever targets www.
  const target = new URL(host.canonicalHostRedirect({ host: "knightmedicalbilling.com", pathname: "/x" })!);
  ok("redirect target is the preferred host", target.hostname === "www.knightmedicalbilling.com");
  ok("redirect target would not redirect again", host.canonicalHostRedirect({ host: target.hostname, pathname: target.pathname }) === null);

  // ---------- preferred site URL normalisation ----------
  ok("apex env value is normalised to www", host.preferredSiteUrl("https://knightmedicalbilling.com") === ORIGIN);
  ok("http apex is upgraded and normalised", host.preferredSiteUrl("http://knightmedicalbilling.com/") === ORIGIN);
  ok("www is kept", host.preferredSiteUrl("https://www.knightmedicalbilling.com/") === ORIGIN);
  ok("localhost is preserved for development", host.preferredSiteUrl("http://localhost:3000") === "http://localhost:3000");
  ok("preview hosts are preserved", host.preferredSiteUrl("https://preview.example.com") === "https://preview.example.com");
  ok("empty config falls back to the canonical origin", host.preferredSiteUrl("") === ORIGIN);
  ok("normalisation drops a trailing path", host.preferredSiteUrl("https://knightmedicalbilling.com/extra") === ORIGIN);

  // ---------- canonical metadata source ----------
  const { SITE_URL } = await import("../src/lib/seo");
  const { site } = await import("../src/lib/site");
  ok("metadata SITE_URL uses the preferred host", new URL(SITE_URL).hostname === "www.knightmedicalbilling.com", SITE_URL);
  ok("site.url used by the sitemap uses the preferred host", new URL(site.url).hostname === "www.knightmedicalbilling.com", site.url);
  ok("metadata SITE_URL is https", SITE_URL.startsWith("https://"));
  ok("metadata SITE_URL and sitemap origin agree", SITE_URL === site.url);

  // ---------- proxy integration ----------
  const apexRequest = new NextRequest(`${APEX}/about?utm_source=x`, { headers: { host: "knightmedicalbilling.com" }, method: "GET" });
  const apexResponse = await proxy(apexRequest);
  ok("proxy returns 301 for the apex host", apexResponse.status === 301, String(apexResponse.status));
  ok("proxy preserves path and query", apexResponse.headers.get("location") === `${ORIGIN}/about?utm_source=x`, String(apexResponse.headers.get("location")));

  const wwwRequest = new NextRequest(`${ORIGIN}/about`, { headers: { host: "www.knightmedicalbilling.com" }, method: "GET" });
  const wwwResponse = await proxy(wwwRequest);
  ok("proxy leaves www requests alone", wwwResponse.status === 200 && wwwResponse.headers.get("location") === null);

  const apiRequest = new NextRequest(`${APEX}/api/health`, { headers: { host: "knightmedicalbilling.com" }, method: "GET" });
  const apiResponse = await proxy(apiRequest);
  ok("proxy does not redirect API routes", apiResponse.status === 200 && apiResponse.headers.get("location") === null);

  const postRequest = new NextRequest(`${APEX}/admin/login`, { headers: { host: "knightmedicalbilling.com" }, method: "POST" });
  const postResponse = await proxy(postRequest);
  ok("proxy does not 301 a POST", postResponse.headers.get("location") !== `${ORIGIN}/admin/login`);

  const assetRequest = new NextRequest(`${APEX}/images/knight-mark.png`, { headers: { host: "knightmedicalbilling.com" }, method: "GET" });
  const assetResponse = await proxy(assetRequest);
  ok("proxy does not redirect first-party assets", assetResponse.headers.get("location") === null);

  console.log(`RESULT pass=${passed} fail=0`);
} catch (error) {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  console.log("RESULT pass=0 fail=1");
  process.exitCode = 1;
}
