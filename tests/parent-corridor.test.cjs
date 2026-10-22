/* Parent regression: releasing steering between lanes must not be permanent invulnerability. */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { Engine } = require("../engine.js");
test("all stationary lateral positions eventually meet real traffic across deterministic seeds", () => {
  for (let seed = 1; seed <= 5; seed++)
    for (let j = -20; j <= 20; j++) {
      const x = j / 20,
        e = Engine.create({ seed });
      e.start();
      e.setInput({ left: x < 0, right: x > 0 });
      let move = Math.abs(x) / 1.6;
      while (move > 1e-10) {
        const dt = Math.min(0.1, move);
        e.step(dt);
        move -= dt;
      }
      e.setInput({});
      assert.ok(Math.abs(e.snapshot().playerX - x) < 1e-8);
      for (let i = 0; i < 480 && e.snapshot().phase === "running"; i++)
        e.step(0.25);
      const s = e.snapshot();
      assert.equal(
        s.phase,
        "results",
        `stationary x=${x}, seed=${seed} is invulnerable`,
      );
      assert.ok(s.crash);
    }
});
