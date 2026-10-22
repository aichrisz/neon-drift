const { FILES, ROOT, read } = require("./public.cjs");
const { execFileSync } = require("node:child_process");
const path = require("node:path");
for (const f of FILES) {
  read(f);
  if (f.endsWith(".js"))
    execFileSync(process.execPath, ["--check", path.join(ROOT, f)]);
}
console.log("Runtime allowlist and JavaScript syntax OK");
