const { FILES, read, output } = require("./public.cjs");
let html = read("index.html"),
  count = 0;
html = html.replace(
  /<link\b[^>]*href\s*=\s*["']styles\.css["'][^>]*\/?\s*>/gi,
  () => {
    count++;
    return "<style>" + read("styles.css") + "</style>";
  },
);
html = html.replace(
  /<script\b[^>]*src\s*=\s*["']([^"']+)["'][^>]*>\s*<\/script\s*>/gi,
  (_, name) => {
    if (!FILES.includes(name) || !name.endsWith(".js"))
      throw Error("Unknown script");
    count++;
    return (
      "<script>" + read(name).replace(/<\/script/gi, "<\\/script") + "</script>"
    );
  },
);
if (
  count !== FILES.length - 1 ||
  /<(?:script|link)\b[^>]*(?:src|href)\s*=/i.test(html) ||
  /url\s*\(/i.test(read("styles.css"))
)
  throw Error("Incomplete embedding");
// Inline classic scripts execute after the DOM, rather than relying on defer.
const scripts = [];
html = html.replace(/<script>[\s\S]*?<\/script>/g, (s) => {
  scripts.push(s);
  return "";
});
html = html.replace("</body>", scripts.join("\n") + "\n</body>");
console.log(output("artifacts", "Neon-Drift.html", html));
