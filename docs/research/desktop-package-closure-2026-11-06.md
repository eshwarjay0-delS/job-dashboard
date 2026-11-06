# Published Kompas.exe crashes on startup — 6 November 2026

## Request

After PR #247 merged as `1b116ce`, the Windows download crashed on launch. The dialog was "A JavaScript error occurred in the main process", `Cannot find module './capture-source.cjs'`, from `C:\Users\Eshwa\AppData\Local\Kompas\app\162200852-AA090000\resources\app\...\main.js`. The file was `Kompas-20261106-1b116ce.exe`. Do not merge this follow-up. Do not change stored auth, the Chrome handoff, dictation parity, JEV, or Lens.

## Artifact

Downloaded `kompas-desktop-latest` on 6 Nov 2026. SHA256 `ff6202c315acc9f66a5a94bc10ba6b9b5c332ba1a02ca0261de9ca70d40a2e03`. Size 162208028 bytes. The launcher payload length is 162200852, which is the folder name on the laptop. The asar contains `main.js`, `chrome-handoff.cjs`, `marketfit-auth.cjs`, `desktop-handoff.cjs`, `desktop-update.cjs`, the picker files, `panel.css`, `preload.js`, and the copilot pages. It does not contain `capture-source.cjs` or `taskbar-choice.cjs`. `main.js` requires both before it opens a window. The running gate on that exe reports `Packaged app is missing runtime files: capture-source.cjs, taskbar-choice.cjs`.

`icon-256.png` is named in `main.js` and is not in the repository. It is not a `require`, and it is not this crash. It stays out of the package list.

## Change

The package file list is the require and file closure of `main.js`, `preload.js`, `picker-preload.js`, and `picker.html`, including `capture-source.cjs` and `taskbar-choice.cjs`. `npm run dist` refuses to finish if the built `Kompas.exe` asar is missing any of those files. Windows CI runs that check on `dist/Kompas.exe` and then starts `dist/win-unpacked/Kompas.exe` with `KOMPAS_SMOKE=1`. That flag returns from `app.whenReady` before the session file is read and before Chrome is opened. Exit 0 is the smoke pass. This environment is Linux, so that launch was not run here.

## Evidence

Desktop `npm run check`: 46 pass, 0 fail, protocol self-test passed. The published exe fails the new gate on the two missing modules. Not a Windows process start from this machine. Not merged. The release asset stays the crashing build until this pull request is merged and the Windows workflow uploads the replacement.
