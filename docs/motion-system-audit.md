# Motion audit — 17 November 2026

## Recovery point

Before any implementation changes, `origin/main` at `59e3ae9` was preserved and pushed as `backup/before-button-dialog-motion-20261117`. No finance schema/data migration or server change is part of this work.

## Findings and corrections

- Entry dialogs had overlapping CSS entrance/prototype-exit ownership; period selection had a second calendar-owned entrance. A single dialog controller now owns standard modal surfaces. No surrogate rectangle, cloned form or page is used.
- Dialogs previously appeared from a fixed position, irrespective of the button. The actual button rectangle now determines translation, scale, direction and contour. Its visibility is restored on exit, interruption or native close.
- Interrupted modal entrances could restart exit from a different opacity. Exit reads the current presentation before cancelling effects; reopening supersedes old completion callbacks. Queued native close events cannot clean up a newly reopened modal.
- Large save effects were used for routine transactions. Expenses/income now persist immediately and show a short receipt, then dismiss. Only creating/editing an obligatory payment requests the existing SwiftUI/Metal wave. Both paths keep haptic feedback and duplicate-save protection; failed persistence leaves the editor usable.
- Repeated 260–680 ms timings were scattered across account selection, charts, calendars and small interactions. Shared roles now control these effects. A redundant `#pageBody` CSS entrance is disabled while route modules own navigation.
- Chart view switching animated `height` every frame. It now establishes final layout once and animates opacity/translation. Button press effects no longer interpolate large shadows. Static shadows, colours and typography are preserved.
- Existing main-tab gesture navigation is intentionally retained following the user's request to restore it. Its values are named tokens rather than silently replaced with a different transition.

## Presets

`MonoMotion` is loaded before app scripts and publishes the same values as CSS variables. `reduced` is a live system preference.

| Role | ms | Use |
| --- | ---: | --- |
| micro | 140 | account label, outgoing reminder, small fades |
| feedback | 180 | receipt, button press, selection feedback |
| small | 220 | local content, numeric changes, reorder |
| modal / sheet / screen | 320 | dialog, account sheet, secondary page |
| exit | 240 | modal, receipt, sheet dismissal |
| settle | 280 | cancelled drag, calendar month feedback |
| complex | 400 | account stack, home layout adjustment |
| chart | 480 | specialised chart surface and SVG morph |
| stagger | 16 | bounded visible content sequencing |
| reduced | 100 | simple fades where movement is removed |
| carousel | 500 | existing reminder paging |
| nav / navExtra | 420 / 120 | existing root-tab gesture settling |

Easing: enter `.22,1,.36,1`; exit `.4,0,.2,1`; screen `.32,.72,0,1`; restrained spring `.34,1.12,.64,1` is available but no bounce is forced onto every component. Gesture interpolation is driven directly by the finger, with easing only on settlement. Timeouts controlling notice lifetime, speech recognition and native capture are protocol/reading times, not motion tokens.

## Ownership inventory

| Surface | Owner / policy |
| --- | --- |
| Standard button dialogs, period picker | `dialog-motion.js`: source morph, content fade, cancellable exit |
| Account bottom sheet | `home-account-picker.js`: translate, live swipe, immediate backdrop blur removal |
| Account stack | `account-stack.js`: FLIP and cancelled prior selection effects |
| Main tabs and swipe navigation | `page-motion.js`, `gestures.js`: original mechanism retained |
| Menu detail pages | `menu-motion.js`: single route transition |
| Home reminder → list | `home-reminder-motion.js`: live-surface fades; no resizing reminder clone or automatic scroll |
| Inline calendars | `calendar-motion.js`: fixed original surface, content reveal, sibling FLIP; no duplicate period entrance |
| Chart, month selection, dismiss gesture | `chart-detail.js`, `chart-period-ui.js`, `chart-gesture.js`: shared timings, specialised geometry |
| Home carousel and layout | `home-carousel.js`: existing swipe, shared timed settlement/reveal |
| Numeric updates, goal reorder | `number-roll.js`, `goal-drag.js`: small transform/opacity feedback |
| Notices, success/error | `notice-lifetime.js`, `save-wave.js`: independent reading lifetime, bounded entry/exit; no duplicate success notice |
| Buttons, switches, search, expandable payment summary | CSS presets in `dialog-motion.css`; static shadows, theme variables |
| Microphone idle/press/recording, launch intro | Existing CSS state machine and reduced-motion rules retained; no extra glow added |
| Search and swipe-delete/reorder gestures | Existing lifecycle, focus and finger tracking retained; no new decorative animation |
| Onboarding / lock / loading | Existing state/focus lifecycle; no source morph from a non-existent trigger |
| Native wave | Existing `MonoSaveWave` / `MonoSaveWaveView`: snapshot handshake, resource cleanup, library's reduced-motion path |

The inventory includes source review of CSS keyframes, WAAPI sites and native effect ownership. It is not a claim that every original decorative animation has been replaced or that every screen was profiled on hardware.

## Performance and accessibility

Most changed effects use transform/opacity, with geometry read at transition boundaries rather than every frame. A deliberate exception is the standard dialog border radius, needed to preserve the button-to-window contour from the supplied reference; this repaints the contour but does not animate width/height. The existing chart SVG paths/clip and root-tab blur remain specialised paint effects. Native Metal waves remain an intentionally heavier effect limited to payment saves.

Modal effects finish on resize/backgrounding and when Reduce Motion changes. Escape/native focus return is retained. Cancelling an old animation cannot close a newer modal. Content remains readable without movement. No new runtime library, perpetual JS loop or synthetic page layer was added.

Chromium CDP regression measured zero layout passes during the sampled middle 150 ms of a dialog morph. This is evidence against frame-by-frame layout, not a 60/120 FPS guarantee. Browser checks cover both trigger directions, close during entrance, reopen during exit, Escape, reduced motion, account gestures, themes, stable reminder/calendar geometry and save-once behavior. Unit tests cover finance and save protocol failures/timeouts.

## Remaining device validation

Linux cannot build/run UIKit, Metal or iOS WebKit. Build in Codemagic/Xcode and check the first/repeated payment wave, haptics, keyboard, app background/foreground, larger accessibility text and Reduce Motion on iPhone. Profile border-contour paint and the retained chart/root-tab blur on the oldest supported device before claiming a frame-rate target. The pre-overhaul branch remains available for a full rollback.
