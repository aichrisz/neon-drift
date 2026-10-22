/* Parent coverage expansion; boundary fixtures contain synthetic data only. */
"use strict";
const test = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  { spawnSync } = require("node:child_process");
const ROOT = path.resolve(__dirname, "..");
const { FILES, read } = require("../scripts/public.cjs");
function fixture(fn) {
  const base = process.env.TMPDIR || path.join(ROOT, "artifacts", "fixtures");
  fs.mkdirSync(base, { recursive: true });
  const top = fs.mkdtempSync(path.join(base, "neon-parent-"));
  const root = path.join(top, "project");
  fs.mkdirSync(path.join(root, "scripts"), { recursive: true });
  try {
    for (const name of FILES) {
      fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
      fs.copyFileSync(path.join(ROOT, name), path.join(root, name));
    }
    for (const name of ["public.cjs", "build.cjs", "export.cjs", "package.py"])
      fs.copyFileSync(
        path.join(ROOT, "scripts", name),
        path.join(root, "scripts", name),
      );
    return fn(top, root);
  } finally {
    fs.rmSync(top, { recursive: true, force: true });
  }
}
const run = (root, name) =>
  spawnSync(process.execPath, [path.join(root, "scripts", name)], {
    cwd: path.dirname(root),
    encoding: "utf8",
    timeout: 15000,
  });
test('export refuses duplicate runtime scripts even when total count is unchanged',()=>
  fixture((top,root)=>{
    const file=path.join(root,'index.html');
    fs.writeFileSync(file,fs.readFileSync(file,'utf8').replace('src="engine.js"','src="audio.js"'));
    assert.notEqual(run(root,'export.cjs').status,0,'each allowlisted script must occur exactly once');
  }));
test("normal cwd-independent build emits exactly the runtime source bodies", () =>
  fixture((top, root) => {
    const r = run(root, "build.cjs");
    assert.equal(r.status, 0, r.stderr);
    assert.deepEqual(
      fs.readdirSync(path.join(root, "dist")).sort(),
      [...FILES].sort(),
    );
    for (const name of FILES)
      assert.deepEqual(
        fs.readFileSync(path.join(root, "dist", name)),
        fs.readFileSync(path.join(root, name)),
      );
  }));
test("public reader refuses serving-root symlink and non-allowlisted paths", () =>
  fixture((top, root) => {
    const link = path.join(top, "link");
    fs.symlinkSync(root, link, "dir");
    assert.throws(() => read("index.html", link));
    for (const name of [
      "package.json",
      "../outside",
      ".env",
      "scripts/public.cjs",
    ])
      assert.throws(() => read(name, root));
  }));
test("public reader refuses final symlink", () =>
  fixture((top, root) => {
    const external = path.join(top, "synthetic");
    fs.writeFileSync(external, "SYNTHETIC_SENTINEL");
    fs.unlinkSync(path.join(root, "engine.js"));
    fs.symlinkSync(external, path.join(root, "engine.js"));
    assert.throws(() => read("engine.js", root));
  }));
test("build refuses output-root symlink without touching outside data", () =>
  fixture((top, root) => {
    const outside = path.join(top, "outside");
    fs.mkdirSync(outside);
    const sentinel = path.join(outside, "index.html");
    fs.writeFileSync(sentinel, "DO_NOT_OVERWRITE");
    fs.symlinkSync(outside, path.join(root, "dist"), "dir");
    assert.notEqual(run(root, "build.cjs").status, 0);
    assert.equal(fs.readFileSync(sentinel, "utf8"), "DO_NOT_OVERWRITE");
  }));
test("build refuses dangling output-file link without creating outside target", () =>
  fixture((top, root) => {
    fs.mkdirSync(path.join(root, "dist"));
    const outside = path.join(top, "not-created.js");
    fs.symlinkSync(outside, path.join(root, "dist", "app.js"));
    assert.notEqual(run(root, "build.cjs").status, 0);
    assert.equal(fs.existsSync(outside), false);
  }));
test("export refuses dangling output link without creating outside target", () =>
  fixture((top, root) => {
    fs.mkdirSync(path.join(root, "artifacts"));
    const outside = path.join(top, "not-created.html");
    fs.symlinkSync(outside, path.join(root, "artifacts", "Neon-Drift.html"));
    assert.notEqual(run(root, "export.cjs").status, 0);
    assert.equal(fs.existsSync(outside), false);
  }));
test("archive refuses dangling output link without creating outside target", () =>
  fixture((top, root) => {
    fs.mkdirSync(path.join(root, "artifacts"));
    const outside = path.join(top, "not-created.zip");
    fs.symlinkSync(
      outside,
      path.join(root, "artifacts", "Neon-Drift-source.zip"),
    );
    const r = spawnSync("python3", [path.join(root, "scripts/package.py")], {
      cwd: top,
      encoding: "utf8",
      timeout: 15000,
    });
    assert.notEqual(r.status, 0);
    assert.equal(fs.existsSync(outside), false);
  }));
