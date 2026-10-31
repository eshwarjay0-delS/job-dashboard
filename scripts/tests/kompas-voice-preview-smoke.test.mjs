import test from "node:test";
import assert from "node:assert/strict";
import { verifyVoicePreview } from "../kompas-voice-preview-smoke.mjs";

const sha = "abcdef0123456789abcdef0123456789abcdef01";
const origin = "https://job-dashboard-git-fix-kompas-parakeet-227d7c-qu4ntum-s-projects.vercel.app/";
const response = (status, data) => ({
  status, ok: status >= 200 && status < 300,
  json: async () => data,
});
const version = response(200, { commit: sha.slice(0, 7), commitFull: sha, build: "kompas", builtAt: "2026-10-31T01:00:00Z" });
const health = response(200, { ok: true, app: "MarketFit" });

test("exact PR-head version and healthy live route pass without credentials or audio", async () => {
  const calls = [];
  const result = await verifyVoicePreview({
    baseUrl: origin, expectedSha: sha, attempts: 1,
    fetcher: async (url, options) => {
      calls.push([url.pathname, options]);
      return url.pathname === "/version.json" ? version : health;
    },
  });
  assert.deepEqual(result, { commit: sha.slice(0, 7), status: "verified", attempt: 1 });
  assert.deepEqual(calls.map(([path]) => path), ["/version.json", "/api/health"]);
  for (const [, opts] of calls) {
    assert.equal(opts.redirect, "manual");
    assert.equal(opts.cache, "no-store");
    assert.equal(opts.headers, undefined);
  }
});

test("stale preview never passes until exact SHA is served", async () => {
  let checks = 0, sleeps = 0;
  const result = await verifyVoicePreview({
    baseUrl: origin, expectedSha: sha, attempts: 2, intervalMs: 0,
    sleeper: async () => { sleeps++; },
    fetcher: async (url) => url.pathname === "/api/health" ? health :
      (++checks === 1 ? response(200, { commit: "1234567" }) : version),
  });
  assert.equal(result.attempt, 2);
  assert.equal(sleeps, 1);
});

test("matching 7-character prefixes cannot substitute for a full-SHA proof", async () => {
  const samePrefix = sha.slice(0, 7) + "0".repeat(33);
  for (const data of [
    { commit: sha.slice(0, 7) },
    { commit: sha.slice(0, 7), commitFull: samePrefix },
    { commit: sha.slice(0, 7), commitFull: "malformed" },
  ]) {
    await assert.rejects(verifyVoicePreview({
      baseUrl: origin, expectedSha: sha, attempts: 1,
      fetcher: async (url) => url.pathname === "/version.json" ? response(200, data) : health,
    }), /full commit does not match/);
  }
});

test("protected and redirected previews fail closed without a share link", async () => {
  for (const status of [302, 401, 403]) {
    await assert.rejects(verifyVoicePreview({
      baseUrl: origin, expectedSha: sha, attempts: 3, intervalMs: 0,
      fetcher: async () => response(status, {}),
      sleeper: async () => { throw Error("must not retry access bypass"); },
    }), /PREVIEW_ACCESS_BLOCKED/);
  }
  await assert.rejects(verifyVoicePreview({
    baseUrl: origin, expectedSha: sha, attempts: 1,
    fetcher: async (url) => url.pathname === "/version.json" ? version : response(403, {}),
  }), /PREVIEW_ACCESS_BLOCKED/);
});

test("unhealthy route, stale commit, and missing preview never produce green", async () => {
  for (const fetcher of [
    async (url) => url.pathname === "/version.json" ? version : response(200, { ok: false, app: "MarketFit" }),
    async () => response(200, { commit: "0000000" }),
    async () => response(404, {}),
  ]) {
    await assert.rejects(verifyVoicePreview({
      baseUrl: origin, expectedSha: sha, attempts: 2, intervalMs: 0,
      fetcher, sleeper: async () => {},
    }), /Exact-head preview smoke failed/);
  }
});

test("rejects non-Vercel origins, credentials, query tokens and invalid SHAs", async () => {
  for (const baseUrl of [
    "http://job-dashboard.vercel.app/", "https://example.com/",
    "https://user:password@job-dashboard.vercel.app/",
    "https://job-dashboard.vercel.app/?_vercel_share=unsafe",
    "https://job-dashboard.vercel.app/path",
    "https://job-dashboard.vercel.app:8443/",
  ]) {
    await assert.rejects(verifyVoicePreview({ baseUrl, expectedSha: sha }), /Preview URL must/);
  }
  await assert.rejects(verifyVoicePreview({ baseUrl: origin, expectedSha: "short" }), /40-character/);
});


test("private automation credential is sent only to the pinned preview origin on both routes", async () => {
  const token = "test-only-opaque-credential";
  const calls = [];
  const result = await verifyVoicePreview({
    baseUrl: origin, expectedSha: sha, protectionBypassToken: token, attempts: 1,
    fetcher: async (url, options) => {
      calls.push({ url: url.href, options });
      return url.pathname === "/version.json" ? version : health;
    },
  });
  assert.equal(result.status, "verified");
  assert.equal(calls.length, 2);
  for (const { url, options } of calls) {
    assert.ok(url.startsWith(origin));
    assert.ok(!url.includes(token));
    assert.equal(options.headers["x-vercel-protection-bypass"], token);
    assert.equal(options.redirect, "manual");
  }
});

test("private credential never overrides stale commit, unhealthy route, or protected redirect", async () => {
  const token = "test-only-opaque-credential";
  for (const fetcher of [
    async () => response(200, { commit: "0000000" }),
    async (url) => url.pathname === "/version.json" ? version : response(200, { ok: false, app: "MarketFit" }),
  ]) {
    await assert.rejects(verifyVoicePreview({
      baseUrl: origin, expectedSha: sha, protectionBypassToken: token,
      attempts: 1, fetcher,
    }), /Exact-head preview smoke failed/);
  }
  for (const status of [302, 401, 403]) {
    await assert.rejects(verifyVoicePreview({
      baseUrl: origin, expectedSha: sha, protectionBypassToken: token,
      attempts: 1, fetcher: async () => response(status, {}),
    }), /PREVIEW_ACCESS_BLOCKED/);
  }
});

test("private credential is rejected for other Vercel tenants or unsafe header values", async () => {
  for (const baseUrl of ["https://other-project.vercel.app/", "https://job-dashboard.vercel.app/",
    "https://job-dashboard-git-fix-kompas-parakeet-227d7c-qu4ntum-s-projects.vercel.app:8443/"]) {
    await assert.rejects(verifyVoicePreview({
      baseUrl, expectedSha: sha, protectionBypassToken: "test-credential",
      attempts: 1, fetcher: async () => { throw Error("must not contact other tenant"); },
    }), /Invalid private preview authentication configuration/);
  }
  for (const protectionBypassToken of ["bad\nheader", "bad\rheader", "white space", "x".repeat(2049)]) {
    await assert.rejects(verifyVoicePreview({
      baseUrl: origin, expectedSha: sha, protectionBypassToken,
      attempts: 1, fetcher: async () => { throw Error("must not send unsafe header"); },
    }), /Invalid private preview authentication configuration/);
  }
});
