import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {runInNewContext} from 'node:vm'
import ts from 'typescript'
const code=ts.transpileModule(readFileSync('src/lib/pdf-text.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
function reader(numPages,text,error=false){
 let extracts=0,destroys=0;const m={exports:{}}
 runInNewContext(code,{module:m,exports:m.exports,Buffer,console:{error(){}},require:()=>({getDocumentProxy:async()=>({numPages,loadingTask:{destroy:async()=>destroys++}}),extractText:async()=>{extracts++;if(error)throw Error('parse failed');return {text}}})})
 return {read:(strict=true)=>m.exports.pdfText(Buffer.from('%PDF-fixture'),{requireComplete:strict}),get extracts(){return extracts},get destroys(){return destroys}}
}
for(const n of [1,12])test(`complete ${n}-page evidence retains its final page`,async()=>{const pages=Array.from({length:n},(_,i)=>'Evidence '+i),h=reader(n,pages);assert.equal(await h.read(),pages.join('\n'));assert.equal(h.destroys,1)})
test('13-page evidence is rejected before extraction rather than losing page 13',async()=>{const h=reader(13,Array(13).fill('evidence'));assert.equal(await h.read(),'');assert.equal(h.extracts,0);assert.equal(h.destroys,1)})
test('library classification retains its existing 12-page sampling behavior',async()=>{const h=reader(13,Array.from({length:13},(_,i)=>'p'+i));const text=await h.read(false);assert.match(text,/p11$/);assert.doesNotMatch(text,/p12/);assert.equal(h.destroys,1)})
test('strict evidence refuses missing extracted pages',async()=>{const h=reader(2,['first only']);assert.equal(await h.read(),'');assert.equal(h.destroys,1)})
test('strict evidence refuses character truncation',async()=>{const h=reader(1,['x'.repeat(200001)]);assert.equal(await h.read(),'');assert.equal(h.destroys,1)})
test('parse failures release PDF resources',async()=>{const h=reader(1,[],true);assert.equal(await h.read(),'');assert.equal(h.destroys,1)})
test('WhatsApp explicitly requests complete PDF evidence and explains the page limit',()=>{const s=readFileSync('src/lib/whatsapp-kompas-channel.ts','utf8');assert.match(s,/pdfText\(bytes, \{ requireComplete: true \}\)/);assert.match(s,/PDFs must have at most 12 pages/)})

function makePdf(lines) {
  const esc = (s) => s.replace(/[\\()]/g, (c) => '\\' + c)
  const stream = ['BT', '/F1 10 Tf', '54 750 Td', '13 TL', ...lines.map((l) => `(${esc(l)}) Tj T*`), 'ET'].join('\n')
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>', `<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>']
  let out = '%PDF-1.4\n'
  const at = []
  objects.forEach((body, i) => { at.push(Buffer.byteLength(out, 'latin1')); out += `${i + 1} 0 obj\n${body}\nendobj\n` })
  const xref = Buffer.byteLength(out, 'latin1')
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` + at.map((n) => `${String(n).padStart(10, '0')} 00000 n \n`).join('') + `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(out, 'latin1')
}

test('real PDF parser preserves evidence and releases its loading task', async()=>{const {pdfText}=await import('../../src/lib/pdf-text.ts');const result=await pdfText(makePdf(['Confirmed endpoint security experience']),{requireComplete:true});assert.match(result,/Confirmed endpoint security experience/)})
