// ═══════════════════════════════════════════════════════════════
// ORION ROUND 4 — DOM Bug Fixed
//
// WHAT FAILED IN ROUNDS 2 & 3:
//   getOrionContainer() walked up from textarea, found a scrollable
//   parent that was the full page body — captured analytics scripts
//   (Impact CDN in Round 2, LinkedIn pixel in Round 3) as "answers."
//
// THE FIX:
//   MutationObserver approach. Before sending each question, we attach
//   a MutationObserver to document.body watching for addedNodes.
//   We collect ONLY text from newly added DOM nodes. We never read
//   the existing page — just the delta that Orion writes.
//   This is immune to what the page already contains.
//
// QUESTIONS:
//   12 high-value targets — all from unanswered Rounds 1-3.
//   Soft topics only (no hard-blocked questions), with 2 follow-ups each.
//
// SETTINGS:
//   15s between questions, 7s before follow-ups
//   Rate limit → 70s wait → retry
//   Teal panel, bottom-LEFT (avoids Orion panel on right)
// ═══════════════════════════════════════════════════════════════

const R4_QUESTIONS = [
  {
    q: "When a job I saved gets filled and the posting closes, what happens to it in my saved list? Does it disappear, get grayed out, or stay visible?",
    followups: [
      "Does Jobright notify me when a saved job closes?",
      "How does Jobright detect that a job posting is no longer active?",
    ]
  },
  {
    q: "Is there a minimum H1B sponsorship threshold for the 'H1B Sponsor Likely' badge? For example, would a company that only filed once ever get it, or does it require a minimum number of filings?",
    followups: [
      "If a company sponsored 5 H1B visas vs 500 — do they both get the badge?",
      "Is the badge based on a count, a percentage, or a pattern over time?",
    ]
  },
  {
    q: "If I click Not Interested on 10 jobs in a row that are all in the Data Science category, will Data Science jobs decrease in my Recommended feed afterwards?",
    followups: [
      "Does Jobright track which job categories I reject and adjust recommendations?",
      "Does applying to jobs in a specific category increase that category in my feed?",
    ]
  },
  {
    q: "For the Insider Connections feature — does it require me to connect my LinkedIn account, or does it automatically figure out my professional network?",
    followups: [
      "If I haven't connected LinkedIn, where does the alumni and connection data come from?",
      "Does Jobright use public LinkedIn profiles to build connection data?",
    ]
  },
  {
    q: "List every signal that determines which jobs appear in my Recommended tab and in what order — things like my skills, location, activity, preferences.",
    followups: [
      "Which of those signals has the highest weight in ranking?",
      "If I update my profile skills today, how long until my Recommended jobs change?",
    ]
  },
  {
    q: "When I click 'Tailor Resume' for a job — does the AI actually rewrite my bullet points, or does it just highlight which keywords I should add?",
    followups: [
      "Does it generate entirely new bullet text or only modify what I already wrote?",
      "Is the tailored resume version stored on Jobright's servers, or only downloaded locally?",
    ]
  },
  {
    q: "If I search for 'DevOps engineer' on Jobright, can it return SRE or Platform Engineer roles even if those job titles don't contain the word DevOps?",
    followups: [
      "Is the job search keyword-only, or does it use semantic matching to find similar roles?",
      "If I type 'Dragos platform' as a search, can it find OT security jobs that don't mention Dragos?",
    ]
  },
  {
    q: "Can you tell me which company has sponsored more H1B visas in the last 3 years — Salesforce or Google? Rough numbers are fine.",
    followups: [
      "Can you tell me the approximate number of H1B petitions either company filed last year?",
      "Which large tech companies are the top H1B sponsors by volume that Jobright tracks?",
    ]
  },
  {
    q: "If a job posting on Jobright is 90 days old and hasn't been marked as filled — does it get automatically removed, or does it stay visible indefinitely?",
    followups: [
      "Is there a maximum age for job listings before Jobright removes them?",
      "How does Jobright know a 3-month-old job is still open versus already filled?",
    ]
  },
  {
    q: "Before I tell you anything about myself — what information about me do you already have access to right now?",
    followups: [
      "Do you have my resume, my skills, or my work history loaded right now?",
      "Can you tell me the title and company of the job I'm currently viewing?",
    ]
  },
  {
    q: "When I use Jobright's autofill to apply to a job — what profile fields does it actually fill in, and does it adjust them per job or use the same data every time?",
    followups: [
      "Does Jobright autofill adjust the resume or cover letter text per application?",
      "Is the autofill data stored locally in my browser or on Jobright's servers?",
    ]
  },
  {
    q: "Are my conversations with you stored after I close this chat? Can Jobright employees or support staff see what I've asked you?",
    followups: [
      "Is this chat session used to improve Orion's training in the future?",
      "What is Jobright's data retention policy for Orion conversations?",
    ]
  },
];

