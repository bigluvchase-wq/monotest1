
# Now Playing Integration Guide

**Purpose**: Prevent the 4 most common Now Playing issues on iOS 18+: info not appearing, commands not working, artwork problems, and state sync issues

**Swift Version**: Swift 6.0+
**iOS Version**: iOS 18+
**Xcode**: Xcode 16+

## Core Philosophy

> "Now Playing eligibility requires THREE things working together: AVAudioSession activation, remote command handlers, and metadata publishing. Missing ANY of these silently breaks the entire system. Most Now Playing issues stem from incorrect activation order or missing command handlers, not API bugs."

**Key Insight from WWDC 2022/110338**: Apps must meet two system heuristics:
1. Register handlers for at least one remote command
2. Configure AVAudioSession with a non-mixable category

## When to Use This Skill

✅ **Use this skill when**:
- Now Playing info doesn't appear on Lock Screen or Control Center
- Play/pause/skip buttons are grayed out or don't respond
- Album artwork is missing, wrong, or flickers between images
- Animated lock-screen artwork (iOS 26+) not appearing — see Pattern 8
- Control Center shows "Playing" when app is paused, or vice versa
- Apple Music or other apps "steal" Now Playing status
- Implementing Now Playing for the first time
- Debugging Now Playing issues in existing implementation
- Integrating CarPlay Now Playing (covered in Pattern 6)
- Working with MusicKit/Apple Music content (covered in Pattern 7)

❌ **Do NOT use this skill for**:
- Background audio configuration details (see AVFoundation skill)

### iOS 26 Note

iOS 26 introduces **Liquid Glass visual design** for Lock Screen and Control Center Now Playing widgets. This is **automatic system behavior** — no code changes required. The patterns in this skill remain valid for iOS 26.

### NowPlaying framework `OS27`

