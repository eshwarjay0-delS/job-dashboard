// Resolve a preview through the authenticated Vercel project API, never a
// guessed branch alias. Run only from trusted base-branch workflow code.
import { appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SHA = /^[a-f0-9]{40}$/i;
const PROJECT_ID = 'prj_s6vNyUlUl0IyDlNPa65P8Pqc9zhe';
const PREVIEW_HOST = /^job-dashboard-[a-z0-9-]+-qu4ntum-s-projects\.vercel\.app$/;
const sleep = ms => new Promise(done => setTimeout(done, ms));

export async function resolveVoicePreview({
  expectedSha, token, teamId, fetcher = fetch, sleeper = sleep,
  attempts = 24, intervalMs = 10000,
} = {}) {
  if (!SHA.test(String(expectedSha || ''))) throw Error('Expected exact 40-character commit SHA');
  if (typeof token !== 'string' || !/^[\x21-\x7e]{1,2048}$/.test(token))
    throw Error('KOMPAS_VERCEL_API_TOKEN must be configured privately');
  if (teamId && !/^team_[a-zA-Z0-9]+$/.test(teamId)) throw Error('Invalid Vercel team ID');
  if (!Number.isInteger(attempts) || attempts < 1 || attempts > 60) throw Error('Invalid attempt count');
  if (!Number.isInteger(intervalMs) || intervalMs < 0 || intervalMs > 60000) throw Error('Invalid retry interval');

  const endpoint = new URL('https://api.vercel.com/v6/deployments');
  endpoint.searchParams.set('projectId', PROJECT_ID);
  endpoint.searchParams.set('sha', expectedSha.toLowerCase());
  endpoint.searchParams.set('limit', '20');
  if (teamId) endpoint.searchParams.set('teamId', teamId);
  let last = 'no exact-head preview deployment';
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const response = await fetcher(endpoint, {
      headers: { authorization: `Bearer ${token}` }, redirect: 'error',
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw Error('Vercel deployment API HTTP ' + response.status);
    const data = await response.json();
    if (!Array.isArray(data?.deployments)) throw Error('Invalid Vercel deployment API response');
    const candidates = data.deployments.filter(d =>
      d?.meta?.githubCommitSha?.toLowerCase() === expectedSha.toLowerCase() &&
      d?.meta?.githubOrg === 'eshwarjay0-delS' && d?.meta?.githubRepo === 'job-dashboard' &&
      (d.projectId == null || d.projectId === PROJECT_ID) &&
      (d.target == null || d.target === 'preview')
    ).sort((a, b) => (b.created || 0) - (a.created || 0));
    const current = candidates[0];
    if (current) {
      if (['ERROR', 'CANCELED', 'BLOCKED'].includes(current.state))
        throw Error('Latest exact-head preview deployment failed: ' + current.state);
      if (current.state === 'READY') {
        const host = String(current.url || '').toLowerCase();
        if (!PREVIEW_HOST.test(host)) throw Error('Untrusted preview hostname from Vercel API');
        return { url: `https://${host}/`, hostname: host, commit: expectedSha.toLowerCase(), attempt };
      }
      last = 'exact-head preview still ' + (current.state || 'unknown');
    }
    if (attempt < attempts) await sleeper(intervalMs);
  }
  throw Error('No READY exact-head preview after ' + attempts + ' checks: ' + last);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  resolveVoicePreview({
    expectedSha: process.env.KOMPAS_EXPECTED_SHA,
    token: process.env.KOMPAS_VERCEL_API_TOKEN,
    teamId: process.env.KOMPAS_VERCEL_TEAM_ID,
  }).then(result => {
    if (!process.env.GITHUB_ENV) throw Error('GITHUB_ENV is required in the trusted workflow');
    appendFileSync(process.env.GITHUB_ENV,
      `KOMPAS_PREVIEW_URL=${result.url}\nKOMPAS_TRUSTED_PREVIEW_HOST=${result.hostname}\n`);
    console.log('Resolved exact-head READY preview from the expected Vercel project');
  }).catch(error => { console.error(error.message); process.exitCode = 1; });
}
