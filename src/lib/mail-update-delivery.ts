import {createServiceClient} from '@/lib/supabase/service'
import {listGoogleWorkspaceAccounts} from '@/lib/googleWorkspace'
import {blob} from '@/lib/storage'
import {registerUpdateProviderReceipt,updateRoot,updatePreferences,updateFeed} from '@/lib/mail-update-store'
import {eligibleMobile,senderNotifyMode} from '@/lib/mail-update-policy'
import {trackedSenders,} from '@/lib/mail-important-store'
import {trackedBy} from '@/lib/mail-important'
import {senderEmail} from '@/lib/mail-reading'
import {waConfigured} from '@/lib/whatsapp'
/** Only code-linked phone numbers qualify; manually populated profile phones do not. */
export async function notificationNumbers(uid:string){const raw=await blob.getText(`whatsapp/linked/${uid.replace(/[^A-Za-z0-9_-]/g,'_')}.json`);const own=raw?JSON.parse(raw):{numbers:[]};const rows=await Promise.all((own.numbers||[]).map(async(n:{digits:string})=>{const linked=await blob.getText(`whatsapp/links/${n.digits}.json`);const link=linked?JSON.parse(linked):null;return link?.userId===uid&&link?.verified===true?n.digits:null}));return rows.filter((n:unknown):n is string=>typeof n==='string')}
export function mobileReady(){return waConfigured()&&!!process.env.WHATSAPP_GMAIL_UPDATE_TEMPLATE}
export async function deliverInboxUpdates(uid:string){const p=await updatePreferences(uid);if(!p.enabled||!p.mobile)return {accepted:0,blocked:0};if(!mobileReady())return {accepted:0,blocked:1,reason:'WhatsApp update template is not configured.'};const numbers=(await notificationNumbers(uid)).filter(n=>n.endsWith(p.ending));if(numbers.length!==1)return {accepted:0,blocked:1,reason:'Verify one WhatsApp number before enabling updates.'};const feed=await updateFeed(uid);let accepted=0,blocked=0,attempted=0;
 for(const e of feed.filter(e=>eligibleMobile(e,p,true))){
  if(attempted>=5)break;
  // Reserve before the external send. An interrupted/uncertain send is never blindly repeated.
  const key=updateRoot(uid)+`deliveries/${e.id}.json`;if(!(await blob.putIfAbsent(key,JSON.stringify({status:'sending',at:Date.now(),event:e.id}))))continue;
  attempted++;
  try{const latest=await updatePreferences(uid),current=(await notificationNumbers(uid)).filter(n=>n.endsWith(latest.ending));const latestTracked=await trackedSenders(uid);const {data,error}=await createServiceClient().auth.admin.getUserById(uid);if(error||!data.user)throw Error('Could not verify notification preferences.');const mode=senderNotifyMode(data.user.user_metadata?.gmail_notify_rules,e.account,senderEmail(e.from));const accounts=await listGoogleWorkspaceAccounts(uid);if(mode==='never'||!accounts.some(a=>a.gmail_enabled&&a.google_email.toLowerCase()===e.account)||!eligibleMobile(e,latest,mode==='always'||trackedBy(latestTracked,e.account,senderEmail(e.from)))||current.length!==1||current[0]!==numbers[0]){await blob.put(key,JSON.stringify({status:'cancelled',at:Date.now()}));continue}
   const r=await fetch(`https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION||'v21.0'}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,{method:'POST',headers:{Authorization:`Bearer ${process.env.WHATSAPP_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({messaging_product:'whatsapp',to:numbers[0],type:'template',template:{name:process.env.WHATSAPP_GMAIL_UPDATE_TEMPLATE,language:{code:process.env.WHATSAPP_GMAIL_UPDATE_LANGUAGE||'en_US'},components:[{type:'body',parameters:[e.account,e.from,e.subject].map(text=>({type:'text',text:text.replace(/[\r\n\t]/g,' ').slice(0,200)||'(not supplied)'}))}]}}),signal:AbortSignal.timeout(10000)});const result=await r.json().catch(()=>({}));if(!r.ok||!result.messages?.[0]?.id)throw Error(`WhatsApp rejected update (${r.status}).`);await blob.put(key,JSON.stringify({status:'accepted',at:Date.now()}));await registerUpdateProviderReceipt(result.messages[0].id,uid,e.id);accepted++;
  }catch(e){blocked++;await blob.put(key,JSON.stringify({status:'needs_review',reason:e instanceof Error?e.message:'Delivery uncertain',at:Date.now()}))}
 }return {accepted,blocked}}
