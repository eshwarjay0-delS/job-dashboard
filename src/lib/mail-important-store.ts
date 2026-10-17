import { createHash } from "node:crypto"
import { blob } from "@/lib/storage"
import { validTracked, type TrackedSender } from "@/lib/mail-important"
const prefix=(userId:string)=>`mail/important/${userId.replace(/[^A-Za-z0-9_-]/g,"_")}/`
export async function trackedSenders(userId:string):Promise<TrackedSender[]> {
 const keys=await blob.list(prefix(userId))
 const values=await Promise.all(keys.filter(k=>k.endsWith('.json')).slice(0,200).map(async k=>JSON.parse(await blob.getText(k)||'null')))
 return values.filter(validTracked)
}
export async function setTracked(userId:string, rule:TrackedSender, on:boolean) {
 const key=prefix(userId)+createHash('sha256').update(rule.account+'\n'+rule.email).digest('hex')+'.json'
 if(on) await blob.put(key,JSON.stringify(rule)); else await blob.delete(key)
}
