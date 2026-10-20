// Kforce's public job search, read offline from saved pieces: the search page's script tag, the part of the script that
// holds the query key (a stand-in here), and 10 of the 685 Technology jobs the search service returned.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const { kforce, readJobs, scriptOf, keyOf, addressOf } = await import('../../src/lib/crawl/portals/kforce.ts')
const { collectJobs } = await import('../../src/lib/crawl/collect.ts')
const fixture = (f) => readFileSync(new URL(`../fixtures/crawl/${f}`, import.meta.url), 'utf8')
const NOW = Date.parse('2026-10-20T12:00:00Z')

test('the key is read from the site\'s own script, never kept here', () => {
  assert.equal(scriptOf(fixture('kforce-search-page.html')), 'https://kforcewebeast.azureedge.net/scripts/dist/js/app.min.js?v=277119830')
  assert.equal(keyOf(fixture('kforce-app-snippet.js')), '0123456789ABCDEF0123456789ABCDEF', 'the production search, not the redesign one beside it')
  assert.equal(scriptOf('<html></html>'), ''); assert.equal(keyOf('nothing here'), '')
  assert.ok(!readFileSync(new URL('../../src/lib/crawl/portals/kforce.ts', import.meta.url), 'utf8').match(/[0-9A-F]{32}/), 'no key in the source')
})

test('a job\'s Id is its address; the short numeric Ids are Kforce\'s own openings and are left out', () => {
  assert.equal(addressOf('MTY5Nn5XUUd-MjE5MTM2OVAxfjk5'), 'https://www.kforce.com/jobs/1696~WQG~2191369P1~99/')
  assert.equal(addressOf('MjYwNTY5'), '')
  assert.equal(addressOf(''), '')
})

test('the answer is read as jobs: place with remote or hybrid, contract or direct hire, pay per hour or per year, date, description; nothing 120 days old', () => {
  const jobs = readJobs(fixture('kforce-search.json'), NOW)
  assert.equal(jobs.length, 8, '10 in the answer: one own opening and one from 2022 are left out')
  const byTitle = (t, i = 0) => jobs.filter(j => j.title === t)[i]
  assert.deepEqual({ ...byTitle('Data Analyst'), description: undefined }, {
    title: 'Data Analyst', url: addressOf(JSON.parse(fixture('kforce-search.json')).value.find(j => j.Title === 'Data Analyst').Id),
    location: 'Saint Louis, MO (Remote)', engagement: 'Contract', payRange: '$35 - $45 per hour', postedAt: byTitle('Data Analyst').postedAt, description: undefined,
  })
  assert.equal(byTitle('Business Analytics Manager', 0).location, 'Overland Park, KS (Remote)')
  assert.equal(byTitle('Business Analytics Manager', 1).location, 'Overland Park, KS (Hybrid)')
  assert.equal(byTitle('Software Engineer').location, 'Lisle, IL', 'neither remote nor hybrid')
  assert.equal(byTitle('Software Engineer').payRange, '$80,750 - $109,250 per year')
  assert.equal(byTitle('Software Engineer').engagement, 'Direct Hire')
  assert.ok(jobs.every(j => /^https:\/\/www\.kforce\.com\/jobs\/\d+~[A-Z0-9]+~[0-9A-Z]+~\d+\/$/.test(j.url)))
  assert.ok(jobs.every(j => j.description && !/<[a-z]/i.test(j.description)))
  assert.ok(!jobs.some(j => j.title === 'Mechanical Engineering Manager' || j.title === 'IT App Security Analyst'))
  assert.equal(readJobs(fixture('kforce-search.json'), Date.parse('2022-12-24T00:00:00Z')).some(j => j.title === 'Mechanical Engineering Manager'), true, 'it was current when it was posted')
})

test('a run is three requests: the search page, its script, then one search with the key just read; ApplyUrl is never asked for', async () => {
  const asked = []
  const get = async (url, init = {}) => {
    asked.push({ url, method: init.method || 'GET', key: init.headers?.['api-key'], body: init.body })
    if (url.startsWith('https://www.kforce.com/find-work')) return fixture('kforce-search-page.html')
    if (url.includes('app.min.js')) return fixture('kforce-app-snippet.js')
    return fixture('kforce-search.json')
  }
  const jobs = await collectJobs(kforce, get)
  assert.deepEqual(asked.map(a => [a.method, new URL(a.url).host]), [['GET', 'www.kforce.com'], ['GET', 'kforcewebeast.azureedge.net'], ['POST', 'kforcewebeast.search.windows.net']])
  assert.equal(asked[2].key, '0123456789ABCDEF0123456789ABCDEF')
  const body = JSON.parse(asked[2].body)
  assert.equal(body.filter, "Industry eq 'Technology'"); assert.equal(body.top, 1000)
  assert.ok(!/ApplyUrl/.test(body.select))
  assert.ok(jobs.length >= 8)
  await assert.rejects(collectJobs(kforce, async () => '<html></html>'), /names no script/)
  await assert.rejects(collectJobs(kforce, async (u) => (u.includes('www.kforce.com') ? fixture('kforce-search-page.html') : 'var nothing')), /no search key/)
})
