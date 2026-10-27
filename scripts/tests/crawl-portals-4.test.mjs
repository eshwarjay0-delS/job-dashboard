// KORE1, Kavaliro, Mitchell Martin, The Judge Group, Genesis10, Pyramid, Addison and CSI, read offline from samples saved
// while probing them (21 Oct 2026). Portal ids and corp tokens in the samples are stand-ins: the adapters read the real
// ones from each portal's own page or config every run, and no such value is written in their code.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const fixture = (f) => readFileSync(new URL(`../fixtures/crawl/${f}`, import.meta.url), 'utf8')
const { collectJobs, crawlEach } = await import('../../src/lib/crawl/collect.ts')
const { ADAPTERS, PENDING_PORTALS } = await import('../../src/lib/crawl/adapters.ts')
const { isTechTitle, scrubContacts, labelled, linesOf } = await import('../../src/lib/crawl/text.ts')
const P = async (k) => (await import(`../../src/lib/crawl/portals/${k}.ts`))
const clean = (jobs) => jobs.every(j => /^https:\/\//.test(j.url) && j.title && !/<|&[a-z]+;|&#\d+;|\s{2,}/.test(j.title))
const serve = (map, asked = []) => async (url, init) => {
  asked.push({ url, ...init })
  for (const [re, f] of map) if (re.test(url)) return typeof f === 'function' ? f(url, init) : fixture(f)
  throw new Error('no sample for ' + url)
}

test('KORE1: one request reads the board; title, place with its work mode, kind, pay with its unit, date; other fields left out', async () => {
  const { kore1, readPage } = await P('kore1')
  const asked = []
  const jobs = await collectJobs(kore1, serve([[/job-board\.php\?action=jobs/, 'kore1-jobs.json']], asked))
  assert.equal(asked.length, 1)
  assert.equal(asked[0].url, 'https://talent.kore1.com/api/job-board.php?action=jobs&limit=100&offset=0')
  assert.equal(asked[0].accept, 'application/json')
  assert.ok(jobs.length >= 6 && jobs.length < 14, 'non-technology titles are left out')
  assert.ok(clean(jobs) && !jobs.some(j => /Structural/.test(j.title)))
  const ai = jobs.find(j => j.title.startsWith('AI Engineer'))
  assert.deepEqual({ location: ai.location, engagement: ai.engagement, payRange: ai.payRange, postedAt: ai.postedAt }, { location: 'Irvine, CA (Hybrid)', engagement: 'Contract', payRange: '$70 - $85 per hour', postedAt: '2026-10-20' })
  assert.ok(jobs.every(j => j.url.startsWith('https://talent.kore1.com/careers/')))
  assert.throws(() => readPage('{"error":"x"}'), /did not come back/)
})

test('Kavaliro: the search page\'s ticket, then the list; a page that lost its ticket is said plainly', async () => {
  const { kavaliro, ticketIn } = await P('kavaliro')
  const asked = []
  const jobs = await collectJobs(kavaliro, serve([[/index\.smpl\?arg=jb_search_results/, 'kavaliro-search.html'], [/json\/index\.smpl/, 'kavaliro-list.json']], asked))
  assert.equal(asked.length, 2)
  const list = new URL(asked[1].url)
  assert.equal(list.searchParams.get('arg'), 'list_posts'); assert.equal(list.searchParams.get('pp'), '200')
  assert.ok(list.searchParams.get('h') && list.searchParams.get('t'), 'the ticket from the page is sent')
  assert.ok(jobs.length >= 3 && jobs.length <= 10)
  assert.ok(clean(jobs))
  const net = jobs.find(j => j.title === 'Network Engineer')
  assert.deepEqual({ location: net.location, engagement: net.engagement, payRange: net.payRange, postedAt: net.postedAt }, { location: 'Sanford, FL', engagement: 'Contract To Hire', payRange: '$43-48 per hour', postedAt: '2026-10-16' })
  assert.throws(() => ticketIn('<html>no form</html>'), /no longer carries its list ticket/)
})

test('Mitchell Martin: the IT position types only, place from the "Location:" line, the site\'s sync date not kept, a 400 past the last page ends the read', async () => {
  const { mitchellmartin, readPage } = await P('mitchellmartin')
  const { jobs, count } = readPage(fixture('mitchellmartin-p1.json'))
  assert.equal(count, 12)
  assert.ok(jobs.every(j => /^IT/.test(j.engagement)), 'healthcare posts are left out')
  assert.ok(!jobs.some(j => /Nurse/i.test(j.title)))
  assert.ok(jobs.every(j => j.postedAt === undefined))
  const pm = jobs.find(j => j.title === 'Project Manager III')
  assert.deepEqual({ location: pm.location, engagement: pm.engagement, payRange: pm.payRange }, { location: 'Pennington, NJ (Hybrid)', engagement: 'IT Contract', payRange: '$45.08-$64.40 Per Hr' })
  // A full page of 100 asks for the next; WordPress answers 400 past the last page, and that ends the read.
  const full = JSON.stringify(Array.from({ length: 100 }, (_, i) => ({ link: `https://www.mitchellmartin.com/blog/job/j${i}`, title: { rendered: 'Java Developer' }, content: { rendered: '<p>Location: Austin, TX</p>' }, 'position-type': [349] })))
  const asked = []
  const all = await collectJobs(mitchellmartin, async (url) => { asked.push(url); if (asked.length === 2) throw new Error('HTTP 400 from www.mitchellmartin.com'); return full })
  assert.equal(asked.length, 2); assert.equal(all.length, 100)
  assert.deepEqual(new URL(asked[0]).searchParams.get('position-type').split(',').sort(), ['346', '349', '763'], 'IT Contract, IT Direct Placement, IT-Right to Hire')
  await assert.rejects(collectJobs(mitchellmartin, async () => { throw new Error('HTTP 400 from www.mitchellmartin.com') }), /HTTP 400/, 'a 400 on the first page is a failure, not an empty board')
})

test('The Judge Group: the page\'s own search (technology, contract, USA), answer read twice, at most 12 pages of 20', async () => {
  const { judge, readPage, payOf } = await P('judge')
  const { jobs, total } = readPage(fixture('judge-p0.json'))
  assert.equal(total, 466); assert.equal(jobs.length, 7, 'the content operations role in the firm\'s IT category is left out by its title')
  assert.ok(clean(jobs) && jobs.every(j => /^https:\/\/www\.judge\.com\/jobs\/details\/\d+\/$/.test(j.url)))
  const auto = jobs.find(j => j.title === 'Sr Automation Engineer')
  assert.deepEqual({ payRange: auto.payRange, location: auto.location, postedAt: auto.postedAt }, { payRange: '$80 - $85 per hour', location: 'Remote', postedAt: '2026-10-20' })
  assert.equal(payOf('TBD'), undefined); assert.equal(payOf('$115,000.00 USD Annually - $130,000.00 USD Annually'), '$115,000 - $130,000 per year')
  const asked = []
  await collectJobs(judge, serve([[/admin-ajax\.php\?action=jdg_get_jobs/, 'judge-p0.json']], asked))
  assert.equal(asked.length, 12)
  assert.ok(asked.every(a => a.method === 'POST' && a.accept === 'application/json'))
  assert.deepEqual(asked.map(a => JSON.parse(a.body).payload.page).slice(0, 3), [0, 1, 2])
  assert.deepEqual(JSON.parse(asked[0].body).payload.categories, ['InformationTechnology'])
  assert.deepEqual(JSON.parse(asked[0].body).payload.type, ['Contract'])
})

test('Genesis10: the feed address is read from the careers page each run; "ST - City" becomes "City, ST"; kinds from the feed\'s numbers', async () => {
  const { genesis10, feedIn } = await P('genesis10')
  const asked = []
  const jobs = await collectJobs(genesis10, serve([[/consultant-careers/, 'genesis10-careers.html'], [/getportaljobs\.jsp/, 'genesis10-feed.xml']], asked))
  assert.equal(asked.length, 2)
  assert.equal(asked[1].url, 'https://www2.jobdiva.com/candidates/myjobs/getportaljobs.jsp?a=testportal123&noofjobs=10000')
  assert.ok(jobs.length >= 4 && jobs.length <= 8 && clean(jobs))
  assert.deepEqual({ location: jobs[0].location, engagement: jobs[0].engagement, payRange: jobs[0].payRange, postedAt: jobs[0].postedAt }, { location: 'Eagan, MN (Remote)', engagement: 'Contract', payRange: '$79.00 - $82.00 per hour', postedAt: '2026-10-20' })
  assert.throws(() => feedIn('<html>moved</html>'), /no longer names its job feed/)
  const src = readFileSync(new URL('../../src/lib/crawl/portals/genesis10.ts', import.meta.url), 'utf8')
  assert.ok(!/getportaljobs\.jsp\?a=[a-z0-9]{20,}/.test(src), 'the portal id is never written in the code')
})

test('Pyramid: the board\'s own GraphQL query with its fixed app header, 100 a page, the kind from the first sentence', async () => {
  const { pyramid, readPage, kindOf } = await P('pyramid')
  const { jobs, total, count } = readPage(fixture('pyramid-p1.json'))
  assert.equal(total, 978); assert.equal(count, 10)
  assert.ok(!jobs.some(j => /Clerk|Electrical Engineer/.test(j.title)), 'not technology work')
  const curam = jobs.find(j => j.title === 'Curam batch Developer')
  assert.deepEqual({ location: curam.location, engagement: curam.engagement, payRange: curam.payRange, postedAt: curam.postedAt }, { location: 'Raleigh, NC (Remote)', engagement: 'Contract', payRange: '$80 - $90 per hour', postedAt: '2026-08-18' })
  assert.equal(kindOf('This is a Fulltime opportunity located in Dallas'), 'Full Time'); assert.equal(kindOf('12+ months Contract to hire role'), 'Contract to Hire')
  const asked = []
  await collectJobs(pyramid, serve([[/production-api\.sprockets\.ai\/graphql/, 'pyramid-p1.json']], asked))
  assert.equal(asked.length, 12, 'never more than 12 pages')
  assert.ok(asked.every(a => a.method === 'POST' && a.headers['Sprockets-App'] === 'job-board-app'))
  assert.deepEqual(JSON.parse(asked[1].body).variables, { identifier: 'pyramidinc', page: 2, itemsPer: 100, search: '' })
})

test('Addison: robots.txt asks ten seconds between requests, so it gets them and the time they need; contract kinds only', async () => {
  const { addison } = await P('addison')
  assert.equal(addison.gapMs, 10_000); assert.ok(addison.budgetMs >= 4 * 10_000 + 20_000)
  const asked = []
  const jobs = await collectJobs(addison, serve([[/addisongroup\.com\/jobs\/l\/recruiting\/jobsearchaction/, 'addison-it-contract.html']], asked))
  const q = (u, k) => new URL(u).searchParams.get(k)
  assert.equal(asked.length, 4, '54 jobs is 2 pages, for each of the two kinds')
  assert.deepEqual(asked.map(a => q(a.url, 'jobTypes')), ['CONTRACT', 'CONTRACT', 'Contract to Hire', 'Contract to Hire'])
  assert.ok(asked.every(a => q(a.url, 'tags') === 'Information Technology'))
  assert.equal(jobs.length, 8)
  assert.ok(jobs.every(j => j.url.startsWith('https://addisongroup.com/jobs/job/')))
  // A portal with its own time is started only while that time fits before the run ends.
  const started = []
  const out = await crawlEach([addison], async (a) => { started.push(a.portal); return 1 }, { concurrency: 1, deadline: 100_000, perPortalMs: 60_000, now: () => 75_000 })
  assert.deepEqual(started, []); assert.equal(out[0].skipped, true)
})

test('CSI: the Bullhorn search named in the portal\'s own config, read each run; contract kinds as the portal writes them', async () => {
  const { csi, searchFrom } = await P('csi')
  const asked = []
  const jobs = await collectJobs(csi, serve([[/jobs\.csicompanies\.com\/app\.json/, 'csi-app.json'], [/public-rest99\.bullhornstaffing\.com\/rest-services\/TEST01\/search\/JobOrder/, 'csi-search.json']], asked))
  assert.equal(asked.length, 2)
  assert.equal(new URL(asked[1].url).searchParams.get('query'), '(isOpen:1) AND (isDeleted:0)')
  assert.ok(jobs.length >= 1 && jobs.length < 12, 'pharmacy and other non-technology jobs are left out')
  assert.ok(!jobs.some(j => /Pharmacy/.test(j.title)))
  const sap = jobs.find(j => j.title.startsWith('SAP Business Systems Analyst'))
  assert.equal(sap.url, 'https://jobs.csicompanies.com/jobs/87330/SAP-Business-Systems-Analyst-SAP-CSSMOTC')
  assert.equal(sap.location, 'Chicago, IL (Remote)')
  assert.throws(() => searchFrom('{"service":{"corpToken":"a b"}}'), /no longer names its job search/)
  const src = readFileSync(new URL('../../src/lib/crawl/portals/csi.ts', import.meta.url), 'utf8')
  assert.ok(!/3B37UP/.test(src), 'the corp token is never written in the code')
})

test('a recruiter\'s address or number in a description is taken out before it is stored, and labelled lines are read', () => {
  assert.equal(scrubContacts('Send resumes to jane.doe@agency.com or call (555) 010-2000 / 555.010.2000.'), 'Send resumes to [email removed] or call [phone removed] / [phone removed].')
  assert.equal(scrubContacts('Pay $80,000 - $95,000; job 26-160099'), 'Pay $80,000 - $95,000; job 26-160099')
  assert.equal(labelled('<p><strong>Title:</strong> Developer<br/><strong>Location:</strong> Austin, TX</p>', /location/), 'Austin, TX')
  assert.deepEqual(linesOf('<p>A</p><p>B<br>C</p>'), ['A', 'B', 'C'])
  const runner = readFileSync(new URL('../../src/lib/crawl/runner.ts', import.meta.url), 'utf8')
  assert.ok(runner.includes('description: j.description ? scrubContacts(j.description).slice(0, 8000) : null'))
})

test('the technology filter leaves out engineers, managers, clerks and technicians of other fields', () => {
  for (const t of ['Electrical Engineer', 'Civil Engineer', 'Structural Project Manager', 'Admin Support Clerk - III', 'Evening Pharmacy Fulfillment Technician', 'AP Clerk', 'Payroll Service Delivery Analyst', 'Controls Manufacturing Engineer', 'Locum OM/UC APP'])
    assert.equal(isTechTitle(t), false, t)
  for (const t of ['Electrical Engineer - SCADA Software', 'Procurement Systems Analyst (SAP Ariba)', 'Network Engineer', 'Cyber Security Engineer', 'IT Project Manager'])
    assert.equal(isTechTitle(t), true, t)
})

test('twenty-one portals are registered once each; the ones still to read are listed', () => {
  const keys = ADAPTERS.map(a => a.portal)
  assert.equal(new Set(keys).size, keys.length); assert.equal(keys.length, 21)
  for (const k of ['kore1', 'kavaliro', 'mitchellmartin', 'judge', 'genesis10', 'pyramid', 'addison', 'csi']) assert.ok(keys.includes(k), k)
  assert.ok(!PENDING_PORTALS.some(k => keys.includes(k)))
})
