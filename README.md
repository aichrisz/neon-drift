# Neon Drift

**v1.1.0 · Kejar malam. Bukan tabrakan.**

Rear-camera pseudo-3D endless traffic arcade. Zero runtime dependencies, accounts, analytics, fonts or downloaded assets. Optional synthesized WebAudio; no microphone or external audio requests.

## Delivery status

**v1.1.0 is live on GitHub Pages.** Abel authorized publication with “Deploy aja biasain”. Release/tag source `dd0c919`; Pages runtime `5ff5fe6`. Seven public runtime responses byte-match the build. Normal/Hard desktop and touch-emulated public lifecycle tests passed, as did native four-pass/×4 combo routes in both modes, without app/HTTP/request errors. Fresh publication preflight26 unit +31 browser and online audit0; earlier full local gate additionally13 edge/eight lifecycle variants and fresh exact-Astra ship review. See `docs/deployment.md` for provenance/rollback and `docs/v1.1-parent-acceptance.md` for local evidence and the nonblocking audio-label note.

Play v1.1: https://aichrisz.github.io/neon-drift/
Source repository: https://github.com/aichrisz/neon-drift

Immutable `v1.1.0` points to release source `dd0c919`; the original73-file ZIP describes that tag, not later publication-only documentation. `v1.0.0` and prior Pages history are preserved. The old Pages commit `1521118` is a rollback anchor, not the current live version.

## Play

Open `index.html` directly, or run `npm start` and visit http://127.0.0.1:4187. The exported `artifacts/Neon-Drift.html` is standalone and needs no neighboring files. Indonesian UI.

- Select Normal or Hard before starting or on results. Difficulty cannot change during play or pause. Replay retains the selected mode.
- Hold A/D or Left/Right to steer, S/Down to brake, Space/W/Up for nitro. Separate held touch pointers support steering and a pedal together. Both directions cancel; brake takes priority over boost.
- P/Esc pauses, including while settings have focus. Blur, pagehide and hidden state auto-pause. Resume explicitly; there is no background catch-up.
- Pass close, then clear the vehicle's entire length: gain up to16 nitro, capped100. No passive refill. The HUD reports the actual capped amount, highlights the meter and shows combo/time remaining.
- Another near pass within8 active seconds increments combo. Bonuses are150,300,450,600, then600 per pass; only the pass bonus is multiplied. Paused time does not expire combo. Collision ends the run.
- Sound starts off. Check “Suara mati” to opt in; status changes to active, waiting, paused or unavailable truthfully. Uncheck to mute. Unsupported/blocked audio never prevents play.
- “Efek hujan” disables rain, spray, trails, skyline parallax, boost exhaust/streaks and body roll. Reduced-motion preference defaults it off. Essential road/traffic motion remains.

## Development and delivery

Node with npm and Python3 required. Existing exact-pinned dev tools are @playwright/test1.64.1 and axe-core4.14.0. No dependencies were added for v1.1. Chromium path is configured in `playwright.config.cjs`; override with `CHROMIUM_PATH`. Runtime needs no tooling.

```
npm run check
npm run build
npm run export
npm test
npm run test:manual
npm run verify
git diff --check
# Stage every intended new source/test/doc before packaging:
npm run package
```

`npm run verify` performs syntax/allowlist, build, export, unit/browser suites, independent domain/manual browser matrix, then online `npm audit --fetch-retries=0 --fetch-timeout=15000`. Audit is bounded; unavailable network/advisory results must be reported rather than inferred. `verify:offline` is an explicit alternative, not an online advisory-freshness claim.

`test:manual` covers Normal and Hard through source/build/standalone crash/save/retry/reload, plus standalone emulated multitouch in both modes and the adversarial edge matrix. New browser tests additionally exercise near-pass HUD/recharge and unavailable audio for both modes on every delivery.

Helpers anchor to the project, not caller cwd. Outputs go only to `dist/` and `artifacts/`. Source ZIP includes tracked/staged source, tests, docs and helpers, never generated output or dependencies; every member's bytes and ZIP integrity are checked by `scripts/package.py`. Server binds127.0.0.1:4187. `node scripts/server.cjs --dist` serves the build. Shared explicit seven-file runtime allowlist: index.html, styles.css, engine.js, records.js, renderer.js, audio.js, app.js. Export embeds every runtime script exactly once. Ancestor/final/dangling symlinks are refused; no path-boundary widening. Stop an existing test server before browser suites.

## Architecture and domain contract

```
engine.js -> detached frozen snapshot -> renderer.js
app.js -> native DOM/input/lifecycle, one active rAF chain
app.js -> engine.js, mode-scoped records.js, lazy audio.js
```

CommonJS `require('./engine.js')` and browser `Neon` expose Engine, frozen CONFIG/MODE_CONFIG/VEHICLES and pure sweepContact. `Engine.create({seed,mode='normal'})` accepts uint32 seed and only Normal/Hard mode keys (`normal`, `hard`). Methods: start(), setInput({left,right,brake,nitro}), step(seconds), pause(), resume(), snapshot(). No live game instance is attached to DOM/window. Snapshots, traffic arrays/cars, crash and lastNearMiss events are detached and frozen.

World x lane centers are -1,0,1; steering bounds[-1,1]. Length/distance in metres, speed in m/s; HUD converts speed to km/h.

| Mode | Start | Cruise | Maximum cruise | Increase/active second | Wave spacing ramp |
| --- | ---: | ---: | ---: | ---: | --- |
| Normal | 36 | 46 | 58 | .12 | 140 to125 over120s |
| Hard | 42 | 52 | 66 | .20 | 125 to108 over90s |

