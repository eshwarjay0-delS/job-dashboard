// INSPYR, Brooksource, eTeam, Eliassen and System One, read offline from pages saved while probing them (20 Oct 2026):
// 12 INSPYR feed entries, 10 Brooksource feed items, 16 eTeam jobs, 8 Eliassen cards, 8 System One cards.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const { inspyr, readPage: inspyrPage } = await import('../../src/lib/crawl/portals/inspyr.ts')
const { brooksource, readFeed } = await import('../../src/lib/crawl/portals/brooksource.ts')
const { eteam, readPage: eteamPage } = await import('../../src/lib/crawl/portals/eteam.ts')
const { eliassen } = await import('../../src/lib/crawl/portals/eliassen.ts')
const { systemone } = await import('../../src/lib/crawl/portals/systemone.ts')
const { readCards, totalIn } = await import('../../src/lib/crawl/portals/snaphop.ts')
const { collectJobs } = await import('../../src/lib/crawl/collect.ts')
const { payIn, decodeEntities, isTechTitle } = await import('../../src/lib/crawl/text.ts')
const { ADAPTERS } = await import('../../src/lib/crawl/adapters.ts')
const fixture = (f) => readFileSync(new URL(`../fixtures/crawl/${f}`, import.meta.url), 'utf8')
const clean = (jobs) => jobs.every(j => /^https:\/\//.test(j.url) && j.title && !/<|&[a-z]+;|&#\d+;|\s{2,}/.test(j.title))

test('INSPYR: the open job feed is read as jobs, technology titles only, with kind, place, pay from the text and the day posted', async () => {
  const { jobs, count } = inspyrPage(fixture('inspyr-p1.json'))
  assert.equal(count, 12)
  assert.ok(jobs.length >= 7 && jobs.length < 12, 'jobs that are not technology work are left out')
  assert.ok(clean(jobs))
  for (const j of jobs) {
    assert.match(j.url, /^https:\/\/www\.inspyrsolutions\.com\/job\/[a-z0-9-]+\/$/)
    assert.match(j.postedAt, /^20\d\d-\d\d-\d\d$/)
    assert.ok(j.location && j.engagement && j.description.length > 40)
    assert.ok(!/<|&[a-z]+;/.test(j.description), 'tags and named entities are gone from the description')
  }
  assert.ok(jobs.some(j => j.engagement === 'Right to Hire') && jobs.some(j => j.engagement === 'Direct Placement') && jobs.some(j => j.engagement === 'Contract'))
  assert.equal(jobs.find(j => j.title === 'Program Manager III').payRange, '$62 – $82/hr', 'pay is read from the description: the salary fields are empty on this site')
  assert.equal(jobs.find(j => j.title === 'Payroll Service Delivery Analyst').payRange, '$28/hour – $36/hour')
  assert.throws(() => inspyrPage('{"code":"rest_no_route"}'), /did not come back/)
})

test('INSPYR: pages of 100 are asked for until one is short, never more than eight, as JSON', async () => {
  const hit = (n) => ({ link: `https://www.inspyrsolutions.com/job/${n}/`, title: { rendered: 'Cloud Engineer' }, content: { rendered: '<p>x</p>' }, meta: { _job_location: 'Austin, Texas', _filled: 0 }, class_list: ['job-type-contract'], date: '2026-10-19T00:00:00' })
  const asked = []
  const jobs = await collectJobs(inspyr, async (url, init) => {
    asked.push({ url, accept: init?.accept })
    const page = Number(new URL(url).searchParams.get('page'))
    return JSON.stringify(Array.from({ length: page < 3 ? 100 : 30 }, (_, i) => hit(`${page}-${i}`)))
  })
  assert.equal(asked.length, 3); assert.equal(jobs.length, 230)
  assert.ok(asked.every(a => a.accept === 'application/json' && a.url.startsWith('https://www.inspyrsolutions.com/wp-json/wp/v2/job-listings?per_page=100&')))
  const endless = []
  await collectJobs(inspyr, async (url) => { endless.push(url); return JSON.stringify(Array.from({ length: 100 }, (_, i) => hit(`${endless.length}-${i}`))) })
  assert.equal(endless.length, 8)
  // A job the site marks filled is not offered.
  const filled = JSON.stringify([{ ...hit('f'), meta: { _job_location: 'x', _filled: 1 } }])
  assert.deepEqual(inspyrPage(filled).jobs, [])
})

test('Brooksource: one request reads the whole feed; items are title, address, place, kind and pay; no date is kept', async () => {
  const jobs = readFeed(fixture('brooksource-feed.xml'))
  assert.ok(jobs.length >= 6 && jobs.length < 10)
  assert.ok(clean(jobs))
  for (const j of jobs) {
    assert.match(j.url, /^https:\/\/jobs\.brooksource\.com\/jobs\/job\/[a-z0-9-]+\/$/)
    assert.ok(j.location && ['Contract', 'Contract-to-Hire', 'Direct Hire'].includes(j.engagement))
    assert.equal(j.postedAt, undefined, 'the feed date is the hourly sync, not the day a job was posted')
    assert.ok(j.description.length > 40 && !/<|\]\]>|CDATA/.test(j.description))
  }
  assert.equal(jobs.find(j => j.title === 'UI/UX Designer').payRange, '$65 – $75 per hour')
  assert.equal(jobs.find(j => j.title === 'Senior Project Manager').engagement, 'Direct Hire')
  const asked = []
  await collectJobs(brooksource, async (url, init) => { asked.push({ url, accept: init?.accept }); return fixture('brooksource-feed.xml') })
  assert.deepEqual(asked, [{ url: 'https://jobs.brooksource.com/jobs/?feed=job_feed&posts_per_page=200', accept: 'application/rss+xml' }])
  assert.throws(() => readFeed('<html>Just a moment...</html>'), /did not come back/)
})

