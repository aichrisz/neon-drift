# Neon Drift Implementation Plan

> For agentic workers: use executing-plans or subagent-driven-development task-by-task; one writer in assigned worktree, parent verifies independently.

**Goal:** Deliver the approved locally playable endless pseudo-3D traffic game, six-file-ish runtime, offline HTML and complete source ZIP.

**Architecture:** Pure deterministic domain engine drives a Canvas perspective renderer. Controller owns native input/lifecycle, a single active rAF and validated storage; renderer never decides collision or scoring.

**Tech Stack:** Classic browser JS/HTML/CSS/Canvas, Node built-ins/tests, @playwright/test1.64.1, axe-core4.14.0, Python3 archive.

## Global constraints
- Follow all exact behavior/limits in `docs/superpowers/specs/2026-10-22-neon-drift-design.md`.
- Exact `gpt-6-astra`, local-only, no credential/config/provider/service changes or publication; one owned worktree only.
- Domain API `Neon.Engine.create({seed})` → start/setInput/step/pause/resume/snapshot. No mutable live-game test hook.
- Python3 packaging; loopback4187; source/dist/offline independently exercised; truthful TDD/audit/browser coverage.

## Task1 — state, deterministic motion and fairness (engine.js, tests/engine.test.cjs)
- [ ] Write a tracer test before engine exists, e.g. `const {Engine}=require('../engine.js'); const e=Engine.create({seed:7}); e.start(); e.step(1); assert(e.snapshot().distance>0);` Run `node --test tests/engine.test.cjs`, retain actual missing-module RED under ignored artifacts.
- [ ] Implement only state/motion needed; rerun GREEN. Incrementally add steering bounds, pause/resume/invalid input and deterministic seed tests, one RED→GREEN cycle at a time.
- [ ] Add immutable CONFIG with exact speed/steering/wave-width/lookahead/spacing numbers. Test spawn reaction window > two-lane traversal at maximum relative speed; at most2cars per wave/free lane, bounded traffic across many seeds. Document formula.
- [ ] Run whole current unit suite and commit engine slice.

## Task2 — collision, near miss and nitro (engine.js, tests/traffic.test.cjs)
- [ ] Add actual seeded approach→pass/collision tests before behavior; capture expected failing assertions. Use pure helper test fixtures or deterministic seed only, never a UI cheat.
- [ ] Implement swept contact detection and exact contact-time finish, once-only pass bonus, narrow clearance thresholds, capped resource recharge/drain, brake priority and neutral dual steering.
- [ ] Test `score===floor(distance*CONFIG.distancePoints)+nearMisses*CONFIG.nearMissPoints`, no duplicate near pass, no bonus on crash, nonnegative finite values, high-speed/large delta no tunneling, no post-result progression. Expected exact formula can use a differently named documented formula if consistently defined in CONFIG/README; choose once and freeze.
- [ ] Compare equal active time partitions for reproducibility/tolerances. Rerun units and commit.

## Task3 — real pseudo-3D game and lifecycle (renderer.js, app.js, index.html, styles.css, assets/mark.svg if used; tests/e2e/game.spec.cjs)
- [ ] Write one failing Playwright start→visible distance/steering→pause/resume→crash→retry tracer before controller; retain RED.
- [ ] Implement perspective projection road/horizon/buildings/reflections/rear player car and traffic depth scale; no external resources. Native semantic menu/HUD/buttons, rain decoration and visual reduced motion.
- [ ] Implement held key/pointer sets and cancellation, focus-safe rendering, explicit resume, frame delta cap, exactly one active animation chain. Expose only DOM HUD and normal controls; no live-game object.
- [ ] Incremental RED/GREEN tests for pointer cancellation/simultaneous touches, Space scroll prevention, focused-control P/Esc, blur/hidden freeze, mid-run resize, restart reset.
- [ ] Check actual game+controls viewport boxes at320/390/768/1366/1440, DPR2; axe all phases with real timers during audit. Run suites; commit UI slice.

## Task4 — records and safe delivery (app.js or records.js, scripts/{public,check,server,build,export}.cjs, scripts/package.py; tests/{records,boundary}.test.cjs and tests/e2e/delivery.spec.cjs)
- [ ] Write read/write separately failing storage tests: corrupt/oversize/denied/prototype-like payload and quota failure after successful read. Implement whitelisted bounded records and visible results save status, never false durable-save copy.
- [ ] Write synthetic serving/output symlink boundary regressions RED. Build cwd-independent helper module with explicit runtime allowlist; safe output ancestor and dangling-file refusal before writes.
- [ ] Add standalone exporter inlining CSS/JS/SVG with replacement counts, actual computed CSS, offline browser real input→distance→pause→results/retry, no neighbor/external requests. Export tests precede delivery implementation, do not infer success from a render alone.
- [ ] Source archive allowlist tracked source excluding .git/worktrees/deps/build/artifacts/secrets; verify archive members/bytes, no stubs. Test `npm run check`, `npm run build`, `npm run export`, `npm test`, `npm run package`; bounded npm audit.

## Task5 — full acceptance / evidence (README.md, CHANGELOG.md, docs/tdd-evidence.md, artifacts)
- [ ] README controls/motion/score/fairness equations/storage/architecture diagram, runtime requirements and honest limitations. Inline comments explain non-obvious swept/timing/security code. Actual RED/GREEN checkpoint names/counts, not invented strict per-method TDD.
- [ ] Full fresh unit/browser run, no skipped/flaky, real source/dist/offline comparison, viewport screenshots, normal gameplay record/retry, adversarial storage and noJS/reduced-motion.
- [ ] Parent verifies independently and obtains fresh-context read-only review. Address concrete failures through new RED tests and minimal changes, then full rerun.
- [ ] Parent finalizes local clean commit/tag, HTML/ZIP/preview and vault backup. No public repo/deploy without a new instruction.
