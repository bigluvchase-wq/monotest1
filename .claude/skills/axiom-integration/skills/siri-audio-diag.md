
# Siri Audio Diagnostics

Symptom-first fixes for audio apps whose Siri support builds but doesn't play. Most failures are one of four things: the request took a path you didn't build, the entity was never *resolved*, a cold-start process died, or the search didn't survive Siri's phrasing. Paths, the Siri AI / classic Siri split, build order, and testing: `skills/siri-audio.md`. Types and error strings: `skills/siri-audio-ref.md`.

## First: Which Path Did the Request Take?

Siri routes each request to exactly one path, and each path fails differently. Identify it before changing code — a SiriKit fix does nothing for an Apple Intelligence failure.

| Request | Path |
|---|---|
| "Pause", "next", "skip ahead 30 seconds", "play it slower" | `MPRemoteCommandCenter` / NowPlaying commands |
| "What song is this?" (about *your* playback) | `MPNowPlayingInfoCenter` / NowPlaying metadata |
| "Play X in AppName" — **Siri AI** | `AudioSearch` `IntentValueQuery` → `playAudio` schema intent |
| "Play X in AppName" — **classic Siri** (iOS 26, no Apple Intelligence, AI off, watchOS/tvOS) | SiriKit `INPlayMediaIntent` handler |
| An App Shortcut phrase | `AppShortcutsProvider` (its own Siri opt-in) |

"Next track works but play this album fails" is consistent with the two taking different paths. It says nothing about whether SiriKit authorization was granted, or whether authorization is the cause.

## Symptoms

### Build fails, but no schema errors are listed

The schema check is the `ExtractAppIntentsMetadata` phase, which only runs after Swift compiles. Any Swift error — even unrelated — means no schema errors at all. Fix every Swift error, rebuild, then read `appintentsmetadataprocessor` output. "Exit 65 with no schema errors" never means "shapes are fine".

### `At least one halting error was produced during export, so no AppIntents metadata have been exported`

None of your App Intents reach the system — not just the audio ones. Read the error lines above it and map each with the table in `siri-audio-ref.md`.

### Classic Siri: "AppName hasn't added support for that with Siri"

The SiriKit path isn't wired. Check in order:
1. `INIntentsSupported` includes `INPlayMediaIntent`, and `INSupportedMediaCategories` lists at least one category.
2. The Siri capability (`com.apple.developer.siri`) is on the app target.
3. `application(_:handlerFor:)` returns your handler — and the app **supports multiple scenes**; on iOS the system calls that delegate method only in multi-scene apps.
4. `NSSiriUsageDescription` exists and the user granted authorization (`INPreferences.siriAuthorizationStatus()`). The system remembers the answer and repeat requests don't re-prompt; only Settings reverses a denial.

Observed in the iOS 27 simulator before a handler existed: the request failed with `AUDIO#intentNotSupportedByApp`.

### Siri AI: "I can't play that" after a green build

Registration succeeded; resolution didn't. Siri must turn the request into one of your entities *before* `playAudio` runs.

1. **No `AudioSearch` query.** Device log (process `intelligenceflowd`): `[ResolveQueryExecutor] … 'Expected query of type IntentValueQuery that accepts provided input value' against MediaIntents.AudioSearchEntity`. Add `IntentValueQuery` with `values(for: AudioSearch) -> [AudioItem]` — Apple: `playAudio` and that query form the playback use-case group; "adopt both parts".
2. **The query runs but returns nothing.** Log the criteria you receive. `.searchQuery` text can include "play …" and "… in AppName" — apply the search ladder in `skills/siri-audio.md` (Build Order 3). `.unspecified` must return something.
3. **Stale or legacy-format Spotlight index.** Observed on device: with an index left over from older Core Spotlight code, Siri wouldn't engage the app even though the query returned results. Rebuild the index through `indexAppEntities`, purging the old items by domain identifier (`deleteSearchableItems(withDomainIdentifiers:)`) — never `deleteAllSearchableItems`, which also deletes every donated `INPlayMediaIntent` interaction. Confirm with Settings → Developer → CoreSpotlight Testing.
4. **The process died first** — see the cold-start symptoms below.

### "I can't find the artist X in AppName" / AppIntentsTesting `LNPerformQueryErrorDomain 10002`

The entity's `defaultQuery` is a plain `EntityQuery`, so it can't be searched by name. Key on the message, "Type does not support EntityStringQuery" — the same code 10002 also comes from `allEntities()` on a non-`EnumerableEntityQuery`. Make it an `EntityStringQuery` with `entities(matching:)`. To confirm in metadata: the query's `capabilities` in `Metadata.appintents/extract.actionsdata` changes from 66 to 70.

### Siri lists the app, then nothing happens — or it works only when the app is already open

Cold start. Siri launches a process for the query and intent, possibly with no window.
- **Torn down mid-request.** Observed in one app on device (iOS 27.0): with `playAudio` in background mode, processes launched cold ended before `values(for:)` returned, and Siri said "I can't play that". Pinning `supportedModes` to `.foreground` fixed it there, at the cost of bringing the app forward. Apple's sample sets no `supportedModes`. Fix cold-start latency first; pin `.foreground` only if teardown persists, and then test from the Lock Screen and AirPods.
- **Crash on first query.** Observed: a query that reached the database through a main-thread-only accessor trapped (`EXC_BREAKPOINT`) before any window existed. Start services lazily from the intent/query and make them safe off the main thread.

Repro: kill the app, then ask Siri.

### Duplicate results in Siri or Spotlight

Two entity types for the same content — typically your pre-27 base entities plus the new schema entities — are both indexed. Core Spotlight doesn't deduplicate across types. Index one set; resolve the other through queries.

### Pause/next/what's-playing don't work

Not a SiriKit or App Intents problem. Check that the commands are registered, enabled, and that Now Playing metadata is published while you're the active player (axiom-media (skills/now-playing.md)). Siri reports a graceful error for commands you don't register.

### An App Shortcut phrase falls through to a web or Maps result, but tapping the shortcut works

The per-app App Shortcuts Siri opt-in was declined — a consent separate from SiriKit that `siriAuthorizationStatus()` doesn't report. See `skills/app-shortcuts-ref.md` (Test Siri Invocation).

### A schema `perform()` crashes with large entities

iOS 27 release notes (181763422, under Resolved Issues) describe a 10 MB cumulative limit per `AppEntity`, child properties included, with a logged crash when exceeded. Don't embed artwork or full track lists in entity properties — use identifiers and fetch on demand.

## Testing Traps

Observed in one app's UI-test suite:

- `XCUIDevice.shared.siriService.activate(voiceRecognitionText:)` blocked about 60 s on iPadOS 27.2 even though Siri ran the request — don't treat the timeout as failure; assert on your app's own playback state.
- A Siri answer left on screen replayed into the next request. Press Home between requests.
- Right after installing a build, Siri re-indexes your actions and requests found nothing; a 30-second wait before the first Siri request was enough.
- AppIntentsTesting needs iOS 27. Observed: linking it into a UI-test bundle that also runs on iOS 26.5 kept the whole bundle from loading there, weak-linked or not — keep those tests in an iOS 27-only bundle.

## Resources

**WWDC**: 2026-343, 2026-240, 2020-10060

**Docs**: /mediaintents/responding-to-audio-search-and-playback-requests, /sirikit/requesting-authorization-to-use-siri, /sirikit/dispatching-intents-to-handlers, /appintentstesting

**Skills**: skills/siri-audio.md, skills/siri-audio-ref.md, skills/app-shortcuts-ref.md, axiom-media (skills/now-playing.md)