test('eTeam: the JSON list is read as jobs; "0" is no pay, Hour is "per hour", a guard is not a cyber role; the job page address is built from the id', async () => {
  const { jobs, more } = eteamPage(fixture('eteam-p1.json'))
  assert.equal(more, true)
  assert.ok(jobs.length >= 6 && jobs.length < 16)
  assert.ok(clean(jobs))
  assert.ok(!jobs.some(j => /security officer|material handler/i.test(j.title)))
  for (const j of jobs) {
    assert.match(j.url, /^https:\/\/www\.eteaminc\.com\/searchjobs\/\d+$/)
    assert.match(j.postedAt, /^20\d\d-\d\d-\d\d$/)
    assert.match(j.location, /^[^,]+, [A-Z]{2}$/)
  }
  const pay = (t) => jobs.find(j => j.title === t).payRange
  assert.equal(pay('Sr Tech Field Engineer'), '$21.43 - $25 per hour')
  assert.equal(pay('Senior BI Developer / BI Architect'), '$53.3 per hour', 'a minimum of "0" is not given: the maximum alone is shown')
  assert.equal(pay('Sr. Project Manager, Digital & Client Experience'), '$53.57 per hour', 'the same figure twice is one figure')
  // The single-job call returns the client\'s name and bill rates: nothing of it is asked for or kept.
  assert.ok(!JSON.stringify(jobs).includes('jobdiva/jobs'))
  assert.throws(() => eteamPage('{"error":"x"}'), /did not come back/)
})

test('eTeam: pages of 200 are asked for while the board says there are more, at most five', async () => {
  const page = (more) => JSON.stringify({ jobs: [{ jobid: String(Math.random()).slice(2), title: 'Java Developer', location: 'Austin, TX', jobtype: 'Contract', postdate: '2026-10-19 10:00:00.0' }], hasMore: more })
  let n = 0
  const asked = []
  await collectJobs(eteam, async (url, init) => { asked.push({ url, accept: init?.accept }); return page(++n < 3) })
  assert.equal(asked.length, 3)
  assert.deepEqual(asked.map(a => new URL(a.url).searchParams.get('page')), ['1', '2', '3'])
  assert.ok(asked.every(a => a.accept === 'application/json' && a.url.startsWith('https://www.eteaminc.com/searchjobs/api/jobs?instance=US&limit=200&page=')))
  const endless = []
  await collectJobs(eteam, async (url) => { endless.push(url); return page(true) })
  assert.equal(endless.length, 5)
})

