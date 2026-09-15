# Elemental Evolves

Five lands · one wall. Classic Evolves × Reborn — pick a color, auto-spawning cores, kill-score evolution.

**This repo is the public source of truth** for the playable static web build.

| Surface | Role |
|--------|------|
| **GitHub Pages** (this `main` branch, site root) | Public playable build + PWA |
| **itch.io zip** | Same files; `index.html` must sit at the **zip root** |
| [elementalevolves.grok.me](https://elementalevolves.grok.me) | **LAB only** — not the ship target |

## Play

After Pages is enabled on this repo (Settings → Pages → Deploy from branch **`main`** / folder **`/` (root)**):

- Expected URL: `https://zcloud8891.github.io/elemental-evolves/`
- Paths in the build are **relative** (`./assets/…`) so project Pages and itch both work.

## What’s in the ship layer

- **PWA**: `manifest.webmanifest` + `sw.js` (precaches shell, CSS/JS bundles, keyart, floor, icons). Register from `ship.js`.
- **Tab pause**: `ship.js` pauses via `window.__ee.togglePause()` when the tab hides during `playing` (and resumes on visible). Lab already exposes pause/`__ee`; this wires background.
- **Install chip**: Android uses `beforeinstallprompt`; iPhone shows Share → Add to Home Screen (4 steps). Never mentions App Store / Play.
- **Portrait / notch**: `viewport-fit=cover` + `env(safe-area-inset-*)` padding on chip/stamp (`ship.css`).
- **Version stamp**: bottom-left `YYYY-MM-DD` + short git SHA (written at push time).

## localStorage keys

| Key | Who | Meaning |
|-----|-----|---------|
| `ee-muted` | Lab game | Audio muted |
| `ee-best-run` | Lab game | Best run `{ score, kills, … }` |
| `ee-last-faction` | Ship | Last land tapped (`Fire` / `Water` / `Earth` / `Light` / `Dark`) |
| `ee-last-match` | Ship | Last end screen JSON (`phase`, `message`, `at`, …) |
| `ee-howto-seen` | Ship | How-to-play was shown/dismissed |
| `ee-install-chip-dismissed` | Ship | Install chip dismissed |

## Offline / PWA smoke

1. Open the Pages URL over **HTTPS**.
2. DevTools → Application → Service Workers: `sw.js` should be activated.
3. Install (Chrome/Edge) or iOS Share → Add to Home Screen.
4. Go offline → reload: shell + assets should still load from cache.
5. Start a match, switch tabs: sim should pause; return and resume.

## itch zip

```bash
# from repo root — index.html at zip root
zip -r elemental-evolves-itch.zip index.html manifest.webmanifest sw.js ship.js ship.css \
  assets icons elemental-evolves-keyart.jpg realm-floor.jpg README.md .nojekyll
```

Pitch blurb (from cut):

> Pick a land. Your core spawns and the fight starts.
> Kills feed the next wave — each color evolves differently.
> Tap the map to march. Short tap peels.
> Break the wall. That’s the whole game.

## Develop / update

Lab HTML/JS is vendored under `assets/` from the grok.me lab build. Ship-only files: `ship.js`, `ship.css`, `sw.js`, `manifest.webmanifest`, `icons/`.
