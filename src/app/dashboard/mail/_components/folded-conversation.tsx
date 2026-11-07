"use client"
import { useState } from "react"
import ReadingPane from "./reading-pane"
import SmartReply from "./smart-reply"
import ContactCard from "./contact-card"
import SubmissionFollowUp from "../../overview/_components/submission-followup"
import type { Tracked } from "@/lib/interview-track"
import type { Mail } from "../../_suite/sample"
export default function FoldedConversation({mail,tint,restored,onSent,target,words,canSendForYou,onSubChanged}:{mail:Mail;tint:string;restored:boolean;onSent:()=>void;target?:Tracked|null;words?:{subject:string;body:string};canSendForYou?:boolean;onSubChanged?:()=>void}) {
 const [reply,setReply]=useState(false)
 // The follow-up control, when this thread is a tracked submission: the same panel as the Overview rows, with the
 // same guard — it stays hidden only when there is nothing to follow up (closed, no contact, own recruiter).
 // The recruiter writing last does not hide it: that is the normal waiting state.
 const showFollowUp = !!target && target.phase === "waiting" && !!target.contact && !target.contact.recruiter && !!words && !!onSubChanged
 return <>
 <section id="reply" className="mf-mail-fold mf-mail-thread" aria-label="Email thread"><ReadingPane m={mail} myEmail={mail.account} tint={tint} restored={restored} reply={null} onReply={()=>setReply(true)} unfolded /></section>
 {showFollowUp&&<section className="mf-mail-fold mf-mail-context" aria-label="Follow up"><div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><h2 style={{fontSize:18}}>Follow up</h2></div><SubmissionFollowUp target={target!} words={words} canSendForYou={!!canSendForYou} onChanged={onSubChanged!} /></section>}
 <section className="mf-mail-fold mf-mail-context" aria-label={reply?'Reply workspace':'Contact context'}>{reply?<><div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><h2 style={{fontSize:18}}>Reply</h2></div><SmartReply mail={mail} onClose={()=>setReply(false)} onSent={()=>{setReply(false);onSent()}}/></>:<ContactCard mail={mail}/>}</section>
 {reply&&<aside className="mf-mail-fold mf-mail-contact"><ContactCard mail={mail}/></aside>}
 </>
}
