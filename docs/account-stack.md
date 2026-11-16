# Account wallet stack

The Accounts section stacks existing account cards separately for each currency. The selected card is fully visible at the front; the other names and current balances stay exposed as native buttons. The entire exposed rear card surface (including the right margin) selects it. The active card has a stronger static contact shadow above and a wider cast shadow below; rear shadows stay softer. Existing theme surfaces, type, borders, edit forms, front-card swipe deletion and delete confirmation/undo remain in use. One account renders as a single ordinary card.

Selection changes only the visual ordering, not `state.accounts`, balances, the microphone's recording account, or the personal/shared mode. In-memory choices are scoped to the personal/shared storage key and currency, survive re-rendering, and fall back to an existing card if an account is removed. Every rear card remains reachable, including long names and larger collections.

## Motion

Purpose: spatial consistency for occasional account selection. WAAPI animates only full `transform` strings for 280ms, using the existing page-motion ease-out curve. A selected rear card lifts slightly sideways into the front position. Repeated selections sample all current transforms before cancelling old animations and retarget from the visible position. No per-frame layout reads, animated blur/shadows or new libraries are introduced. Completed animations are cancelled and detached controllers are cleaned up on render. Width changes recalculate the stack without animation.

Keyboard selection is immediate. Reduce Motion uses a 120ms opacity-only transition; changing the preference live settles existing movement. Inactive edit/delete controls are inert and visually hidden. Deletion gestures only begin on the front card.

GitHub skills installed locally for Codex before implementation:

- [animate](https://github.com/emilkowalski/skills/tree/64eb3deb9a5fbfa041faf783e0bc3fd635872e9c/skills/animate) and [animation-performance](https://github.com/emilkowalski/skills/tree/64eb3deb9a5fbfa041faf783e0bc3fd635872e9c/skills/animation-performance): applied to timing, interruption, properties and accessibility.
- [swiftui-pro](https://github.com/twostraws/SwiftUI-Agent-Skill/tree/f2920b63995263f57b3e198674e89a602efba6d2/swiftui-pro): available for future native changes. This feature lives in WKWebView; no Swift changes were needed.

## Verification

`node --test tests/*.test.cjs`

Optional browser checks (Playwright installed separately):

```sh
MONO_PLAYWRIGHT_MODULE=/path/to/playwright MONO_CHROMIUM_PATH=/path/to/chromium node tools/verify-account-stack.cjs
MONO_PLAYWRIGHT_MODULE=/path/to/playwright MONO_CHROMIUM_PATH=/path/to/chromium node tools/verify-shared-ui.cjs
```

The stack check freezes start/middle/end frames, checks animation properties and absence of repeated layout during movement, rapid/keyboard selection, edit/swipe behavior, financial-state invariance, seven themes, three mobile widths, long labels, single/many cards and scope separation. Shared UI uses an isolated in-memory server and two browser clients.

Real iPhone Safari/WKWebView animation pacing and GPU performance still require checking in the next build. No server deployment is needed.
