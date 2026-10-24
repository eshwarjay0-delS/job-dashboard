import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {desktopQuestionKind,desktopResponsePolicy} from '../../src/lib/kompasDesktopResponse.ts'
const boundaries=[
 ['What is IDOR? Design a multi-tenant authorization architecture and explain its failure modes.','implementation'],
 ['Compare OIDC and SAML in depth, including token validation and rollout.','implementation'],
 ['What is CSRF? Explain in detail.','implementation'],
 ['Have you ever heard of CSRF? Define it briefly.','definition'],
 ['What did you do when an incident bypassed containment?','experience'],
 ['What is system design?','definition'],
 ['Compare IDOR versus CSRF.','comparison'],
 ['Define CSRF.','definition'],
]
for(const [q,kind] of boundaries) test(q,()=>assert.equal(desktopQuestionKind(q),kind))
const cases=JSON.parse(readFileSync(new URL('../fixtures/kompas-evaluation/interview-50.json',import.meta.url)))
for(const c of cases.filter(c=>c.step>=2)) test(`${c.id}: preserve requested practical depth`,()=>{
 const policy=desktopResponsePolicy(c.level,c.question)
 assert.equal(policy.kind,'implementation')
 assert.ok(policy.words>=180)
})
