# Apple Documentation Research

## When to Use

- The answer isn't in the guides and diagnostics Xcode bundles (the `axiom-apple-docs` router covers those), and you need Apple's full API reference or a WWDC session
- You need an API's exact declaration, availability, or documented behavior
- You need the reasoning and recommended patterns behind an API, which WWDC sessions explain

**Not for**: third-party frameworks, or questions an Axiom skill already answers (load that skill first).

## Pick the Source

| You need | Source | Why |
|---|---|---|
| Exact declaration and availability for the SDK you build with | The installed SDK's `.swiftinterface` files and Objective-C headers | Version-exact, offline, and it is what the compiler sees |
| Apple's documented behavior, discussion, and examples | sosumi.ai, a markdown mirror of developer.apple.com | Fetchable as markdown; developer.apple.com pages render with JavaScript |
| Why an API exists, recommended patterns, migration advice | A WWDC session transcript | Apple engineers explain intent and trade-offs |
| A complete working project | The session's Resources links or Apple's sample code page | Transcripts describe code; samples contain it |

Search every module, not just the one you import (`glassEffect` lives in `SwiftUICore`, not `SwiftUI`):

```bash
SDK=$(xcrun --sdk iphoneos --show-sdk-path)   # Command Line Tools only: --sdk macosx
grep -n 'func glassEffect' "$SDK"/System/Library/Frameworks/*.framework/Modules/*.swiftmodule/*.swiftinterface \
  "$SDK"/usr/lib/swift/*.swiftmodule/*.swiftinterface
grep -n '@interface MKGeocodingRequest' "$SDK"/System/Library/Frameworks/*.framework/Headers/*.h
```

All three before concluding an API doesn't exist: stdlib, concurrency, Observation, Synchronization and Swift overlays live in `usr/lib/swift` (`Mutex`, `withObservationTracking`); much of UIKit/AppKit/MapKit/Foundation exists only as ObjC headers (`MKGeocodingRequest` is in no `.swiftinterface`).

## Apple Documentation via sosumi.ai

Replace `developer.apple.com` with `sosumi.ai` in any documentation URL:

```
https://developer.apple.com/documentation/widgetkit/widget
https://sosumi.ai/documentation/widgetkit/widget
```

Path: lowercase, no spaces/hyphens (`appintents`, not `app-intents`); nested paths work (`corelocation/clmonitor`). Fetch with your harness's web-fetch tool. 404 → try the parent path (not every page is mirrored).

## WWDC Session Transcripts

Pages: `developer.apple.com/videos/play/wwdcYYYY/NNNNN/` — **Transcript** tab (timestamped speech), **Code** tab (snippets with timestamps) when the session shows code.

1. Xcode MCP `DocumentationSearch` in your tool list? Try it first: searches Apple docs + WWDC transcripts, no browser (`axiom-xcode-mcp (skills/xcode-mcp-tools.md)`). Not in every Xcode build.
2. Else open the page in a JS-rendering browser tool, headed, with its own persistent profile. Plain fetch → navigation only; headless/scripted clients often redirect to the year index — a bot guard, not an unpublished session.
3. Read the Transcript tab; Code tab for snippets.
4. Never take over the user's browser window or quit their browser.

**Can't render?** Tell the user the transcript wasn't retrieved; ask them to paste or open it. Never describe a session from memory.

**No Transcript tab** (some newer tech talks)? English captions are in the stream:
1. MP4 link on the page (`…/downloads/<name>_sd.mp4`) → everything before `/downloads/` = stream base.
2. `<base>/cmaf.m3u8` → subtitles entry with `LANGUAGE="en"` → playlist (e.g. `subtitles/en/prog_index.m3u8`).
3. Fetch every WebVTT segment; drop cues repeated across segment boundaries.

**Transcripts are speech, not code**: every API name heard is a lead → confirm in the SDK or on sosumi.ai before coding.

## Workflows

| Goal | Steps |
|---|---|
| Answer an API question | SDK interface for the declaration → sosumi.ai for behavior → a WWDC session for intent and patterns |
| Research a new feature | Find the sessions (the year's WWDC video index) → read transcripts and Code tabs → confirm each API and its availability in the SDK |
| Trace an API across releases | Read one session per year → record what changed in which OS version → check deprecations in the SDK interface |

## Anti-Patterns

| Don't | Why | Instead |
|---|---|---|
| Write an API from memory or a transcript without checking | Names and signatures change between betas and releases | Confirm it in the SDK interface or headers, or on sosumi.ai |

## Resources

**Skills**: axiom-apple-docs, axiom-xcode-mcp (skills/xcode-mcp-tools.md)
