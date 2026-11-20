# Kompas desktop spike: Tauri and WASAPI

Docs only. No Tauri app, no new native binary, and no change to the Electron shell in this pull request.

## What already works

The current desktop is Electron. Computer audio is the Windows output mix through `audio: "loopback"` on a screen source. That is the WASAPI loopback Electron already exposes. The web session captures a meeting tab with `getDisplayMedia`, keeps the audio tracks on the background capture stream, and shows only the video tracks in the in-session tab preview. The preview element stays muted.

## Spike question

Can a Tauri shell replace Electron for the same two jobs: play the meeting tab in a small in-session preview, and capture the default output device in the background without a second share picker?

## Plan

1. Keep the web Kompas page as the UI. Tauri would host that page, the way Electron does now.
2. Audio: a small Rust plugin that opens the default render endpoint in loopback (WASAPI) and pushes 16 kHz PCM to the page. Do not route that audio through the preview element.
3. Preview: the page already accepts a video-only stream. On Windows desktop, if loopback has no video, the preview stays hidden and capture continues. A later spike can add a window thumbnail only if WASAPI audio is already stable.
4. Do not vendor a second capture stack beside Electron until one Windows machine shows loopback audio and a muted preview at the same time.
5. Signing, auto-update, and the hide-from-taskbar choice stay on the Electron path until that spike passes.

## Out of scope

No polling, no `[ship]`, and no claim that Tauri or a new WASAPI binding is built.
