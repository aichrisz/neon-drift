# Implementation evidence and handoff

## v1.1 continuation

The sections below are historical v1.0 evidence. Current v1.1 genuine RED/GREEN logs and changed-contract oracle explanations are in `docs/v1.1-implementation-evidence.md`; completed parent acceptance is in `docs/v1.1-parent-acceptance.md` (26 unit,31 browser,13 edge,eight lifecycle variants,online audit0,fresh Astra ship with one low audio-label note). Do not apply historical v1.0 publication/reviewer approval to v1.1. No new dependency installation or external publication was performed for v1.1.

This document preserves the **initial implementer checkpoint** below, followed by expanded parent acceptance. Initial counts and archive size are historical, not the final release totals. No push or public deployment is authorized.

## Observed RED → GREEN

Raw logs are retained in artifacts/evidence/; selected checkpoints are also copied to docs/evidence/ so the source archive retains them.

1. 01-engine-red.log: node --test tests/engine.test.cjs, exit1 before engine.js existed. Implemented state/motion/fairness. 01-engine-green.log exit0, 3 tests.
2. 02-traffic-red.log: node --test tests/traffic.test.cjs, exit1 before swept collision/nitro/pass implementation. 02-traffic-attempt.log records an additional failing pass fixture: the supposed far lane was occupied. Corrected the fixture to the actually open lane, not the engine. 02-traffic-green.log exit0, 8 tests total.
3. 03-ui-red.log: Playwright native lifecycle tracer, exit1 before HTML/controller existed (file navigation failure). This is a coarse missing-runtime tracer, not per-handler RED evidence. 03-ui-green-attempt.log exit0 for 11 unit tests and the native lifecycle test after implementation.
4. 04-records-red.log: unit test exit1 before records.js existed. Storage tests passed as part of the 11-test suite. There is no separate standalone records GREEN log; combined logs contain its three passing tests.

The delivery helpers and delivery smoke tests were NOT developed through an observed boundary RED cycle. Do not infer complete strict TDD from the above checkpoints.

## Executed verification

- npm install --ignore-scripts --fetch-timeout=15000 --fetch-retries=0 --no-audit: exit0, “added 4 packages in 1s”. No offline fallback needed. An initial compound install command was blocked by the tool scanner, then the simple command succeeded.
- npm run check: exit0, “Runtime allowlist and JavaScript syntax OK”.
- npm run build: exit0, “Built 6 runtime files in dist/”.
- npm run export: exit0, produced artifacts/Neon-Drift.html.
- npm run package: exit0; artifacts/Neon-Drift-source.zip contained37 tracked files, ZIP integrity and every member's bytes verified by the Python helper.
- Initial expanded suite full-test.log: 11 units passed, 3 browser delivery tests passed, native tracer failed a wall-clock-sensitive post-retry distance assertion (10 received, expected <10). Test corrected to freeze the browser clock at retry and assert exact zero; production code unchanged.
- Fresh npm test, final-test.log: exit0; 11 unit tests passed, 0 failed/skipped; 4 browser tests passed (22.9s). Browser cases: source HTTP, dist file URL, standalone file URL offline, and native source-file lifecycle.
- Standalone offline case observed exactly one document request and no neighbor/external requests; actual steering, distance and pause exercised. Native source tracer exercised start, steering, nitro, pause/freeze/resume, actual collision, save status and replay.
- axe WCAG2A/AA/2.1AA + best-practice: no exclusions, zero violations at READY for source/dist/offline. Other phases not audited yet.
- Source/dist/offline screenshots captured at real390x844 and1366x768; geometry assertions confirmed no horizontal overflow, canvas height>300 and controls bottom within viewport. Running screenshots also captured. These images have NOT received independent visual inspection through an image viewer in this terminal-only run. Do not treat screenshot creation as visual acceptance.
- npm audit --fetch-timeout=15000 --fetch-retries=0: exit0, “found 0 vulnerabilities”. Online command, no cached fallback used. Registry intelligence freshness beyond this response is not asserted.

## Initial handoff gaps (superseded by parent coverage below)

