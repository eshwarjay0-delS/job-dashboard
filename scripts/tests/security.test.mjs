import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeAdminToken, verifyAdminToken, ADMIN_SESSION_SECONDS } from '../../src/lib/adminSession.ts';
import { safeResumeName, readLimitedStream } from '../../src/lib/uploadSafety.ts';
import { trustedResumeUrl } from '../../extension/trusted-url.js';

test('admin tokens expire server-side and reject tampering and old tokens',()=>{
 const original=process.env.ADMIN_SESSION_SECRET; process.env.ADMIN_SESSION_SECRET='test-only-secret';
 try {
 const now=1790980000000, token=makeAdminToken(now);
 assert.equal(verifyAdminToken(token,now),true);
 assert.notEqual(token,makeAdminToken(now));
 assert.equal(verifyAdminToken(token,now+ADMIN_SESSION_SECONDS*1000),false);
 assert.equal(verifyAdminToken(token.replace(/^v2\.\d+/, 'v2.9999999999'),now),false);
 assert.equal(verifyAdminToken('a'.repeat(64),now),false);
 assert.equal(verifyAdminToken(token.slice(0,-1)+'z',now),false);
 } finally { if(original===undefined)delete process.env.ADMIN_SESSION_SECRET;else process.env.ADMIN_SESSION_SECRET=original; }
});
test('resume filenames cannot traverse folders on Windows or Linux',()=>{
 assert.equal(safeResumeName('../../outside.docx'),'outside.docx');
 assert.equal(safeResumeName('..\\..\\outside.docx'),'outside.docx');
 assert.throws(()=>safeResumeName('.hidden.docx'));
 assert.throws(()=>safeResumeName('not-a-resume.exe'));
});
test('bounded archive reader aborts expanded payloads',async()=>{
 async function* chunks(){yield Buffer.alloc(8);yield Buffer.alloc(8);}
 await assert.rejects(readLimitedStream(chunks(),10),/limit/);
 assert.equal((await readLimitedStream(chunks(),16)).length,16);
});
test('authenticated downloads reject foreign origins and unexpected endpoints',()=>{
 const app='https://job-dashboard-fawn.vercel.app';
 assert.match(trustedResumeUrl(app+'/api/tailor/file?token=abc',app),/token=abc/);
 for(const target of ['https://evil.example/api/tailor/file','//evil.example/api/resumes/download',app+'/api/profile','https://user:pass@job-dashboard-fawn.vercel.app/api/tailor/file'])assert.throws(()=>trustedResumeUrl(target,app));
 assert.throws(()=>trustedResumeUrl('/api/tailor/file','http://public.example'));
 assert.equal(trustedResumeUrl('/api/tailor/file','http://localhost:3000'),'http://localhost:3000/api/tailor/file');
});
