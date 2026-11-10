import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const aggregate=fs.readFileSync(new URL('../../src/app/api/jobs/route.ts',import.meta.url),'utf8')
const crawler=fs.readFileSync(new URL('../../src/app/api/crawl/jobs/route.ts',import.meta.url),'utf8')

test('both live Apply result lanes enforce the shared clearance boundary',()=>{
 assert.match(aggregate,/requiresSecurityClearance\(`\$\{j\.title\} \$\{j\.description\}`\)/)
 assert.match(crawler,/rows\.filter\(job => !requiresSecurityClearance/)
 assert.match(crawler,/searchParams\.get\("clearance"\) !== "include"/)
})

test('crawler fills the requested limit with bounded clearance-safe pagination',()=>{
 assert.match(crawler,/collectFilteredPages/)
 assert.match(crawler,/query\.range\(offset, offset \+ pageSize - 1\)/)
 assert.match(crawler,/job => requiresSecurityClearance/)
 assert.match(crawler,/excluded_clearance: excludedClearance/)
 assert.match(crawler,/clearance_scan_limited: clearanceScanLimited/)
 assert.doesNotMatch(crawler,/fetchLimit/)
})
