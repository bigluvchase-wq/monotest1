# Home and menu surface stability

The home account select has a fixed responsive width (300px, capped at 85vw). Loading shared-account optgroups or selecting a longer account name must not change its width. The same rule targets live pages and page-motion previews.

The microphone and menu tiles retain their existing gradients and highlights over an opaque theme paper base. They no longer sample a backdrop, avoiding a transparent first frame while moving cloned pages are composited. Theme colors still come from existing palette variables. Menu tiles only transition transforms, so theme/background changes do not fade through transparent intermediate fills.

## Verification

Run `node --test tests/*.test.cjs` and the optional Playwright check:

```sh
MONO_PLAYWRIGHT_MODULE=/path/to/playwright \
MONO_CHROMIUM_PATH=/path/to/chromium \
node tools/verify-stable-surfaces.cjs
```

The browser check covers startup, idle style preparation, delayed shared-account groups, long names, personal/shared selection, 320/390/430px widths, seven themes and live/preview surfaces at three swipe positions. All network responses are fixtures.

Chromium checks do not replace an iPhone WebKit check. In the next build, cold-launch with a shared account and swipe home/menu slowly in light and dark themes: the picker width and surface opacity should remain constant. No server changes are required.
