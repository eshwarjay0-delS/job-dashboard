import {createHash} from 'node:crypto'
import {blob} from '@/lib/storage'
import {defaultUpdatePreferences,validUpdatePreferences,type UpdatePreferences,type InboxUpdate} from '@/lib/mail-update-policy'
export const updateRoot=(uid:string)=>`mail/updates/${uid.replace(/[^a-zA-Z0-9_-]/g,'_')}/`
export const accountKey=(email:string)=>createHash('sha256').update(email.toLowerCase()).digest('hex')
export async function updatePreferences(uid:string){const raw=await blob.getText(updateRoot(uid)+'preferences.json');const p=raw?JSON.parse(raw):null;return validUpdatePreferences(p)?p:{...defaultUpdatePreferences}}
export async function saveUpdatePreferences(uid:string,p:UpdatePreferences){await blob.put(updateRoot(uid)+'preferences.json',JSON.stringify(p))}
export async function updateFeed(uid:string):Promise<InboxUpdate[]>{const prefix=updateRoot(uid)+'events/';const keys=(await blob.list(prefix)).filter(k=>k.endsWith('.json')).sort().reverse().slice(0,150);const rows=await Promise.all(keys.map(async k=>JSON.parse(await blob.getText(k)||'null')));return rows.filter(Boolean).sort((a,b)=>b.at-a.at)}
export async function storeUpdate(uid:string,event:InboxUpdate){const key=updateRoot(uid)+`events/${String(event.at).padStart(13,'0')}-${event.id}.json`;await blob.putIfAbsent(key,JSON.stringify(event))}