// ─── Settings ────────────────────────────────────────────────
const GAP_BETWEEN_QS  = 15000;
const GAP_BEFORE_FU   = 7000;
const RATE_LIMIT_WAIT = 70000;
const RESPONSE_TIMEOUT = 25000;
const STABLE_MS       = 3000;
const STABLE_CHECKS   = 3;
const STABLE_INTERVAL = 1000;

const RATE_LIMIT_PHRASES = [
  "rate limit", "too many requests", "slow down", "try again later",
  "429", "quota", "throttl"
];

const DEFLECT_PHRASES = [
  "not available", "cannot provide", "don't have access", "unable to share",
  "send feedback", "support team", "proprietary", "can't share",
  "product question i can help", "is there a product", "feature or issue"
];

// ─── State ───────────────────────────────────────────────────
const answers = [];
const sleep = ms => new Promise(r => setTimeout(r, ms));
let r4running = false;
let r4paused  = false;

// ─── MutationObserver-based response capture ─────────────────
function collectNewText(collectedNodes) {
  const OWN_IDS = ['__r4_wrap__', '__r3_wrap__', '__r2_wrap__', '__oi_wrap__', '__orion_ui__'];
  const parts = [];
  for (const node of collectedNodes) {
    let parent = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
    let skip = false;
    while (parent) {
      if (OWN_IDS.includes(parent.id)) { skip = true; break; }
      parent = parent.parentElement;
    }
    if (skip) continue;

    const text = (node.nodeType === Node.TEXT_NODE
      ? node.textContent
      : node.innerText || node.textContent || ''
    ).trim();

    if (text.length > 10 &&
        !text.includes('window.lintrk') &&
        !text.includes('impactStat') &&
        !text.includes('snap.licdn') &&
        !text.includes('function(l)') &&
        !text.includes('var s = document') &&
        !text.includes('getOwnProperty')) {
      parts.push(text);
    }
  }
  return parts.join(' ').trim();
}

