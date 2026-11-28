import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import vm from 'node:vm'

const require = createRequire(import.meta.url)
const ts = require('typescript')
const root = resolve(process.cwd())
function loadTS(file, mocks, sandbox = {}) {
  const source = readFileSync(resolve(root, file), 'utf8')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const module = { exports: {} }
  vm.runInNewContext(compiled, {
    module, exports: module.exports, require: id => id in mocks ? mocks[id] : require(id),
    AbortController, AbortSignal, setTimeout, clearTimeout, Date, URL, ...sandbox,
  }, { filename: file })
  return module.exports
}

test('runner forwards the portal signal to fetch and storage operations', async () => {
  const fetchSignals = [], upsertSignals = [], retireSignals = []
  const query = log => ({
    abortSignal(signal) { log.push(signal); return this },
    then(resolve, reject) { return Promise.resolve({ error: null }).then(resolve, reject) },
  })
  const rpcCalls = []
  const service = {
    async rpc(name, args) { rpcCalls.push({ name, args }); return { data: true, error: null } },
    from(table) {
      if (table === 'mfit_crawl_runs') {
        return {
          insert() { return { select() { return { single: async () => ({ data: { id: 'run-1' }, error: null }) } } } },
          update() { return { eq() { return this }, then(resolve, reject) { return Promise.resolve({ error: null }).then(resolve, reject) } } },
        }
      }
      return {
        upsert() { return query(upsertSignals) },
        update() { return { eq() { return this }, lt() { return this }, abortSignal(signal) { retireSignals.push(signal); return this }, then(resolve, reject) { return Promise.resolve({ error: null }).then(resolve, reject) } } },
      }
    },
  }
  const fakeFetch = async (_url, init) => {
    fetchSignals.push(init.signal)
    return { ok: true, text: async () => 'synthetic listing' }
  }
  const collect = loadTS('src/lib/crawl/collect.ts', {}, { fetch: fakeFetch })
  const adapter = {
    portal: 'synthetic-run32', firm: 'Synthetic',
    listUrls: ['https://jobs.example.test/list'],
    parseList: () => [{ title: 'Contract Security Analyst', url: 'https://jobs.example.test/role/1', engagement: 'Contract' }],
  }
  const { runCrawl } = loadTS('src/lib/crawl/runner.ts', {
    '@/lib/supabase/service': { createServiceClient: () => service },
    './adapters': { ADAPTERS: [adapter] },
    './classify': { classifyWorkType: () => 'contract', normalizeDate: () => null },
    './collect': collect,
    './text': { scrubContacts: text => text },
  }, { fetch: fakeFetch })
  const results = await runCrawl()
  assert.equal(results.length, 1)
  assert.equal(results[0].portal, 'synthetic-run32')
  assert.equal(results[0].firm, 'Synthetic')
  assert.equal(results[0].found, 1)
  assert.equal(results[0].upserted, 1)
  assert.equal(fetchSignals.length, 1)
  assert.equal(upsertSignals.length, 1)
  assert.equal(retireSignals.length, 1)
  assert.equal(upsertSignals[0], retireSignals[0], 'the same portal signal is used for both write queries')
  assert.ok(fetchSignals[0] instanceof AbortSignal, 'fetch receives a request-level signal')
  assert.ok(upsertSignals[0] instanceof AbortSignal, 'write queries receive the portal signal')
  assert.notEqual(fetchSignals[0], upsertSignals[0], 'fetch wraps the portal signal so its own request timeout remains available')
  assert.deepEqual(rpcCalls.map(call => call.name), ['acquire_mfit_crawl_run_lease', 'release_mfit_crawl_run_lease'])
  assert.equal(rpcCalls[0].args.p_lease_token, rpcCalls[1].args.p_lease_token, 'only the acquiring invocation can release its lease')
  const runnerSource = readFileSync(resolve(root, 'src/lib/crawl/runner.ts'), 'utf8')
  assert.match(runnerSource, /politeFetcher\(adapter\.gapMs \?\? 600,\s*25_000,\s*signal\)/, 'runner forwards the portal signal into the fetcher')
})


