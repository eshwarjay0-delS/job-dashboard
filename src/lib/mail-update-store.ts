import {createHash} from 'node:crypto'
import {blob} from '@/lib/storage'
import {defaultUpdatePreferences,validUpdatePreferences,type UpdatePreferences,type InboxUpdate} from '@/lib/mail-update-policy'
export const updateRoot=(uid:string)=>`mail/updates/${uid.replace(/[^a-zA-Z0-9_-]/g,'_')}/`
export const accountKey=(email:string)=>createHash('sha256').update(email.toLowerCase()).digest('hex')
export type MobileDeliveryReceipt={status:'sending'|'accepted'|'delivered'|'read'|'failed'|'needs_review'|'cancelled';at:number;reason?:string}
type ProviderDeliveryStatus='sent'|'delivered'|'read'|'failed'
const providerIndexRoot='mail/update-provider/'
const statusRank:Record<ProviderDeliveryStatus,number>={sent:1,failed:2,delivered:3,read:4}
const displayStatus:Record<ProviderDeliveryStatus,MobileDeliveryReceipt['status']>={sent:'accepted',failed:'failed',delivered:'delivered',read:'read'}
const providerKey=(providerId:string)=>providerIndexRoot+createHash('sha256').update(providerId).digest('hex')+'.json'
/** Keep provider message IDs out of user-facing receipt files and URLs. */
export async function registerUpdateProviderReceipt(providerId:string,uid:string,eventId:string){
 if(!providerId||!uid||!/^[a-f0-9]{64}$/.test(eventId))return false
 await blob.put(providerKey(providerId),JSON.stringify({uid,event:eventId}))
 return true
}
/** Append provider callbacks so concurrent or late events cannot downgrade a later state. */
export async function recordUpdateProviderStatus(providerId:string,status:ProviderDeliveryStatus,at:number,reason=''){
 if(!providerId||!Object.hasOwn(statusRank,status)||!Number.isFinite(at))return false
 try{const raw=await blob.getText(providerKey(providerId));const index=raw?JSON.parse(raw):null
  if(!index||typeof index.uid!=='string'||!/^[a-f0-9]{64}$/.test(index.event))return false
  const receipt:MobileDeliveryReceipt={status:displayStatus[status],at}
  if(status==='failed'&&reason)receipt.reason=reason.replace(/[\r\n\t]/g,' ').slice(0,160)
  const marker=createHash('sha256').update(providerId+'\n'+status+'\n'+at).digest('hex')
  await blob.putIfAbsent(updateRoot(index.uid)+`delivery-status/${index.event}/${statusRank[status]}-${marker}.json`,JSON.stringify(receipt))
  return true
 }catch{return false}
}
export async function updatePreferences(uid:string){const raw=await blob.getText(updateRoot(uid)+'preferences.json');const p=raw?JSON.parse(raw):null;return validUpdatePreferences(p)?p:{...defaultUpdatePreferences}}
export async function saveUpdatePreferences(uid:string,p:UpdatePreferences){await blob.put(updateRoot(uid)+'preferences.json',JSON.stringify(p))}
export async function updateFeed(uid:string):Promise<InboxUpdate[]>{const prefix=updateRoot(uid)+'events/';const keys=(await blob.list(prefix)).filter(k=>k.endsWith('.json')).sort().reverse().slice(0,150);const rows=await Promise.all(keys.map(async k=>JSON.parse(await blob.getText(k)||'null')));return rows.filter(Boolean).sort((a,b)=>b.at-a.at)}
/** Read only display-safe delivery evidence. Provider message IDs remain server-side. */
export async function updateDeliveryReceipts(uid:string,eventIds:string[]):Promise<Record<string,MobileDeliveryReceipt>>{const wanted=new Set(eventIds.filter(id=>/^[a-f0-9]{64}$/.test(id)));if(!wanted.size)return {};const root=updateRoot(uid),prefix=root+'deliveries/';const keys=(await blob.list(prefix)).filter(key=>key.endsWith('.json')&&wanted.has(key.slice(prefix.length,-5)));const pairs=await Promise.all(keys.map(async key=>{const id=key.slice(prefix.length,-5);try{const row=JSON.parse(await blob.getText(key)||'null') as Record<string,unknown>|null;if(!row||!['sending','accepted','needs_review','cancelled'].includes(String(row.status))||!Number.isFinite(row.at))return null;const receipt:MobileDeliveryReceipt={status:row.status as MobileDeliveryReceipt['status'],at:Number(row.at)};if(receipt.status==='needs_review'&&typeof row.reason==='string')receipt.reason=row.reason.slice(0,160);return [id,receipt] as const}catch{return null}}));const receipts=Object.fromEntries(pairs.filter((pair):pair is readonly [string,MobileDeliveryReceipt]=>!!pair))
 const statusPrefix=root+'delivery-status/';const statusKeys=(await blob.list(statusPrefix)).filter(key=>key.endsWith('.json'));const ranked:Record<string,{rank:number;receipt:MobileDeliveryReceipt}>={}
 await Promise.all(statusKeys.map(async key=>{const rest=key.slice(statusPrefix.length),slash=rest.indexOf('/');if(slash<0)return;const id=rest.slice(0,slash);if(!wanted.has(id))return;const rank=Number(rest.slice(slash+1).split('-',1)[0]);if(!Number.isFinite(rank)||rank<1)return;try{const row=JSON.parse(await blob.getText(key)||'null') as MobileDeliveryReceipt|null;if(!row||!['accepted','delivered','read','failed'].includes(row.status)||!Number.isFinite(row.at))return;if(!ranked[id]||rank>ranked[id].rank||(rank===ranked[id].rank&&row.at>ranked[id].receipt.at))ranked[id]={rank,receipt:{status:row.status,at:Number(row.at),...(row.status==='failed'&&typeof row.reason==='string'?{reason:row.reason.slice(0,160)}:{})}}}catch{}}))
 for(const [id,row] of Object.entries(ranked))receipts[id]=row.receipt
 return receipts}
export async function storeUpdate(uid:string,event:InboxUpdate){const key=updateRoot(uid)+`events/${String(event.at).padStart(13,'0')}-${event.id}.json`;await blob.putIfAbsent(key,JSON.stringify(event))}
