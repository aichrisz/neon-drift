# Neon Drift

**v1.0.0 · Kejar malam. Bukan tabrakan.**

Rear-camera pseudo-3D endless traffic arcade, implemented with exact-model `gpt-6-astra` and independently exercised by the parent. No runtime dependencies, accounts, network assets, fonts, analytics, or sound.

**Play live:** https://aichrisz.github.io/neon-drift/

**Source:** https://github.com/aichrisz/neon-drift

Published to GitHub Pages after Abel explicitly requested push/deployment. Tag `v1.0.0` remains the original verified game source; publication documentation is on `main`.

## Play

Open index.html directly, or run `npm start` and visit http://127.0.0.1:4187. Open artifacts/Neon-Drift.html for the single-file offline edition. Indonesian UI. Hold A/D or Left/Right to steer, S/Down to brake, Space/W/Up for nitro. Touch controls support separate held pointers. P/Esc pauses; losing visibility/focus pauses. Resume explicitly. A collision ends the run. Near passes replenish nitro. Replay resets the run, not the record.

## Development

Node with npm and Python3 required. `npm ci --ignore-scripts` installs the lockfile with exact dev pins @playwright/test 1.64.1 and axe-core 4.14.0. Chromium path is configured in playwright.config.cjs; override with CHROMIUM_PATH. Runtime does not need these tools.

Commands: `npm run check`, `npm run build`, `npm run export`, `npm test`, `npm run test:manual`, `npm run verify`, `npm run package`. `npm test` runs unit and browser suites; `npm run verify` adds independent domain, source/dist/standalone play-throughs, emulated multitouch and adversarial browser matrix. Run `npm audit` separately for online dependency advisory results. Helpers anchor themselves to the project, not the caller's working directory. Source ZIP includes tracked source, tests, docs and helpers; stage new intended files before packaging. No recursive deletion. Output goes only to dist/ and artifacts/. Server binds only 127.0.0.1:4187 and serves the shared six-file runtime allowlist. `node scripts/server.cjs --dist` serves the build instead. Stop an existing server before running browser tests.

## Architecture and public contract

engine.js (pure domain) -> detached snapshot -> renderer.js (Canvas perspective)
app.js (native input, lifecycle, one rAF chain) -> engine.js
app.js -> records.js (validated origin-local persistence)
index.html + styles.css -> semantic HUD, dialogs and held buttons

CommonJS `require('./engine.js')` and browser `Neon` expose Engine, immutable CONFIG, and pure sweepContact. `Engine.create({seed})` accepts uint32; methods: start(), setInput({left,right,brake,nitro}), step(seconds), pause(), resume(), snapshot(). No live engine reference is attached to the DOM/window. Snapshots include phase, elapsed, distance, speed, score, nitro, nearMisses, playerX, traffic, boosting and crash.

World x lane centers are -1, 0, 1, bounds [-1,1]. Distances in metres, speed metres/second. CONFIG is authoritative. Start speed36; cruise46 rising .12 per active second to58; nitro84; brake22; traffic20. Acceleration24 and deceleration48 m/s². Steering1.6 lane units/s. Substeps at most1/120s; each step(seconds) clamps accepted work to .25s, discarding excess. Browser frames cap .1s and lifecycle loss pauses instead of catching up. Invalid negative/nonfinite deltas and nonboolean input flags throw before mutation. Partial input replaces other flags with false. Both directions cancel. Brake has priority.

Fairness: two-lane traversal = 2/1.6 = 1.25s. Worst relative speed = 84-20 = 64m/s. Required window includes BOTH entry/exit contact zones: 64*1.25+2*4.4 = 88.8m. Wave spacing125m and spawn lookahead310m both strictly exceed88.8m. Waves contain at most two original lanes; every wave leaves an integer lane center open. The first two waves are centered; subsequent waves cycle static lateral offsets -0.22,0,+0.22, with no extra RNG draws. Open-lane clearance is at least 0.78 lane units, greater than contactWidth0.33; cars remain inside the road. Varying offsets close permanent inter-lane invulnerability, so players must keep steering rather than park between lanes to farm score/nitro. First traffic is310m away. Population cap10 and passed removal at z<=-20. Seeded LCG makes equivalent input/delta sequences reproducible.

Car widths .32/.34 lane units; combined half width .33. Both lengths4.4m, combined half length4.4. Collision is inclusive swept two-axis segment/box intersection on each bounded step. Integration truncates at first contact, including time, distance, resource drain and traffic. No pass rewards in a colliding substep; results never progress. Each step is a documented constant mean-velocity segment, not an unbounded variable-delta teleport.

Near passes award once only after z<-4.4 and minimum lateral separation while longitudinally overlapping is >.33 and <=.49. Reward150 points plus16 nitro, capped100. Starting nitro55; boost drains26/s, split at exhaustion. No passive recharge. Score=floor(distance*2)+nearMisses*150. Speed display converts to km/h. Road bends never alter collision geometry; renderer uses a genuine perspective horizon and depth-scaled cars.

## Records

Key neon-drift.records.v1; version1 JSON, maximum1024 UTF-8 bytes. Whitelisted integer bestScore/bestDistance<=1e9, bestNearMisses<=1e7, runs<=1e6. Invalid fields default0; prototype-like payloads rejected. Completed run is saved once by controller, never while active. Denied reads/writes retain session records with visible truthful save outcome. Records are origin-specific; file URLs/private mode may not persist.

## Accessibility and limitations

Native controls, explicit focus, text HUD, labeled meter, decoration toggle defaulting off for reduced motion. Necessary traffic/road motion remains. Canvas driving needs visual reaction; keyboard access and axe do not establish equivalent nonvisual gameplay. No audio. Chromium automation only; no physical-device, Safari/Firefox or human accessibility acceptance claimed.

## Verification and release evidence

- 19 unit/boundary tests and 7 browser tests, no exclusions or skipped tests.
- Parent domain oracle: seeded fairness/scoring/determinism, 20 unattended center-run crashes and 10,000 alternate-algorithm swept-contact cases.
- Native source, build and standalone crash/save/retry/reload play-throughs; standalone requires no neighboring file or network request.
- Standalone 390×844 Chromium touch emulation with simultaneous held steering/nitro and actual pointer cancellation. This is not physical-device certification.
- 13 additional browser cases: five responsive viewports (320–1440 wide), corrupt/oversized/adversarial/denied/quota storage, reduced motion, no JavaScript, and real near-pass nitro recharge through ordinary controls.
- Axe checks READY, DRIVING, PAUSED and RESULTS; simulated pagehide/visibility/blur signals freeze play. A persistent heading fixes the observed in-play heading regression.
- Runtime/source/export/package boundary tests use synthetic fixture data, including dangling and ancestor symlinks.
- The permanent safe-corridor strategy is regression-tested at 41 stationary lateral positions across five deterministic seeds. Enabled pause controls receive keyboard focus after start/resume/retry.

`docs/tdd-evidence.md` preserves historical RED/GREEN and clearly distinguishes initial implementation evidence from expanded parent acceptance. `artifacts/acceptance/gate.json`, `artifacts/independent-review.json`, and `artifacts/release-manifest.json` accompany local release verification. Screenshots are actual browser captures, visually inspected by the parent, not mockups. No physical-device, Safari/Firefox, manual screen-reader, or nonvisual driving-equivalence claim. Source archive contains committed source, tests, documentation, and retained evidence; generated files remain outside Git.
