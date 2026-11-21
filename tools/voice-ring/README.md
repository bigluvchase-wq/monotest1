# Mono Voice ring integration

A small isolated React root renders the original `voice-ring@0.2.0` canvas inside the existing microphone host. The application itself remains vanilla JS/WKWebView. Speech recognition and the accessible hold button remain owned by Mono.

Build from the repository root:

```sh
npm ci --prefix tools/voice-ring
npm run build --prefix tools/voice-ring
```

Commit the generated `Mono/Web/vendor/voice-ring.js`, source and lockfile, not `node_modules`. No CDN, runtime import or `useMicrophone` capture is used. Package licenses are included in `Mono/Web/vendor-notices.txt` and the compiled bundle.

`SpeechBridge` uses the existing audio tap and emits normalized RMS levels at up to 12 Hz. `native-bridge.js` forwards levels only for the active recognition session. A getter samples them in VoiceRing without React renders per audio buffer. Stale levels expire after 350 ms. States map to idle/listening/processing. Theme follows the current Mono theme. Animation pauses when a dialog opens, the user leaves Home, the document hides or reduced motion is enabled. Page swipe previews copy the canvas pixels; no second animation root is mounted.

If the bundle is unavailable, the original microphone remains functional with its previous appearance. Real-device microphone metering and Swift compilation require the Codemagic/iPhone build; Chromium only validates the bridge and UI states with fixtures.
