(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else Object.assign((root.Neon = root.Neon || {}), api);
})(globalThis, function () {
  "use strict";
  const KEY = "neon-drift.records.v1";
  const limits = Object.freeze({
    bestScore: 1e9,
    bestDistance: 1e9,
    bestNearMisses: 1e7,
    runs: 1e6,
  });
  const empty = () => ({
    version: 1,
    bestScore: 0,
    bestDistance: 0,
    bestNearMisses: 0,
    runs: 0,
  });
  function parse(raw) {
    const clean = empty();
    if (typeof raw !== "string" || new TextEncoder().encode(raw).length > 1024)
      return clean;
    try {
      const data = JSON.parse(raw);
      if (
        !data ||
        Array.isArray(data) ||
        data.version !== 1 ||
        ["__proto__", "constructor", "prototype"].some((k) =>
          Object.hasOwn(data, k),
        )
      )
        return clean;
      for (const [k, max] of Object.entries(limits))
        if (
          Object.hasOwn(data, k) &&
          Number.isInteger(data[k]) &&
          data[k] >= 0 &&
          data[k] <= max
        )
          clean[k] = data[k];
    } catch {
      /* Untrusted local data is never interpolated as markup. */
    }
    return clean;
  }
  function open(storage, { mode = "normal" } = {}) {
    if (mode !== "normal" && mode !== "hard") throw new TypeError("invalid mode");
    const key = KEY + (mode === "hard" ? ".hard" : "");
    let current = empty(),
      readable = false;
    try {
      current = parse(storage.getItem(key));
      readable = true;
    } catch {
      /* Session-only remains playable. */
    }
    const safe = (n, max) =>
      Number.isFinite(n) && n >= 0 ? Math.min(max, Math.floor(n)) : 0;
    return Object.freeze({
      readable,
      profile: () => ({ ...current }),
      finish(run) {
        current = {
          version: 1,
          bestScore: Math.max(
            current.bestScore,
            safe(run.score, limits.bestScore),
          ),
          bestDistance: Math.max(
            current.bestDistance,
            safe(run.distance, limits.bestDistance),
          ),
          bestNearMisses: Math.max(
            current.bestNearMisses,
            safe(run.nearMisses, limits.bestNearMisses),
          ),
          runs: Math.min(limits.runs, current.runs + 1),
        };
        let saved = false;
        try {
          storage.setItem(key, JSON.stringify(current));
          saved = true;
        } catch {
          /* Read success never implies write success. */
        }
        return { saved, profile: { ...current } };
      },
    });
  }
  return { Records: Object.freeze({ KEY, empty, parse, open }) };
});
