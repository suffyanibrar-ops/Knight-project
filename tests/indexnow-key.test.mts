let passed = 0;
const ok = (n: string, c: boolean, d = "") => { if (!c) throw new Error(`FAIL ${n}${d ? ` — ${d}` : ""}`); passed += 1; console.log(`PASS ${n}`); };
const KEY = "k".repeat(32);
try {
  const proxy = await import("../src/lib/seo/indexnow-key");
  const idx = await import("../src/lib/seo/indexnow");

  ok("exact key path matches", proxy.indexNowKeyPath(`/${KEY}.txt`, KEY) === true);
  ok("other paths do not match", proxy.indexNowKeyPath("/about", KEY) === false);
  ok("wrong key does not match", proxy.indexNowKeyPath(`/${"x".repeat(32)}.txt`, KEY) === false);
  ok("missing key never matches", proxy.indexNowKeyPath(`/${KEY}.txt`, undefined) === false && proxy.indexNowKeyPath(`/${KEY}.txt`, "") === false);
  ok("malformed key never matches", proxy.indexNowKeyPath("/short.txt", "short") === false);
  ok("key path is case-sensitive", proxy.indexNowKeyPath(`/${KEY.toUpperCase()}.txt`, KEY) === false);
  ok("configured flag reflects the env", proxy.indexNowKeyConfigured({ INDEXNOW_KEY: KEY } as NodeJS.ProcessEnv) === true && proxy.indexNowKeyConfigured({} as NodeJS.ProcessEnv) === false);

  ok("module key validation agrees", idx.normaliseIndexNowKey(KEY) === KEY && idx.normaliseIndexNowKey("short") === null);
  ok("submission stays scoped to the origin", idx.isSubmittable(`https://www.knightmedicalbilling.com/blog/x`, "https://www.knightmedicalbilling.com") === true
    && idx.isSubmittable("https://evil.example/x", "https://www.knightmedicalbilling.com") === false);
  ok("no submission without a key", (await idx.submitChangedUrls({ urls: [`https://www.knightmedicalbilling.com/a`], contentHashes: {}, origin: "https://www.knightmedicalbilling.com", key: null, fetchImpl: async () => { throw new Error("must not fetch"); } })).status === "skipped");

  console.log(`RESULT pass=${passed} fail=0`);
} catch (e) { console.error(e instanceof Error ? e.message : e); console.log("RESULT pass=0 fail=1"); process.exitCode = 1; }
