export type CapabilityState = "PLANNED" | "FOUNDATION" | "CODED" | "PR OPEN" | "MERGED" | "DEPLOYED" | "VERIFIED"
export type Capability = { id:string; label:string; area:string; state:CapabilityState; repo:string; parent?:string; description:string }

export const KOMPAS_CAPABILITIES: Capability[] = [
  { id:"kompas", label:"Kompas", area:"Core", state:"FOUNDATION", repo:"kompas", description:"Grounded interview and work intelligence." },
  { id:"grounding", label:"Resume + JD Grounding", area:"Intelligence", state:"MERGED", repo:"kompas", parent:"kompas", description:"Combined evidence source with provenance." },
  { id:"memory", label:"Evidence Memory", area:"Intelligence", state:"MERGED", repo:"kompas", parent:"kompas", description:"Persistent evidence and reusable validated knowledge." },
  { id:"engineer", label:"Engineer Depth", area:"Interview", state:"FOUNDATION", repo:"kompas", parent:"kompas", description:"Implementation, architecture, failure modes, tests and remediation." },
  { id:"director", label:"Director Depth", area:"Interview", state:"FOUNDATION", repo:"kompas", parent:"kompas", description:"Business impact, ownership, tradeoffs and metrics." },
  { id:"listener", label:"Two Speaker Listener", area:"Voice", state:"FOUNDATION", repo:"kompas", parent:"kompas", description:"Realtime two participant listener architecture." },
  { id:"transcribe", label:"Transcribe", area:"Voice", state:"PLANNED", repo:"kompas", parent:"kompas", description:"Live capture, understanding, searchable memory and writing." },
  { id:"share", label:"Live Share", area:"Transcribe", state:"PLANNED", repo:"kompas", parent:"transcribe", description:"Shareable guest microphone session with live owner transcript." },
  { id:"auto", label:"Auto Transcribe", area:"Transcribe", state:"PLANNED", repo:"kompas", parent:"transcribe", description:"Local personal listener with explicit microphone permission." },
  { id:"dictate", label:"Dictate", area:"Transcribe", state:"PLANNED", repo:"kompas", parent:"transcribe", description:"Meaning preserving polished dictation." },
  { id:"rawclean", label:"Raw / Clean / Rewrite", area:"Transcribe", state:"PLANNED", repo:"kompas", parent:"transcribe", description:"Immutable source plus cleanup and optional semantic rewrite." },
  { id:"review", label:"What Went Wrong", area:"Evaluation", state:"PLANNED", repo:"kompas", parent:"kompas", description:"Corrections, attribution mistakes, latency and meaning preservation review." },
  { id:"prosody", label:"Prosody", area:"Adaptation", state:"FOUNDATION", repo:"kompas", parent:"kompas", description:"Voice affect and delivery signals." },
  { id:"turns", label:"Turn Taking", area:"Adaptation", state:"FOUNDATION", repo:"kompas", parent:"kompas", description:"Conversation timing and role aware response behavior." },
  { id:"social", label:"Social Adaptation", area:"Adaptation", state:"FOUNDATION", repo:"kompas", parent:"kompas", description:"Interviewer and context sensitive response adaptation." },
]
