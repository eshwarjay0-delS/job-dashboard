// One deliberate Windows caption-window capture per click; no background OCR.
(function () {
  let busy = false;
  const clean = s => String(s || "").replace(/\s+/g, " ").trim();
  const similar = s => clean(s).toLowerCase().replace(/[^a-z0-9+#]+/g, " ");
  function combine(previous, captured) {
    const before = clean(previous), next = clean(captured);
    if (!before) return next;
    if (!next || similar(before).includes(similar(next))) return before;
    if (similar(next).includes(similar(before))) return next;
    return before + "\n" + next;
  }
  function extractedText(payload) {
    if (payload?.needsAnswer === true) return clean(payload.question);
    if (payload?.needsReview === true && Array.isArray(payload.tasks))
      return payload.tasks.map(t => clean(t?.question)).filter(Boolean).join("\n");
    return "";
  }
  async function capture() {
    if (busy) return false;
    if (!window.kompasDesktop?.captureCaptionOnce) {
      status("Caption Capture requires the updated Kompas Windows app.", "err"); return false;
    }
    if (typeof aiBusy !== "undefined" && aiBusy) {
      status("Finish the current AI answer before capturing a new window.", "live"); return false;
    }
    if (document.getElementById("view-copilot")?.classList.contains("hidden")) return false;
    busy = true;
    const button = document.getElementById("screenCaptureAnswerBtn");
    if (button) button.disabled = true;
    const sessionId = typeof current !== "undefined" ? current?.id : null;
    const begun = performance.now();
    try {
      status("Reading selected caption window…", "live");
      const frame = await window.kompasDesktop.captureCaptionOnce();
      if (!frame || frame.source !== "window" || !/^data:image\/jpeg;base64,/.test(frame.image || ""))
        throw new Error("No readable window image was captured.");
      const response = await fetch("/api/screen", {
        method: "POST", signal: AbortSignal.timeout(25000),
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: "caption-window", image: frame.image }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Caption text recognition failed");
      const raw = extractedText(data);
      if (!raw) throw new Error("No readable caption text was present in the selected window.");
      // The SAME existing resume/JD/document vocabulary and technical
      // homophone correction functions are used for live computer audio.
      const corrected = fixTerms(fixPhrases(raw));
      if (!corrected) throw new Error("No question remained after correction.");
      if (sessionId !== (typeof current !== "undefined" ? current?.id : null))
        throw new Error("Session changed during capture; the old caption was not submitted.");
      const input = document.getElementById("manualInput");
      if (!input) throw new Error("The Kompas question field is unavailable.");
      input.value = combine(input.value, corrected);
      setChat(true);
      status("Caption recognized in " + Math.round(performance.now() - begun) +
        " ms; answering with the existing session context.", "live");
      await aiAnswer(false, { captionOnce: true });
      return true;
    } catch (error) {
      status(error?.message || "Caption Capture could not read the window.", "err");
      return false;
    } finally {
      busy = false;
      if (button) button.disabled = false;
    }
  }
  window.KompasCaptionOnce = { capture, combine, extractedText };
  const button = document.getElementById("screenCaptureAnswerBtn");
  if (button) button.onclick = () => { void capture(); };
  // Capture listener takes precedence over the older Screen Answer shortcut.
  // Win+Shift+S remains owned by Windows; Ctrl+Shift+S is Kompas's shortcut.
  document.addEventListener("keydown", event => {
    if (event.ctrlKey && event.shiftKey && !event.altKey && !event.metaKey &&
        String(event.key).toLowerCase() === "s" &&
        !document.getElementById("view-copilot")?.classList.contains("hidden")) {
      event.preventDefault();
      event.stopImmediatePropagation();
      void capture();
    }
  }, true);
})();