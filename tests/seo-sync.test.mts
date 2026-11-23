import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const db = join(tmpdir(), `knight-seo-sync-${process.pid}.db`);
process.env.SQLITE_PATH = db;
process.env.SQLITE_ALLOW_CREATE = "1";
process.env.SQLITE_REQUIRE_EXISTING = "0";
process.env.ADMIN_PASSWORD = "seo-sync-password";

let passed = 0;
function ok(name: string, condition: boolean, detail = "") {
  if (!condition) throw new Error(`FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  passed += 1;
  console.log(`PASS ${name}`);
}

const SITE = "https://www.knightmedicalbilling.com";

try {
  const gsc = await import("../src/lib/seo/gsc-sync");
  const bing = await import("../src/lib/seo/bing-sync");
  const sqlite = await import("../src/lib/sqlite");

  // ---------- GSC request construction ----------
  const body = gsc.buildSearchAnalyticsQuery({ date: "2026-11-13", type: "web", dimensions: ["date"] });
  ok("one-day window per request", body.startDate === "2026-11-13" && body.endDate === "2026-11-13");
  ok("rowLimit capped at 25k", gsc.buildSearchAnalyticsQuery({ date: "2026-11-13", type: "web", dimensions: ["date"], rowLimit: 99_999 }).rowLimit === 25_000);
  ok("search type is a request field, not a dimension",
    body.type === "web" && !(body.dimensions as string[]).includes("web"));
  ok("unsupported dimensions are dropped",
    gsc.buildSearchAnalyticsQuery({ date: "2026-11-13", type: "web", dimensions: ["date", "total" as never] }).dimensions.join(",") === "date");

  const detailed = gsc.normaliseGscRow({ keys: ["a", "/b"], clicks: 2, impressions: 100, ctr: 0.02, position: 8.3333 }, ["page", "query"]);
  ok("page/query rows are marked as a top-row sample", detailed.completeness === "top_rows_only");
  const aggregate = gsc.normaliseGscRow({ keys: ["2026-11-13"], clicks: 2, impressions: 100 }, ["date"]);
  ok("date-only rows are complete", aggregate.completeness === "complete");
  ok("missing metrics stay null, never zero", gsc.normaliseGscRow({ keys: ["x"] }, ["date"]).clicks === null);
  ok("position is rounded to two decimals", detailed.position === 8.33);

  // ---------- GSC paging, cap, idempotency ----------
  const row = (n: number) => ({ keys: [`2026-11-13`], clicks: n, impressions: n * 10, ctr: 0.1, position: 5 });
  const fetchPages = async ({ body: b }: { body: { startRow: number } }) => {
    if (b.startRow === 0) return { status: 200, json: { rows: Array.from({ length: 25_000 }, (_, i) => row(i + 1)), responseAggregationType: "byProperty" } };
    if (b.startRow === 25_000) return { status: 200, json: { rows: Array.from({ length: 25_000 }, (_, i) => row(i + 1)), responseAggregationType: "byProperty" } };
    return { status: 200, json: { rows: [], responseAggregationType: "byProperty" } };
  };
  const first = await gsc.runGscSync({ token: "t", propertyKey: "sc-domain:knightmedicalbilling.com", dates: ["2026-11-13"], fetchImpl: fetchPages, maxRequests: 10 });
  ok("pagination stops at the 50k/day/type cap", first.pages === 2 && first.truncated === true, JSON.stringify(first));
  ok("two pages produced two requests", first.requests === 2, String(first.requests));

  const again = await gsc.runGscSync({ token: "t", propertyKey: "sc-domain:knightmedicalbilling.com", dates: ["2026-11-13"], fetchImpl: fetchPages, maxRequests: 10 });
  ok("re-sync is idempotent (same requests, no duplicate rows)", again.requests === 2);
  const handle = sqlite.sqliteHandle();
  assert.ok(handle);
  const count = Number((handle.prepare("SELECT COUNT(*) n FROM seo_metrics_daily").get() as { n: number }).n);
  ok("aggregate day is stored once, not once per row", count === 1, String(count));
  const stored = handle.prepare("SELECT * FROM seo_metrics_daily LIMIT 1").get() as Record<string, unknown>;
  ok("stored row keeps aggregation and completeness", stored.aggregation === "byProperty" && stored.completeness === "complete");
  ok("property row stored with domain kind",
    (handle.prepare("SELECT property_kind FROM seo_properties WHERE source='gsc'").get() as { property_kind: string }).property_kind === "domain");

  // ---------- GSC error handling ----------
  const quota = await gsc.runGscSync({
    token: "t", propertyKey: "sc-domain:knightmedicalbilling.com", dates: ["2026-11-13"],
    fetchImpl: async () => ({ status: 429, json: { error: { status: "RESOURCE_EXHAUSTED" } } }),
  });
  ok("429 is recorded, not swallowed", quota.errors.length === 1 && quota.errors[0].status === 429);
  ok("failed sync stores no rows", quota.rows === 0);

  const unauthorised = await gsc.runGscSync({
    token: "t", propertyKey: "sc-domain:knightmedicalbilling.com", dates: ["2026-11-13"],
    fetchImpl: async () => ({ status: 401, json: { error: { status: "UNAUTHENTICATED" } } }),
  });
  ok("401 is reported as an error", unauthorised.errors[0]?.code === "UNAUTHENTICATED");

  // ---------- Bing: real observed shapes ----------
  const usersites = { d: [{ __type: "Site:#Microsoft.Bing.Webmaster.Api", AuthenticationCode: "abc", DnsVerificationCode: "def", IsVerified: true, Url: "https://knightmedicalbilling.com/" }] };
  ok("OData envelope unwrapped", bing.unwrapOData(usersites).length === 1);
  ok("bare arrays also accepted", bing.unwrapOData([{ Url: SITE }]).length === 1);
  const sites = bing.parseUserSites(usersites);
  ok("IsVerified is read correctly", sites[0]?.verified === true, JSON.stringify(sites));
  ok("domain root recognised", sites[0]?.url === "https://knightmedicalbilling.com/");

  const call = await bing.callBing("GetUserSites", {
    key: "test-key-not-a-real-credential",
    fetchImpl: async ({ url }) => {
      ok("endpoint uses the JSON protocol", url.startsWith("https://ssl.bing.com/webmaster/api.svc/json/GetUserSites"));
      ok("siteUrl omitted for GetUserSites", !url.includes("siteUrl="));
      return { status: 200, json: usersites };
    },
  });
  ok("callBing returns unwrapped data", call.status === 200 && call.data.length === 1);
  ok("callBing reports no error on 200", call.error === null);
  ok("invalid method names rejected", await bing.callBing("Get;DROP", { key: "k", fetchImpl: async () => ({ status: 200, json: null }) }).then(() => false).catch(() => true));

  const siteCheck = await bing.verifyBingSite({
    key: "k",
    host: "knightmedicalbilling.com",
    fetchImpl: async () => ({ status: 200, json: usersites }),
  });
  ok("verified site accepted for the domain host", siteCheck.ok === true, JSON.stringify(siteCheck));
  const wrongHost = await bing.verifyBingSite({ key: "k", host: "example.com", fetchImpl: async () => ({ status: 200, json: usersites }) });
  ok("unrelated host rejected", wrongHost.ok === false);

  const stats = bing.normaliseBingStats("GetQueryStats", [{ Query: "Medical Billing", Impressions: 40, Clicks: 3, AvgClickPosition: 4.2 }]);
  ok("query stats normalised and lowercased", stats[0]?.subjectType === "query" && stats[0]?.subjectKey === "medical billing");
  ok("missing bing metrics stay null", bing.normaliseBingStats("GetQueryStats", [{ Query: "x" }])[0]?.metrics.impressions === null);
  ok("rows without a subject are dropped", bing.normaliseBingStats("GetQueryStats", [{ Impressions: 5 }]).length === 0);
  ok("page stats use url subjects", bing.normaliseBingStats("GetPageStats", [{ Page: `${SITE}/about`, Clicks: 1 }])[0]?.subjectType === "url");

  // Regression: Bing serialises .NET dates as OData `/Date(ms)/`. Slicing that
  // string produced the fake subject `/Date(1794` and displayed it as a page.
  const odataDate = bing.parseBingDate("/Date(1794000000000)/");
  ok("OData date is parsed to an ISO day", /^\d{4}-\d{2}-\d{2}$/.test(odataDate ?? ""), String(odataDate));
  ok("the truncated prefix is not a date", bing.parseBingDate("/Date(1794") === null);
  ok("plain ISO dates still work", bing.parseBingDate("2026-11-15") === "2026-11-15");
  const traffic = bing.normaliseBingStats("GetRankAndTrafficStats", [{ Date: "/Date(1794000000000)/", Impressions: 50, Clicks: 4 }]);
  ok("traffic rows get a clean period key", traffic[0]?.subjectKey === odataDate, String(traffic[0]?.subjectKey));
  ok("a malformed date never becomes a subject",
    bing.normaliseBingStats("GetRankAndTrafficStats", [{ Date: "/Date(1794", Impressions: 5 }])[0]?.subjectKey === "period");
  ok("traffic subjects are not URLs", traffic[0]?.subjectType === "site");
  ok("malformed page rows are dropped", bing.normaliseBingStats("GetPageStats", [{ Page: "/Date(1794", Clicks: 1 }]).length === 0);
  ok("legacy malformed bing subjects are repaired", bing.repairBingSubjectKey("site", "/Date(1794") === "period");
  ok("valid bing period subjects are preserved", bing.repairBingSubjectKey("site", "2026-11-15") === "2026-11-15");
  ok("url subjects are never rewritten by the repair", bing.repairBingSubjectKey("url", `${SITE}/about`) === `${SITE}/about`);

  const bingFetch = async ({ url }: { url: string }) => {
    if (url.includes("GetQueryStats")) return { status: 200, json: { d: [{ Query: "medical billing services", Impressions: 30, Clicks: 2 }] } };
    if (url.includes("GetPageStats")) return { status: 200, json: { d: [{ Page: `${SITE}/services`, Impressions: 20, Clicks: 1 }] } };
    return { status: 200, json: { d: [{ Date: "2026-11-15", Impressions: 50, Clicks: 4 }] } };
  };
  const sync = await bing.runBingSync({
    key: "k",
    siteUrl: "https://knightmedicalbilling.com/",
    observedAt: "2026-11-16T00:00:00.000Z",
    fetchImpl: bingFetch,
  });
  ok("three bing reports requested", sync.requests === 3, String(sync.requests));
  ok("bing observations persisted", sync.observations === 3, String(sync.observations));
  const bingCount = Number((handle.prepare("SELECT COUNT(*) n FROM seo_observations WHERE source='bing'").get() as { n: number }).n);
  ok("observations stored with bing attribution", bingCount === 3, String(bingCount));

  const syncAgain = await bing.runBingSync({
    key: "k",
    siteUrl: "https://knightmedicalbilling.com/",
    observedAt: "2026-11-16T00:00:00.000Z",
    fetchImpl: bingFetch,
  });
  ok("duplicate bing sync inserts nothing new", syncAgain.observations === 0, String(syncAgain.observations));

  const failing = await bing.runBingSync({
    key: "k",
    siteUrl: "https://knightmedicalbilling.com/",
    fetchImpl: async () => ({ status: 400, json: { ErrorCode: 3, Message: "InvalidApiKey" } }),
  });
  ok("invalid key surfaces as an error", failing.errors.length === 3 && failing.errors[0].code === 3);
  ok("failed bing sync stores nothing", failing.observations === 0);

  ok("env key guard rejects short values", bing.bingKeyFromEnv({ BING_WEBMASTER_API_KEY: "short" } as NodeJS.ProcessEnv) === null);
  ok("env key guard accepts a plausible key", bing.bingKeyFromEnv({ BING_WEBMASTER_API_KEY: "a".repeat(32) } as NodeJS.ProcessEnv) !== null);
  ok("missing key throws loudly", (() => { try { bing.requireBingKey({} as NodeJS.ProcessEnv); return false; } catch { return true; } })());

  console.log(`RESULT pass=${passed} fail=0`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  console.log("RESULT pass=0 fail=1");
  process.exitCode = 1;
} finally {
  for (const suffix of ["", "-wal", "-shm"]) {
    try { rmSync(db + suffix, { force: true }); } catch {}
  }
}