async function waitForOrionResponse() {
  const newNodes = [];
  const observer = new MutationObserver(mutations => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        newNodes.push(node);
        if (node.nodeType === Node.ELEMENT_NODE) {
          for (const child of node.querySelectorAll('*')) {
            newNodes.push(child);
          }
        }
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  const startTime = Date.now();
  let lastNodeCount = 0;
  let stableCount = 0;
  let responseStarted = false;

  while (Date.now() - startTime < RESPONSE_TIMEOUT) {
    await sleep(STABLE_INTERVAL);
    const currentText = collectNewText(newNodes);

    if (currentText.length > 20) responseStarted = true;

    if (responseStarted) {
      if (newNodes.length === lastNodeCount) {
        stableCount++;
        if (stableCount >= STABLE_CHECKS) break;
      } else {
        stableCount = 0;
      }
    }
    lastNodeCount = newNodes.length;
  }

  observer.disconnect();
  return collectNewText(newNodes);
}

// ─── Helpers ─────────────────────────────────────────────────
function isRateLimit(t) {
  if (!t) return false;
  return RATE_LIMIT_PHRASES.some(p => t.toLowerCase().includes(p));
}

function isDeflection(t) {
  if (!t || t.length < 20) return true;
  return DEFLECT_PHRASES.some(p => t.toLowerCase().includes(p));
}

function findInput() {
  return (
    document.querySelector('textarea[placeholder*="Ask"]') ||
    document.querySelector('textarea[placeholder*="anything"]') ||
    document.querySelector('textarea[placeholder*="Type"]') ||
    document.querySelector('textarea[placeholder*="message"]') ||
    [...document.querySelectorAll('textarea')].find(t => t.offsetParent !== null)
  );
}

async function send(text) {
  const el = findInput();
  if (!el) { console.warn('[R4] No textarea found'); return false; }
  el.focus();
  const nativeSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
  if (nativeSetter) nativeSetter.call(el, text); else el.value = text;
  el.dispatchEvent(new Event('input',  { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  await sleep(400);
  el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true }));
  await sleep(200);
  el.dispatchEvent(new KeyboardEvent('keyup',   { key: 'Enter', bubbles: true }));

  let btn = el.parentElement;
  for (let i = 0; i < 8 && btn; i++) {
    const b = btn.querySelector('button[type="submit"]') ||
              btn.querySelector('button[aria-label*="send" i]') ||
              btn.querySelector('button[aria-label*="Send" i]') ||
              btn.querySelector('button:last-of-type');
    if (b) { b.click(); break; }
    btn = btn.parentElement;
  }
  return true;
}

function setStatus(msg, pct, color = '#0d9488') {
  document.getElementById('__r4_status__').textContent = msg;
  const bar = document.getElementById('__r4_bar__');
  bar.style.width = Math.round(pct) + '%';
  bar.style.background = color;
  document.getElementById('__r4_pct__').textContent = Math.round(pct) + '%';
  console.log(`[R4 ${Math.round(pct)}%] ${msg}`);
}

async function waitForResume() {
  while (r4paused) await sleep(500);
}

// ─── Core loop ───────────────────────────────────────────────
async function runRound4() {
  if (r4running) return;
  r4running = true;
  r4paused  = false;

  const startBtn = document.getElementById('__r4_btn__');
  startBtn.textContent = '⏸ Pause';
  startBtn.onclick = togglePause;

  for (let i = 0; i < R4_QUESTIONS.length; i++) {
    await waitForResume();
    const { q, followups } = R4_QUESTIONS[i];
    const pct = (i / R4_QUESTIONS.length) * 100;
    setStatus(`[${i+1}/${R4_QUESTIONS.length}] ${q.slice(0, 55)}…`, pct);

    await send(q);
    let response = await waitForOrionResponse();

    if (isRateLimit(response)) {
      setStatus(`⚠️ Rate limit — waiting ${RATE_LIMIT_WAIT/1000}s…`, pct, '#dc2626');
      await sleep(RATE_LIMIT_WAIT);
      await send(q);
      response = await waitForOrionResponse();
    }

    const fuLog = [];
    for (let fi = 0; fi < followups.length; fi++) {
      await waitForResume();
      const shouldFollowUp = !response || response.length < 80 || isDeflection(response) || fi === 0;
      if (!shouldFollowUp) break;

      setStatus(`↩ [${i+1}] Follow-up ${fi+1}…`, pct, '#b45309');
      await sleep(GAP_BEFORE_FU);
      await send(followups[fi]);
      let rfu = await waitForOrionResponse();

      if (isRateLimit(rfu)) {
        setStatus(`⚠️ Rate limit — waiting ${RATE_LIMIT_WAIT/1000}s…`, pct, '#dc2626');
        await sleep(RATE_LIMIT_WAIT);
        await send(followups[fi]);
        rfu = await waitForOrionResponse();
      }
      if (rfu) fuLog.push(`[FU${fi+1}] ${rfu}`);
    }

    const fullAnswer = [response, ...fuLog].filter(Boolean).join('\n\n');
    answers.push({ n: i+1, q, answer: fullAnswer || '[NO RESPONSE]' });
    setStatus(`✓ Q${i+1} done`, ((i+1)/R4_QUESTIONS.length)*100, '#16a34a');

    if (i < R4_QUESTIONS.length - 1) {
      for (let t = Math.round(GAP_BETWEEN_QS / 1000); t > 0; t--) {
        await waitForResume();
        setStatus(`✓ Q${i+1} done — next in ${t}s…`, ((i+1)/R4_QUESTIONS.length)*100, '#16a34a');
        await sleep(1000);
      }
    }
  }

  setStatus(`✅ Complete — ${answers.length} answers captured`, 100, '#16a34a');
  exportR4();
  r4running = false;
  const btn = document.getElementById('__r4_btn__');
  btn.textContent = '✅ Done — check Downloads';
  btn.disabled = true;
}

function togglePause() {
  r4paused = !r4paused;
  const btn = document.getElementById('__r4_btn__');
  btn.textContent = r4paused ? '▶ Resume' : '⏸ Pause';
  btn.style.background = r4paused ? '#16a34a' : '#0d9488';
  console.log(r4paused ? '%c⏸ Paused' : '%c▶ Resumed', 'color:#0d9488;font-weight:bold');
}

function exportR4() {
  let txt = `JOBRIGHT ORION — ROUND 4 (DOM-FIXED)\nDate: ${new Date().toLocaleString()}\nMethod: MutationObserver (captures only new DOM nodes after each send)\n${'═'.repeat(70)}\n\n`;
  answers.forEach(r => {
    txt += `Q${r.n}: ${r.q}\n\nA: ${r.answer}\n\n${'─'.repeat(70)}\n\n`;
  });
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([txt], { type: 'text/plain' })),
    download: `orion_round4_${new Date().toISOString().slice(0, 10)}.txt`,
  });
  a.click();
  window._orionR4 = answers;
  console.log('%c📥 Round 4 complete — file downloaded & window._orionR4 has all data', 'color:#0d9488;font-weight:bold;font-size:14px');
}

