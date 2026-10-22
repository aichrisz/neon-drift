/* Lazy, opt-in synthesis. No network, timers or microphone. update never resumes
   a context: only setEnabled/activate called from native gestures may do that. */
(function (root) {
  "use strict";
  function create({ createContext = () => {
    const Context = root.AudioContext || root.webkitAudioContext;
    if (!Context) throw Error("WebAudio unavailable");
    return new Context();
  }, onStatus = () => {} } = {}) {
    let context, master, engine, boost, cue, engineGain, boostGain, cueGain;
    let enabled = false, unlocked = false, epoch = 0, lastId = 0;
    let snapshot = { phase: "ready", speed: 36 }, status = "muted";
    const report = value => { status = value; onStatus(value); };
    function value(param, n) {
      param.cancelScheduledValues(context.currentTime);
      param.setValueAtTime(n, context.currentTime);
    }
    function silence() {
      if (!context) return;
      if (master) value(master.gain, 0);
      if (cueGain) value(cueGain.gain, 0); // Cancel the entire pending one-shot envelope too.
    }
    function graph() {
      if (context) return;
      context = createContext();
      master = context.createGain(); master.gain.value = 0; master.connect(context.destination);
      function voice(type, frequency, gain) {
        const oscillator = context.createOscillator(), level = context.createGain();
        oscillator.type = type; oscillator.frequency.value = frequency; level.gain.value = gain;
        oscillator.connect(level); level.connect(master); oscillator.start();
        return [oscillator, level];
      }
      [engine, engineGain] = voice("triangle", 60, .15);
      [boost, boostGain] = voice("sawtooth", 110, 0);
      [cue, cueGain] = voice("sine", 880, 0);
      // One deterministic noise buffer, looped for the lifetime of the controller.
      const noise = context.createBuffer(1, context.sampleRate, context.sampleRate);
      const data = noise.getChannelData(0); let seed = 19;
      for (let i = 0; i < data.length; i++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        data[i] = (seed / 4294967296 * 2 - 1) * .45;
      }
      const source = context.createBufferSource(); source.buffer = noise; source.loop = true;
      source.connect(boostGain); source.start();
    }
    function apply() {
      if (!context || !master) return;
      if (!enabled || !unlocked || snapshot.phase !== "running") { silence(); return; }
      value(master.gain, .7);
      value(engine.frequency, 38 + snapshot.speed * 1.8);
      value(engineGain.gain, .15);
      value(boost.frequency, 100 + snapshot.speed * 2.3);
      value(boostGain.gain, snapshot.boosting ? .045 : 0);
    }
    async function setEnabled(wanted) {
      enabled = Boolean(wanted); const ticket = ++epoch;
      unlocked = false; silence();
      if (!enabled) { report("muted"); return; }
      report("pending");
      try {
        graph();
        // OfflineAudioContext is accepted for real waveform tests; it renders
        // explicitly and has no user-gesture resume lifecycle.
        if (typeof context.startRendering !== "function") await context.resume();
        if (ticket !== epoch || !enabled) return;
        unlocked = typeof context.startRendering === "function" || context.state === "running";
        report(unlocked ? "on" : "unavailable");
        apply(); // Uses current state, never an async-captured running snapshot.
      } catch {
        if (ticket !== epoch) return;
        unlocked = false; silence(); report("unavailable");
      }
    }
    function update(next) {
      if (snapshot.phase === "running" && next.phase !== "running") {
        ++epoch; // Pending resume must not resurrect a paused/result/muted cue.
        if (status === "pending") { unlocked = false; report("paused"); }
      }
      snapshot = next;
      apply();
      const id = next.lastNearMiss?.id || 0;
      if (id > lastId) {
        lastId = id; // Consume even while muted/blocked: never play stale events.
        if (context && enabled && unlocked && next.phase === "running") {
          const now = context.currentTime;
          value(cueGain.gain, 0);
          cueGain.gain.linearRampToValueAtTime(.16, now + .012);
          cueGain.gain.exponentialRampToValueAtTime(.0001, now + .23);
          cueGain.gain.setValueAtTime(0, now + .24);
          value(cue.frequency, 880);
          cue.frequency.exponentialRampToValueAtTime(1320, now + .18);
        }
      }
    }
    return Object.freeze({ setEnabled, activate: () => setEnabled(enabled), update,
      resetRun() { lastId = 0; silence(); }, status: () => status });
  }
  (root.Neon = root.Neon || {}).Audio = Object.freeze({ create });
})(globalThis);
