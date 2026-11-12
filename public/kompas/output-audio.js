"use strict";

// Same rules as legacy/perfact/desktop/output-loopback.cjs, for the page.
// The desktop opens WASAPI loopback on the current Windows default output.
// A later device change re-opens that loopback. The recorded computer-audio
// stream is lifted so it is in the same range as the microphone's auto-gain.
// Echo cancellation stays off. Live Captions remains the caption source.
const THEM_RECORD_GAIN = 2.5;

function defaultOutputKey(devices) {
  const list = (Array.isArray(devices) ? devices : []).filter(device => device && device.kind === "audiooutput");
  const chosen = list.find(device => device.deviceId === "default") || list[0] || null;
  if (!chosen) return "";
  return String(chosen.label || chosen.deviceId || "");
}

function shouldFollowOutputDevice(previous, next) {
  const before = String(previous || "").trim();
  const after = String(next || "").trim();
  if (!before || !after || before === after) return false;
  return true;
}

function recordGainFor(who) {
  return who === "Them" ? THEM_RECORD_GAIN : 1;
}

const api = { THEM_RECORD_GAIN, defaultOutputKey, shouldFollowOutputDevice, recordGainFor };
if (typeof module === "object" && module.exports) module.exports = api;
globalThis.KompasOutputAudio = api;
