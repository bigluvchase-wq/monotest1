
# Siri for Audio Apps

Making "play X in YourApp" work — music, podcasts, audiobooks, radio, ambient sound, news briefs. Two kinds of Siri exist, and each request takes exactly one:

- **Siri AI** — Apple's name for the new Siri in the 27 cycle, built on Apple Intelligence. Needs an Apple Intelligence device with it turned on.
- **Classic Siri** — everything else: iOS 26 and earlier, devices without Apple Intelligence, Apple Intelligence turned off, and watchOS/tvOS (where the Audio schemas don't exist).

| Path | Reached by | You build |
|---|---|---|
| App Intents Audio schema domain `OS27` | Siri AI | schema entities + `IntentValueQuery` over `AudioSearch` + `playAudio` intent |
| SiriKit media | Classic Siri | `INPlayMediaIntent` handler + authorization |
| Now Playing commands | Both, while your app is the current player | `MPRemoteCommandCenter`/NowPlaying commands + now-playing metadata |

Exact types, required members, and every build error: `skills/siri-audio-ref.md`. Symptom → fix: `skills/siri-audio-diag.md`.

## When to Use This Skill

- Adding Siri playback, like/dislike, add-to-library, add-to-playlist, play-next, or identify-nearby-audio (`recognizeAudio`) to an audio app
- Adopting `@AppEntity(schema: .audio.song)` or any `.audio.*` schema
- Siri says "I can't play that", "AppName hasn't added support for that with Siri", or plays from the wrong app
- Deciding whether SiriKit (`INPlayMediaIntent`) is still needed in the 27 cycle — it is

NOT for generic App Intents mechanics (`skills/app-intents-ref.md`), App Shortcuts phrases (`skills/app-shortcuts-ref.md`), or building the player and Now Playing session (axiom-media (skills/now-playing.md)).

## Red Flags — Rationalizations That Ship a Dead Feature

| Thought | Reality |
|---|---|
| "The schema build is green, so Siri works" | Green proves shape, not resolution. Siri also has to *find* the entity before `playAudio` runs — through your Spotlight index, your `EntityStringQuery`, or your `AudioSearch` query. Registration without resolution: Siri lists your app, then says "I can't play that." |
| "No schema errors appeared, so the shapes are fine" | Schema errors come from the metadata phase, which only runs after Swift compiles. One unrelated Swift error hides all of them. |
| "SiriKit is deprecated, skip it" | The 27 cycle deprecated SiriKit Lists/Notes only. Media intents carry no deprecation, and they are the *only* way classic Siri plays your content. |
| "The schema path needs the Siri entitlement and authorization too" | It needs neither — no Siri capability, no `NSSiriUsageDescription`, no `requestSiriAuthorization` (Apple's music sample ships an empty entitlements file). Those belong to the SiriKit path. |
| "`siriAuthorizationStatus()` is `.authorized`, so Siri is set up" | It reports the SiriKit grant only — not Siri AI readiness, and not the separate App Shortcuts opt-in. |
| "Pause and next work, so Siri works" | Those go through `MPRemoteCommandCenter` with no SiriKit or App Intents involvement. "Play X" is a different path entirely. |
| "Siri gives me a clean title in `.searchQuery`" | Observed: the text can still carry Siri's own words ("play Karma Police in AppName"). |
| "Index the schema entities too, for good measure" | If you also keep pre-27 base entities indexed, Spotlight returns both copies — duplicate results. Index one set. |

## Which Paths to Build

1. **Always** — Now Playing commands and metadata (Build Order 1).
2. **Schema path** on iOS, iPadOS, macOS, and visionOS 27. Deployment target below 27: gate every schema type, union, and query with `@available(anyAppleOS 27, *) @available(watchOS, unavailable) @available(tvOS, unavailable)`. `@available(iOS 27.0, *)` alone fails in any target that also builds for macOS, watchOS, or tvOS.
3. **SiriKit media** unless the app is macOS-only (`INPlayMediaIntent` is unavailable on macOS). On watchOS and tvOS it is the *only* path for "play X".

Classic Siri covers every iOS 26 user, every device that can't run Apple Intelligence, and everyone who turned it off. An app shipping only the schema path is silent for all of them.

## Build Order

Each layer is testable before the next. Skipping ahead means debugging resolution and shape at the same time.

### 1. Now Playing commands (both Siris)
Register the commands your player supports — `play`, `pause`, `nextTrack`, `previousTrack`, `changePlaybackPosition`, skip, `changePlaybackRate`, shuffle/repeat — and publish title/artist/album. Siri routes "pause", "skip ahead 30 seconds", "what band is this?" here. Leave unsupported commands unregistered (Siri explains), or disable one while it can't apply. Declare `UIBackgroundModes` `audio` (Apple's music sample does): Siri-started playback often begins in a background launch. axiom-media (skills/now-playing.md).

### 2. Schema entities, each resolvable `OS27`
Adopt only the entity schemas matching content you can play (`song`, `album`, `artist`, `playlist` cover most music apps). Every entity Siri can pass you must be resolvable; `IndexedEntity` satisfies the build, but also give each a `defaultQuery` that is an **`EntityStringQuery`** — that is what lets Siri find "the artist Chevelle" by name. Build until the metadata phase is clean. Deployment target below 27: keep the schema types separate from your existing entities, behind `@available`.

### 3. `AudioSearch` resolution `OS27`
One `IntentValueQuery` with `values(for: AudioSearch) -> [AudioItem]` — Apple calls `playAudio` plus this query the playback "use-case group" and says to adopt both. Handle all three criteria. `.unspecified` ("play AppName", "play something", or a vague query) deserves the most care: generic requests were over half of all SiriKit media traffic when Apple measured it, so return favorites, recents, or the loaded queue — never nothing.

Search the spoken query as given first; only if that finds nothing, strip Siri's own words (a leading "play", a trailing "in AppName" and your alternate app names, then words like "artist"/"band"/"album"). Stripping everything up front over-matches ("The Band" → "The", "Love Song" → "Love").

### 4. `playAudio` `OS27`
Honor `queueLocation` (`nil` replace and play, `.next` insert next, `.tail` append) and `playbackAttributes` (shuffle, repeat). Accept `warmupAudioQueueResult` even if you ignore it; `warmupAudioQueue` (pre-load without starting) is optional — Apple's own sample doesn't implement it.

The schema has no resume or position parameter (SiriKit has `resumePlayback`). Apple documents no path for "continue my audiobook" or "the latest episode of X" — resolve those to the right item in `values(for:)` and resume from your saved position in `perform()`.

### 5. The other intents, as your app supports them `OS27`
`updateAudioAffinity` (like/dislike/unset — no "love"), `addToLibrary`, `addToPlaylist`, `createStation` (from now-playing), `recognizeAudio` (identify nearby audio: needs microphone access and a Live Activity while recording — recognition itself: axiom-media (skills/shazamkit.md)). Adopt only what your app really does; a schema intent that fails at runtime is worse than none.

### 6. Index and context
`IndexedEntity` + `indexAppEntities` for content that is local and bounded (playlists, library); skip types that are huge, server-side, or volatile and let the `AudioSearch` query cover them. Keep the index current (add, update on display-property change, delete). Add `appEntityIdentifiers` to Now Playing content, on-screen annotations, and UI-interaction donations so "play the live version" and "add this to my running playlist" resolve.

### 7. SiriKit media for classic Siri
In-app `INPlayMediaIntentHandling` via `application(_:handlerFor:)` (multi-scene apps only), `INIntentsSupported` + `INSupportedMediaCategories`, the Siri entitlement, `NSSiriUsageDescription`, and an explicit `INPreferences.requestSiriAuthorization` when the user turns the feature on — a place to explain it and handle a denial. Share one search-and-play core between this handler and the `AudioSearch` query so both Siris behave the same.

### 8. Cold start
Siri runs queries and intents in a process that may have no window yet. Reach your database and player through lazily started services that are safe off the main thread; never through a scene, a view model, or a global that assumes the UI launched first. Observed: a query running before any window existed trapped on a main-thread-only database accessor.

## Testing Ladder

Climb in order; each rung isolates a different failure.

1. **Build** — metadata phase clean, zero warnings.
2. **AppIntentsTesting** (iOS 27 only) — `IntentDefinitions(bundleIdentifier:)`, then each entity type's `entities(matching:)` by name. Catches a missing `EntityStringQuery` without Siri.
3. **Unit-test `values(for:)` directly** — `AudioSearch(criteria: .searchQuery("play Karma Police in AppName"))`, `.unspecified`, `.url([...])`. Siri's phrasing is the input your search ladder must survive.
4. **Shortcuts app** — run each intent by hand.
5. **Spotlight** — entities appear; on iOS, reindex from Settings → Developer → CoreSpotlight Testing (per Apple's sample).
6. **Siri, both kinds** — Siri AI on a device; classic Siri (observed to run, and to route to SiriKit, in the iOS 27 simulator). Test with the app running *and* killed, and on a screenless surface such as AirPods, where only the spoken dialog reaches the user.

## Common Mistakes

| Mistake | Cost | Fix |
|---|---|---|
| Schema path only | Silent for every classic-Siri user | Add the SiriKit media handler (Build Order 7) |
| No `AudioSearch` query | "I can't play that" after a green build | Build Order 3 |
| Plain `EntityQuery` defaults | Siri can't find items by name | `EntityStringQuery` |
| `.unspecified` returns `[]` | The most common request does nothing | Return favorites/recents/current queue |
| Assumed SiriKit needs no authorization | Handler never runs | `NSSiriUsageDescription` + `requestSiriAuthorization` |
| Handler in a single-scene app | `application(_:handlerFor:)` is never called | Adopt the scene manifest with multiple-scene support |
| Indexing duplicate entity types | Duplicate Siri/Spotlight results | One indexed set |
| Apple's doc snippets pasted verbatim | `AudioStartingIntent` deprecation warning; warmup result with plain `EntityQuery` fails the build; `AudioSearch` switch without `@unknown default` fails in Swift 6 | Use `skills/siri-audio-ref.md` code |

## Pressure Scenarios

**"Ship the schema adoption now, SiriKit later."** Until then, users on iOS 26 and on devices without Apple Intelligence hear "AppName hasn't added support for that with Siri." The SiriKit handler and the `AudioSearch` query share one search-and-play core; building them together costs little beyond the plist keys and the authorization flow.

**"The build is green and Shortcuts plays the song — call it done."** Shortcuts receives an already-resolved entity; Siri has to *find* it. Run rung 6 with the app killed before claiming Siri support.

## Resources

**WWDC**: 2026-343, 2026-240, 2026-345, 2026-8011, 2020-10060

**Docs**: /appintents/app-schema-domain-audio, /appintents/apple-intelligence-and-siri-ai, /appintents/integrating-your-music-app-with-apple-intelligence, /mediaintents/responding-to-audio-search-and-playback-requests, /sirikit/improving-siri-media-interactions-and-app-selection, /sirikit/requesting-authorization-to-use-siri

**Skills**: skills/siri-audio-ref.md, skills/siri-audio-diag.md, skills/app-intents-ref.md, skills/app-shortcuts-ref.md, axiom-media (skills/now-playing.md), axiom-media (skills/shazamkit.md)
