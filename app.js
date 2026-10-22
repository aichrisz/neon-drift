(function () {
  "use strict";
  const $ = (id) => document.getElementById(id),
    primary = $("primary");
  try {
    let engine = Neon.Engine.create({
        seed: crypto.getRandomValues(new Uint32Array(1))[0],
      });
    const renderer = Neon.Renderer.create($("road"));
    const audio = Neon.Audio.create({ onStatus(status) {
      $("sound-status").textContent = { muted: "Suara mati", pending: "Suara menunggu", on: "Suara aktif", paused: "Suara dijeda", unavailable: "Suara tidak tersedia" }[status];
    }});
    let storage;
    try {
      storage = localStorage;
    } catch {
      storage = null;
    }
    const profiles = { normal: Neon.Records.open(storage), hard: Neon.Records.open(storage, {mode: "hard"}) };
    let records = profiles.normal, eventId = 0;
    const keys = new Set(),
      pointers = new Map();
    const buttons = [...document.querySelectorAll("[data-input]")];
    const mapping = {
      ArrowLeft: "left",
      KeyA: "left",
      ArrowRight: "right",
      KeyD: "right",
      ArrowDown: "brake",
      KeyS: "brake",
      Space: "nitro",
      ArrowUp: "nitro",
      KeyW: "nitro",
    };
    let raf = null,
      last = null,
      finished = false;
    $("decorations").checked = !matchMedia("(prefers-reduced-motion: reduce)")
      .matches;
    function input() {
      const flags = { left: false, right: false, brake: false, nitro: false };
      for (const k of keys) flags[mapping[k]] = true;
      for (const b of pointers.values()) flags[b.dataset.input] = true;
      engine.setInput(flags);
      for (const b of buttons)
        b.setAttribute("aria-pressed", String(flags[b.dataset.input]));
    }
    function clear() {
      keys.clear();
      pointers.clear();
      input();
    }
    function stop() {
      if (raf !== null) cancelAnimationFrame(raf);
      raf = null;
      last = null;
    }
    function render() {
      const s = engine.snapshot();
      $("distance").textContent = Math.floor(s.distance);
      $("score").textContent = s.score;
      $("speed").textContent = Math.round(s.speed * 3.6);
      $("near").textContent = s.nearMisses;
      $("mode-label").textContent = s.mode === "hard" ? "Hard" : "Normal";
      $("mode").disabled = s.phase === "running" || s.phase === "paused";
      $("combo").textContent = `COMBO ${s.combo} · ×${s.multiplier}`;
      $("combo-time").value = s.comboRemaining;
      const event = s.lastNearMiss;
      if (event && event.id > eventId) {
        eventId = event.id;
        $("near-event").textContent = `NEAR MISS · +${Number(event.nitroAdded.toFixed(1))} NITRO`;
      }
      const feedback = event && s.elapsed - event.elapsed < 2;
      $("near-event").hidden = !feedback;
      $("nitro").classList.toggle("recharged", Boolean(feedback));
      audio.update(s);
      $("nitro").value = s.nitro;
      $("nitro-text").textContent = Math.round(s.nitro) + "%";
      $("phase").textContent = {
        ready: "SIAP",
        running: "MENGEMUDI",
        paused: "JEDA",
        results: "SELESAI",
      }[s.phase];
      $("pause").disabled = s.phase !== "running";
      for (const b of buttons) b.disabled = s.phase !== "running";
      $("record").textContent = records.profile().bestScore;
      renderer.draw(s, $("decorations").checked);
    }
    function panel(phase) {
      $("panel").hidden = phase === "running";
      $("result-stats").hidden = phase !== "results";
      if (phase === "paused") {
        $("panel-title").textContent = "Tarik napas.";
        $("panel-description").textContent =
          "Perjalanan dijeda. Waktu, lalu lintas, dan nitro berhenti sampai kamu melanjutkan.";
        primary.textContent = "Lanjutkan";
      }
      if (phase === "results") {
        $("panel-title").textContent = "Perjalanan berakhir.";
        $("panel-description").textContent =
          "Satu sentuhan, akhir perjalanan. Jalan berikutnya menunggu.";
        primary.textContent = "Coba lagi";
      }
      if (phase !== "running") primary.focus({ preventScroll: true });
    }
    function frame(now) {
      raf = null;
      if (engine.snapshot().phase !== "running") return;
      if (last !== null)
        engine.step(Math.min(0.1, Math.max(0, (now - last) / 1000)));
      last = now;
      const s = engine.snapshot();
      if (s.phase === "results") {
        stop();
        clear();
        if (!finished) {
          finished = true;
          const result = records.finish(s);
          $("save-status").textContent = result.saved
            ? "Rekor berhasil disimpan di browser ini."
            : "Penyimpanan tidak tersedia. Rekor hanya untuk sesi ini.";
          $("final-distance").textContent = Math.floor(s.distance) + " m";
          $("final-score").textContent = s.score;
          $("final-near").textContent = s.nearMisses;
          $("panel-kicker").textContent = `${s.mode === "hard" ? "Hard" : "Normal"} · BEST COMBO ${s.bestCombo}`;
        }
        panel("results");
      }
      render();
      if (s.phase === "running") raf = requestAnimationFrame(frame);
    }
    function run() {
      if (raf === null) {
        last = null;
        raf = requestAnimationFrame(frame);
      }
    }
    function pause() {
      if (engine.snapshot().phase !== "running") return;
      engine.pause();
      stop();
      clear();
      panel("paused");
      render();
    }
    primary.addEventListener("click", () => {
      clear();
      if (engine.snapshot().phase === "paused") engine.resume();
      else {
        if (engine.snapshot().mode !== $("mode").value) {
          engine = Neon.Engine.create({seed: crypto.getRandomValues(new Uint32Array(1))[0], mode: $("mode").value});
        }
        records = profiles[$("mode").value];
        engine.start();
        eventId = 0;
        $("near-event").textContent = "";
        audio.resetRun();
        finished = false;
        $("save-status").textContent = records.readable
          ? "Rekor tersimpan hanya di browser ini."
          : "Penyimpanan tidak tersedia; rekor sesi saja.";
      }
      panel("running");
      render();
      void audio.activate();
      $("pause").focus({ preventScroll: true });
      run();
    });
    $("pause").addEventListener("click", pause);
    $("sound").addEventListener("change", () => { void audio.setEnabled($("sound").checked); });
    $("mode").addEventListener("change", () => {
      if (!["ready", "results"].includes(engine.snapshot().phase)) return;
      records = profiles[$("mode").value];
      $("record").textContent = records.profile().bestScore;
    });
    document.addEventListener("keydown", (e) => {
      if (engine.snapshot().phase !== "running") return;
      if (e.code === "KeyP" || e.code === "Escape") {
        e.preventDefault();
        pause();
        return;
      }
      // Space on native settings must toggle them, not be stolen by driving.
      if (["INPUT", "SELECT"].includes(e.target.tagName)) return;
      if (mapping[e.code]) {
        e.preventDefault();
        keys.add(e.code);
        input();
      }
    });
    document.addEventListener("keyup", (e) => {
      if (mapping[e.code]) {
        keys.delete(e.code);
        input();
        // Release held driving keys even if focus moved to a setting. Native
        // checkbox Space activation occurs on keyup, so preserve its default.
        if (
          engine.snapshot().phase === "running" &&
          !["INPUT", "SELECT"].includes(e.target.tagName)
        ) e.preventDefault();
      }
    });
    for (const b of buttons) {
      b.addEventListener("pointerdown", (e) => {
        if (engine.snapshot().phase !== "running") return;
        e.preventDefault();
        b.setPointerCapture(e.pointerId);
        pointers.set(e.pointerId, b);
        input();
      });
      for (const event of ["pointerup", "pointercancel", "lostpointercapture"])
        b.addEventListener(event, (e) => {
          pointers.delete(e.pointerId);
          input();
        });
      b.addEventListener("contextmenu", (e) => e.preventDefault());
    }
    window.addEventListener("blur", pause);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) pause();
    });
    window.addEventListener("pagehide", pause);
    new ResizeObserver(() => {
      renderer.resize();
      render();
    }).observe($("road"));
    $("decorations").addEventListener("change", render);
    $("help").addEventListener("click", () => {
      pause();
      $("visual-note").hidden = !$("visual-note").hidden;
      $("help").setAttribute("aria-expanded", String(!$("visual-note").hidden));
    });
    render();
    primary.disabled = false;
    primary.textContent = "Mulai mengemudi";
  } catch (error) {
    $("panel-description").textContent =
      "Permainan tidak dapat diinisialisasi: " + error.message;
    primary.disabled = true;
    primary.textContent = "Tidak tersedia";
  }
})();
