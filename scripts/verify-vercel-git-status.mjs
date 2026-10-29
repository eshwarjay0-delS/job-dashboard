/**
 * Verify Vercel's Git-integrated deployment status for the exact commit.
 * This observes deployment, it never creates another build or uses a Vercel
 * token. Production aliases must still be verified via Vercel release details.
 */
const SHA=/^[a-f0-9]{40}$/i
const REPO=/^[\w.-]+\/[\w.-]+$/
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms))
function check(v,m){if(!v)throw Error(m)}
export async function verifyVercelStatus({repo,sha,token,fetcher=fetch,sleeper=wait,attempts=120,intervalMs=5000}) {
 check(REPO.test(String(repo||"")),"Expected exact GitHub owner/repository")
 check(SHA.test(String(sha||"")),"Expected exact 40-hex commit SHA")
 check(typeof token==="string"&&token.length>0,"GITHUB_TOKEN is required to query GitHub deployment statuses")
 check(Number.isInteger(attempts)&&attempts>=1&&attempts<=300,"Invalid bounded attempt count")
 check(Number.isInteger(intervalMs)&&intervalMs>=0&&intervalMs<=60000,"Invalid poll interval")
 const endpoint="https://api.github.com/repos/"+repo+"/commits/"+sha+"/status"
 for(let i=0;i<attempts;i++){
  const res=await fetcher(endpoint,{headers:{authorization:"Bearer "+token,accept:"application/vnd.github+json","x-github-api-version":"2022-11-28"},redirect:"error"})
  check(res.ok,"GitHub combined commit status HTTP "+res.status)
  const body=await res.json()
  check(Array.isArray(body.statuses),"GitHub combined status contains no statuses list")
  // REST returns newest status first: compare only the newest Vercel signal.
  const current=body.statuses.find(s=>s.context==="Vercel")
  if(current?.state==="success"){
   const url=new URL(current.target_url||"")
   check(url.protocol==="https:"&&url.hostname==="vercel.com"&&url.pathname.includes("/job-dashboard/"),"Vercel status has an unexpected proof URL")
   return {commit:sha,status:"success",targetUrl:url.href,attempt:i+1}
  }
  if(["failure","error"].includes(current?.state)){
   throw Error("Vercel Git deployment status "+current.state+" for "+sha)
  }
  if(i+1<attempts)await sleeper(intervalMs)
 }
 throw Error("No successful Vercel Git deployment status for "+sha+" after "+attempts+" checks")
}
if(process.argv[1]&&import.meta.url===new URL("file://"+process.argv[1]).href){
 verifyVercelStatus({repo:process.env.GITHUB_REPOSITORY,sha:process.env.GITHUB_SHA,token:process.env.GITHUB_TOKEN})
  .then(result=>console.log(JSON.stringify(result)))
  .catch(e=>{console.error(e.message);process.exitCode=1})
}
