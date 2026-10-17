"use client"
import { useState } from "react"
import ReadingPane from "./reading-pane"
import SmartReply from "./smart-reply"
import ContactCard from "./contact-card"
import type { Mail } from "../../_suite/sample"
export default function FoldedConversation({mail,tint,restored,onSent}:{mail:Mail;tint:string;restored:boolean;onSent:()=>void}) {
 const [reply,setReply]=useState(false)
 return <>
 <section id="reply" className="mf-mail-fold mf-mail-thread" aria-label="Email thread"><ReadingPane m={mail} myEmail={mail.account} tint={tint} restored={restored} reply={null} onReply={()=>setReply(true)} unfolded /></section>
 <section className="mf-mail-fold mf-mail-context" aria-label={reply?'Reply workspace':'Contact context'}>{reply?<><div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><h2 style={{fontSize:18}}>Reply</h2></div><SmartReply mail={mail} onClose={()=>setReply(false)} onSent={()=>{setReply(false);onSent()}}/></>:<ContactCard mail={mail}/>}</section>
 {reply&&<aside className="mf-mail-fold mf-mail-contact"><ContactCard mail={mail}/></aside>}
 </>
}