- Synthetic server/input/output/ancestor/dangling symlink and traversal boundary regression tests (implementation guards exist, not fully tested).
- Explicit pointer simultaneous/cancel/lostcapture automation, keyboard release/focused P/Esc coverage, hidden/blur/pagehide freeze, rAF count instrumentation, mid-run resize invariance.
- Axe running/paused/results; viewports320/768/1440 and DPR2 coverage; noJS and reduced-motion automated cases; human visual inspection.
- Native saved-record reload/denied/quota/once-only browser tests (pure storage unit cases do pass).
- Dist and standalone crash/retry paths specifically, rather than inferring from source tracer; broader seed/fairness adversarial tests.
- Independent parent review, fingerprints and release acceptance. No physical-device, Safari/Firefox or nonvisual driving-equivalence claim.

Real initial screenshots: artifacts/source-390-ready.png, source-1366-ready.png, source-running.png, and matching dist/offline names. Paths are relative to the project.

## Parent acceptance expansion

- `tests/manual/engine.cjs`: independent scoring/range/fairness invariants, seeded determinism, 20 real unattended crashes, 10,000 swept-contact fuzz cases computed with a rectangle-face algorithm different from production, and one-time close-pass recharge. The domain report records exact seed totals.
- `tests/manual/browser.cjs`: native keyboard play through source/dist/standalone, actual crash, once-only save, replay, reload persistence, pause/blur, no scrolling on Space, rAF instrumentation (one chain while active, none while idle/paused/results), and 390×844 simultaneous CDP touch plus cancellation. No live game instance is exposed or mutated.
- `tests/manual/edge.cjs`: 13 responsive/storage/noJS/reduced-motion/near-pass browser cases. RNG is replaced only as a test environment dependency before initialization for deterministic ordinary-input paths. It is not a game-state hook. Long edge runs use 100ms displayed frames while domain substeps remain 120Hz.
- `tests/parent-boundary.test.cjs`: seven synthetic boundary tests first passed on the guarded implementation; **coverage expansion, not an observed production-fix RED cycle**.
- `tests/e2e/parent-acceptance.spec.cjs`: all-phase axe, focused-key pause, key release, actual lost-capture processing and simulated platform lifecycle signals.
- Parent all-phase axe initially failed during DRIVING with `page-has-heading-one` because hiding the menu also hid the only h1. Astra added a persistent visually-hidden h1, moved the menu title to h2, preserved styles, and the same all-phase scan passed without disabling rules.
- An added lost-capture test initially failed because the harness assumed releasePointerCapture fires its event synchronously. The corrected test supplies the next real pointer event, then asserts release **before mouseup**. No production change. The RED diagnostic is retained in docs/evidence/parent-lost-capture-harness-red.log.
- Earlier parent harness corrections used the actual root background instead of a transparent body, accessible button text rather than overly exact matching, and the visible no-JS child instead of noscript container box visibility. No production mechanics changed to satisfy those harness assumptions.
- Final automated results, online audit response and source/archive integrity are recorded under artifacts/acceptance and artifacts/release-manifest.json; fresh reviewer verdict under artifacts/independent-review.json. Initial 37-member ZIP above is superseded by the final manifest count.
- Remaining limitations: Chromium automation, not physical devices, Safari/Firefox, real navigation/BFCache certification or human screen-reader usability. Procedurally open traffic lanes do not promise that a player choosing a late/wrong maneuver can always recover.

## Fresh review correction cycle

The first fresh Astra reviewer returned changes_required (docs/evidence/parent-review-first.json). Parent reproduced two issues before correction:

- `node --test tests/parent-corridor.test.cjs`: RED, stationary x=-0.65 seed1 was still running after120s. Fixed by varying actual static traffic x across later waves, not by injecting collisions or widening hidden hitboxes. First two intro waves and real near-pass behavior remain unchanged. All 41 lateral positions across5seeds must now actually crash if steering is released for120active seconds.
- `npm run test:browser -- --grep 'pause focus'`: RED, enabled pause did not own focus because the controller attempted focus before render enabled it. Corrected render-before-focus order and directly asserted activeElement after start/resume/replay.
- Documentation fairness proof now includes twice the longitudinal contact length, matching the stronger independent oracle. Spacing125 already exceeds the required88.8m.

The complete parent gate was rerun after these actual source corrections: 19 unit/boundary and 7 browser tests passed, plus 13 edge cases; the online audit returned zero vulnerabilities. Raw RED logs remain under docs/evidence; the fresh final read-only Astra review returned ship with no security/logic blockers. Review fingerprints and local release bytes are recorded separately from the first review.
