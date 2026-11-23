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

test('runner wires one portal AbortSignal into fetch and both database write queries', async () => {
  const fetchSignals = [], upsertSignals = [], retireSignals = []
  const query = log => ({
    abortSignal(signal) { log.push(signal); return this },
    then(resolve, reject) { return Promise.resolve({ error: null }).then(resolve, reject) },
  })
  const service = {
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
  const collect = loadTS('src/lib/crawl/collect.ts', {})
  const adapter = {
    portal: 'synthetic', firm: 'Synthetic',
    listUrls: ['https://jobs.example.test/list'],
    parseList: () => [{ title: 'Contract Security Analyst', url: 'https://jobs.example.test/role/1', engagement: 'Contract' }],
  }
  const { runCrawl } = loadTS('src/lib/crawl/runner.ts', {
    '@/lib/supabase/service': { createServiceClient: () => service },
    './adapters': { ADAPTERS: [adapter] },
    './classify': { classifyWorkType: () => 'contract', normalizeDate: () => null },
    './collect': collect,
    './text': { scrubContacts: text => text },
  }, {
    fetch: async (_url, init) => {
      fetchSignals.push(init.signal)
      return { ok: true, text: async () => 'synthetic listing' }
    },
  })
  const results = await runCrawl()
  assert.deepEqual(results, [{ portal: 'synthetic', firm: 'Synthetic', found: 1, upserted: 1 }])
  assert.equal(fetchSignals.length, 1)
  assert.equal(upsertSignals.length, 1)
  assert.equal(retireSignals.length, 1)
  assert.equal(fetchSignals[0], upsertSignals[0])
  assert.equal(fetchSignals[0], retireSignals[0], 'the same portal signal is used for fetch and writes')
  assert.ok(fetchSignals[0] instanceof AbortSignal)
})