function leaseRunner({ acquired = true, acquireError = null, quarantined = false } = {}) {
  const calls = []
  let fromCalls = 0
  let crawlCalls = 0
  const adapter = { portal: 'synthetic-lease', firm: 'Synthetic' }
  const service = {
    async rpc(name, args) {
      calls.push({ name, args })
      if (name === 'acquire_mfit_crawl_run_lease') return { data: acquired, error: acquireError }
      if (name === 'release_mfit_crawl_run_lease') return { data: true, error: null }
      throw new Error('unexpected RPC')
    },
    from(table) {
      fromCalls++
      assert.equal(table, 'mfit_crawl_runs')
      return {
        insert() { return { select() { return { single: async () => ({ data: { id: 'lease-run' }, error: null }) } } } },
        update() { return { eq() { return { then(resolve, reject) { return Promise.resolve({ error: null }).then(resolve, reject) } } } } },
      }
    },
  }
  const collect = {
    collectJobs: async () => [],
    politeFetcher: () => async () => '',
    async crawlEach(adapters) {
      crawlCalls++
      return adapters.map(item => quarantined
        ? { adapter: item, error: 'timed out', quarantined: true }
        : { adapter: item, value: { portal: item.portal, firm: item.firm, found: 0, upserted: 0 } })
    },
  }
  const mod = loadTS('src/lib/crawl/runner.ts', {
    '@/lib/supabase/service': { createServiceClient: () => service },
    './adapters': { ADAPTERS: [adapter] },
    './classify': { classifyWorkType: () => 'contract', normalizeDate: () => null },
    './collect': collect,
    './text': { scrubContacts: value => value },
  })
  return { ...mod, calls, get fromCalls() { return fromCalls }, get crawlCalls() { return crawlCalls } }
}

test('a second serverless invocation fails closed while the global crawler lease is held', async () => {
  const runner = leaseRunner({ acquired: false })
  await assert.rejects(runner.runCrawl(), error => error?.name === 'CrawlAlreadyRunningError')
  assert.equal(runner.fromCalls, 0, 'a rejected lease must not create a run row')
  assert.equal(runner.crawlCalls, 0, 'a rejected lease must not start any portal')
  assert.deepEqual(runner.calls.map(call => call.name), ['acquire_mfit_crawl_run_lease'])
})

test('a quarantined non-cooperative portal keeps the cross-instance lease until expiry', async () => {
  const runner = leaseRunner({ quarantined: true })
  const results = await runner.runCrawl()
  assert.match(results[0].error, /timed out/)
  assert.deepEqual(runner.calls.map(call => call.name), ['acquire_mfit_crawl_run_lease'])
  assert.equal(runner.fromCalls, 2, 'the run is recorded but its lease is intentionally retained')
})

test('a lease RPC failure prevents the crawler from starting', async () => {
  const runner = leaseRunner({ acquireError: { message: 'RPC unavailable' } })
  await assert.rejects(runner.runCrawl(), /Unable to acquire the contract crawler lease/)
  assert.equal(runner.fromCalls, 0)
  assert.equal(runner.crawlCalls, 0)
})

test('the cross-instance lease migration is service-only and outlives the maximum route duration', () => {
  const migration = readFileSync(resolve(root, 'supabase/migrations/20261128194000_mfit_crawl_run_lease.sql'), 'utf8')
  assert.match(migration, /enable row level security/i)
  assert.match(migration, /revoke all on public\.mfit_crawl_run_leases from public, anon, authenticated, service_role/i)
  assert.match(migration, /interval '15 minutes'/i)
  assert.match(migration, /grant execute on function public\.acquire_mfit_crawl_run_lease\(uuid\) to service_role/i)
  assert.match(migration, /grant execute on function public\.release_mfit_crawl_run_lease\(uuid\) to service_role/i)
  const runRoute = readFileSync(resolve(root, 'src/app/api/crawl/run/route.ts'), 'utf8')
  assert.match(runRoute, /export const maxDuration = 300/)
  const jobsRoute = readFileSync(resolve(root, 'src/app/api/crawl/jobs/route.ts'), 'utf8')
  assert.match(jobsRoute, /export const maxDuration = 60/)
  assert.match(jobsRoute, /status: 409/)
})
