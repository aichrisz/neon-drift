const fs = require("node:fs"),
  path = require("node:path");
const ROOT = path.resolve(__dirname, "..");
const FILES = Object.freeze([
  "index.html",
  "styles.css",
  "engine.js",
  "records.js",
  "renderer.js",
  "app.js",
]);
// Walk every ancestor with lstat: realpath alone misses dangling symlinks.
function safe(p) {
  const full = path.resolve(p);
  let cur = path.parse(full).root;
  for (const part of full.slice(cur.length).split(path.sep).filter(Boolean)) {
    cur = path.join(cur, part);
    try {
      const s = fs.lstatSync(cur);
      if (s.isSymbolicLink()) throw Error("Symlink refused: " + cur);
      if (cur !== full && !s.isDirectory())
        throw Error("Non-directory ancestor");
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
  }
  return full;
}
function read(name, root = ROOT) {
  if (!FILES.includes(name)) throw Error("Not public");
  const p = safe(path.join(safe(root), name));
  if (!fs.statSync(p).isFile()) throw Error("Not regular");
  return fs.readFileSync(p, "utf8");
}
function output(dir, name, content) {
  if (!["dist", "artifacts"].includes(dir) || path.basename(name) !== name)
    throw Error("Invalid output");
  const target = safe(path.join(ROOT, dir));
  fs.mkdirSync(target, { recursive: true });
  const p = safe(path.join(target, name));
  if (fs.existsSync(p) && !fs.statSync(p).isFile()) throw Error("Not regular");
  fs.writeFileSync(p, content);
  return p;
}
module.exports = { ROOT, FILES, safe, read, output };
