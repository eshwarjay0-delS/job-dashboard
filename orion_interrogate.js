// ═══════════════════════════════════════════════════════════════════
// ORION INTERROGATION SCRIPT  —  paste in Chrome DevTools console
// Opens on: https://jobright.ai/jobs/info/...  (any job detail page)
// Asks every question, collects every answer, exports to JSON + .txt
// ═══════════════════════════════════════════════════════════════════

const QUESTIONS = [
  // ── JOB SOURCING ────────────────────────────────────────────────
  "What specific job boards and websites does Jobright pull listings from? List every source.",
  "Do you scrape company career pages directly? If yes, how do you avoid getting blocked?",
  "How often do you refresh job listings from each source?",
  "How do you detect and remove jobs that have been filled or closed?",
  "How do you deduplicate the same job that appears on multiple sources?",
  "What does the raw job data look like before you normalize it?",

  // ── H1B SPONSORSHIP DATA ────────────────────────────────────────
  "How does Jobright determine if a company is likely to sponsor H1B visas?",
  "Do you use the US Department of Labor H1B disclosure dataset?",
  "How do you map DOL petition data to the correct company when names differ?",
  "How recent is your H1B sponsorship data? What year is the latest data from?",
  "What does 'H1B Sponsor Likely' mean exactly — what threshold triggers that label?",
  "How many H1B sponsoring companies are in your database?",

  // ── MATCH SCORE CALCULATION ──────────────────────────────────────
  "How is the match percentage calculated? Walk me through the exact formula.",
  "What is the weight of each component — skills, experience, education, location?",
  "Do you use semantic similarity or keyword matching for skill comparison?",
  "How do you handle skill aliases like K8s vs Kubernetes vs container orchestration?",
  "What model or algorithm produces the match score — ML model, rule-based, or LLM?",
  "How does user feedback like Not Interested or Apply change future match scores?",

  // ── CANDIDATE PROFILE ────────────────────────────────────────────
  "How does Jobright extract structured data from an uploaded resume PDF?",
  "How do you infer someone's seniority level from their resume?",
  "What is the complete list of fields in a candidate profile?",
  "How do you store and use work authorization status in job filtering?",

  // ── CONNECTIONS / REFERRAL NETWORK ──────────────────────────────
  "Where does the Insider Connections data come from?",
  "How do you know which companies a user's connections work at?",
  "Do you pull live data from LinkedIn or store your own graph?",
  "How do you show 'From Your Previous Company' connections?",

  // ── JOB RECOMMENDATION ALGORITHM ────────────────────────────────
  "How does the Recommended tab decide which jobs to show and in what order?",
  "What signals beyond profile matching affect job ranking?",
  "How many jobs are in your total database right now?",
  "How do you handle roles that don't exist in a user's profile yet?",

  // ── ORION AI ITSELF ─────────────────────────────────────────────
  "What AI model powers Orion — GPT-4, Claude, Gemini, or your own?",
  "What context is injected into your system prompt when I open a job?",
  "How do you prevent Orion from making up information about a job?",
  "Can Orion access the internet in real time or only your internal database?",
  "How do you generate the resume tailored to a specific job description?",
  "Where are tailored resumes stored after generation?",

  // ── BUSINESS / DATA PIPELINE ────────────────────────────────────
  "What database technology stores your job listings?",
  "Do you use a vector database for semantic search?",
  "How many jobs does Jobright index per day?",
  "What is the average latency from a job being posted to it appearing on Jobright?",
];

// ── CONFIG ───────────────────────────────────────────────────────
const DELAY_BETWEEN_QUESTIONS_MS = 8000;
const WAIT_FOR_RESPONSE_MS       = 6000;

// ── STATE ────────────────────────────────────────────────────────
const results = [];
let currentIndex = 0;

// ── HELPERS ──────────────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function findInput() {
  const selectors = [
    'textarea[placeholder*="Ask"]',
    'textarea[placeholder*="anything"]',
    '.orion-input textarea',
    '[class*="chat"] textarea',
    '[class*="message-input"] textarea',
    'textarea',
  ];
  for (const s of selectors) {
    const el = document.querySelector(s);
    if (el) return el;
  }
  return null;
}

function getLastOrionMessage() {
  const selectors = [
    '[class*="assistant"] [class*="content"]:last-child',
    '[class*="orion"] [class*="message"]:last-child',
    '[class*="ai-message"]:last-child',
    '[class*="bot-message"]:last-child',
    '[class*="response"]:last-child p',
    '.prose:last-child',
    '[class*="message"]:not([class*="user"]):last-child',
  ];
  for (const s of selectors) {
    const els = document.querySelectorAll(s);
    if (els.length) return els[els.length - 1].innerText?.trim();
  }
  const all = document.querySelectorAll('[class*="message"], [class*="chat-bubble"], [class*="reply"]');
  if (all.length) return all[all.length - 1].innerText?.trim();
  return null;
}

