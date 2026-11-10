import {createHash} from 'node:crypto'
import {getGoogleWorkspaceAccessToken,listGoogleWorkspaceAccounts} from '@/lib/googleWorkspace'
import {blob} from '@/lib/storage'
import {accountKey,updateRoot,storeUpdate,updatePreferences} from '@/lib/mail-update-store'
import type {InboxSyncHealth,InboxUpdate} from '@/lib/mail-update-policy'

type State={history:string;page?:string;checkedAt:number}
type SyncAccount={google_email:string;gmail_enabled:boolean}

async function gmail(path:string,token:string){
  const response=await fetch('https://gmail.googleapis.com/gmail/v1/users/me/'+path,{
    headers:{Authorization:`Bearer ${token}`},
    signal:AbortSignal.timeout(12000),
    cache:'no-store',
  })
  if(!response.ok)throw Object.assign(Error(response.status===401||response.status===403?'Reconnect this inbox.':`Gmail sync failed (${response.status}).`),{status:response.status})
  return response.json()
}

/** Read only the display-safe part of each account's durable cursor. */
export async function getInboxSyncHealth(uid:string,accounts:SyncAccount[]):Promise<InboxSyncHealth[]>{
  return Promise.all(accounts.filter(a=>a.gmail_enabled).map(async account=>{
    const email=account.google_email.toLowerCase()
    const key=updateRoot(uid)+`cursors/${accountKey(email)}.json`
    try{
      const raw=await blob.getText(key)
      if(!raw)return {account:email,status:'never',lastSuccessAt:null}
      const state=JSON.parse(raw) as Partial<State>|null
      if(!state||typeof state.history!=='string'||!state.history||typeof state.checkedAt!=='number'||!Number.isFinite(state.checkedAt)||state.checkedAt<=0||(state.page!==undefined&&typeof state.page!=='string')){
        return {account:email,status:'error',lastSuccessAt:null,issue:'Saved sync state is invalid. Refresh to retry.'}
      }
      return {
        account:email,
        status:state.page?'partial':'checked',
        lastSuccessAt:state.checkedAt,
        ...(state.page?{issue:'More changes remain; the next refresh continues the scan.'}:{})
      }
    }catch{
      return {account:email,status:'error',lastSuccessAt:null,issue:'Saved sync state could not be read. Refresh to retry.'}
    }
  }))
}

/** One page per account; the saved cursor advances only after all resulting events are durable. */
export async function collectInboxUpdates(uid:string){
  const prefs=await updatePreferences(uid)
  if(!prefs.enabled)return {issues:[],synced:0,health:[]}
  const accounts=(await listGoogleWorkspaceAccounts(uid)).filter(a=>a.gmail_enabled&&prefs.accounts.includes(a.google_email.toLowerCase()))
  const results=await Promise.all(accounts.map(async a=>{
    const email=a.google_email.toLowerCase()
    try{
      const key=updateRoot(uid)+`cursors/${accountKey(email)}.json`
      const raw=await blob.getText(key)
      const state:State|null=raw?JSON.parse(raw):null
      if(state&&Date.now()-state.checkedAt<25000)return {count:0,account:email,partial:!!state.page}
      const token=await getGoogleWorkspaceAccessToken(uid,a.id)
      if(!token)throw Error('Reconnect this inbox.')
      let ids:string[]=[]
      let next:State
      let initial=!state
      if(state){
        try{
          const history=await gmail(`history?startHistoryId=${encodeURIComponent(state.history)}&historyTypes=messageAdded&maxResults=30${state.page?'&pageToken='+encodeURIComponent(state.page):''}`,token)
          ids=[...new Set<string>((history.history||[]).flatMap((item:{messagesAdded?:{message:{id:string;labelIds?:string[]}}[]})=>(item.messagesAdded||[]).filter(m=>m.message.labelIds?.includes('INBOX')).map(m=>m.message.id)))]
          next={history:history.nextPageToken?state.history:String(history.historyId||state.history),page:history.nextPageToken||undefined,checkedAt:Date.now()}
        }catch(error){
          if((error as {status?:number}).status!==404)throw error
          initial=true
          const profile=await gmail('profile',token)
          next={history:String(profile.historyId),checkedAt:Date.now()}
          const list=await gmail('messages?maxResults=25&q=in%3Ainbox',token)
          ids=(list.messages||[]).map((message:{id:string})=>message.id)
        }
      }else{
        const profile=await gmail('profile',token)
        next={history:String(profile.historyId),checkedAt:Date.now()}
        const list=await gmail('messages?maxResults=25&q=in%3Ainbox',token)
        ids=(list.messages||[]).map((message:{id:string})=>message.id)
      }
      if(ids.length>150)throw Error('Large mailbox change needs another sync pass.')
      // A listed message may disappear before metadata is read. Only message-level 404 is absent;
      // auth, quota, transport and server failures still prevent advancing the durable cursor.
      for(let i=0;i<ids.length;i+=5){
        await Promise.all(ids.slice(i,i+5).map(async id=>{
          const message=await gmail(`messages/${encodeURIComponent(id)}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`,token).catch((error:unknown)=>{
            if((error as {status?:number}).status===404)return null
            throw error
          })
          if(!message?.labelIds?.includes('INBOX'))return
          const header=(name:string)=>String(message.payload?.headers?.find((h:{name:string;value:string})=>h.name.toLowerCase()===name)?.value||'')
          const event:InboxUpdate={
            id:createHash('sha256').update(email+'\n'+id).digest('hex'),
            account:email,
            thread:message.threadId,
            message:id,
            from:header('from'),
            subject:header('subject'),
            preview:String(message.snippet||'').slice(0,400),
            at:Number(message.internalDate)||Date.now(),
            observedAt:Date.now(),
            initial
          }
          await storeUpdate(uid,event)
        }))
      }
      await blob.put(key,JSON.stringify(next))
      return {count:ids.length,account:email,partial:!!next.page}
    }catch(error){
      return {count:0,account:email,error:error instanceof Error?error.message:'Inbox sync failed.'}
    }
  }))
  const health=await getInboxSyncHealth(uid,accounts)
  const byAccount=new Map(health.map(item=>[item.account,item]))
  for(const result of results){
    const item=byAccount.get(result.account)
    if(!item)continue
    if('error' in result){
      item.status='error'
      item.issue=result.error
    }else if(result.partial){
      item.status='partial'
      item.issue='More changes remain; the next refresh continues the scan.'
    }
  }
  return {
    synced:results.reduce((count,result)=>count+result.count,0),
    issues:results.filter(result=>'error' in result||result.partial).map(result=>({account:result.account,reason:'error' in result?result.error:'More changes remain; next refresh continues the scan.'})),
    health
  }
}