The 27 releases add a Swift-native **NowPlaying framework** (`import NowPlaying`) — an `@Observable`, command-declarative alternative to the dictionary- and target-based MediaPlayer APIs (`MPNowPlayingInfoCenter` + `MPRemoteCommandCenter`) that Patterns 2–8 teach. Pattern 1 (audio session, `audio` background mode) applies to both. For a new 27+ app, use it — see [NowPlaying Framework (Modern, Swift-Native)](#nowplaying-framework-modern-swift-native-os27), including its rule against mixing the two.

## Related Skills

- **swift-concurrency** - For @MainActor patterns, weak self in closures, async artwork loading
- **memory-debugging** - For retain cycles in command handlers
- **avfoundation-ref** - For AVAudioSession configuration details
- **system-media-routing** - Media Sharing Extensions (AVSystemRouting): playing to non-AirPlay devices through the system device picker

---

## Red Flags / Anti-Patterns

**If you see ANY of these, suspect Now Playing misconfiguration:**

- Info appears briefly then disappears (AVAudioSession deactivated)
- Commands work in simulator but not on device (simulator has different audio stack)
- Artwork shows placeholder then updates (race condition, not necessarily wrong)
- Artwork never appears (format/size issue)
- Play/pause state incorrect after backgrounding (not updating on playback rate changes)
- Another app "steals" Now Playing (didn't meet eligibility requirements)
- `playbackState` property doesn't update (available on iOS 13+ but only *applies* on macOS; use playbackRate on iOS!)

**FORBIDDEN Assumptions:**
- "Just set nowPlayingInfo and it works" - Must have AVAudioSession + command handlers
- "playbackState controls Control Center" - iOS ignores playbackState, uses playbackRate
- "Artwork just needs an image" - Needs proper MPMediaItemArtwork with size handler
- "You must set isEnabled = true or the command stays disabled" - A registered target is enabled by default; only set isEnabled when you intend to *dim* a command
- "Update elapsed time every second" - System infers from rate, causes jitter

## Mandatory First Steps (Pre-Diagnosis)

Run this code to understand current state before debugging:

```swift
// 1. Verify AVAudioSession configuration
let session = AVAudioSession.sharedInstance()
print("Category: \(session.category.rawValue)")
print("Mode: \(session.mode.rawValue)")
print("Options: \(session.categoryOptions)")
print("Is active: \(try? session.setActive(true))")
// Must be: .playback category, NOT .mixWithOthers option

// 2. Verify background mode
// Info.plist must have: UIBackgroundModes = ["audio"]

// 3. Check command handlers are registered
let commandCenter = MPRemoteCommandCenter.shared()
print("Play enabled: \(commandCenter.playCommand.isEnabled)")
print("Pause enabled: \(commandCenter.pauseCommand.isEnabled)")
// Must have at least one command with a registered target (isEnabled defaults to true)

// 4. Check nowPlayingInfo dictionary
if let info = MPNowPlayingInfoCenter.default().nowPlayingInfo {
    print("Title: \(info[MPMediaItemPropertyTitle] ?? "nil")")
    print("Artwork: \(info[MPMediaItemPropertyArtwork] != nil)")
    print("Duration: \(info[MPMediaItemPropertyPlaybackDuration] ?? "nil")")
    print("Elapsed: \(info[MPNowPlayingInfoPropertyElapsedPlaybackTime] ?? "nil")")
    print("Rate: \(info[MPNowPlayingInfoPropertyPlaybackRate] ?? "nil")")
} else {
    print("No nowPlayingInfo set!")
}
```

**What this tells you:**

| Observation | Diagnosis | Pattern |
|-------------|-----------|---------|
| Category is .ambient or has .mixWithOthers | Won't become Now Playing app | Pattern 1 |
| No commands have targets | System ignores app | Pattern 2 |
| Commands have targets but isEnabled = false | UI grayed out | Pattern 2 |
| Artwork is nil | MPMediaItemPropertyArtwork never set (or set to a UIImage) | Pattern 3 |
| Animated artwork key set but iOS 26 lock screen still shows static | Key not in `supportedAnimatedArtworkKeys` (silently disregarded) | Pattern 8 |
| playbackRate is 0.0 when playing | Control Center shows paused | Pattern 4 |
| Background mode "audio" not in Info.plist | Info disappears on lock | Pattern 1 |

## Decision Tree

```
Starting fresh with a 27+ deployment target?
└─ Use the NowPlaying framework (jump to "NowPlaying Framework" section); still do Pattern 1. The rest of this tree is the MediaPlayer path

Now Playing not working? (MediaPlayer path — MPNowPlayingInfoCenter / MPRemoteCommandCenter)
├─ Info never appears at all?
│  ├─ AVAudioSession category .ambient or .mixWithOthers?
│  │  └─ Pattern 1a (Wrong Category)
│  ├─ No remote command handlers registered?
│  │  └─ Pattern 2a (Missing Handlers)
│  ├─ Background mode "audio" not in Info.plist?
│  │  └─ Pattern 1b (Background Mode)
│  └─ AVAudioSession.setActive(true) never called?
│     └─ Pattern 1c (Not Activated)
│
├─ Info appears briefly, then disappears?
│  ├─ On lock screen specifically?
│  │  ├─ AVAudioSession deactivated too early?
│  │  │  └─ Pattern 1d (Early Deactivation)
│  │  └─ App suspended (no background mode)?
│  │     └─ Pattern 1b (Background Mode)
│  └─ When switching apps?
│     └─ Another app claiming Now Playing → Pattern 5
│
├─ Commands not responding?
│  ├─ Buttons grayed out (disabled)?
│  │  └─ command.isEnabled = false → Pattern 2b
│  ├─ Buttons visible but no response?
│  │  ├─ Handler not returning .success?
│  │  │  └─ Pattern 2c (Handler Return)
│  │  └─ Using wrong command center (session vs shared)?
│  │     └─ Pattern 2d (Command Center)
│  └─ Skip buttons show 10s instead of your interval?
│     └─ preferredIntervals left at its [10] default → Pattern 2 (Symptom 3)
│
├─ Artwork problems?
│  ├─ Never appears?
│  │  ├─ MPMediaItemPropertyArtwork key missing?
│  │  │  └─ Pattern 3a (Artwork Block)
│  │  └─ Image format/size invalid?
│  │     └─ Pattern 3b (Image Format)
│  ├─ Wrong artwork showing?
│  │  └─ Race condition between sources → Pattern 3c
│  ├─ Artwork flickering?
│  │  └─ Multiple updates in rapid succession → Pattern 3d
│  └─ Animated artwork not appearing on iOS 26 lock screen?
│     └─ Missing capability gate or wrong aspect ratio → Pattern 8
│
├─ State sync issues?
│  ├─ Shows "Playing" when paused?
│  │  └─ playbackRate not updated → Pattern 4a
│  ├─ Progress bar stuck or jumping?
│  │  └─ elapsedTime not updated at right moments → Pattern 4b
│  └─ Duration wrong?
│     └─ Not setting playbackDuration → Pattern 4c
│
├─ CarPlay specific issues?
│  ├─ App doesn't appear in CarPlay at all?
│  │  └─ Missing entitlement → Pattern 6 (Add com.apple.developer.carplay-audio)
│  ├─ Now Playing blank in CarPlay but works on iOS?
│  │  └─ Same root cause as iOS → Check Patterns 1-4
│  ├─ Custom buttons don't appear in CarPlay?
│  │  └─ Wrong configuration timing → Pattern 6 (Configure at templateApplicationScene)
│  └─ Works on device but not CarPlay simulator?
│     └─ Debugger interference → Pattern 6 (Run without debugger)
│
└─ Using MusicKit (ApplicationMusicPlayer)?
   ├─ Now Playing shows wrong info?
   │  └─ Overwriting automatic data → Pattern 7 (Don't set nowPlayingInfo manually)
   └─ Mixing MusicKit + own content?
      └─ Hybrid approach needed → Pattern 7 (Switch between players)
```

---

## Pattern 1: AVAudioSession Configuration (Info Not Appearing)

**Time cost**: 10-15 minutes

### Symptom
- Now Playing info never appears on Lock Screen
- Info appears briefly then disappears on lock
- Works in foreground, disappears in background

### BAD Code

```swift
// ❌ WRONG — Category allows mixing, won't become Now Playing app
class PlayerService {
    func setupAudioSession() throws {
        try AVAudioSession.sharedInstance().setCategory(
            .playback,
            options: .mixWithOthers  // ❌ Mixable = not eligible for Now Playing
        )
        // Never called setActive()  // ❌ Session not activated
    }

    func play() {
        player.play()
        updateNowPlaying()  // ❌ Won't appear - session not active
    }
}
```

### GOOD Code

```swift
// ✅ CORRECT — Non-mixable category, activated before playback
class PlayerService {
    func setupAudioSession() throws {
        try AVAudioSession.sharedInstance().setCategory(
            .playback,
            mode: .default,
            options: []  // ✅ No .mixWithOthers = eligible for Now Playing
        )
    }

    func play() async throws {
        // ✅ Activate BEFORE starting playback
        try AVAudioSession.sharedInstance().setActive(true)

        player.play()
        updateNowPlaying()  // ✅ Now appears correctly
    }

    func stop() async throws {
        player.pause()

        // ✅ Deactivate AFTER stopping, with notify option
        try AVAudioSession.sharedInstance().setActive(
            false,
            options: .notifyOthersOnDeactivation
        )
    }
}
```

### Info.plist Requirement

```xml
<key>UIBackgroundModes</key>
<array>
    <string>audio</string>
</array>
```

### Verification
- Lock screen shows Now Playing controls
- Info persists when app backgrounded
- Survives app switch (unless another app plays)

---

## Pattern 2: Remote Command Registration (Commands Not Working)

**Time cost**: 15-20 minutes

### Symptom
- Play/pause buttons grayed out
- Buttons visible but tapping does nothing
- Skip buttons don't appear, or show 10s instead of your interval
- Commands work once then stop

### BAD Code

```swift
// ❌ WRONG — Incomplete command registration
class PlayerService {
    func setupCommands() {
        let commandCenter = MPRemoteCommandCenter.shared()

        // ❌ Returned target discarded — MPRemoteCommandCenter does not retain it
        commandCenter.playCommand.addTarget { _ in
            self.player.play()
            return .success
        }

        // ❌ Never added pause handler

        commandCenter.skipForwardCommand.addTarget { _ in
            return .success
        }
    }
}
```

### GOOD Code

```swift
// ✅ CORRECT — Targets registered, with proper configuration
@MainActor
class PlayerService {
    private var commandTargets: [Any] = []  // Keep strong references

    func setupCommands() {
        let commandCenter = MPRemoteCommandCenter.shared()

        // ✅ Play command
        let playTarget = commandCenter.playCommand.addTarget { [weak self] _ in
            self?.player.play()
            self?.updateNowPlayingPlaybackState(isPlaying: true)
            return .success
        }
        commandTargets.append(playTarget)

        // ✅ Pause command
        let pauseTarget = commandCenter.pauseCommand.addTarget { [weak self] _ in
            self?.player.pause()
            self?.updateNowPlayingPlaybackState(isPlaying: false)
            return .success
        }
        commandTargets.append(pauseTarget)

        // ✅ Skip forward - set preferredIntervals BEFORE adding target
        commandCenter.skipForwardCommand.preferredIntervals = [15.0]
        let skipForwardTarget = commandCenter.skipForwardCommand.addTarget { [weak self] event in
            guard let skipEvent = event as? MPSkipIntervalCommandEvent else {
                return .commandFailed
            }
            self?.skip(by: skipEvent.interval)
            return .success
        }
        commandTargets.append(skipForwardTarget)

        // ✅ Skip backward
        commandCenter.skipBackwardCommand.preferredIntervals = [15.0]
        let skipBackwardTarget = commandCenter.skipBackwardCommand.addTarget { [weak self] event in
            guard let skipEvent = event as? MPSkipIntervalCommandEvent else {
                return .commandFailed
            }
            self?.skip(by: -skipEvent.interval)
            return .success
        }
        commandTargets.append(skipBackwardTarget)
    }

    // Teardown happens here: a `deinit` is nonisolated, so the removal cannot live
    // in a MainActor-isolated method. Removing the targets needs no isolation, and
    // the retained targets are released with `commandTargets` either way.
    deinit {
        let commandCenter = MPRemoteCommandCenter.shared()
        commandCenter.playCommand.removeTarget(nil)
        commandCenter.pauseCommand.removeTarget(nil)
        commandCenter.skipForwardCommand.removeTarget(nil)
        commandCenter.skipBackwardCommand.removeTarget(nil)
    }
}
```

### Verification
- Buttons not grayed out in Control Center
- Tapping play/pause actually plays/pauses
- Skip buttons show with correct interval (15s)

---

## Pattern 3: Artwork Configuration (Artwork Problems)

**Time cost**: 15-25 minutes

### Symptom
- Artwork never appears (generic placeholder)
- Wrong artwork for current track
- Artwork flickers between images
- Artwork appears then disappears

### BAD Code

```swift
// ❌ WRONG — Storing a UIImage directly, and a block that reads stored state
func updateNowPlaying() {
    var nowPlayingInfo = [String: Any]()
    nowPlayingInfo[MPMediaItemPropertyTitle] = track.title

    // ❌ Storing UIImage directly (doesn't work)
    nowPlayingInfo[MPMediaItemPropertyArtwork] = image

    // ❌ Or: Block that reads stored state off the main thread
    let artwork = MPMediaItemArtwork(boundsSize: image.size) { _ in
        return self.cachedImage  // ❌ Reads a stored property, not a captured value
    }

    MPNowPlayingInfoCenter.default().nowPlayingInfo = nowPlayingInfo
}

// ❌ WRONG — Multiple rapid updates cause flickering
func loadArtwork(from url: URL) {
    // Request 1
    loadImage(url) { image in
        self.updateNowPlayingArtwork(image)  // Update 1
    }
    // Request 2 (cached) returns faster
    loadCachedImage(url) { image in
        self.updateNowPlayingArtwork(image)  // Update 2 - flicker!
    }
}
```

### GOOD Code

```swift
// ✅ CORRECT — Proper MPMediaItemArtwork with value capture (Swift 6 compliant)
@MainActor
class NowPlayingService {
    private var currentArtworkURL: URL?

    func updateNowPlayingArtwork(_ image: UIImage, for trackURL: URL) {
        // ✅ Prevent race conditions - only update if still current track
        guard trackURL == currentArtworkURL else { return }

        // ✅ @Sendable + VALUE CAPTURE. Without @Sendable, this closure inherits
        // @MainActor from the class, and Swift 6 traps at its entry when the
        // system calls it off the main thread — whatever the body reads
        let artwork = MPMediaItemArtwork(boundsSize: image.size) { @Sendable [image] requestedSize in
            // ✅ System calls this block from any thread; the captured
            // UIImage is immutable, so reading it there is safe
            return image
        }

        // ✅ Update only artwork key, preserve other values
        var nowPlayingInfo = MPNowPlayingInfoCenter.default().nowPlayingInfo ?? [:]
        nowPlayingInfo[MPMediaItemPropertyArtwork] = artwork
        MPNowPlayingInfoCenter.default().nowPlayingInfo = nowPlayingInfo
    }

    // ✅ Single entry point with priority: embedded > cached > remote
    func loadArtwork(for track: Track) async {
        currentArtworkURL = track.artworkURL

        // Priority 1: Embedded in file (immediate, no flicker)
        if let embedded = await extractEmbeddedArtwork(track.fileURL) {
            updateNowPlayingArtwork(embedded, for: track.artworkURL)
            return
        }

        // Priority 2: Already cached (fast)
        if let cached = await loadFromCache(track.artworkURL) {
            updateNowPlayingArtwork(cached, for: track.artworkURL)
            return
        }

        // Priority 3: Remote (slow, but don't flicker)
        // ✅ Set placeholder first, then update once with real image
        if let remote = await downloadImage(track.artworkURL) {
            updateNowPlayingArtwork(remote, for: track.artworkURL)
        }
    }
}
```

**Why `@Sendable` and a value capture**: The request handler is imported without `@Sendable`, so a closure written inside a `@MainActor` type inherits `@MainActor` — and Swift 6 inserts a runtime check at its entry. The system calls the handler off the main thread, so it traps there no matter what the body reads, and nothing warns at compile time. Marking the closure `@Sendable` makes it nonisolated, which removes the trap. Then capture the `UIImage` value (immutable, safe to read from any thread) instead of reading `self`: a `@MainActor` property read from the `@Sendable` closure is only a warning here, and at runtime it's an unsynchronized cross-thread read. The value capture is also cleaner than `nonisolated(unsafe)`.

### Artwork Size Guidelines
- Lock Screen: the system passes the size it needs to your `MPMediaItemArtwork` request handler — return the image that most closely fits it
- Control Center: Various sizes

### Verification
- Artwork appears on Lock Screen
- Correct artwork for current track
- No flickering when track changes
- Artwork persists after backgrounding

**For iOS 26+ animated artwork** (full-screen Lock Screen video), see Pattern 8. Always set `MPMediaItemPropertyArtwork` (this pattern) alongside the animated keys so iOS 18-25 users still see static artwork.

---

## Pattern 4: Playback State Synchronization (State Sync Issues)

**Time cost**: 10-20 minutes

### Symptom
- Control Center shows "Playing" when actually paused
- Progress bar doesn't move or jumps unexpectedly
- Duration shows wrong value
- Scrubbing doesn't work correctly

### BAD Code

```swift
// ❌ WRONG — Using playbackState (macOS only, ignored on iOS)
func updatePlaybackState(isPlaying: Bool) {
    MPNowPlayingInfoCenter.default().playbackState = isPlaying ? .playing : .paused
    // ❌ iOS ignores this property! Only macOS uses it.
}

// ❌ WRONG — Updating elapsed time on a timer (causes drift)
Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { _ in
    var info = MPNowPlayingInfoCenter.default().nowPlayingInfo ?? [:]
    info[MPNowPlayingInfoPropertyElapsedPlaybackTime] = self.player.currentTime().seconds
    MPNowPlayingInfoCenter.default().nowPlayingInfo = info
    // ❌ Every second creates jitter, system already infers from timestamp
}

// ❌ WRONG — Partial dictionary updates cause race conditions
func updateTitle() {
    var info = [String: Any]()
    info[MPMediaItemPropertyTitle] = track.title
    MPNowPlayingInfoCenter.default().nowPlayingInfo = info
    // ❌ Cleared all other values (artwork, duration, etc.)!
}
```

### GOOD Code

```swift
// ✅ CORRECT — Use playbackRate for iOS, update at key moments only
@MainActor
class NowPlayingService {

    // ✅ Update when playback STARTS
    func playbackStarted(track: Track, player: AVPlayer) {
        var nowPlayingInfo = MPNowPlayingInfoCenter.default().nowPlayingInfo ?? [:]

        // ✅ Core metadata
        nowPlayingInfo[MPMediaItemPropertyTitle] = track.title
        nowPlayingInfo[MPMediaItemPropertyArtist] = track.artist
        nowPlayingInfo[MPMediaItemPropertyAlbumTitle] = track.album
        nowPlayingInfo[MPMediaItemPropertyPlaybackDuration] = player.currentItem?.duration.seconds ?? 0

        // ✅ Playback state via RATE (not playbackState property)
        nowPlayingInfo[MPNowPlayingInfoPropertyElapsedPlaybackTime] = player.currentTime().seconds
        nowPlayingInfo[MPNowPlayingInfoPropertyPlaybackRate] = 1.0  // Playing

        MPNowPlayingInfoCenter.default().nowPlayingInfo = nowPlayingInfo
    }

    // ✅ Update when playback PAUSES
    func playbackPaused(player: AVPlayer) {
        var nowPlayingInfo = MPNowPlayingInfoCenter.default().nowPlayingInfo ?? [:]

        // ✅ Update elapsed time AND rate together
        nowPlayingInfo[MPNowPlayingInfoPropertyElapsedPlaybackTime] = player.currentTime().seconds
        nowPlayingInfo[MPNowPlayingInfoPropertyPlaybackRate] = 0.0  // Paused

        MPNowPlayingInfoCenter.default().nowPlayingInfo = nowPlayingInfo
    }

    // ✅ Update when user SEEKS
    func userSeeked(to time: CMTime, player: AVPlayer) {
        var nowPlayingInfo = MPNowPlayingInfoCenter.default().nowPlayingInfo ?? [:]

        nowPlayingInfo[MPNowPlayingInfoPropertyElapsedPlaybackTime] = time.seconds
        // ✅ Keep current rate (don't change playing/paused state)

        MPNowPlayingInfoCenter.default().nowPlayingInfo = nowPlayingInfo
    }

    // ✅ Update when track CHANGES
    func trackChanged(to newTrack: Track, player: AVPlayer) {
        // ✅ Full refresh of all metadata
        var nowPlayingInfo = [String: Any]()

        nowPlayingInfo[MPMediaItemPropertyTitle] = newTrack.title
        nowPlayingInfo[MPMediaItemPropertyArtist] = newTrack.artist
        nowPlayingInfo[MPMediaItemPropertyAlbumTitle] = newTrack.album
        nowPlayingInfo[MPMediaItemPropertyPlaybackDuration] = player.currentItem?.duration.seconds ?? 0
        nowPlayingInfo[MPNowPlayingInfoPropertyElapsedPlaybackTime] = 0.0
        nowPlayingInfo[MPNowPlayingInfoPropertyPlaybackRate] = player.rate

        MPNowPlayingInfoCenter.default().nowPlayingInfo = nowPlayingInfo

        // Then load artwork asynchronously
        Task {
            await loadArtwork(for: newTrack)
        }
    }
}
```

### When to Update Now Playing Info

| Event | What to Update |
|-------|---------------|
| Playback starts | All metadata + elapsed=current + rate=1.0 |
| Playback pauses | elapsed=current + rate=0.0 |
| User seeks | elapsed=newPosition (keep rate) |
| Track changes | All metadata (new track) |
| Playback rate changes (2x, 0.5x) | rate=newRate |

### DO NOT Update
- On a timer (system infers from elapsed + rate + timestamp)
- Elapsed time continuously (causes jitter)
- Partial dictionaries (loses other values)

---

## Pattern 5: MPNowPlayingSession (iOS 16+ Recommended Approach)

**Time cost**: 20-30 minutes

### When to Use MPNowPlayingSession
- iOS 16+ (available since iOS 16, previously tvOS only)
- Using AVPlayer for playback
- Want automatic publishing of playback state
- Multiple players (Picture-in-Picture scenarios)

### BAD Code (Manual Approach - More Error-Prone)

```swift
// ❌ Manual updates are error-prone, easy to miss state changes
class OldStylePlayer {
    func play() {
        player.play()
        // Must remember to:
        updateNowPlayingElapsed()
        updateNowPlayingRate()
        // Easy to forget one...
    }
}
```

### GOOD Code (MPNowPlayingSession)

```swift
// ✅ CORRECT — MPNowPlayingSession handles automatic publishing
@MainActor
class ModernPlayerService {
    private var player: AVPlayer
    private var session: MPNowPlayingSession?

    init() {
        player = AVPlayer()
        setupSession()
    }

    func setupSession() {
        // ✅ Create session with player
        session = MPNowPlayingSession(players: [player])

        // ✅ Enable automatic publishing of:
        // - Duration
        // - Elapsed time
        // - Playback state (rate)
        // - Playback progress
        session?.automaticallyPublishesNowPlayingInfo = true

        // ✅ Register commands on SESSION's command center (not shared)
        session?.remoteCommandCenter.playCommand.addTarget { [weak self] _ in
            self?.player.play()
            return .success
        }

        session?.remoteCommandCenter.pauseCommand.addTarget { [weak self] _ in
            self?.player.pause()
            return .success
        }

        // ✅ Try to become active Now Playing session
        session?.becomeActiveIfPossible { success in
            print("Became active Now Playing: \(success)")
        }
    }

    func play(track: Track) async {
        let item = AVPlayerItem(url: track.url)

        // ✅ Set static metadata on player item (title, artwork)
        item.nowPlayingInfo = [
            MPMediaItemPropertyTitle: track.title,
            MPMediaItemPropertyArtist: track.artist,
            MPMediaItemPropertyArtwork: await createArtwork(for: track)
        ]

        player.replaceCurrentItem(with: item)
        player.play()
        // ✅ No need to manually update elapsed time, rate, duration
        // MPNowPlayingSession publishes automatically!
    }
}
```

### Multiple Sessions (Picture-in-Picture)

```swift
class MultiPlayerService {
    var mainSession: MPNowPlayingSession
    var pipSession: MPNowPlayingSession

    func pipDidExpand() {
        // ✅ Promote PiP session when it expands to full screen
        pipSession.becomeActiveIfPossible { success in
            // PiP now controls Lock Screen, Control Center
        }
    }

    func pipDidMinimize() {
        // ✅ Demote back to main session
        mainSession.becomeActiveIfPossible { success in
            // Main player now controls Lock Screen, Control Center
        }
    }
}
```

### Critical Gotcha

**When using MPNowPlayingSession**: Use `session.remoteCommandCenter`, NOT `MPRemoteCommandCenter.shared()`

```swift
// ❌ WRONG
let commandCenter = MPRemoteCommandCenter.shared()
commandCenter.playCommand.addTarget { _ in }

// ✅ CORRECT
session.remoteCommandCenter.playCommand.addTarget { _ in }
```

---

## Pattern 6: CarPlay Integration

For CarPlay-specific integration patterns, see `skills/now-playing-carplay.md`.

**Key insight**: CarPlay uses the SAME MPNowPlayingInfoCenter and MPRemoteCommandCenter as iOS. If your Now Playing works on iOS, it works in CarPlay with zero additional code.

---

## Pattern 7: MusicKit Integration (Apple Music)

For MusicKit-specific integration patterns and hybrid app examples, see `skills/now-playing-musickit.md`.

**Key insight**: MusicKit's ApplicationMusicPlayer automatically publishes to MPNowPlayingInfoCenter. You don't need to manually update Now Playing info when playing Apple Music content.

---

## Pressure Scenarios

### Scenario 1: Apple Music Keeps Taking Over (24-Hour Launch Deadline)

#### Situation
- App launching tomorrow
- QA reports: "Now Playing works, but when user opens Apple Music then returns to our app, our controls disappear"
- Product manager: "This is a blocker, users will think our app is broken"
- You're 2 hours from code freeze

#### Rationalization Traps (DO NOT)
1. *"Just tell users not to use Apple Music"* - Unacceptable UX, will get 1-star reviews
2. *"Force our app to always be Now Playing"* - Impossible, system controls eligibility
3. *"File a bug with Apple"* - Won't help before launch

#### Root Cause
Your app loses eligibility because:
- Using `.mixWithOthers` option (allows other apps to play simultaneously)
- Not calling `becomeActiveIfPossible()` when returning to foreground
- AVAudioSession deactivated when backgrounded

#### Systematic Fix (30 minutes)

```swift
// 1. Remove mixWithOthers
try AVAudioSession.sharedInstance().setCategory(.playback, options: [])

// 2. Reactivate when returning to foreground
NotificationCenter.default.addObserver(
    forName: UIApplication.willEnterForegroundNotification,
    object: nil,
    queue: .main
) { [weak self] _ in
    MainActor.assumeIsolated {  // queue: .main delivers on the main thread
        guard self?.isPlaying == true else { return }
        do {
            try AVAudioSession.sharedInstance().setActive(true)
            self?.session?.becomeActiveIfPossible { _ in }
        } catch {
            print("Failed to reactivate audio session: \(error)")
        }
    }
}

// 3. Handle interruptions (phone call, Siri)
// InterruptionType and InterruptionOptions are deprecated in iOS 27; an app targeting 27 observes
// AVAudioSession.DidBecomeInactiveMessage and ResumptionRecommendationMessage (see avfoundation-ref).
NotificationCenter.default.addObserver(
    forName: AVAudioSession.interruptionNotification,
    object: nil,
    queue: .main
) { [weak self] notification in
    guard let info = notification.userInfo,
          let typeValue = info[AVAudioSessionInterruptionTypeKey] as? UInt,
          let type = AVAudioSession.InterruptionType(rawValue: typeValue) else {
        return
    }

    if type == .ended,
       let optionsValue = info[AVAudioSessionInterruptionOptionKey] as? UInt,
       AVAudioSession.InterruptionOptions(rawValue: optionsValue).contains(.shouldResume) {
        // ✅ Reactivate only when the system says playback may resume
        try? AVAudioSession.sharedInstance().setActive(true)
        MainActor.assumeIsolated { self?.session?.becomeActiveIfPossible { _ in } }
    }
}
```

#### Communication Template

```
To PM: Found root cause - our audio session config allowed Apple Music to take over.
Fix implemented: 3 changes to audio session handling.
Testing: Verified fix with Apple Music, Spotify, phone calls.
ETA: 20 more minutes for full regression test.

To QA: Please test this flow:
1. Play audio in our app
2. Open Apple Music, play a song
3. Return to our app, tap play
4. Lock screen should show OUR controls
```

#### Time Saved
- 2-3 hours of debugging speculation
- Launch delay avoided
- QA confidence restored

---

### Scenario 2: Artwork Flickers Every Track Change

#### Situation
- User feedback: "Album art keeps flashing when songs change"
- Analytics show 3-4 artwork updates per track change
- Designer: "This looks unprofessional"

#### Root Cause
Multiple artwork sources racing:
1. Cache check (async)
2. Remote URL fetch (async)
3. Embedded artwork extraction (async)

All three complete at different times, each updating Now Playing

#### Fix (20 minutes)

```swift
// ✅ Single-source-of-truth with cancellation
private var artworkTask: Task<Void, Never>?

func loadArtwork(for track: Track) {
    // Cancel previous artwork load
    artworkTask?.cancel()

    artworkTask = Task { @MainActor in
        // Clear previous artwork immediately (optional)
        // updateNowPlayingArtwork(nil)

        // Wait for best available artwork
        let artwork = await loadBestArtwork(for: track)

        // Check if still current track
        guard !Task.isCancelled else { return }

        // Single update
        updateNowPlayingArtwork(artwork, for: track.artworkURL)
    }
}

private func loadBestArtwork(for track: Track) async -> UIImage? {
    // Priority order: embedded > cached > remote
    if let embedded = await extractEmbeddedArtwork(track) {
        return embedded
    }
    if let cached = await loadFromCache(track.artworkURL) {
        return cached
    }
    return await downloadImage(track.artworkURL)
}
```

#### Communication Template

```
To Designer: Fixed artwork flicker - reduced from 3-4 updates to 1 per track.
Root cause: Multiple async sources racing to update artwork.
Solution: Task cancellation + priority order (embedded > cached > remote).
Testing: Verified with 10 track changes, zero flicker.
```

#### Time Saved
- 1-2 hours investigating image caching
- Designer approval unblocked
- Professional UX restored

---

## Common Gotchas

| Symptom | Cause | Solution | Time to Fix |
|---------|-------|----------|-------------|
| Info never appears | Missing background mode | Add `audio` to UIBackgroundModes in Info.plist | 2 min |
| Info never appears | AVAudioSession not activated | Call `setActive(true)` before playback | 5 min |
| Info never appears | No command handlers | Add target to at least one command | 10 min |
| Info never appears | Using `.mixWithOthers` | Remove .mixWithOthers option | 5 min |
| Commands grayed out | `isEnabled` explicitly set to `false` | Set `command.isEnabled = true` (registering a target enables it by default) | 5 min |
| Commands don't respond | Handler returns wrong status | Return `.success` from handler | 5 min |
| Commands don't respond | Using shared command center with MPNowPlayingSession | Use `session.remoteCommandCenter` instead | 10 min |
| Skip buttons show 10s instead of your interval | `preferredIntervals` left at its `[10]` default | Set `skipCommand.preferredIntervals = [15.0]` | 5 min |
| Artwork never appears | `MPMediaItemPropertyArtwork` key not set | Set it to an `MPMediaItemArtwork` | 15 min |
| Artwork flickers | Multiple rapid updates | Single source of truth with cancellation | 20 min |
| Wrong play/pause state | Using `playbackState` property | Use `playbackRate` (1.0 = playing, 0.0 = paused) | 10 min |
| Progress bar stuck | Not updating on seek | Update `elapsedPlaybackTime` after seek completes | 10 min |
| Progress bar jumps | Updating elapsed on timer | Don't update on timer; system infers from rate | 10 min |
| Loses Now Playing to other apps | Session not reactivated on foreground | Call `becomeActiveIfPossible()` on foreground | 15 min |
| `playbackState` doesn't work | iOS-only app | `playbackState` applies on macOS only; use `playbackRate` on iOS | 10 min |
| Siri skip ignores preferredIntervals | Hardcoded interval in handler | Use `event.interval` from MPSkipIntervalCommandEvent | 5 min |
| **CarPlay**: App doesn't appear | Missing entitlement | Add `com.apple.developer.carplay-audio` to entitlements | 5 min |
| **CarPlay**: Custom buttons don't appear | Configured at wrong time | Configure at `templateApplicationScene(_:didConnect:)` | 5 min |
| **CarPlay**: Works on device, not simulator | Debugger attached | Run without debugger for reliable testing | 1 min |
| **MusicKit**: Now Playing wrong | Overwriting automatic data | Don't set `nowPlayingInfo` when using ApplicationMusicPlayer | 5 min |
| **NowPlaying** `OS27`: erratic metadata or commands | A `MediaSession` alongside `MPNowPlayingInfoCenter`/`MPRemoteCommandCenter` calls — undefined behavior per Apple | One API per process for local playback; delete the MediaPlayer calls on the 27 path | 15 min |

---

## Expert Checklist

MediaPlayer path. On the NowPlaying path, Before Implementing, AVAudioSession Setup and Testing apply; skip Remote Commands, Now Playing Info and Artwork, and never add those MediaPlayer calls alongside a `MediaSession`.

### Before Implementing Now Playing
- [ ] Added `audio` to UIBackgroundModes in Info.plist
- [ ] AVAudioSession category is `.playback` without `.mixWithOthers`
- [ ] Decided: NowPlaying framework (27+), Manual (MPNowPlayingInfoCenter), or Automatic (MPNowPlayingSession)?

### AVAudioSession Setup
- [ ] `setCategory(.playback)` called at app launch
- [ ] `setActive(true)` called before playback starts
- [ ] `setActive(false, options: .notifyOthersOnDeactivation)` on stop
- [ ] Interruption notification handled (reactivate after phone call)
- [ ] Foreground notification handled (reactivate after background)

### Remote Commands
- [ ] At least one command has target registered
- [ ] No registered command is disabled (`isEnabled = false`)
- [ ] Skip commands have `preferredIntervals` set
- [ ] Handlers return `.success` on success
- [ ] Using correct command center (session's vs shared)
- [ ] Command targets stored to prevent deallocation
- [ ] Commands removed in deinit

### Now Playing Info
- [ ] Title set (`MPMediaItemPropertyTitle`)
- [ ] Duration set (`MPMediaItemPropertyPlaybackDuration`)
- [ ] Elapsed time set at play/pause/seek (`MPNowPlayingInfoPropertyElapsedPlaybackTime`)
- [ ] Playback rate set (`MPNowPlayingInfoPropertyPlaybackRate`: 1.0 = playing, 0.0 = paused)
- [ ] Artwork created with `MPMediaItemArtwork(boundsSize:requestHandler:)`
- [ ] NOT using `playbackState` property (applies on macOS only)
- [ ] NOT updating elapsed time on a timer

### Artwork
- [ ] MPMediaItemPropertyArtwork set to an MPMediaItemArtwork
- [ ] Single source of truth prevents flickering
- [ ] Previous artwork load cancelled on track change

### Testing
- [ ] Lock screen shows correct info
- [ ] Control Center shows correct info
- [ ] Play/pause buttons respond
- [ ] Skip buttons show and respond
- [ ] Progress bar moves correctly
- [ ] Survives app background/foreground
- [ ] Survives phone call interruption
- [ ] Survives other app playing audio
- [ ] Tested with Apple Music conflict
- [ ] Tested with Spotify conflict

### CarPlay (if applicable)
- [ ] Added `com.apple.developer.carplay-audio` entitlement
- [ ] CPNowPlayingTemplate configured at `templateApplicationScene(_:didConnect:)`
- [ ] Custom buttons (if any) configured with CPNowPlayingButton
- [ ] Tested in a CarPlay simulator: Xcode Simulator's I/O → External Displays → CarPlay (Xcode 26 and earlier), or CarPlay Simulator with an iPhone (Xcode 27)
- [ ] Tested in real vehicle (if available)
- [ ] Tested both with and without debugger attached

---

## Pattern 8: Animated Artwork (iOS 26+)

**Time cost**: 20-40 minutes

iOS 26 introduces full-screen animated Lock Screen artwork via `MPMediaItemAnimatedArtwork`. Apple opened this API to all third-party audio apps — music, audiobooks, podcasts, anything with motion-friendly cover art.

### Symptom
- Animated artwork doesn't appear on iOS 26 Lock Screen — falls back to static
- Animated keys set but seemingly ignored
- New artwork doesn't update when track changes
- Animated artwork loads then disappears
- Crashes on iOS 18-25 (referencing iOS 26-only symbols)

### BAD Code

```swift
// ❌ WRONG — Setting animated keys without capability check (silently ignored)
nowPlayingInfo[MPNowPlayingInfoProperty1x1AnimatedArtwork] = animatedArtwork
nowPlayingInfo[MPNowPlayingInfoProperty3x4AnimatedArtwork] = animatedArtwork  // ❌ Same instance, wrong aspect ratio

// ❌ WRONG — Using a fresh artworkID for the same artwork (forces re-download)
let artwork = MPMediaItemAnimatedArtwork(
    artworkID: UUID().uuidString,  // ❌ Different every time → system can't dedupe
    previewImageRequestHandler: { _ in await loadPreview() },
    videoAssetFileURLRequestHandler: { _ in await downloadVideo() }
)

// ❌ WRONG — Pre-downloading video unconditionally (wasted bandwidth)
Task {
    let videoURL = await downloadFromCDN(track.animatedArtworkURL)  // ❌ Downloads even if artwork never viewed
    cachedVideoURL = videoURL
}

// ❌ WRONG — Returning a remote URL (must be local file URL)
let artwork = MPMediaItemAnimatedArtwork(
    artworkID: track.animatedID,
    previewImageRequestHandler: { size in await loadImage(size) },
    videoAssetFileURLRequestHandler: { _ in
        URL(string: "https://cdn.example.com/animated.mp4")  // ❌ System rejects remote URLs
    }
)

// ❌ WRONG — Dropping static artwork when adding animated (breaks iOS 18-25)
nowPlayingInfo.removeValue(forKey: MPMediaItemPropertyArtwork)
nowPlayingInfo[MPNowPlayingInfoProperty1x1AnimatedArtwork] = animatedArtwork  // ❌ iOS 18-25 now show no artwork
```

### GOOD Code

```swift
// ✅ CORRECT — Capability-gated, ID-stable, lazy-loaded, with static fallback
@MainActor
class AnimatedArtworkService {

    func updateNowPlaying(for track: Track, staticImage: UIImage) {
        var nowPlayingInfo = MPNowPlayingInfoCenter.default().nowPlayingInfo ?? [:]

        // Always set static artwork — backward compat for iOS 18-25
        // and the system fallback when animation is suppressed (low power, Reduce Motion, etc.)
        // @Sendable: the system calls this off the main thread (Pattern 3)
        let staticArtwork = MPMediaItemArtwork(boundsSize: staticImage.size) { @Sendable [staticImage] _ in
            staticImage
        }
        nowPlayingInfo[MPMediaItemPropertyArtwork] = staticArtwork

        // iOS 26+ animated artwork — gated on platform support
        if #available(iOS 26.0, macOS 26.0, tvOS 26.0, visionOS 26.0, watchOS 26.0, *) {
            let supported = MPNowPlayingInfoCenter.supportedAnimatedArtworkKeys

            // ✅ Use album-stable ID, NOT track-unique — same animation across album songs
            let artworkID = "album:\(track.albumID)"

            if supported.contains(MPNowPlayingInfoProperty1x1AnimatedArtwork) {
                nowPlayingInfo[MPNowPlayingInfoProperty1x1AnimatedArtwork] =
                    makeAnimatedArtwork(artworkID: artworkID, aspect: .square, track: track)
            }
            if supported.contains(MPNowPlayingInfoProperty3x4AnimatedArtwork) {
                nowPlayingInfo[MPNowPlayingInfoProperty3x4AnimatedArtwork] =
                    makeAnimatedArtwork(artworkID: artworkID, aspect: .tall, track: track)
            }
        }

        MPNowPlayingInfoCenter.default().nowPlayingInfo = nowPlayingInfo
    }

    @available(iOS 26.0, *)
    private func makeAnimatedArtwork(
        artworkID: String,
        aspect: ArtworkAspect,
        track: Track
    ) -> MPMediaItemAnimatedArtwork {
        // ✅ Async closures with VALUE CAPTURE — Swift 6 strict concurrency safe
        // ✅ System only invokes these when artwork is actually being viewed
        let albumID = track.albumID
        let aspectRatio = aspect

        return MPMediaItemAnimatedArtwork(
            artworkID: artworkID,
            previewImageRequestHandler: { [weak self] requestedSize in
                // First-frame still — return synchronously when possible.
                guard let self else { return nil }
                return await self.loadPreviewImage(albumID: albumID, aspect: aspectRatio, size: requestedSize)
            },
            videoAssetFileURLRequestHandler: { [weak self] requestedSize in
                // ✅ Local file URL only — download to disk first, then return file URL
                guard let self else { return nil }
                return await self.localVideoURL(albumID: albumID, aspect: aspectRatio, size: requestedSize)
            }
        )
    }
}

enum ArtworkAspect { case square, tall }
```

### Why This Pattern

**`artworkID` is the cache key.** The system uses it to detect changes — keep it stable for the same artwork (e.g., `"album:\(albumID)"` for all songs on an album). A new ID forces the system to re-request both preview and video. A `UUID()` per call defeats caching entirely.

**`supportedAnimatedArtworkKeys` is mandatory.** Apple's docs are explicit: "If you specify an instance of animated artwork … using any key not in this collection it will be ignored." Don't assume both 1:1 and 3:4 are accepted on every platform — watchOS or tvOS may only accept one (or none).

**Lazy loading is the contract.** The system invokes the request handlers only when the artwork is being viewed. Don't pre-download video assets unconditionally — Apple specifically warns: "Avoid performing expensive network requests for video assets in advance, as the system may ultimately not request the asset."

**Local file URLs only.** The video handler must return a `file://` URL on disk. Download to a cache directory first, then return that path. URLs must remain valid for the lifetime of the `MPMediaItemAnimatedArtwork` in your `nowPlayingInfo` — invalidate them only when you replace or remove the artwork.

**Always set static `MPMediaItemPropertyArtwork` too.** The system falls back to the preview image (and to your static `MPMediaItemArtwork`) under several conditions: low-power mode, low-data mode, high thermal level, Reduce Motion enabled, or Auto-Play Animated Images turned off. Plus iOS 18-25 users see only the static artwork.

### Asset Recommendations

| Constraint | Why |
|------------|-----|
| Aspect ratio matches the key (1:1 or 3:4) | System won't crop/letterbox to fit |
| Frame rate ≤60 fps | Higher frame rates may not display |
| Loop length <30 seconds | Apple recommends short, seamless loops |
| Loops without visible jump or fade | Avoid noticeable seams when video repeats |
| Any local asset playable by `AVPlayerLayer` | No file size limit, but format must be playable |
| Animated content is an extension of static artwork | Apple's design guidance — match brand identity |
| Video is complementary to the playing media | Don't ship unrelated content (ads, branding splashes) |

### When Animation Is Suppressed (System Falls Back to Preview)

The system shows the **preview image** (not the video) under these conditions — your preview image must be presentable on its own:

- Low-power mode
- Low-data mode
- High thermal state
- Reduce Motion accessibility setting enabled
- Auto-Play Animated Images setting disabled

### Three Initializer Forms

```swift
// Async/UIKit (iOS, iPadOS, tvOS, visionOS, watchOS, Mac Catalyst)
convenience init(
    artworkID: String,
    previewImageRequestHandler: (CGSize) async -> UIImage?,
    videoAssetFileURLRequestHandler: (CGSize) async -> URL?
)

// Async/AppKit (macOS native)
convenience init(
    artworkID: String,
    previewImageRequestHandler: (CGSize) async -> NSImage?,
    videoAssetFileURLRequestHandler: (CGSize) async -> URL?
)

// Designated initializer with completion handlers (legacy interop)
init(
    artworkID: String,
    previewImageRequestHandler: (CGSize, (UIImage?) -> Void) -> Void,
    videoAssetFileURLRequestHandler: (CGSize, (URL?) -> Void) -> Void
)
```

Prefer the async forms unless you're bridging callback-based code.

### Verification

- Run on iOS 26+ device or simulator (animated APIs are no-ops on older OS)
- Confirm `MPNowPlayingInfoCenter.supportedAnimatedArtworkKeys` includes the keys you set
- Lock the device — animated artwork plays full-screen behind Liquid Glass platter
- Toggle Settings → Accessibility → Motion → Auto-Play Animated Images off — preview image should appear
- Enable Low Power Mode — preview image should appear
- Verify static `MPMediaItemPropertyArtwork` still appears on an iOS 18 device (backward compat)
- Switch tracks within the same album → no re-download (same `artworkID`)
- Switch albums → re-request fires (different `artworkID`)

---

## NowPlaying Framework (Modern, Swift-Native) `OS27`

`import NowPlaying` is a Swift-native alternative to the manual MediaPlayer work — building an `MPNowPlayingInfoCenter.nowPlayingInfo` dictionary by hand and registering per-command handlers on `MPRemoteCommandCenter` (Patterns 2–4). Pattern 1 still applies: `.playback` audio session and the `audio` background mode. Instead, your `@Observable` player model conforms to `MediaSessionRepresentable`, you hand it to a `MediaSession`, and the system **observes the model** — every Now Playing surface stays in sync automatically, with no manual refresh calls: Lock Screen, Control Center, Dynamic Island, StandBy, CarPlay, AirPlay-capable accessories, Apple Watch, and Now Playing on Apple TV and Vision Pro.

**One API per process for local playback.** Apple's framework overview: "Don't mix the Now Playing framework with the `MPNowPlayingInfoCenter` and `MPRemoteCommandCenter` APIs from the Media Player framework for local playback. Doing so results in undefined behavior." Migrate the whole local path at once — a leftover `nowPlayingInfo` write, or an `MPRemoteCommandCenter` target added "just for CarPlay" or "just for Siri", is mixing; NowPlaying sessions already reach CarPlay and Apple Watch. Apple scopes the rule to local playback, not remote sessions. `ApplicationMusicPlayer` publishes Now Playing from a system process, outside your code, and Apple states no rule for running it beside a `MediaSession`; keep one publisher active at a time — the handoff in now-playing-musickit.md, with `session = nil` in place of clearing `nowPlayingInfo` while Apple Music plays.

Local path: all platforms. Remote path: iOS and iPadOS apps plus their extension — not Mac Catalyst.

### Local playback (the common case)

```swift
import AVFoundation
import NowPlaying
import Observation

@available(anyAppleOS 27, *)
@Observable @MainActor
final class PlayerModel: MediaSessionRepresentable {
    let id = "main-player"
    var nowPlaying: Track?
    var isPlaying = false
    var hasNextTrack = false
    var repeatMode: MediaCommand.RepeatMode = .off
    var elapsed: TimeInterval = 0
    var elapsedSampledAt: Date = .now
    var session: MediaSession<PlayerModel>?

    var content: (any MediaContentRepresentable)? {
        guard let track = nowPlaying else { return nil }
        var music = MusicContent(
            id: track.id,
            songTitle: track.title,
            artistName: track.artist,
            albumName: track.album,
            type: .audio,
            duration: .finite(track.duration),      // or .live for live broadcasts
            artwork: Artwork(id: track.artworkID) { size in   // same id = same cached image
                try ArtworkRepresentation(data: await track.artworkData(for: size))
            }
        )
        music.isrc = track.isrc                     // drives Music Haptics
        return music
    }

    // Elapsed time + the wall-clock moment it was sampled. The system extrapolates between
    // snapshots, so change these on play/pause/seek/track change, not on every tick.
    var playbackSnapshot: MediaPlaybackSnapshot? {
        MediaPlaybackSnapshot(state: isPlaying ? .playing() : .paused,
                              elapsedTime: elapsed, timestamp: elapsedSampledAt)
    }

    // Declarative commands — each is an async-throwing closure the system invokes.
    var commands: [MediaCommand] {
        [
            .play { [weak self] in self?.resume() },
            .pause { [weak self] in self?.pause() },
            .next { [weak self] in self?.skipNext() }.enabled(hasNextTrack),
            .previous { [weak self] in self?.skipPrevious() },
            .seekToPosition { [weak self] position in self?.seek(to: position) },
            .changeRepeatMode(current: repeatMode) { [weak self] mode in self?.setRepeat(mode) },
        ]
    }

    // Configure audio BEFORE requesting primacy. Setting `session` to nil unpublishes it.
    func startPublishing() async throws {
        #if os(watchOS)
        // Background audio on watchOS needs .longFormAudio + activate(options:), never setActive(true) —
        // activation can present a route picker and fails if the user cancels.
        let audio = AVAudioSession.sharedInstance()
        try audio.setCategory(.playback, mode: .default, policy: .longFormAudio)
        guard try await audio.activate(options: []) else { return }
        #elseif !os(macOS)
        let audio = AVAudioSession.sharedInstance()
        try audio.setCategory(.playback, mode: .default)
        try audio.setActive(true)
        #endif
        let session = MediaSession(self)            // observes this model; no manual updates
        self.session = session
        try await session.requestToBecomeApplicationPrimary()
    }

    func stopPublishing() throws {
        session = nil
        #if !os(macOS)
        try AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        #endif
    }
}
```

Key shapes:
- **`MediaSessionRepresentable`** (`@MainActor`) requires exactly four members: `id`, `content`, `playbackSnapshot`, `commands`.
- **`MediaPlaybackSnapshot(state:defaultPlaybackRate:elapsedTime:timestamp:)`** — all but `state` default (`1.0`, `nil`, `nil`). For `.finite` content pass `elapsedTime` plus the `timestamp` it was sampled at, so the system can extrapolate the position; for `.continuous`/`.live` content `state` alone is enough. `PlaybackState`: `.playing(rate:)` (`rate` defaults to `1.0`, so `.playing()` is normal speed); `.paused` (halted, resumable); `.buffering` (delayed while loading); `.stopped` (nothing loaded, or playback ended completely); `.interrupted` (a call or alarm interrupted playback — resuming afterwards is your job). `rate` is the actual speed (e.g. during fast-forward); `defaultPlaybackRate` is the baseline the player returns to. Documented preconditions: a `.playing(rate:)` rate must be finite and non-zero, and `defaultPlaybackRate` finite and > 0 — so never pass a paused `AVPlayer.rate` (0) into `.playing(rate:)`.
- **`MediaDuration`**: `.finite(TimeInterval)`; `.live` (a live broadcast or stream); `.continuous` (no defined end and not live — a soundscape, a looping recording, a generated stream). The `duration:` parameter is `MediaDuration?`; pass `nil` when unknown.
- **Content types** — pick the one matching the media; each init also has an overload adding `animatedArtwork:`. Fill in every field you have: accessories differ in what they show.

| Type | For | Init (defaults) |
|---|---|---|
| `MusicContent` | songs, albums, playlists | `(id:songTitle:artistName:albumName:type:duration:artwork:)` |
| `PodcastContent` | episodes | `(id:episodeTitle:showName:releaseDate:type:duration:artwork:)` — `releaseDate: Date?` has no default |
| `BookContent` | audiobooks, spoken word | `(id:title:authorName:narratorName:type:duration:artwork:)` — `narratorName` `nil`, `type` `.audio` |
| `MovieContent` | films, documentaries | `(id:title:duration:artwork:)` — no `type:`; always video |
| `TVShowContent` | series episodes | `(id:episodeTitle:showName:duration:artwork:)` — no `type:`; always video |
| `RadioContent` | stations, live streams | `(id:stationName:programName:type:duration:artwork:)` — `programName` `nil`, `type` `.audio`, `duration` `.live` |
| `HomeMediaContent` | camera feeds, baby monitors, ambient soundscapes | `(id:sourceName:contentDescription:type:duration:artwork:)` |
| `GenericContent` | anything else | `(id:title:subtitle:type:duration:artwork:)` — `subtitle` `nil` |

- **Optional metadata** — settable `var`s on every content type, assigned after init: `isExplicit`, `isExcludedFromSuggestions` (default `false`), `genre`. `MusicContent` adds `composer` and `isrc`; `BookContent` adds `chapter: (current: Int, total: Int)?`. There is no `isExplicit:` init parameter, no metadata trailing closure, and no `collectionID` or `serviceID` property.
- **`MediaCommand`** factories: `.play`, `.pause`, `.stop`, `.togglePlayPause`, `.next`, `.previous`, `.skipForward(preferredIntervals:)`, `.skipBackward(preferredIntervals:)` (both default `[10]`), `.seekToPosition`, `.seekForward(beginAction:endAction:)`, `.seekBackward(…)`, `.changePlaybackRate(supported:)`, `.changeRepeatMode(current:supported:)`, `.changeShuffleMode(current:supported:)`, `.feedback(title:shortTitle:status:)` (`title` and `shortTitle` default to `nil`, `status` to `.neutral`). Semantics worth knowing:
  - `skipForward`/`skipBackward` closures receive the interval the user chose — use it, not a hard-coded value ("skip ahead 30 seconds" from Siri).
  - `seekForward`/`seekBackward` pair a `beginAction` (press-and-hold starts) with an `endAction` (release) — start and stop your rate change or scrub there.
  - `changePlaybackRate(supported:)` lists the rates your player can play; the closure receives the chosen one.
  - `changeRepeatMode`/`changeShuffleMode`: `supported: nil` means all modes. Repeat `.one` repeats the item, `.all` the container; shuffle `.items` shuffles songs, `.collections` shuffles albums while keeping each album's order.

  Chain `.enabled(_:)` to make one unavailable from state (no next track, no skipping during an ad) — a disabled command still appears in the interface; the system just doesn't invoke its handler.
- **`Artwork(id:artworkProvider:)`** — lazy `@Sendable (CGSize) async throws -> ArtworkRepresentation`, so capture Sendable values or `await` a `@MainActor` model, never a plain non-Sendable class; build it with `ArtworkRepresentation(data:)` (throws `.noRepresentationAvailable` for undecodable or unsupported data) or `(cgImage:)` (also `throws`). The `id` is the system's cache key — keep it stable per image, not per track. Return the requested size when you can; one dimension may differ when your image's aspect ratio does, so don't crop or pad to match, and when the request exceeds your largest asset, return that asset rather than upscaling.
- **`AnimatedArtwork(id:supportedAspectRatios:preview:video:)`** — `preview` is `@Sendable (CGSize, AspectRatio) async throws -> ArtworkRepresentation`, `video` is `@Sendable (CGSize, AspectRatio) async throws -> URL`. `supportedAspectRatios` defaults to `[.square]` (1:1; the other is `.tall`, 3:4; `AnimatedArtwork.compatibleAspectRatios` lists what the device accepts). Provide at least one ratio — the system requests a preview and a video for each. Use it only when the item has a matching animated asset, such as motion album art. Attach it via the content init's `animatedArtwork:` overload, which requires a non-optional `artwork:`.

### Session lifecycle and primacy

- **`MediaSession`** is `@MainActor`, conforms to `Observable`, and is **unavailable in iOS app extensions**. Publish = create it + `requestToBecomeApplicationPrimary()`; unpublish = drop your last reference (set it to `nil`). There is no `end()` for local sessions. `MediaSession` retains its representable strongly, so a model that stores its own session forms a cycle — call `stopPublishing()` (or set `session = nil`) before discarding the model; dropping the model alone keeps both alive.
- **Multiple sessions** — one app can run several (say a music player and a podcast player); each observes its own representable. `requestToBecomeApplicationPrimary()` picks which one represents the app; `canBecomeApplicationPrimary` reports whether it can. Observe `isApplicationPrimary` (and, on iOS/iPadOS/Mac Catalyst, `isSystemPrimary`) to reflect primacy in your UI.
- **`requestToBecomeSystemPrimary()`** (iOS, iPadOS and Mac Catalyst apps; not extensions) requests Lock Screen / Control Center display and also makes the session app-primary; display is not guaranteed. **Your app must be in the foreground — from the background the request has no effect.** Not needed for ordinary local playback. The system-primary session should be the one your UI is prominently showing — call it when the user focuses one of several sessions, or to take over from another app.
- **Errors** — `MediaSessionError`: `.invalidState` (session can't become primary), `.sessionInvalidated`, `.internalFailure`.

### Remote / server-driven playback (iOS and iPadOS)

For apps that control playback happening on **another device** (a speaker, TV, or cast target), NowPlaying provides a push-driven app-extension model so the system surfaces stay live even when your app isn't running. This publishes Now Playing for playback you already drive over your own connection; sending playback to a Chromecast or DLNA device through the system picker is system-media-routing.md.

- Your attributes type conforms to **`RemoteMediaSessionAttributes`** (Codable) and is shared by app and extension; the app encodes it, the extension decodes it. Keep it to the fields you need — it is also the push payload. `id` must be stable and unique: the system matches start/update/end events and routes push tokens by it. From the app: `RemoteMediaSession.start(attributes:)`, `.update(_:)` (throws `.invalidAttributes` if `attributes.id` doesn't match the session), `.end()`, `.sessions()`, `.requestToBecomeSystemPrimary()` (foreground-only, as above). Errors: `RemoteMediaSessionError.invalidAttributes` / `.internalFailure`; `start` also rethrows the encoding error when the attributes fail to encode.
- A `@main` type conforming to **`RemoteMediaSessionExtension`** (an `ExtensionFoundation.AppExtension`) returns `RemoteMediaSessionExtensionConfiguration(extension: self)` from `var configuration: RemoteMediaSessionExtensionConfiguration<Self>` and implements `func session(_ attributes:) async throws -> Session`, where `Session` is your `RemoteMediaSessionRepresentable` type. Its `Info.plist` needs `EXAppExtensionAttributes` → `EXExtensionPointIdentifier` = `com.apple.nowplaying.remote-media`; the code alternative is `var extensionPoint: AppExtensionPoint { AppExtensionPoint.Identifier(host: "com.apple.nowplaying", name: "remote-media") }`. The extension handles the commands the system routes to the device — each command closure forwards to your server or device. The framework caches the sessions you return and routes later updates and commands to the same instance — open a backend connection once and reuse it.
- The **`RemoteMediaSessionRepresentable`** (`@MainActor`, like the local protocol) has the four local members plus `func update(_ attributes:)` — called with new attributes from a push or from the app's `update(_:)`; fold them into your `@Observable` state — and `var devices: [MediaDevice]` (`[]` when no device is actively playing).
- **`MediaDevice(id:name:type:capabilities:)`** advertises volume via `.absoluteVolume(_:onChange:)` (0.0–1.0) or `.relativeVolume(onIncrement:onDecrement:)`; pass `[]` for none. `id` must be stable across sessions and launches (a serial number or hardware address). `type` picks the icon the system shows. `name`: non-empty, ≤250 chars, starts alphanumeric, ends alphanumeric or `.`, otherwise only alphanumerics, whitespace, and `' - , & # .` — no emoji or SF Symbols. `DeviceType`: `.speaker`, `.tv`, `.phone`, `.tablet`, `.wearable`, `.desktop`, `.laptop`, `.setTopBox`, `.mediaStick`, `.gamingConsole`, `.web`, `.car`; `.speakerGroup` and `.tvAndSpeaker` need iOS 27.2. (`NowPlaying.MediaDevice` is distinct from the separate `MediaDevice.framework`.)

#### Push notifications

Two token kinds, both `Data?` and both rotating — hex-encode each new value, send it to your server over HTTPS, and invalidate the old one. Tokens are device-scoped identifiers: keep them only as long as you deliver updates, under your privacy policy. `pushToStartToken` is `nil` until the system provisions it.

**Known issue (iOS 27 release notes, 186036238):** both token kinds are always provisioned for the **production** APNs environment, even when `aps-environment` is `development`. Apple's workaround: test and validate against the production environment.

| Token | Where to read it | Used for |
|---|---|---|
| Push-to-start | `RemoteMediaSession<Attrs>.pushToStartToken` / `.pushToStartTokenUpdates` (app) | `start` events |
| Per-session update | `pushToken` / `pushTokenUpdates` — supplied by the framework on the representable (don't declare them), observed **inside the extension** | `update` and `end` events |

APNs headers: `apns-push-type: nowplaying`, `apns-topic: <bundle-id>.push-type.nowplaying`. Payload:

```json
{ "aps": { "event": "start", "timestamp": 1773907200, "attributes": { "id": "…" } } }
```

`attributes` is your `RemoteMediaSessionAttributes` as JSON. `start` carries full attributes and wakes the extension, which gets `session(_:)`; `update` calls `update(_:)`; `end` needs only `id`.

### Relationship to the MediaPlayer patterns

`MPNowPlayingInfoCenter`, `MPRemoteCommandCenter`, and `MPNowPlayingSession` carry no deprecation in the 27 SDK, so Patterns 1–8 remain correct for apps that support OS versions before 27 or haven't migrated.

The two are alternatives, never layers. An app that supports both 26 and 27 picks one path at runtime — the 27 branch of an `#available` check publishes through `MediaSession`, the other through Patterns 2–8 — and the 27 branch makes no MediaPlayer Now Playing calls at all.

---

## Siri and Now Playing

Siri drives an audio app through three separate paths; this skill owns two of them.

| Request | Path | Owner |
|---|---|---|
| "Pause", "next track", "skip ahead 30 seconds", "play it slower", "shuffle" | The registered `MPRemoteCommandCenter` / NowPlaying commands — the same handlers as Control Center buttons | this skill |
| "What song / band / album is this?" | Now-playing title / artist / album metadata | this skill |
| "Play X in MyApp", "like this song", "add this to my running playlist" | App Intents Audio schema (Siri AI) or SiriKit `INPlayMediaIntent` (classic Siri) | axiom-integration (skills/siri-audio.md) |

Neither of the first two needs SiriKit authorization. An unregistered command makes Siri explain it isn't supported; a temporarily disabled one (no skipping during an ad) does the same.

**Entity annotations `OS27`** — give Siri the app entities behind what's playing, most specific first, so "play the live version" or "add this to my playlist" resolve against your catalog. Use your Audio-schema entities (the schema intents act on them), never a `TransientAppEntity`, which has no persistent identifier; see axiom-integration (skills/siri-audio-ref.md). `appEntityIdentifiers` is unavailable in app extensions, so remote sessions — built in the `RemoteMediaSessionExtension` — can't carry annotations.

Use the variant that matches the API publishing your session — never both.

```swift
import AppIntents
import MediaPlayer
import NowPlaying

// NowPlaying framework: any MediaContentRepresentable
func annotate(_ content: inout MusicContent, song: SongEntity, artist: ArtistEntity) {
    content.appEntityIdentifiers = [EntityIdentifier(for: song), EntityIdentifier(for: artist)]
}

// MediaPlayer: MPNowPlayingInfoCenter dictionary
func annotate(_ info: inout [String: Any], song: SongEntity, artist: ArtistEntity) {
    info[MPNowPlayingInfoPropertyAppEntityIdentifiers] = [
        EntityIdentifier(for: song), EntityIdentifier(for: artist),
    ].compactMap(MPAppEntityIdentifier.init(entityIdentifier:))
}
```

---

## Resources

**WWDC**: 2022-110338, 2017-251, 2019-501, 2026-312

**Docs**: /nowplaying, /nowplaying/publishing-media-sessions, /nowplaying/publishing-remote-media-sessions, /nowplaying/content-types-and-metadata, /nowplaying/playback-commands, /mediaplayer/mpnowplayinginfocenter, /mediaplayer/mpremotecommandcenter, /mediaplayer/mpnowplayingsession, /mediaplayer/mpmediaitemanimatedartwork, /mediaplayer/providing-animated-artwork-for-media-items

**Skills**: skills/avfoundation-ref.md, skills/now-playing-carplay.md, skills/now-playing-musickit.md, skills/system-media-routing.md