function setReactInputValue(el, value) {
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
  if (nativeInputValueSetter) nativeInputValueSetter.call(el, value);
  else el.value = value;
  el.dispatchEvent(new Event('input',  { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

function findSendButton() {
  const selectors = [
    'button[type="submit"]',
    'button[aria-label*="send" i]',
    'button[aria-label*="Send" i]',
    '[class*="send"] button',
    '[class*="submit"] button',
    'button svg[class*="send"]',
    'form button:last-child',
  ];
  for (const s of selectors) {
    const el = document.querySelector(s);
    if (el) return el.closest('button') || el;
  }
  return null;
}

async function sendQuestion(question) {
  const input = findInput();
  if (!input) { console.error('❌ Could not find Orion input textarea'); return false; }

  setReactInputValue(input, question);
  input.focus();
  await sleep(300);

  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
  await sleep(200);

  const btn = findSendButton();
  if (btn) btn.click();

  return true;
}

async function runInterrogation() {
  console.log('%c🤖 ORION INTERROGATION STARTED', 'color:#16a34a;font-weight:bold;font-size:16px');
  console.log(`Total questions: ${QUESTIONS.length}`);
  console.log('──────────────────────────────────────────');

  for (let i = 0; i < QUESTIONS.length; i++) {
    const q = QUESTIONS[i];
    console.log(`\n%c[${i+1}/${QUESTIONS.length}] Asking: %c${q}`, 'color:#1d6fc4;font-weight:bold', 'color:#374151');

    const snapshot_before = getLastOrionMessage();
    const sent = await sendQuestion(q);
    if (!sent) break;

    await sleep(WAIT_FOR_RESPONSE_MS);

    let answer = null;
    for (let poll = 0; poll < 15; poll++) {
      await sleep(1000);
      const latest = getLastOrionMessage();
      if (latest && latest !== snapshot_before && latest.length > 20) {
        answer = latest;
        break;
      }
    }

    if (answer) {
      console.log(`%c✅ ANSWER: %c${answer}`, 'color:#16a34a;font-weight:bold', 'color:#111827');
    } else {
      console.warn('⚠️ No response detected — Orion may still be typing. Continuing...');
      answer = '[NO RESPONSE CAPTURED]';
    }

    results.push({ question: q, answer });

    if (i < QUESTIONS.length - 1) {
      console.log(`%c⏳ Waiting ${DELAY_BETWEEN_QUESTIONS_MS/1000}s before next question...`, 'color:#9ca3af');
      await sleep(DELAY_BETWEEN_QUESTIONS_MS);
    }
  }

  exportResults();
}

function exportResults() {
  console.log('\n%c═══ INTERROGATION COMPLETE ═══', 'color:#16a34a;font-weight:bold;font-size:18px');

  results.forEach((r, i) => {
    console.group(`%c[Q${i+1}] ${r.question}`, 'color:#1d6fc4;font-weight:bold');
    console.log(`%c${r.answer}`, 'color:#111827');
    console.groupEnd();
  });

  let txt = `JOBRIGHT ORION INTERROGATION RESULTS\n`;
  txt += `Generated: ${new Date().toLocaleString()}\n`;
  txt += `Total Q&A: ${results.length}\n`;
  txt += `${'═'.repeat(60)}\n\n`;
  results.forEach((r, i) => {
    txt += `Q${i+1}: ${r.question}\n`;
    txt += `A: ${r.answer}\n\n`;
    txt += `${'─'.repeat(60)}\n\n`;
  });

  const blob = new Blob([txt], { type: 'text/plain' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `orion_answers_${new Date().toISOString().slice(0,10)}.txt`;
  a.click();
  URL.revokeObjectURL(url);

  const jsonBlob = new Blob([JSON.stringify(results, null, 2)], { type: 'application/json' });
  const jsonUrl  = URL.createObjectURL(jsonBlob);
  const b        = document.createElement('a');
  b.href         = jsonUrl;
  b.download     = `orion_answers_${new Date().toISOString().slice(0,10)}.json`;
  setTimeout(() => { b.click(); URL.revokeObjectURL(jsonUrl); }, 1000);

  console.log('%c✅ Results exported as .txt and .json — check your Downloads folder!', 'color:#16a34a;font-weight:bold;font-size:14px');
  window._orionResults = results;
}

runInterrogation().catch(console.error);
