// The crawler's shared parts, without storage or network: how one portal's jobs are collected (listing pages, or the
// portal's own JSON/sitemap source through fetchJobs), and the readers every adapter shares (JobPosting records,
// sitemaps). Since 20 Oct 2026 a portal drawn by its own script is read from the source its page reads.
import test from 'node:test'
import assert from 'node:assert/strict'

const { collectJobs } = await import('../../src/lib/crawl/collect.ts')
const { jobPostingsIn, sitemapUrls, clean, absolute } = await import('../../src/lib/crawl/text.ts')

test('listing pages are read through the same fetch, each job once, nothing without a title or an address', async () => {
  const asked = []
  const get = async (url) => { asked.push(url); return url.endsWith('1') ? 'A|/a;B|/b' : 'B|/b;|/c;D|' }
  const adapter = {
    portal: 'p', firm: 'P', listUrls: ['https://x.test/1', 'https://x.test/2'],
    parseList: html => html.split(';').map(s => s.split('|')).map(([title, url]) => ({ title, url })),
  }
  const jobs = await collectJobs(adapter, get)
  assert.deepEqual(asked, ['https://x.test/1', 'https://x.test/2'])
  assert.deepEqual(jobs.map(j => j.url), ['/a', '/b'])
})

test('a portal read from its API uses fetchJobs, and only through the runner\'s fetch', async () => {
  const asked = []
  const get = async (url, init) => { asked.push([url, init?.accept]); return JSON.stringify({ jobs: [{ t: ' Cloud Engineer ', u: 'https://x.test/j/1' }] }) }
  const adapter = {
    portal: 'api', firm: 'API',
    fetchJobs: async (g) => JSON.parse(await g('https://x.test/api/jobs', { accept: 'application/json' })).jobs.map(j => ({ title: j.t, url: j.u })),
  }
  assert.deepEqual(await collectJobs(adapter, get), [{ title: 'Cloud Engineer', url: 'https://x.test/j/1' }])
  assert.deepEqual(asked, [['https://x.test/api/jobs', 'application/json']])
  await assert.rejects(collectJobs({ portal: 'none', firm: 'None' }, get), /no way to read its jobs/)
})

test('JobPosting records are read as jobs: place, remote, pay, kind of engagement, description', () => {
  const html = `<html><head>
    <script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"Organization","name":"X"},
      {"@type":"JobPosting","title":"Security Engineer &amp; Analyst","url":"/jobs/42","datePosted":"2026-10-18",
       "employmentType":["CONTRACTOR","TEMPORARY"],"jobLocation":{"@type":"Place","address":{"addressLocality":"St. Louis","addressRegion":"MO","addressCountry":"US"}},
       "baseSalary":{"@type":"MonetaryAmount","currency":"USD","value":{"@type":"QuantitativeValue","minValue":70,"maxValue":85,"unitText":"HOUR"}},
       "description":"<p>Run <b>Splunk</b> and SOAR.</p>"}]}</script>
    <script type="application/ld+json">{"@type":"JobPosting","title":"Cloud Architect","jobLocationType":"TELECOMMUTE"}</script>
    <script type="application/ld+json">not json</script></head></html>`
  const jobs = jobPostingsIn(html, 'https://firm.test/search?q=1')
  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Security Engineer & Analyst', url: 'https://firm.test/jobs/42', location: 'St. Louis, MO', engagement: 'CONTRACTOR, TEMPORARY',
    payRange: '$70 - $85 per hour', postedAt: '2026-10-18', description: 'Run Splunk and SOAR.',
  })
  assert.equal(jobs[1].location, 'Remote')
  assert.equal(jobs[1].url, 'https://firm.test/search?q=1', 'a record with no address stands for the page it is on')
})

test('sitemaps, links and text', () => {
  const xml = '<urlset><url><loc>https://f.test/job/1</loc></url><url><loc> https://f.test/about </loc></url><url><loc>https://f.test/job/2?a=1&amp;b=2</loc></url></urlset>'
  assert.deepEqual(sitemapUrls(xml, /\/job\//), ['https://f.test/job/1', 'https://f.test/job/2?a=1&b=2'])
  assert.equal(sitemapUrls(xml).length, 3)
  assert.equal(absolute('/a?x=1&amp;y=2', 'https://f.test/list/'), 'https://f.test/a?x=1&y=2')
  assert.equal(clean('<h5> Data&nbsp;Engineer&#39;s  role </h5>'), "Data Engineer's role")
})
