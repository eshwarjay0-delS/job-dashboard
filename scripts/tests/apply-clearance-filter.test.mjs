import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const aggregate=fs.readFileSync(new URL('../../src/app/api/jobs/route.ts',import.meta.url),'utf8')
const crawler=fs.readFileSync(new URL('../../src/app/api/crawl/jobs/route.ts',import.meta.url),'utf8')
const applyPage=fs.readFileSync(new URL('../../src/app/dashboard/apply/page.tsx',import.meta.url),'utf8')

test('both live Apply result lanes enforce the shared clearance boundary',()=>{
 assert.match(aggregate,/requiresSecurityClearance\(`\$\{j\.title\} \$\{j\.description\}`\)/)
 assert.match(crawler,/collectFilteredSnapshot/)
 assert.match(crawler,/job => requiresSecurityClearance/)
 assert.match(crawler,/searchParams\.get\("clearance"\) !== "include"/)
})

test('crawler fills the requested limit with bounded clearance-safe pagination',()=>{
 assert.match(crawler,/collectFilteredSnapshot/)
 assert.match(crawler,/query\.limit\(scanLimit\)/)
 assert.match(crawler,/const scanLimit = Math\.min\(1000, Math\.max\(100, limit \* 10\)\)/)
 assert.doesNotMatch(crawler,/\.range\(offset/)
 assert.match(crawler,/job => requiresSecurityClearance/)
 assert.match(crawler,/excluded_clearance: excludedClearance/)
 assert.match(crawler,/clearance_scan_limited: clearanceScanLimited/)
 assert.doesNotMatch(crawler,/fetchLimit/)
})

test('crawler applies location and remote filters before the bounded clearance scan',()=>{
 assert.match(crawler,/crawlLocationTerms/)
 assert.match(crawler,/query\.ilike\("location",/)
 assert.match(crawler,/if \(remoteOnly\) query = query\.ilike\("location", "%remote%"/)
 assert.match(crawler,/location_filter: locationTerms\.join\(" "\)/)
 assert.match(crawler,/remote_only: remoteOnly/)
})

test('Apply passes location and remote filters to the crawler instead of post-filtering its limited snapshot',()=>{
 assert.match(applyPage,/crawlParams\.set\('location',location\)/)
 assert.match(applyPage,/crawlParams\.set\('remote','true'\)/)
 assert.match(applyPage,/const liveFiltered=/)
 assert.doesNotMatch(applyPage,/indexed[\s\S]*\.filter\(\(j:Job\)=\>/)
})

test('Apply surfaces a bounded clearance-scan notice to the user',()=>{
 assert.match(applyPage,/crawl\.clearance_scan_limited/)
 assert.match(applyPage,/The clearance filter reached its safe scan limit/)
 assert.match(applyPage,/narrow your search to see more eligible results/)
})