test('SnapHop cards (Eliassen, System One): address without the list it was found in, title, place (Anywhere is Remote), date as a date, kind from the filter', () => {
  const eli = readCards(fixture('eliassen-contract-to-hire.html'), 'https://careers.eliassen.com', 'Contract To Hire')
  assert.equal(eli.length, 8)
  assert.ok(clean(eli))
  for (const j of eli) {
    assert.match(j.url, /^https:\/\/careers\.eliassen\.com\/job\/[a-z0-9-]+\/[0-9a-f-]{36}$/, 'no ?listingUrl=')
    assert.equal(j.engagement, 'Contract To Hire'); assert.match(j.postedAt, /^20\d\d-\d\d-\d\d$/)
    assert.ok(j.description && !j.description.startsWith('Description:'))
  }
  assert.equal(eli.find(j => /Technical\/Business/.test(j.title)).location, 'Remote')
  assert.equal(eli[0].postedAt, '2026-10-19', '10/19/2026')
  const so = readCards(fixture('systemone-it-contract.html'), 'https://jobs.systemone.com', 'Contract')
  assert.equal(so.length, 8); assert.equal(totalIn(fixture('systemone-it-contract.html')), 138)
  assert.equal(so[0].payRange, '$62.50 - $75.00'); assert.equal(so[0].url.startsWith('https://jobs.systemone.com/job/servicenow-developer'), true)
  assert.deepEqual(readCards('<html><ul class="list-group"><li class="list-group-item">Filter: Washington</li></ul></html>', 'https://x.test', 'Contract'), [], 'facet rows are not jobs')
  assert.equal(totalIn('<html></html>'), 0)
})

test('Eliassen: the list is read once per kind of job (Contract, Contract To Hire, Consulting, Permanent); a page of 30 means another page', async () => {
  const asked = []
  const jobs = await collectJobs(eliassen, async (url) => { asked.push(url); return fixture('eliassen-contract-to-hire.html') })
  assert.equal(asked.length, 4, 'a short page is the last page')
  assert.deepEqual(asked.map(u => new URL(u).searchParams.get('type')), ['CONTRACT', 'Contract To Hire', 'Consulting', 'PERMANENT'])
  assert.ok(asked.every(u => u.startsWith('https://careers.eliassen.com/all-jobs?type=')))
  assert.ok(asked[1].endsWith('type=Contract%20To%20Hire'))
  // The same eight cards four times are eight jobs, each once, named by the first kind to list it ("DevSecOps" is technology work).
  assert.equal(jobs.length, 8)
  assert.ok(jobs.some(j => /^DevSecOps/.test(j.title)) && jobs.every(j => j.engagement === 'Contract'))
  const mixed = `<ul><li class="list-group-item"><a href="/job/a/1"><h3>Accounts Payable Clerk</h3></a><strong>Austin, TX<br/></strong></li><li class="list-group-item"><a href="/job/b/2"><h3>Site Reliability Engineer</h3></a><strong>Austin, TX<br/></strong></li></ul>`
  assert.deepEqual((await collectJobs(eliassen, async () => mixed)).map(j => j.title), ['Site Reliability Engineer'], 'jobs that are not technology work are left out')
  // A full page of 30 brings the next page, in the list's own address form.
  const card = (i) => `<li class="list-group-item"><a href="/job/engineer-${i}/id${i}"><h3>Cloud Engineer</h3></a><strong>Austin, TX<br/></strong><p>Description: x</p><strong>Date Posted:</strong> 10/19/2026</li>`
  const seen = []
  await collectJobs(eliassen, async (url) => {
    seen.push(url)
    const kind = new URL(url).searchParams.get('type'), page = Number(new URL(url).searchParams.get('page') || 1)
    return kind === 'CONTRACT' ? `<ul>${Array.from({ length: page < 3 ? 30 : 4 }, (_, i) => card(`${page}-${i}`)).join('')}</ul>` : '<ul></ul>'
  })
  const contract = seen.filter(u => new URL(u).searchParams.get('type') === 'CONTRACT')
  assert.equal(contract.length, 3)
  assert.ok(contract[1].startsWith('https://careers.eliassen.com/l/recruiting/alljobs/4cc0e44e-4839-11ef-989c-42010a8a0fd9/null/false?') && contract[1].endsWith('&page=2'))
})

