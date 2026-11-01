import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveVoicePreview } from '../kompas-voice-preview-resolve.mjs';

const sha = 'a'.repeat(40);
const token = 'synthetic-private-token';
const host = 'job-dashboard-git-fix-voice-abc-qu4ntum-s-projects.vercel.app';
const valid = { created: 100, state: 'READY', target: null, url: host,
  meta: { githubCommitSha: sha, githubOrg: 'eshwarjay0-delS', githubRepo: 'job-dashboard' } };
const mock = (deployments, status = 200) => async (url, options) => {
  assert.equal(url.origin, 'https://api.vercel.com');
  assert.equal(url.searchParams.get('projectId'), 'prj_s6vNyUlUl0IyDlNPa65P8Pqc9zhe');
  assert.equal(url.searchParams.get('sha'), sha);
  assert.equal(options.headers.authorization, `Bearer ${token}`);
  assert.equal(options.redirect, 'error');
  return { ok: status === 200, status, json: async () => ({ deployments }) };
};

test('resolves exact SHA, project, repo and trusted preview host without guessing aliases', async () => {
  const r = await resolveVoicePreview({ expectedSha: sha, token, fetcher: mock([valid]), attempts: 1 });
  assert.deepEqual(r, { url: `https://${host}/`, hostname: host, commit: sha, attempt: 1 });
});

test('rejects wrong account, wrong SHA, production and other Vercel tenants', async () => {
  for (const change of [
    { meta: { ...valid.meta, githubOrg: 'attacker' } },
    { meta: { ...valid.meta, githubCommitSha: 'b'.repeat(40) } },
    { target: 'production' },
  ]) {
    await assert.rejects(resolveVoicePreview({ expectedSha: sha, token, fetcher: mock([{ ...valid, ...change }]), attempts: 1 }), /No READY exact-head preview/);
  }
  for (const url of ['other-project.vercel.app', 'job-dashboard-attacker.vercel.app',
    'job-dashboard-abc-qu4ntum-s-projects.vercel.app.evil.org']) {
    await assert.rejects(resolveVoicePreview({ expectedSha: sha, token, fetcher: mock([{ ...valid, url }]), attempts: 1 }), /Untrusted preview hostname/);
  }
});

test('never substitutes older READY preview after latest exact-head deployment fails', async () => {
  await assert.rejects(resolveVoicePreview({ expectedSha: sha, token, fetcher: mock([
    valid, { ...valid, created: 200, state: 'ERROR' },
  ]), attempts: 1 }), /Latest exact-head preview deployment failed/);
});

test('waits for pending exact-head deployment with bounded retries', async () => {
  let n = 0, waits = 0;
  const r = await resolveVoicePreview({ expectedSha: sha, token, attempts: 2, intervalMs: 0,
    fetcher: async (...args) => mock([{ ...valid, state: ++n === 1 ? 'BUILDING' : 'READY' }])(...args),
    sleeper: async () => { waits++; },
  });
  assert.equal(r.attempt, 2);
  assert.equal(waits, 1);
});

test('missing token, unsafe inputs, malformed API and unauthorized API fail closed', async () => {
  await assert.rejects(resolveVoicePreview({ expectedSha: sha }), /KOMPAS_VERCEL_API_TOKEN/);
  await assert.rejects(resolveVoicePreview({ expectedSha: 'short', token }), /40-character/);
  await assert.rejects(resolveVoicePreview({ expectedSha: sha, token: 'bad\nheader' }), /KOMPAS_VERCEL_API_TOKEN/);
  await assert.rejects(resolveVoicePreview({ expectedSha: sha, token, fetcher: mock([], 403), attempts: 1 }), /HTTP 403/);
  await assert.rejects(resolveVoicePreview({ expectedSha: sha, token, fetcher: async () => ({ ok: true, json: async () => ({}) }), attempts: 1 }), /Invalid Vercel deployment API response/);
});

test('release workflow runs trusted base code, never executes PR-head code with secrets', () => {
  const workflow = readFileSync(new URL('../../.github/workflows/kompas-voice-preview-smoke.yml', import.meta.url), 'utf8');
  assert.match(workflow, /pull_request_target:/);
  assert.doesNotMatch(workflow, /^\s+pull_request:/m);
  assert.match(workflow, /ref: master/);
  assert.match(workflow, /persist-credentials: false/);
  assert.match(workflow, /KOMPAS_VERCEL_API_TOKEN: \$\{\{ secrets\.KOMPAS_VERCEL_API_TOKEN \}\}/);
  assert.doesNotMatch(workflow, /github\.event\.pull_request\.head\.ref/);
  assert.doesNotMatch(workflow, /if:\s*github\.head_ref/);
});
