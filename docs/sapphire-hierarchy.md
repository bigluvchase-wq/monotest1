# Sapphire hierarchy trial · 2026-11-21

## Restore point

- Remote branch: `backup/before-hierarchy-redesign-20261121-25c6df1` (commit `25c6df1`).
- Workspace archive: `/workspace/backups/mono-before-hierarchy-20261121-25c6df1.tar.gz`.
- SHA-256: adjacent `.sha256` file.
- Archive includes source and installed skills, excludes Git internals, dependencies, build products, environment files and databases. It is not a backup of live financial data.
- Development branch: `codex/sapphire-hierarchy`, based on main `577bc15` after PR 57 was merged. Build the backup branch to restore the complete previous interface; do not reset the production database.

## What changed

Sapphire is enabled by default for this trial. Settings → Оформление → «Сапфир · новое оформление» switches to the previous color themes. Selecting an existing theme also exits Sapphire. This compares colors; the new hierarchy and review structure remain. The complete old UI is available by building the backup branch.

`hierarchy.css`, loaded last, owns the new visual layer. Ordinary content uses quiet solid surfaces, thin edges and readable secondary text; depth is reserved for modal overlays and the microphone. The existing account stack, speech recognition, account modes, server protocol and native animation implementations are retained.

- Main: balance, monthly flows and microphone have distinct priorities; monthly income minus expenses is labelled honestly, without implying savings.
- Menu: nine destinations grouped into money, planning and application, using horizontal rows.
- Review: financial drafts collapse into summaries, original phrase expands separately, shared account selection supports per-record overrides, save remains sticky. Invalid hidden fields expand before browser validation. Reminder fields remain editable alongside transactions.
- Goals: contribution remains visible, smart/edit actions move into details.
- History: larger record targets; category correction works for manual as well as imported transactions. Delete is available in operation details. Swipe deletion is retained for other financial entities; categories retain their delete button because they do not support swipe.
- Common: larger targets, clearer typography, reduced visual noise and reduced-motion support. Existing sheet/account transitions are deliberately retained.

## Validation

- `node --test tests/*.test.cjs`: 108 passing tests.
- `tools/verify-mixed-review.cjs`: mixed financial/reminder save, required date, cancellation, category learning, repeated transcript and shared account control.
- `tools/verify-hierarchy.cjs`: Sapphire default, batch and individual accounts, summary editing, hidden validation, persistence, manual category correction, nine menu rows, 320/390/430px layouts and color comparison persisted after reload.
- Chromium screenshots reviewed for main, menu, account stack, goals and mixed review. All network API requests mocked and storage disposable.
- Swift compilation and real-device WKWebView, keyboard, VoiceOver and haptic behavior still require the normal Codemagic/iPhone build. No server deployment is needed for these changes.
