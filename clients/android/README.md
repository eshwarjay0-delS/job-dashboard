# MarketFit Android

Target artifacts:

- debug/direct-install: `.apk`
- Google Play: `.aab`

The Android host will use the shared TypeScript session core and a native audio/speech layer. It must run without desktop screen sharing.

Default session behavior: Auto Answer ON.

Planned native responsibilities:

- Google/Supabase sign-in
- secure token storage
- foreground microphone service
- speaker diarization / role calibration
- transcript streaming
- MarketFit answer requests
- haptic/background state cues
- device-slot registration
- reconnect/resume after audio interruptions

The first production build should not depend on WebView-only microphone capture.