Boost84, brake22, acceleration24/deceleration48m/s², steerRate1.6 lane units/s. Player width.32 and length4.4. Traffic types:

| Type | Width (lane units) | Length | Desired speed |
| --- | ---: | ---: | ---: |
| compact | .28 | 3.8 | 22 |
| sedan | .34 | 4.4 | 20 |
| van | .46 | 6 | 16 |

Each wave shares one type and actual speed, occupies1–2 lanes and leaves an integer center clear. Two introductory waves are centered; later static offsets cycle-.22,0,+.22, closing permanent inter-lane parking corridors. Renderer uses actual widths and length footprints, projected at the actual rear edge. Roof suspension is bounded; no decorative lateral displacement of collision geometry.

### Mixed-speed fairness

Higher-z traffic leads lower-z traffic in world coordinates. On each bounded integration segment, leaders are evaluated first; a follower's actual speed is the minimum of its desired speed and `leaderSpeed + max(0, gap-minGap)/dt`. All members share that speed. Thus the per-run center gap floor125 Normal/108 Hard is preserved by velocity integration, not positional correction/teleport. Spawn lookahead310; population bounded10; passed traffic removed at z<=-20.

Worst differential68m/s, full traversal `2/1.6=1.25s`, largest combined half-length `(4.4+6)/2=5.2m`. The required center gap includes both zones: `68*1.25+2*5.2=95.4m <108m`. This is backed by successful sustained ordinary-input pure-domain drivers across mixed types/offset phases, not merely by open-lane claims. It does not promise recovery from an arbitrarily late/wrong maneuver.

Each step clamps accepted work to.25s, subdivides to at most1/120s, and splits at nitro exhaustion. Browser frames cap.1s. Each segment uses mean velocity; swept contact truncates time, distance, resources and all traffic at earliest collision. No reward in a colliding substep. Invalid deltas/input flags throw before mutation; partial input replaces other flags with false.

### Collision, combo and score

For each type, contact half-width is `(.32+width)/2`, half-length `(4.4+length)/2`; exact edges collide. `sweepContact(x0,z0,x1,z1,halfWidth=.33,halfLength=4.4)` retains v1.0 helper defaults.

A vehicle rewards only once after z falls below negative actual contact half-length, if minimum lateral separation through the full longitudinal zone is greater than contact half-width and at most that width+.16. Starting nitro55; boost drains26/s; each reward restores min(16,100-currentNitro).

Combo starts0/multiplier1. First pass gives combo1; subsequent passes before the previous pass's eight-active-second window expires increment count; multiplier=min(4,combo). Expiry resets0/1. `nearMissBonus` accumulates150*multiplier per pass. Exact score is `floor(distance*2)+nearMissBonus`; never multiply old rewards or distance retroactively. Snapshot includes combo, multiplier, comboRemaining, bestCombo, nearMissBonus, lastNearMiss `{id,elapsed,nitroAdded,bonus,combo,multiplier}`. Event ID increases per rewarded vehicle within a run; simultaneous rewards leave the last event in snapshot while score/count include all. Replay resets resources/events/combo. HUD announcement changes only for new event IDs, not every frame; feedback lifetime uses active simulation time.

## Records

Normal preserves key `neon-drift.records.v1` and existing version1 JSON. Hard uses `neon-drift.records.v1.hard`; switching modes never erases Normal. `Records.open(storage,{mode='normal'})` retains backward compatibility. Maximum1024 UTF-8 bytes. Whitelisted integers: bestScore/bestDistance<=1e9, bestNearMisses<=1e7, runs<=1e6. Invalid fields default0; prototype-like payloads rejected. Saves occur once after results. Denied reads/quota writes retain session records with truthful visible status. Origin/file/private-mode restrictions apply.

## Audio contract

`Neon.Audio.create({createContext?,onStatus?})` returns setEnabled(bool), activate(), update(snapshot), resetRun(), status(). Only real user gestures invoke setEnabled/activate; update never creates or resumes WebAudio. Default muted; no context until opt-in. Engine pitch follows speed, boost adds oscillator/noise, near-pass cues have a short envelope. One context, three persistent oscillators and one deterministic looped noise source per controller; no timer/voice accumulation on replay. Master gain and pending cue envelope are zeroed immediately on mute/pause/blur/hidden/results. Async resume uses generation invalidation and current state; rejected creation/resume is caught and unavailable is shown. Muted/pending events are consumed so enabling later cannot replay a stale cue.

Real OfflineAudioContext waveform/RMS tests and native browser-context instrumentation verify signal and lifecycle. No human auditory/device certification is claimed.

## Evidence and limits

`docs/v1.1-implementation-evidence.md` records actual per-task RED/GREEN commands, harness corrections, counts and handoff status. Raw v1.1 logs/captures/reports are in `artifacts/evidence/v1.1/`; selected raw checkpoints are retained in `docs/evidence/v1.1/`. `docs/tdd-evidence.md` preserves historical v1.0 evidence separately.

Native controls, focus, text HUD and labeled meters are tested. Five DPR2 viewports include320×568,390×844,768×1024,1366×768,1440×900 with all-phase axe and non-overlap checks. Canvas driving still requires visual reaction. Chromium automation/emulated touch is not physical-device, Safari/Firefox, screen-reader usability or nonvisual-equivalence certification. Captures are actual browser output; parent visual inspection and independent local acceptance are now recorded in `docs/v1.1-parent-acceptance.md`. No physical/human usability certification is claimed. v1.1 public deployment and ordinary-input live checks are separately documented in `docs/deployment.md`.
