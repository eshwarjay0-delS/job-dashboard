// Runs on the Kompas page. The page reads the frame from the document
// attribute (attributes cross the extension's isolated world; window
// properties set here would not). Pull on load and whenever the tab regains
// focus, so arming the question tab first or last both work.
async function pullFrame() {
  try {
    const res = await chrome.runtime.sendMessage({ type: "kompas:frame-request" });
    if (res && res.dataUrl) document.documentElement.setAttribute("data-kompas-ext-frame", res.dataUrl);
  } catch (_) {}
}
pullFrame();
window.addEventListener("focus", pullFrame);
