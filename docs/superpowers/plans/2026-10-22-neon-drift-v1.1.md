# Neon Drift v1.1 Implementation Plan

> **For agentic workers:** Use executing-plans task-by-task; single exact Astra writer in this worktree. Parent owns independent final verification and fresh review.

**Goal:** Deliver the approved v1.1 gameplay/feel upgrade without breaking offline portability or fair controls.

**Architecture:** Extend pure deterministic engine with mode/wave/type/combo data. Read-only renderer and separate lazy sound module consume snapshots; controller remains sole input/lifecycle owner. Explicit runtime allowlist and mode-aware records preserve security and existing Normal saves.

**Tech Stack:** Classic JavaScript/Canvas/WebAudio, existing exact-pinned Playwright/axe dev dependencies, Node test runner/Python3 ZIP. No new dependencies.

## Global Constraints
- All exact numbers/interfaces/limits are in `docs/superpowers/specs/2026-10-22-neon-drift-v1.1-design.md`; no undocumented alternative.
- Own only this worktree; no main/remote/deployment/tag/config/credentials/service changes. Commit source slices after passing tests; parent releases later.
- Preserve old behavior invariants and boundary tests. Where documented scoring/geometry contract changes, update old expected results transparently, never weaken tests or remove failures to pass.
- Write new tests and observe real RED before implementation, save logs under artifacts/evidence/v1.1 and concise tracked evidence docs. Claim only observed cycles; no fake or reconstructed outputs.
- No mutable live-game engine hook; snapshots and pure engine instances in tests are allowed. Browser interaction uses real controls. No passing skipped/flaky tests.

## Task 1 — difficulty and vehicle wave safety
Files: engine.js, tests/engine.test.cjs, tests/traffic.test.cjs; add tests/v11-engine.test.cjs.
Interfaces: Engine.create({seed,mode}), frozen MODE_CONFIG/VEHICLES; car type/width/length/speed; optional radii sweepContact; old defaults preserved.
- [ ] Add an initial mode tracer before changing code:
```js
const {test}=require('node:test');const assert=require('node:assert/strict');
const {Engine}=require('../engine.js');
test('mode is validated and visible',()=>{
 assert.throws(()=>Engine.create({mode:'bogus'}));
 const e=Engine.create({seed:7,mode:'hard'});e.start();
 assert.equal(e.snapshot().mode,'hard');assert.equal(e.snapshot().speed,42);
});
```
- [ ] Run `node --test tests/v11-engine.test.cjs`, retain actual RED. Implement validated mode/frozen configs and deterministic typed waves incrementally; add new failing tests for all types and geometry before behavior.
- [ ] Test relative motion, actual width/length swept contact, follower-wave spacing floor125/108 at varied steering/brake/nitro, no teleports, spawn population, static safe-corridor closure and successful deterministic sustained traversal in both modes. This is required, not optional.
- [ ] `npm run test:unit`, inspect all changed expectations, commit domain slice when green.

## Task 2 — reward/combo/events and records
Files: engine.js, records.js; tests/v11-engine.test.cjs, tests/records.test.cjs.
Interfaces: snapshot combo/multiplier/remaining/bestCombo/nearMissBonus/lastNearMiss; Records.open(storage,{mode}) and Normal existing key/Hard separate key.
- [ ] Before implementation, add seed-driven actual pass assertions for recharge16 capped100, event one-shot, two rapid passes produce incremental150 then300 bonuses, active-time8 expiry, pause freeze, reset, no collision reward and no duplicated traffic reward. Use ordinary deterministic steering; no internal state mutation.
- [ ] Observe RED then implement bounded state/event cloning and exact scoring. Return detached event on every snapshot. Resource/time endpoints at crash must remain coherent.
- [ ] Add failing independent mode-record isolation/old Normal-save preservation/denied-read/quota-write tests, then implement. `node --test tests/v11-engine.test.cjs tests/records.test.cjs`; commit after green.

## Task 3 — native controls/HUD and synthesized sound
Files: index.html, styles.css, app.js; add audio.js and tests/audio.test.cjs, tests/e2e/v11.spec.cjs; update scripts/public.cjs/build/export/check and boundary fixtures only for explicit new file.
Interfaces: mode selector, #sound toggle or clear semantic equivalent; renderer draw(snapshot,decorations) remains. Audio.create owns one lazily created context and update/mute/lifecycle methods (document concrete API), no game-state hook.
- [ ] Browser RED: getByRole('combobox',{name:/Mode/}) exists, selecting Hard then starting shows Hard; menu explains near-miss recharge; combo event indicator and sound opt-in appear. Native enabled controls retain focus and shortcut behavior.
- [ ] Test real OfflineAudioContext nonzero generated engine/boost/cue signal and silence when muted/paused; dependency injection for real context is allowed. Browser wraps actual AudioContext constructor for observation, not fake graph: no context before gesture/opt-in, one context across retries, pause/mute gains zero/suspended, blocked resume and missing API do not crash game. Test async stale resume ordering.
- [ ] Implement lazy user-gesture WebAudio, truthful available/blocked status, mute/no-loop-leak; integrate snapshot event dedupe for audio/HUD and active-time feedback. Sound default off. Unsupported audio affects sound only.
- [ ] Add audio.js explicitly to runtime allowlist/export, adjust boundary tests' synthetic runtime file lists accordingly, no new files served accidentally. `npm run check && npm run build && npm run export && npm test`; commit green UI/audio slice.

## Task 4 — material visual upgrade
Files: renderer.js/styles.css/index.html; tests/e2e/v11.spec.cjs.
- [ ] Add screenshot/layout/motion-mode browser assertions before renderer changes; compare real current and upgraded captures without claiming screenshots alone test beauty.
- [ ] Implement visibly distinct compact/sedan/van with exact widths, detailed player rear materials/lights/reflections, bounded body roll, spray/trails, layered city districts and boost feel. Keep world projection/hitboxes consistent. All extra motion suppressed by decorations/reduced-motion state.
- [ ] Browser viewport320/390/768/1366x768/1440 with DPR2 and all phases: no horizontal overflow, gameplay/control boxes inside viewport, no HUD/action overlap. All-phase axe no exclusions. Capture actual Normal/Hard playing/near-miss/boost/results/mobile for parent visual inspection.
- [ ] `npm run build && npm run export && npm test`; commit rendering slice only after functional tests pass.

## Task 5 — full acceptance-ready handoff
Files: package.json/package-lock.json README.md CHANGELOG.md docs/tdd-evidence.md; tests/manual/* and earlier tests as necessary for documented new contracts.
- [ ] Version1.1.0 (both package and lock), update controls/reward/formula/safety equation/types/audio contract/mute/mode-save docs, architecture and exact verification commands. v1.0 release/publication evidence remains historical.
- [ ] Adapt old manual oracle to new mode/actual dimensions/accumulated bonus contracts without self-derived expected results. Strengthen old one-contact-zone inequality. Ordinary-input successful avoider across mixed waves, and both modes source/build/standalone lifecycle. No test-only production hooks.
- [ ] Run `npm run verify` with bounded advisory fetch and preserve actual counts/outputs; `git diff --check`. If failure fix through new RED regression, never disable rules.
- [ ] Stage intended new files, `npm run package`, verify source ZIP member list/bytes and standalone network-free normal gameplay/audio fallback. Commit intended source; no generated artifacts in Git.
- [ ] Handoff exact commits/files, actual RED/GREEN logs/limits, unit/browser/manual counts, visual captures and remaining concerns. Parent reruns independently and obtains fresh read-only review before any release merge/deploy. Do not publish or claim parent review complete yourself.
