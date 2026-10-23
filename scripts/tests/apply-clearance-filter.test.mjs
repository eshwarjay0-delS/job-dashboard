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

test('crawler exclusion happens before the caller limit is restored',()=>{
 assert.match(crawler,/fetchLimit = excludeClearance \? Math\.min\(limit \* 4, 100\) : limit/)
 assert.match(crawler,/const allowedJobs = excludeClearance/)
 assert.match(crawler,/const jobs = allowedJobs\.slice\(0, limit\)/)
 assert.match(crawler,/rows\.length - allowedJobs\.length/)
 assert.doesNotMatch(crawler,/rows\.length - jobs\.length/)
})
