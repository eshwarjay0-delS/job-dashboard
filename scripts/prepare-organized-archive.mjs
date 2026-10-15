import fs from 'node:fs/promises'
import path from 'node:path'
import {createHash} from 'node:crypto'
import JSZip from 'jszip'
import mammoth from 'mammoth'
import {organizeResumes,CATEGORY_FOLDERS} from '../src/lib/resumeOrganization.ts'
const source=process.argv[2], destination=process.argv[3]
const zip=await JSZip.loadAsync(await fs.readFile(source))
const inputs=[]
for(const [id,entry] of Object.entries(zip.files)) {
 if(entry.dir || !id.toLowerCase().endsWith('.docx'))continue
 const bytes=await entry.async('nodebuffer')
 const {value:text}=await mammoth.extractRawText({buffer:bytes})
 inputs.push({id,filename:path.basename(id),text,bytes})
}
const result=organizeResumes(inputs)
const out=new JSZip()
const manifest=[]
for(const email of result.emails)for(const cat of CATEGORY_FOLDERS)out.file(`${email}/${cat}/.keep`,'')
for(const item of result.kept) {
 const hash=createHash('sha256').update(item.bytes).digest('hex').slice(0,16)
 const target=`${item.email||'Needs email review'}/${item.category}/${item.filename.replace(/\.docx$/i,'')}__${hash}.docx`
 out.file(target,item.bytes)
 manifest.push({source:item.id,destination:target,email:item.email,category:item.category,categoryEvidenceScore:item.score,evidence:item.evidence})
}
const report={inputDocuments:inputs.length,retained:manifest.length,removed:result.removed,files:manifest,emails:result.emails.map(email=>({email,folders:25,populatedFolders:new Set(manifest.filter(m=>m.email===email).map(m=>m.category)).size,resumes:manifest.filter(m=>m.email===email).length})),method:'One contact email per document. Category evidence uses term coverage with extra weight in the opening summary and explicit role filename. Up to two strongest versions per category. Scores are not ATS percentages or job-match guarantees. No resume text was changed. Empty category folders are retained.'}
out.file('ORGANIZATION_REPORT.json',JSON.stringify(report,null,2))
out.file('README.txt','Each email has 25 category folders. Some are empty because no matching resume was available. Up to two versions are retained per category. The original archive remains the backup. See ORGANIZATION_REPORT.json for every selection and removal.\nImport this ZIP in My files on MarketFit. ZIP imports organize automatically.\n')
await fs.mkdir(path.dirname(destination),{recursive:true})
await fs.writeFile(destination,await out.generateAsync({type:'nodebuffer',compression:'DEFLATE'}))
await fs.writeFile(destination+'.report.json',JSON.stringify(report,null,2))
console.log(JSON.stringify({input:inputs.length,kept:manifest.length,removed:result.removed.length,emails:report.emails}))
