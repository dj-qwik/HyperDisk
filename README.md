# HYPER DISC

Zero-g disc duels above a neon megacity. Stand on a floating podium of concentric rings, throw glowing discs that bank off the walls and ceiling, block with your deflector, and smash the rings out from under your rivals. Last runner standing wins.

- 1 player vs CPU, 2–4 players split-screen on one machine, or 2–4 players online (CPUs fill empty podiums)
- Controllers, keyboard + mouse, two players on one keyboard, and touch
- Fullscreen from the ⛶ button, the <kbd>`</kbd> key, or View/Back on a controller

## How it plays

| | |
|---|---|
| **Discs** | Three each. They bounce off the walls and ceiling up to three times, then fly home. Hold throw to charge a power disc. |
| **Elevation** | HIGH banks off the ceiling and drops onto a rival. MID flies at chest height. LOW smashes the ring in front of them. |
| **Rings** | A struck ring flashes for 1.2 s, then vanishes for 7 s. Anyone standing on it falls. Centre plates are armoured. |
| **Hits** | Knock you back. Each hit raises OVERLOAD, so the next one sends you further. |
| **Deflector** | Covers your front, drains while held, and cracks under power discs. Bank shots go around it. |
| **Recall** | Calls every disc you have in the air back to your hand. |

Arenas: **Halo Rings** (one podium, three rings), **Triad** (three podiums, hop between them), **Pistons** (podiums rise and fall), **Firewall** (a spinning wall of blocks between you), **Overdrive** (all of it).

## Controls

| | Controller | Keys 1 | Keys 2 |
|---|---|---|---|
| Join | A | Space | / |
| Move | Left stick | W A S D | I J K L |
| Aim | Right stick | Q / E or mouse | ← / → |
| Elevation | RB / LB, D-pad, right stick flick | R / F or wheel | ↑ / ↓ |
| Throw (hold = power) | RT | Space or left click | / or Enter |
| Deflector | LT or B | Shift or right click | . or Right Shift |
| Hop | A | C | U |
| Recall | X / Y | X | O |
| Pause | Start | Esc / P | Esc / P |

## Project layout

- `src/page.html` — markup and styles
- `src/01-core.js` … `src/09-main.js` — the game: renderer and post (bloom + tone map), procedural textures, the city and arena, podiums, discs, runners, CPU brains, split-screen cameras and HUD, lobby and match flow, online rooms, synth audio, input and main loop
- `tools/build.js` — builds `public/index.html` (the whole game in one page). Run `npm run build` after editing `src/`.
- `server.js` — serves the page and relays online rooms over a WebSocket at `/ws` (no dependencies)
- `render.yaml` — Render blueprint (free web service)

## Deploy on Render

1. Render dashboard → **New** → **Blueprint**.
2. Pick this repo and click **Apply**. Render reads `render.yaml` and creates the `hyperdisc` web service.
3. Every push to `main` redeploys. On the free plan the server sleeps after 15 minutes idle; the first visit after that takes about a minute.

## Music

Drop mp3s in `public/music/`, then list them in `src/08-audio.js` (`THEME` loops in menus, `TRACKS` shuffle in matches) and rebuild. Until then a built-in darksynth sequencer plays.

## Testing

`tools/browser-test.py <url>?test <out-prefix> <scenario.json>` drives the real page in headless Chromium (test mode steps frames on demand; `window.__hd` exposes state). `tools/online-test.py` opens a host tab and a guest tab against a running server and plays a short online match. Scenarios live in `tools/scenarios/`.
