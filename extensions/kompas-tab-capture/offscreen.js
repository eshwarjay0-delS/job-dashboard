// Runs in the offscreen document: turns a tab stream id into one JPEG frame.
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || msg.type !== "kompas:capture") return false;
  (async () => {
    let stream = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { mandatory: { chromeMediaSource: "tab", chromeMediaSourceId: msg.streamId, maxWidth: 1600, maxHeight: 1600 } },
      });
      const video = document.createElement("video");
      video.muted = true;
      video.srcObject = stream;
      await video.play();
      if (video.readyState < 2) await new Promise((r) => { video.onloadeddata = r; setTimeout(r, 1500); });
      if (!video.videoWidth || !video.videoHeight) throw new Error("no frame");
      const k = Math.min(1, 1600 / video.videoWidth);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(video.videoWidth * k);
      canvas.height = Math.round(video.videoHeight * k);
      canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
      sendResponse({ dataUrl: canvas.toDataURL("image/jpeg", 0.72) });
    } catch (_) {
      sendResponse({ dataUrl: null });
    } finally {
      try { (stream || { getTracks: () => [] }).getTracks().forEach((t) => t.stop()); } catch (_) {}
    }
  })();
  return true;
});
