# Kompas UAC manifest source audit — 13 November 2026

## Request and scope

The owner reported repeated Windows User Account Control prompts for Kompas.exe (issue #192). Continue the canonical MFit/Kompas investigation without disabling UAC, weakening account/session controls, or treating an unsigned-publisher warning as proof of an elevation request.

This audit used only the canonical `job-dashboard` repository, GitHub release metadata and workflow records. It did not inspect the owner's Windows device or download/modify the published executable.

## Source findings

- `legacy/perfact/desktop/scripts/execution-level.mjs` exports `asInvokerManifest`, which rewrites an existing `requestedExecutionLevel` to `asInvoker`. Its comment explicitly says it does not sign the executable.
- `legacy/perfact/desktop/scripts/runtime.mjs` imports that helper and applies it to every RT_MANIFEST resource while stamping the unpacked Electron executable.
- `legacy/perfact/desktop/scripts/package.mjs` stamps the unpacked Electron executable in `afterPack` and separately stamps the outer x64 SFX launcher before packaging. Both source-built executable layers are therefore intended to use `asInvoker`.
- Static search of current `legacy/perfact/desktop/main.js` and `package.json` found no explicit `runas`, `ShellExecute`, `requireAdministrator`, or elevation invocation.
- Current desktop source package version is `0.8.8`.

## Published artifact evidence

The canonical MFit GitHub release `kompas-desktop-latest` contains `Kompas.exe`:

- Size: 162,251,677 bytes
- Last updated: 2026-11-13 18:28:25 UTC
- GitHub-reported SHA-256: `22e5551df7cb1c3ce1f18a82b25c6bdee210d7c148d9aa40714affe98207fcbd`
- Windows packaging workflow: `43482749570`, SUCCESS on master `026c72968e45314ff0a99f701942c966e79f0a1e`
- Current master `3e1033687972230de76747e063afe1a0c1cdea61` is a documentation-only descendant of that packaged commit.

This establishes the source/build record, not the PE manifest bytes of the published asset or the binary installed on the owner's computer.

## Regression guard added

This branch adds `scripts/execution-level.test.mjs` and wires it into the existing Windows desktop `npm run check`. The tests cover:

- `requireAdministrator` and `highestAvailable` being rewritten to `asInvoker`;
- preserving an already-safe manifest and leaving a manifest without an execution-level entry unchanged;
- applying the transformer to every manifest resource;
- stamping both the inner Electron executable and outer SFX launcher.

The test and Windows packaging workflow have not yet run on this branch. This is a regression guard, not a runtime behavior change or proof the user's prompt is resolved.

## Remaining acceptance

Issue #192 stays OPEN. The exact installed executable SHA/path, an installed-binary manifest inspection, and a Windows process/event trace identifying the executable that requests elevation are still missing. The release source comments also say the binary is unsigned; SmartScreen/unknown-publisher warnings are a separate signing concern and must not be conflated with UAC elevation.

Next: obtain exact-head full CI and Windows packaging success for this test guard. If the prompt persists on the latest package, compare the installed binary SHA and manifest, then identify the requesting process/parent from Windows-side evidence. Never advise disabling UAC or repeatedly approving prompts.
