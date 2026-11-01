// One user click or Ctrl+Shift+S reads a single selected window, then runs
// the existing Kompas question formation and AI Answer. No continuous capture.
(function () {
  let busy = false;
  async function capture() {
    if (busy) return;
    if (!window.kompasDesktop?.captureCaptionOnce) {
      status("Install the updated Kompas Windows app for Caption Capture.", "err");
      return;
    }
    busy = true;
    try {
      status("Reading Windows Live Captions…", "live");
      const frame = await window.kompasDesktop.captureCaptionOnce();
      if (!frame?.image || frame.source !== "window") throw new Error("No selected window frame");
      const response = await fetch("/api/screen", {
        method: "POST", headers: { "content-type": "application/json" },
        signal: AbortSignal.timeout(30000),
        body: JSON.stringify({ image: frame.image, prep: slimPrep(), config: liveConfig() })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Caption OCR failed");
      const question = typeof data.question === "string" ? data.question :
        Array.isArray(data.tasks) ? data.tasks.map(x => x.question).filter(Boolean).join(" ") : "";
      if (!question.trim()) throw new Error("No caption question was visible");
      const repaired = fixTerms(fixPhrases(question.trim()));
      const input = document.getElementById("manualInput");
      if (!input) throw new Error("Question field unavailable");
      input.value = [input.value.trim(), repaired].filter(Boolean).join("\n");
      setChat(true);
      await aiAnswer(false);
    } catch (error) { status(error.message || "Caption capture failed", "err"); }
    finally { busy = false; }
  }
  window.KompasCaptionOnce = { capture };
  const button = document.getElementById("screenCaptureAnswerBtn");
  if (button) button.onclick = () => void capture();
  document.addEventListener("keydown", event => {
    if (event.ctrlKey && event.shiftKey && String(event.key).toLowerCase() === "s") {
      event.preventDefault();
      event.stopImmediatePropagation();
      void capture();
    }
  }, true);
})();