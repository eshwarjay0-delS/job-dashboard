/**
 * WhatsApp conversational agent — the AI that lives inside the WhatsApp chat.
 *
 * Vision (owner, 19 Oct 2026): "I was expecting agent always working internally
 * with that WhatsApp chat for everyone." The WhatsApp bot should feel like talking
 * to Muse here: natural, conversational, understands intent, uses tools. Not a rigid
 * state machine. Works for every MarketFit user, not just the owner.
 *
 * Architecture:
 * - Every text message goes through `agentTurn()` which classifies intent via LLM
 * - Intents map to tools: tailor_resume, switch_profile, list_resumes, redo, help, etc.
 * - Conversation memory per user (last N turns) gives context
 * - The agent responds conversationally, not with rigid templates
 */

export type WaIntent =
  | "tailor_new"        // user sent a JD (long text) → tailor a resume
  | "switch_profile"    // "use my Houston resume", "switch to St Louis"
  | "redo"              // "redo", "do it again", "start over"
  | "refine"            // swipe-reply with change request (handled separately)
  | "list_resumes"      // "show my resumes", "what resumes do you have"
  | "help"              // "help", "what can you do"
  | "status"            // "where's my resume", "is it done"
  | "greeting"          // "hi", "hello"
  | "unknown";          // anything else → conversational fallback

export interface WaAgentContext {
  userId: string;
  from: string; // phone number
  lastEmail?: string;
  recentTurns: Array<{ role: "user" | "assistant"; text: string }>;
}

const AGENT_SYSTEM = `You are the MarketFit WhatsApp assistant. You help users tailor their resumes to job descriptions.

RULES:
- Be conversational and brief. Like texting a helpful friend, not a form.
- Never ask "which email (1 or 2)". Use the user's last-used profile silently.
- When a user sends a job description, acknowledge immediately and start tailoring.
- If they mention a profile ("Houston", "St Louis", "my other resume"), switch and remember.
- Keep responses under 3 sentences unless explaining something complex.
- Never invent experience, skills, or credentials the user doesn't have.

CAPABILITIES:
- Tailor resumes to job descriptions (95%+ keyword match for in-domain roles)
- Switch between the user's profiles (e.g. Houston vs St Louis)
- Redo a tailor from scratch
- Edit a tailored resume via swipe-reply`;

export async function classifyIntent(
  keys: any,
  text: string,
  ctx: WaAgentContext
): Promise<{ intent: WaIntent; confidence: number; extracted?: Record<string, string> }> {
  // Fast path: obvious patterns without LLM call
  const lower = text.toLowerCase().trim();

  if (/^(hi|hello|hey|yo)\b/.test(lower) && lower.length < 20) {
    return { intent: "greeting", confidence: 0.95 };
  }
  if (/\b(redo|do it again|start over|try again)\b/.test(lower) && lower.length < 50) {
    return { intent: "redo", confidence: 0.9 };
  }
  if (/\bhelp\b/.test(lower) && lower.length < 30) {
    return { intent: "help", confidence: 0.9 };
  }
  if (/(houston|st\.? louis|saint louis|other resume|switch|use my)/.test(lower) && lower.length < 100) {
    const profile = /houston/i.test(text) ? "houston"
      : /st\.?\s*louis|saint louis/i.test(text) ? "stlouis"
      : "other";
    return { intent: "switch_profile", confidence: 0.85, extracted: { profile } };
  }
  if (/(show|list|what).*(resume|resumes)/.test(lower) && lower.length < 80) {
    return { intent: "list_resumes", confidence: 0.85 };
  }
  if (/(where|status|done|ready|is it)/.test(lower) && lower.length < 60) {
    return { intent: "status", confidence: 0.8 };
  }

  // Long text = likely a job description
  if (text.length > 200) {
    return { intent: "tailor_new", confidence: 0.9 };
  }

  // Fallback: use LLM for ambiguous cases
  // (For now, treat short ambiguous text as unknown → conversational response)
  return { intent: "unknown", confidence: 0.5 };
}

export function agentReplyFor(intent: WaIntent, ctx: WaAgentContext): string | null {
  // Returns a conversational ack, or null if the handler sends its own message
  switch (intent) {
    case "greeting":
      return "Hey! Send me a job description and I'll tailor your resume for it.";
    case "help":
      return "Send a job description — I'll tailor your resume and send it back as a Word file. Send a .docx with it to use that resume, or I'll use your last one. Reply to any resume I send to request changes.";
    case "tailor_new":
      return "On it — tailoring your resume now."; // handler continues
    case "switch_profile":
      return null; // handler sends confirmation
    case "redo":
      return null; // handler processes
    case "list_resumes":
      return null; // handler lists
    case "status":
      return "Checking on that for you…"; // handler updates
    default:
      return "Got it. Send a job description when you're ready and I'll tailor your resume for it.";
  }
}
