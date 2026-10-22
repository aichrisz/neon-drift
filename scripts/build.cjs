const { FILES, read, output } = require("./public.cjs");
for (const name of FILES) output("dist", name, read(name));
console.log("Built " + FILES.length + " runtime files in dist/");
