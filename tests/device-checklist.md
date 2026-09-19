# Manual device checklist

The Node tests cover what a person cannot reliably eyeball (precache drift, version drift, missing translations, absolute paths, contrast ratios, the eco budget). This checklist covers what a machine here cannot reach: real devices, real installs, and real offline behaviour.

Record the result, the device, the OS version, the browser version, the date and the tester in `progress.md`. **Anything not actually run is recorded as "not verified", never as passed** (`AGENTS.md` section 2).

## How to run the app

```bash
python -m http.server 8000
```

Open `http://localhost:8000`. A service worker does not run from a double-clicked file, so the install and offline checks need the server or the deployed URL.

## 1. Layout grid

Five widths × light/dark × Thai/English. Per cell: no sideways page scroll, all six tabs reachable, empty state readable, nothing clipped, console clean.

| Width | light TH | light EN | dark TH | dark EN |
|---|---|---|---|---|
| 360 px | ☐ | ☐ | ☐ | ☐ |
| 390 px | ☐ | ☐ | ☐ | ☐ |
| 820 px | ☐ | ☐ | ☐ | ☐ |
| 1180 px | ☐ | ☐ | ☐ | ☐ |
| 1440 px | ☐ | ☐ | ☐ | ☐ |

Also: ☐ tablet portrait ☐ tablet landscape ☐ iPad Split View ☐ 200% browser zoom at 1180 px.

The navigation is a bottom bar below 600 px and a top strip at 600 px and above. Check the change happens cleanly at the boundary.

## 2. Language and theme

- ☐ Thai is the default on a first visit (clear site data first).
- ☐ Switching language keeps the current tab.
- ☐ Switching language updates the tab labels, the page title, and `<html lang>`.
- ☐ Theme system / light / dark all work, and "system" follows the OS when it changes while the app is open.
- ☐ Both choices survive a reload.
- ☐ No flash of the wrong theme on reload with dark selected.

## 3. Install and offline (needs a server or the deployed URL)

| Device | Browser | Check |
|---|---|---|
| iPhone | Safari | ☐ Share → Add to Home Screen ☐ opens in airplane mode ☐ status bar colour matches the header |
| iPad | Safari | ☐ install ☐ offline ☐ portrait, landscape, Split View |
| Android | Chrome | ☐ install prompt or menu ☐ offline ☐ maskable icon looks right on the home screen |
| Windows | Edge, Chrome | ☐ install from the address bar ☐ offline ☐ update banner |
| macOS | Safari | ☐ File → Add to Dock ☐ offline |
| macOS | Chrome | ☐ install ☐ offline |

- ☐ The install help shown matches the device you are actually on.
- ☐ The offline badge appears when the network is off and clears when it returns.

## 4. Update flow

1. ☐ Load the app and let the service worker install.
2. ☐ Change `VERSION` in `sw.js` **and** `APP_VERSION` in `js/pwa.js` to the same new value.
3. ☐ Reload. The banner appears and the page does **not** reload on its own.
4. ☐ Tap Reload. The new version loads.
5. ☐ In DevTools → Application → Cache Storage, only the new `monthly-forecast-<VERSION>` cache remains.

## 5. Keyboard and accessibility

- ☐ Tab from the top: skip link → language → theme → the six tabs → page content.
- ☐ The skip link becomes visible when focused and jumps to the main region.
- ☐ Every focused control has a visible ring.
- ☐ The active tab is announced as current.
- ☐ Choosing a tab moves focus into the panel.
- ☐ At 200% zoom nothing is lost or overlapped.
- ☐ With reduced motion enabled, nothing animates.

## 6. Single-file build

- ☐ `node build.cjs`, then open `dist/index.html` by double-clicking it.
- ☐ Tabs, language and theme all work.
- ☐ The notice about it being a review copy is visible.
- ☐ The console is clean, with no service-worker error.
- ☐ The header mark renders (it is inlined, so there is no broken image).

## 7. Eco numbers to record

| Number | Budget |
|---|---|
| First load, uncompressed | ≤ 250 KB |
| Font bytes | 0 KB |
| Repeat-visit transfer | ≈ 0 KB |
| Request count on first load | record only |
| `dist/index.html` size | record only |
| Lighthouse: performance / accessibility / best practices / PWA | record only |
