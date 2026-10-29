// Kompas Tab Capture: one click on the question tab arms it; Screen Answer
// in Kompas then answers from that frame. No share picker at any point:
// chrome.tabCapture captures a tab the extension may access without asking.
// One frame, one use, and frames older than 10 minutes are dropped.
let armedFrame = null;
let armedAt = 0;
const FRAME_TTL_MS = 10 * 60 * 1000;

async function ensureOffscreen() {
  if (typeof chrome.offscreen.hasDocument === "function" && (await chrome.offscreen.hasDocument())) return;
  await chrome.offscreen.createDocument({
    url: "offscreen.html",
    reasons: ["USER_MEDIA"],
    justification: "Capture one frame of the armed tab for Kompas Screen Answer.",
  });
}

async function captureArmedTab() {
  const streamId = await chrome.tabCapture.getMediaStreamId({});
  await ensureOffscreen();
  try {
    const res = await chrome.runtime.sendMessage({ type: "kompas:capture", streamId });
    if (res && res.dataUrl) {
      armedFrame = res.dataUrl;
      armedAt = Date.now();
    }
  } finally {
    try { await chrome.offscreen.closeDocument(); } catch (_) {}
  }
}

chrome.action.onClicked.addListener(() => {
  captureArmedTab().catch(() => { armedFrame = null; armedAt = 0; });
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || msg.type !== "kompas:frame-request") return false;
  let dataUrl = null;
  if (armedFrame && Date.now() - armedAt < FRAME_TTL_MS) dataUrl = armedFrame;
  armedFrame = null;
  armedAt = 0;
  sendResponse({ dataUrl });
  return false;
});
