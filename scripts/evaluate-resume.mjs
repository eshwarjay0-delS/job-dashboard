/** Audit a real exported DOCX, without calling a model or changing its contents.
 * node scripts/evaluate-resume.mjs --resume /path/output.docx --case /path/case.json --report /path/report.json
 * Numbers measure term evidence, NOT factual truth or third-party ATS performance.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
import { runInNewContext } from 'node:vm'
import path from 'node:path'
import ts from 'typescript'
const require = createRequire(import.meta.url)
function load(name) {
  const module = { exports: {} }
  const file = new URL(`../src/lib/${name}.ts`, import.meta.url)
  const js = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
  runInNewContext(js, { module, exports: module.exports, Buffer, console, process,
    require: id => name === 'keywords' && (id.startsWith('@/') || id.startsWith('./')) ? {} : require(id) })
  return module.exports
}
export async function evaluateResume(buffer, fixture) {
  if (!Array.isArray(fixture.requirements) || !fixture.requirements.length) throw Error('Explicit review requirements are required')
  if (new Set(fixture.requirements.map(r => r.id)).size !== fixture.requirements.length) throw Error('Duplicate requirement IDs')
  for (const r of fixture.requirements) {
    if (!r.id || !['required','preferred'].includes(r.section) || !Array.isArray(r.any) || !r.any.length || r.any.some(t => typeof t !== 'string' || !t.trim())) throw Error('Invalid requirement')
  }
  const { extractText, extractZones } = load('docx')
  const { present, extractJdKeywords, coveredJdKeywords } = load('keywords')
  const text = await extractText(buffer), zones = await extractZones(buffer)
  const roles = zones.roles.map(r => ({ role: r.role.replace(/\s+/g, ' ').trim(), bullets: r.bullets.map(b => b.text) }))
  const requirements = fixture.requirements.map(r => {
    const matches = value => r.any.some(term => present(value, term))
    const roleMatches = roles.map((role, index) => ({ index, bullets: role.bullets.filter(matches).length })).filter(r => r.bullets)
    return { id:r.id, label:r.label, section:r.section, covered:matches(text), experienceRequired:!!r.experience, inExperience:roleMatches.length > 0, roles:roleMatches }
  })
  const summarize = list => ({ matched:list.filter(r => r.covered).length, total:list.length, percent:list.length ? Math.round(10000*list.filter(r => r.covered).length/list.length)/100 : null, missing:list.filter(r => !r.covered).map(r => r.label) })
  const terms = extractJdKeywords(fixture.jd || '')
  const covered = coveredJdKeywords(text, terms)
  const experience = requirements.filter(r=>r.experienceRequired)
  return {
    case:fixture.id, evaluatedAt:new Date().toISOString(), artifactSha256:createHash('sha256').update(buffer).digest('hex'),
    method:'Real DOCX extraction; explicit requirement matrix + production keyword extractor. No live generation performed. No semantic truth or credential verification inferred.',
    required:summarize(requirements.filter(r=>r.section==='required')), preferred:summarize(requirements.filter(r=>r.section==='preferred')), overall:summarize(requirements),
    experience:{ matched:experience.filter(r=>r.inExperience).length,total:experience.length,missing:experience.filter(r=>!r.inExperience).map(r=>r.label) },
    productionKeywordCoverage:{matched:covered.size,total:terms.length,percent:terms.length?Math.round(10000*covered.size/terms.length)/100:null,missing:terms.filter(t=>!covered.has(t))},
    roles:roles.map((r,i)=>({index:i,role:r.role,bulletCount:r.bullets.length,coveredRequirements:requirements.filter(q=>q.roles.some(m=>m.index===i)).map(q=>q.id)})),
    requirements,
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const args = Object.fromEntries(Array.from({length:Math.floor((process.argv.length-2)/2)},(_,i)=>[process.argv[2+i*2],process.argv[3+i*2]]))
  if (!args['--resume'] || !args['--case'] || !args['--report']) throw Error('Use --resume, --case and --report')
  const report = await evaluateResume(readFileSync(args['--resume']), JSON.parse(readFileSync(args['--case'],'utf8')))
  writeFileSync(args['--report'],JSON.stringify(report,null,2)+'\n')
  console.log(JSON.stringify({required:report.required,preferred:report.preferred,experience:report.experience,productionKeywordCoverage:report.productionKeywordCoverage,roles:report.roles.map(r=>({index:r.index,bullets:r.bulletCount,covered:r.coveredRequirements.length}))},null,2))
}
