// Oxford Global Resources, Everforth (Apex Systems) and Insight Global, read offline from pages saved while probing them
// (20 Oct 2026): 12 Oxford cards, 14 Everforth table rows, 12 Insight Global jobs.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const { oxford, readPage: oxfordPage } = await import('../../src/lib/crawl/portals/oxford.ts')
const { everforth, readPage: everforthPage } = await import('../../src/lib/crawl/portals/everforth.ts')
const { insightglobal, readPage: igPage } = await import('../../src/lib/crawl/portals/insightglobal.ts')
const { collectJobs } = await import('../../src/lib/crawl/collect.ts')
const fixture = (f) => readFileSync(new URL(`../fixtures/crawl/${f}`, import.meta.url), 'utf8')
const clean = (jobs) => jobs.every(j => /^https:\/\//.test(j.url) && j.title && !/<|&[a-z]+;|\s{2,}/.test(j.title))

test('Oxford: cards are read as jobs, technology ones only, with the date and place (Remote in brackets); a board of 130 is 11 pages', async () => {
  const { jobs, total } = oxfordPage(fixture('oxford-page1.html'))
  assert.equal(total, 130)
  assert.ok(jobs.length >= 1 && jobs.length < 12, 'the cards of other industries are left out')
  assert.ok(clean(jobs))
  for (const j of jobs) {
    assert.match(j.url, /^https:\/\/www\.oxfordcorp\.com\/jobs\/[A-Za-z0-9]+\/$/)
    assert.match(j.postedAt, /^[A-Z][a-z]{2} \d{1,2}, 20\d\d$/, 'the ordinal is gone: Oct 19, 2026')
    assert.ok(j.description && j.description.length > 40)
  }
  const asked = []
  await collectJobs(oxford, async (url) => { asked.push(url); return fixture('oxford-page1.html') })
  assert.equal(asked.length, 11)
  assert.deepEqual(asked.slice(0, 2).map(u => new URL(u).searchParams.get('pagenum')), ['1', '2'])
  assert.ok(asked.every(u => u.startsWith('https://www.oxfordcorp.com/all-jobs/') && u.includes('include_remote=1')))
  assert.deepEqual(oxfordPage('<html></html>'), { jobs: [], total: 0 })
})

test('Oxford: "Posted - Oct 19th, 2026 | Cleveland, OH - Remote" is Oct 19, 2026 and Cleveland, OH (Remote)', () => {
  const card = (industry, date) => `<article class="oxglobal-listing-item "><div class="oxglobal-listing-item_industry"><span class="cooking-instructions-tab-title"> ${industry} </span></div><h2 class="oxglobal-listing-item_title"> SOC Analyst </h2><p class="oxglobal-listing-item_date"> ${date} </p><p class="oxglobal-listing-item_excerpt-p"> A summary. </p><a href="https://www.oxfordcorp.com/jobs/x1/" class="oxglobal-listing-item_button">View</a></article>`
  const [a] = oxfordPage(`<p><strong>1</strong> results</p>${card('Tech. &amp; Communication', 'Posted - Oct 19th, 2026 | Cleveland, OH - Remote')}`).jobs
  assert.deepEqual({ title: a.title, location: a.location, postedAt: a.postedAt }, { title: 'SOC Analyst', location: 'Cleveland, OH (Remote)', postedAt: 'Oct 19, 2026' })
  assert.equal(oxfordPage(`<p><strong>1</strong> results</p>${card('Life Sciences', 'Posted - Oct 2nd, 2026 | Boston, MA')}`).jobs.length, 0)
})

test('Everforth: one request for the whole table; rows are title, address, place, date; non-technology titles are left out; error pages throw', async () => {
  const jobs = everforthPage(fixture('everforth-rows.html'))
  assert.ok(jobs.length >= 5 && jobs.length < 14)
  assert.ok(clean(jobs))
  for (const j of jobs) {
    assert.match(j.url, /^https:\/\/www\.apexsystems\.com\/job\/\d+_usa\/[a-z0-9-]+$/)
    assert.match(j.location, /^[^,]+, [A-Z]{2}$/)
    assert.match(j.postedAt, /^20\d\d-\d\d-\d\d$/, 'M/D/YYYY made a real date')
  }
  assert.ok(!jobs.some(j => /scheduler|nurse|driver/i.test(j.title)))
  const asked = []
  await collectJobs(everforth, async (url) => { asked.push(url); return fixture('everforth-rows.html') })
  assert.deepEqual(asked, ['https://www.apexsystems.com/search-results-usa?catalogcode=USA&page=1&rows=3000'])
  assert.throws(() => everforthPage('<p>Sorry, we\'re having trouble with your request</p>'), /did not come back/)
  assert.throws(() => everforthPage('<p>No jobs found.</p>'), /did not come back/)
})

test('Insight Global: jobs, newest contract first, 50 a page up to 20 pages; place, remote, pay per hour or year, date', async () => {
  const { jobs, pages } = igPage(fixture('insightglobal-p1.json'))
  assert.equal(pages, 105)
  assert.ok(jobs.length >= 5 && jobs.length < 12, 'the titles that are not technology work are left out')
  assert.ok(!jobs.some(j => /Mobility & Customer Experience/.test(j.title)))
  assert.ok(clean(jobs))
  assert.deepEqual(jobs[0], { title: 'Epic Radiant Analyst', url: 'https://insightglobal.com/jobs/3c346722-9596-410a-92a9-84f3ce8f828a', location: 'Bellevue, WA', engagement: 'Contract', payRange: '$85 per hour', postedAt: '2026-10-19T23:58:22.1Z' })
  assert.equal(jobs[1].payRange, '$108,500 - $148,500 per year')
  const asked = []
  const all = await collectJobs(insightglobal, async (url) => { asked.push(url); return fixture('insightglobal-p1.json').replace(/"requisitionId": "([^"]+)"/g, `"requisitionId": "$1-${asked.length}"`) })
  assert.equal(asked.length, 20, 'never more than 20 pages, however many the board has')
  assert.ok(asked[0].includes('page=1') && asked[0].includes('sort=postedDate,desc') && asked[0].includes('filter.jobType=Contract') && asked[0].includes('size=50'))
  assert.equal(all.length, 20 * jobs.length)
  assert.deepEqual(igPage('{}'), { jobs: [], pages: 0 })
})
