# HYPER DISC

Zero-g disc duels above a neon megacity. Stand on a floating podium of concentric rings, throw glowing discs that bank off the walls and ceiling, block with your deflector, and smash the rings out from under your rivals. Last runner standing wins.

- 1 player vs CPU, 2–4 players split-screen on one machine, or 2–4 players online (CPUs fill empty podiums)
- Controllers, keyboard + mouse, two players on one keyboard, and touch
- Fullscreen from the ⛶ button, the <kbd>`</kbd> key, or View/Back on a controller

## How it plays

| | |
|---|---|
| **Discs** | Three each. They bounce off the walls and ceiling up to three times, then fly home. |
| **Aiming** | As in the original: a light blue line runs round all four walls at your throwing height, with a crosshair on it. Turn to slide the crosshair, raise or lower the line for elevation. The disc flies straight at the crosshair. Push the line past the top of the walls and it runs out across the ceiling. |
| **Banks** | Discs rebound off flat walls (angle in = angle out) and off the ceiling. Bank round deflectors and barriers. Missed discs come back off the far wall and can hit you from behind. |
| **Rings** | A struck ring flashes for 1.6 s, then vanishes for 9 s. Anyone standing on it falls. Centre plates are armoured. |
| **How to Play** | The lobby's HOW TO PLAY button (H, or X on a controller) explains all of this with diagrams. |
| **Hits** | Every hit wears you down: it shoves you toward the edge and charges your OVERLOAD, so the next hit shoves you further. Where it lands matters: a headshot hits hardest (×1.45 shove, +1.75 OVERLOAD), a chest hit is the baseline, and a glancing blow to the arms or legs only nudges you (×0.6, +0.5). Losing a life resets OVERLOAD. |
| **Shield** | Tap throw to throw; hold it and you raise a disc over your head and a shield opens from it. You need a disc in hand to shield. It covers your front, 7 blocks per life; knock a rival out to refill. Bank shots go around it. |
| **Edges** | You can't walk off a platform. To cross to another of your platforms (or over a hole in your rings), hold toward it at the edge for half a second and you leap over; nobody can hit you mid-leap. Shoved just past the rim by a hit, you teeter: push back toward your podium to save yourself. |
| **Disc vs disc** | Smash a rival's disc out of the air and yours is straight back in your hand. |
| **Recall** | Calls every disc you have in the air back to your hand. |

Arenas (all available from the start): **Halo Rings** (one podium, three rings), **Triad** (three podiums, hop between them), **Pistons** (podiums rise and fall), **Firewall** (a spinning wall of blocks between you), **Bulwark** (a barrier guards each podium: bank or lob), **Overdrive** (pistons and firewall).

## Controls

| | Controller | Keys 1 | Keys 2 |
|---|---|---|---|
| Join | A | Space | / |
| Move | Left stick | W A S D | I J K L |
| Aim | Right stick | Q / E or mouse | ← / → |
| Aim line up / down | Right stick ↑↓, RB / LB, D-pad | R / F, mouse or wheel | ↑ / ↓ |
| Level the aim line | Click right stick | V | ; |
| Throw | Tap RT | Tap Space / left click | Tap / or Enter |
| Shield | Hold RT (or LT / B) | Hold Space / click (or Shift) | Hold / (or .) |
| Jump to another platform | Hold toward it at the edge for half a second | same | same |
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
