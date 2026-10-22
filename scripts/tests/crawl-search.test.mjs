import test from 'node:test'
import assert from 'node:assert/strict'

const { crawlSearchOrFilter, crawlSearchTerms } = await import('../../src/lib/crawl/search.ts')

test('multi-word crawler searches are broad terms instead of one literal phrase', () => {
  const filter = crawlSearchOrFilter('Salesforce CPQ developer')
  assert.match(filter, /title\.ilike\.\*Salesforce\*/)
  assert.match(filter, /description\.ilike\.\*CPQ\*/)
  assert.match(filter, /firm\.ilike\.\*developer\*/)
  assert.equal(filter.includes('*Salesforce CPQ developer*'), false)
})

test('technical punctuation is retained while PostgREST delimiters and wildcards are removed', () => {
  assert.deepEqual(crawlSearchTerms('C++ C# .NET (remote), 100%'), ['C++', 'C#', '.NET', 'remote', '100'])
  const filter = crawlSearchOrFilter('C++ C#')
  assert.match(filter, /description\.ilike\.\*C\+\+\*/)
  assert.match(filter, /title\.ilike\.\*C#\*/)
  assert.equal(/[()%]/.test(filter), false)
})

test('search terms are deduplicated and bounded', () => {
  assert.deepEqual(crawlSearchTerms('cloud CLOUD cloud'), ['cloud'])
  assert.equal(crawlSearchTerms('one two three four five six seven eight nine ten').length, 8)
  assert.equal(crawlSearchOrFilter('*** (,)'), null)
})
