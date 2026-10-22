# Neon Drift

Local v1.0.0 implementation candidate, written with gpt-6-astra. No runtime dependencies, accounts, network assets, fonts, or sound. Parent owns final acceptance/review/release; this is not a release certification.

## Play

Open index.html directly, or run `npm start` and visit http://127.0.0.1:4187. Open artifacts/Neon-Drift.html for the single-file offline edition. Indonesian UI. Hold A/D or Left/Right to steer, S/Down to brake, Space/W/Up for nitro. Touch controls support separate held pointers. P/Esc pauses; losing visibility/focus pauses. Resume explicitly. A collision ends the run. Near passes replenish nitro. Replay resets the run, not the record.

## Development

Node with npm and Python3 required. `npm install --ignore-scripts` installs exact dev pins @playwright/test 1.64.1 and axe-core 4.14.0. Chromium path is configured in playwright.config.cjs; override with CHROMIUM_PATH. Runtime does not need these tools.

Commands: `npm run check`, `npm run build`, `npm run export`, `npm test`, `npm run package`. Helpers anchor themselves to the project, not the caller's working directory. Source ZIP includes tracked source, tests, docs and helpers; stage new intended files before packaging. No recursive deletion. Output goes only to dist/ and artifacts/. Server binds only 127.0.0.1:4187 and serves the shared six-file runtime allowlist. `node scripts/server.cjs --dist` serves the build instead. Stop an existing server before running browser tests.

## Architecture and public contract

engine.js (pure domain) -> detached snapshot -> renderer.js (Canvas perspective)
app.js (native input, lifecycle, one rAF chain) -> engine.js
app.js -> records.js (validated origin-local persistence)
index.html + styles.css -> semantic HUD, dialogs and held buttons

CommonJS `require('./engine.js')` and browser `Neon` expose Engine, immutable CONFIG, and pure sweepContact. `Engine.create({seed})` accepts uint32; methods: start(), setInput({left,right,brake,nitro}), step(seconds), pause(), resume(), snapshot(). No live engine reference is attached to the DOM/window. Snapshots include phase, elapsed, distance, speed, score, nitro, nearMisses, playerX, traffic, boosting and crash.

World x lane centers are -1, 0, 1, bounds [-1,1]. Distances in metres, speed metres/second. CONFIG is authoritative. Start speed36; cruise46 rising .12 per active second to58; nitro84; brake22; traffic20. Acceleration24 and deceleration48 m/s². Steering1.6 lane units/s. Substeps at most1/120s; each step(seconds) clamps accepted work to .25s, discarding excess. Browser frames cap .1s and lifecycle loss pauses instead of catching up. Invalid negative/nonfinite deltas and nonboolean input flags throw before mutation. Partial input replaces other flags with false. Both directions cancel. Brake has priority.

Fairness: two-lane traversal = 2/1.6 = 1.25s. Worst relative speed = 84-20 =64m/s. Required window =64*1.25+4.4 =84.4m. Wave spacing125m and spawn lookahead310m both strictly exceed84.4m. Waves contain at most two lanes; every wave leaves a lane open. First traffic is310m away. Population cap10 and passed removal at z<=-20. Seeded LCG makes equivalent input/delta sequences reproducible.

Car widths .32/.34 lane units; combined half width .33. Both lengths4.4m, combined half length4.4. Collision is inclusive swept two-axis segment/box intersection on each bounded step. Integration truncates at first contact, including time, distance, resource drain and traffic. No pass rewards in a colliding substep; results never progress. Each step is a documented constant mean-velocity segment, not an unbounded variable-delta teleport.

Near passes award once only after z<-4.4 and minimum lateral separation while longitudinally overlapping is >.33 and <=.49. Reward150 points plus16 nitro, capped100. Starting nitro55; boost drains26/s, split at exhaustion. No passive recharge. Score=floor(distance*2)+nearMisses*150. Speed display converts to km/h. Road bends never alter collision geometry; renderer uses a genuine perspective horizon and depth-scaled cars.

## Records

Key neon-drift.records.v1; version1 JSON, maximum1024 UTF-8 bytes. Whitelisted integer bestScore/bestDistance<=1e9, bestNearMisses<=1e7, runs<=1e6. Invalid fields default0; prototype-like payloads rejected. Completed run is saved once by controller, never while active. Denied reads/writes retain session records with visible truthful save outcome. Records are origin-specific; file URLs/private mode may not persist.

## Accessibility and limitations

Native controls, explicit focus, text HUD, labeled meter, decoration toggle defaulting off for reduced motion. Necessary traffic/road motion remains. Canvas driving needs visual reaction; keyboard access and axe do not establish equivalent nonvisual gameplay. No audio. Chromium automation only; no physical-device, Safari/Firefox or human accessibility acceptance claimed.

Read docs/tdd-evidence.md for observed tests and remaining acceptance work. Screenshots under artifacts/ are real browser captures, not mockups. Final independent visual review, all-phase accessibility/lifecycle adversarial coverage and delivery-boundary regression coverage remain parent acceptance work.