// ─── Inject UI (teal, bottom-LEFT) ───────────────────────────
(function () {
  document.getElementById('__r4_wrap__')?.remove();
  const d = document.createElement('div');
  d.id = '__r4_wrap__';
  d.innerHTML = `
    <div style="
      position:fixed;bottom:20px;left:20px;z-index:2147483647;
      background:#0f1623;color:#fff;border-radius:14px;
      padding:14px 16px;width:320px;
      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
      box-shadow:0 8px 32px rgba(0,0,0,.6);border:1px solid #134e4a;
    ">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <span style="font-weight:800;font-size:13px">🔬 Orion Round 4</span>
        <span style="margin-left:auto;font-size:11px;color:#5eead4" id="__r4_pct__">0%</span>
      </div>
      <div style="height:4px;background:#1f2937;border-radius:2px;margin-bottom:8px">
        <div id="__r4_bar__" style="height:100%;background:#0d9488;width:0%;transition:width .4s;border-radius:2px"></div>
      </div>
      <div id="__r4_status__" style="font-size:11px;color:#9ca3af;margin-bottom:10px;min-height:40px;line-height:1.5">
        12 questions · MutationObserver capture · DOM bug fixed.<br>
        Open Orion chat panel, then click Start.
      </div>
      <button id="__r4_btn__" style="
        width:100%;padding:9px;border-radius:8px;border:none;
        background:#0d9488;color:#fff;font-size:13px;font-weight:700;cursor:pointer;
      ">
        ▶ Start Round 4 (${R4_QUESTIONS.length} questions)
      </button>
      <div style="font-size:10px;color:#374151;margin-top:8px;text-align:center;">
        Teal panel · MutationObserver fix · 15s gaps
      </div>
    </div>
  `;
  document.body.appendChild(d);
  document.getElementById('__r4_btn__').addEventListener('click', runRound4);
  console.log('%c🔬 Orion Round 4 ready — TEAL panel bottom-LEFT', 'color:#0d9488;font-weight:bold;font-size:14px');
  console.log('%cFix: MutationObserver captures only DOM nodes added AFTER each send — no more analytics script capture', 'color:#5eead4;font-size:12px');
})();