test('System One: the technology category, once per contract kind, 30 a page by the total on page one; pace is two seconds', async () => {
  assert.equal(systemone.gapMs, 2000)
  const asked = []
  const jobs = await collectJobs(systemone, async (url) => { asked.push(url); return fixture('systemone-it-contract.html') })
  assert.equal(asked.length, 10, '138 jobs is 5 pages, for each of the two kinds')
  const q = (u, k) => new URL(u).searchParams.get(k)
  assert.deepEqual(asked.slice(0, 5).map(u => q(u, 'page')), ['1', '2', '3', '4', '5'])
  assert.ok(asked.slice(0, 5).every(u => q(u, 'jobTypes') === 'CONTRACT') && asked.slice(5).every(u => q(u, 'jobTypes') === 'Contract To Hire'))
  assert.ok(asked.every(u => u.startsWith('https://jobs.systemone.com/l/recruiting/jobsearchaction/') && q(u, 'tags') === 'Information Technology'))
  assert.ok(!asked.some(u => /Direct%20Hire/i.test(u)), 'direct hire is not asked for')
  assert.equal(jobs.length, 8)
  // An empty page ends the kind early.
  const short = []
  await collectJobs(systemone, async (url) => { short.push(url); return `<h3>Job Search Results (90)</h3><ul></ul>` })
  assert.equal(short.length, 2, 'one empty first page for each kind')
})

test('payIn reads the pay a recruiter wrote and nothing else; named punctuation is decoded; a guard is not a technology title', () => {
  assert.equal(payIn('Compensation: $62 – $82/hr Duration: 6 months'), '$62 – $82/hr')
  assert.equal(payIn('Pay Rate: $55 to $70 per hour'), '$55 to $70 per hour')
  assert.equal(payIn('Salary $150,000 – $170,000 plus bonus'), '$150,000 – $170,000')
  assert.equal(payIn('Up to $95k base'), '$95k')
  assert.equal(payIn('We are a $5 billion company'), undefined)
  assert.equal(payIn('No pay written here'), undefined)
  assert.equal(decodeEntities('Cloud Engineer &ndash; Remote &amp; Hybrid &#8211; it&rsquo;s fine'), 'Cloud Engineer – Remote & Hybrid – it’s fine')
  assert.equal(decodeEntities('&unknown; stays'), '&unknown; stays')
  assert.equal(isTechTitle('Security Officer (Mid)'), false); assert.equal(isTechTitle('Security Engineer'), true)
})

test('all thirteen portals are registered once, each with a firm name, and none of the five new ones keeps a personal or key value in its source', () => {
  const keys = ADAPTERS.map(a => a.portal)
  assert.equal(new Set(keys).size, keys.length)
  for (const k of ['inspyr', 'brooksource', 'eteam', 'eliassen', 'systemone']) assert.ok(keys.includes(k), k)
  assert.ok(ADAPTERS.every(a => a.firm && (a.fetchJobs || (a.listUrls && a.parseList))))
  for (const f of ['inspyr', 'brooksource', 'eteam', 'eliassen', 'systemone', 'snaphop']) {
    const src = readFileSync(new URL(`../../src/lib/crawl/portals/${f}.ts`, import.meta.url), 'utf8')
    assert.ok(!/api[-_]?key|bearer|password|token/i.test(src.replace(/\/\/.*$/gm, '')), f + ': no key in code')
  }
})
