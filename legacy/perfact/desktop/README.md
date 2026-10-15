# Kompas desktop

The window shows the same page as https://perfact-ten.vercel.app. A deploy is what changes it. The page reloads itself when that build moves. There is no second copy and no local server.

## Get it

- **Users:** the **Desktop** button on MarketFit's prep page downloads `Kompas.exe`. It is one portable file:
  double-click it, nothing to install, no source folder needed.
- **Build it:** `npm install`, then `npm run dist` in `desktop/`. That writes `dist/Kompas.exe` (about 95 MB).
  `npm run dist -- --copy-to <job-dashboard>/public/downloads` also puts it where MarketFit serves it from.
  The binary is never committed, here or in MarketFit.
- **From source:** `npm start` (or `npm run exe` once, then double-click `.runtime\Kompas.exe`). That stub
  runs this folder's `main.js`. The page inside is the live site, not the files in `../copilot`.

## How the page gets here

The page is loaded from `https://perfact-ten.vercel.app` through `kompas://app/`. The main process fetches
each file from that site, including `/api/*` (`KOMPAS_API_URL` overrides the site). Nothing in the copilot
folder is served, so `api/` and `.env.local` never reach the page. No model key is in the exe or the page.

`window.kompasDesktop` (`preload.js`) is the page's whole view of the desktop: read or change Private, and
`systemAudio: true` so the speaker control stays. The microphone is You. Computer audio is Them: main.js
answers `getDisplayMedia` with WASAPI loopback of the output mix, so there is no share picker. The Connect
dialog does not ask where the call is. That chooser stays on the website, where `kompasDesktop` is absent.

## Window

- Place and size are whatever he last left. Drag the title bar, drag an edge, Ctrl+Shift+arrows, or the move
  icon (six sections of the work area, two rows of three). Saved in `%APPDATA%\Kompas\desktop.json`.
- **Hide** (or Ctrl+H) shrinks it to a small Kompas mark where the panel was. Click the mark (or Ctrl+H) to
  bring it back at that size and place.
- **Private**, default on: `setContentProtection` on the window (display affinity 0x11,
  WDA_EXCLUDEFROMCAPTURE), so Zoom, Teams, Meet, OBS and screenshots do not see it. One saved `isPrivate`
  flag, applied at creation and whenever the bar's switch or the page's ⋯ menu item changes it.
- **Keep on top**, default on.
- Keys, only while Kompas is focused: Ctrl+Enter answers (the page's own handler), Ctrl+H hides or brings
  back. No global shortcuts.
- Preferences: `%APPDATA%\Kompas\desktop.json`. Sessions, resumes and transcripts: the page's local storage.

Environment: `KOMPAS_API_URL` (answer engine), `KOMPAS_DEVTOOLS=1` (DevTools on the page),
`KOMPAS_DEBUG_PORT=<port>` (remote debugging, for testing).

## Left out on purpose

| Parakeet behaviour | Here |
| --- | --- |
| Executable named with a blank character | The process is `Kompas.exe`, described as "Kompas" |
| Out of the taskbar and Alt+Tab (`skipTaskbar`) | Not implemented. Kompas is in the taskbar |
| Meeting Detect | Not implemented |
| System-audio loopback | On. The speaker control stays visible. Loopback is the output mix, granted in main.js with no share picker |
| Several docking spots | Six sections, from the move icon, plus free drag |
| Global hotkeys | Focused-window keys only |
