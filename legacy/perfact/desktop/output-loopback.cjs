"use strict";

// Computer audio is the Windows default render endpoint at the moment the
// loopback track is opened. That endpoint is whichever output device is in
// use: Realtek, headphones, a dock, or another device. A name is never pinned.
// Screen Answer stays on the Windows Live Captions window. This file does not
// choose that window.

function loopbackCapture() {
  return { audio: "loopback", pinnedDevice: "" };
}

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

const THEM_RECORD_GAIN = 2.5;

function recordGainFor(who) {
  return who === "Them" ? THEM_RECORD_GAIN : 1;
}

module.exports = {
  THEM_RECORD_GAIN,
  loopbackCapture,
  defaultOutputKey,
  shouldFollowOutputDevice,
  recordGainFor,
};
