# GitHub Pages deployment — 2026-10-22

Publication was explicitly authorized by Abel: “Coba push dan deploy”. This supersedes the earlier local-only delivery scope for this project.

## Targets and provenance

- Play: https://aichrisz.github.io/neon-drift/
- Public source: https://github.com/aichrisz/neon-drift
- Immutable source release `v1.0.0`: `c49a48ea6ba7cf6ef153224bdd55ef5c6862f30c`.
- First runtime Pages commit: `1521118cc6ce3fec52c26bdb47d9d5e15c96ff9f`.
- Pages source: `gh-pages`, root `/`, legacy branch build, HTTPS enforced.
- `main` includes later publication-only documentation; it is intentionally newer than the release tag. The original standalone HTML/48-file source ZIP and local release manifest continue to describe the tagged release, not the later docs.

## Publication boundary

The orphan first deployment contains exactly `index.html`, `styles.css`, `engine.js`, `records.js`, `renderer.js`, `app.js`, and an empty `.nojekyll`. Tests, development helpers, source evidence and dependencies remain on main; generated artifacts and host-only scripts are not published to Pages. Existing clean GitHub authentication was used; no embedded credential remote or workflow permission changes.

## Actual checks

- Source/history preflight inspected 48 tracked files, 71 reachable blobs and seven commits: no prohibited paths or credential-pattern hits. This is a targeted scan, not a claim that static scanning proves all secrets absent.
- Fresh `npm run check`, `npm run build`, `npm test`: 19/19 unit/boundary and 7/7 browser, no flaky/skipped/unexpected browser tests.
- Bounded online `npm audit --json --fetch-retries=0 --fetch-timeout=15000`: exit 0, zero vulnerabilities reported.
- Source main and peeled annotated tag were read back after push. Pages reported `built` at the exact runtime commit above.
- Every one of the six public runtime responses returned HTTP 200 over HTTPS and byte-matched its validated local dist counterpart.
- Ordinary-input public play-throughs at desktop 1366×768 and touch-emulated 390×844 exercised steering, nitro drain, simultaneous touch/cancel, pause/freeze/resume, blur pause, actual traffic crash, exactly-once saved records, replay and persistence on reload. No page/request errors or outside runtime requests; no horizontal overflow, arena/control boxes inside viewport; one active rAF chain and none pending at results.
- Real public screenshots were captured and the mobile playing image visually inspected. Chromium/touch emulation only, not physical-device or other-engine certification.

Machine-readable local evidence: `artifacts/publication-preflight.json`, `artifacts/github-pages-deployment.json`, `artifacts/publication-live-files.json` and `artifacts/parent/public-*-report.json`.

## Recovery

There is no older public release: this was the first deployment, so no previous-version rollback is claimed. The runtime commit above is the known-good recovery anchor. For future recovery, create a new commit on the existing gh-pages history restoring those exact six runtime bodies and `.nojekyll`; push without force, wait for built at the new SHA, then repeat public file and gameplay checks. Do not reset/delete the repository, rewrite release tags or disable the site as an implicit rollback.
