// No-audio smoke: verify the exact Vercel preview build without public share links,
// microphones, or transcript payloads. A private automation credential is optional.
// Protected previews fail closed when the credential is missing or invalid.
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SHA = /^[a-f0-9]{40}$/i;
const EXPECTED_PREVIEW_HOST = "job-dashboard-git-fix-kompas-parakeet-227d7c-qu4ntum-s-projects.vercel.app";
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

export async function verifyVoicePreview({
  baseUrl, expectedSha, fetcher = fetch, sleeper = sleep,
  attempts = 30, intervalMs = 10000, protectionBypassToken,
}) {
  if (!SHA.test(String(expectedSha || ""))) throw Error("Expected exact 40-character commit SHA");
  if (!Number.isInteger(attempts) || attempts < 1 || attempts > 60) throw Error("Invalid attempt count");
  if (!Number.isInteger(intervalMs) || intervalMs < 0 || intervalMs > 60000) throw Error("Invalid retry interval");
  let base;
  try { base = new URL(baseUrl); } catch { throw Error("Invalid preview URL"); }
  if (base.protocol !== "https:" || !base.hostname.endsWith(".vercel.app") ||
      base.username || base.password || base.search || base.hash || base.pathname !== "/") {
    throw Error("Preview URL must be a plain HTTPS Vercel origin");
  }
  // Never send an automation credential to an arbitrary Vercel tenant or URL.
  const token = protectionBypassToken || undefined;
  if (token !== undefined && (typeof token !== "string" ||
      !/^[\x21-\x7e]{1,2048}$/.test(token) || base.hostname !== EXPECTED_PREVIEW_HOST)) {
    throw Error("Invalid private preview authentication configuration");
  }
  const headers = token ? { "x-vercel-protection-bypass": token } : undefined;
  const requestOptions = () => ({
    redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(8000),
    ...(headers ? { headers } : {}),
  });
  const prefix = expectedSha.slice(0, 7).toLowerCase();
  let last = "preview not ready";
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const versionResponse = await fetcher(new URL("/version.json", base), requestOptions());
      if ([401, 403].includes(versionResponse.status)) {
        throw Error("PREVIEW_ACCESS_BLOCKED: authenticated access required; private automation credential missing or invalid");
      }
      if (versionResponse.status >= 300 && versionResponse.status < 400) {
        throw Error("PREVIEW_ACCESS_BLOCKED: preview redirected; private automation credential missing or invalid");
      }
      if (versionResponse.ok) {
        const version = await versionResponse.json();
        if (version && typeof version.commit === "string" && version.commit.toLowerCase() === prefix) {
          const healthResponse = await fetcher(new URL("/api/health", base), requestOptions());
          if ([401, 403].includes(healthResponse.status) ||
              (healthResponse.status >= 300 && healthResponse.status < 400)) {
            throw Error("PREVIEW_ACCESS_BLOCKED: health route protected or redirected");
          }
          if (healthResponse.ok) {
            const health = await healthResponse.json();
            if (health?.ok === true && health?.app === "MarketFit") {
              return { commit: prefix, status: "verified", attempt };
            }
          }
          last = "health route not ready";
        } else {
          last = "preview commit does not match PR head";
        }
      } else {
        last = "version route HTTP " + versionResponse.status;
      }
    } catch (error) {
      if (String(error?.message || "").startsWith("PREVIEW_ACCESS_BLOCKED")) throw error;
      last = "preview unavailable: " + (error?.name === "TimeoutError" ? "timeout" : "request failed");
    }
    if (attempt < attempts) await sleeper(intervalMs);
  }
  throw Error("Exact-head preview smoke failed after " + attempts + " attempts: " + last);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  verifyVoicePreview({
    baseUrl: process.env.KOMPAS_PREVIEW_URL,
    expectedSha: process.env.KOMPAS_EXPECTED_SHA,
    protectionBypassToken: process.env.KOMPAS_VERCEL_PREVIEW_BYPASS,
  }).then((result) => console.log(JSON.stringify(result)))
    .catch((error) => { console.error(error.message); process.exitCode = 1; });
}
