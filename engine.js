/* DOM-free domain. World units: lane centers for x, metres for z, seconds for t. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else Object.assign((root.Neon = root.Neon || {}), api);
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const CONFIG = Object.freeze({
    fixedStep: 1 / 120,
    maxDelta: 0.25,
    steerRate: 1.6,
    startSpeed: 36,
    cruiseSpeed: 46,
    maxCruiseSpeed: 58,
    difficultyRate: 0.12,
    maxSpeed: 84,
    brakeSpeed: 22,
    acceleration: 24,
    deceleration: 48,
    trafficSpeed: 20,
    playerWidth: 0.32,
    trafficWidth: 0.34,
    trafficOffset: 0.22,
    contactWidth: 0.33,
    playerLength: 4.4,
    trafficLength: 4.4,
    contactLength: 4.4,
    nearWidth: 0.49,
    spawnZ: 310,
    waveSpacing: 125,
    maxTraffic: 10,
    initialNitro: 55,
    nitroDrain: 26,
    nitroRecharge: 16,
    distancePoints: 2,
    nearMissPoints: 150,
    viewDistance: 440,
  });
  const MODE_CONFIG = Object.freeze({
    normal: Object.freeze({ startSpeed: 36, cruiseSpeed: 46, maxCruiseSpeed: 58, difficultyRate: .12, spacing: 140, minGap: 125, rampSeconds: 120 }),
    hard: Object.freeze({ startSpeed: 42, cruiseSpeed: 52, maxCruiseSpeed: 66, difficultyRate: .20, spacing: 125, minGap: 108, rampSeconds: 90 }),
  });
  const VEHICLES = Object.freeze({
    compact: Object.freeze({ width: .28, length: 3.8, speed: 22 }),
    sedan: Object.freeze({ width: .34, length: 4.4, speed: 20 }),
    van: Object.freeze({ width: .46, length: 6, speed: 16 }),
  });
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const neutral = () => ({
    left: false,
    right: false,
    brake: false,
    nitro: false,
  });
  // Slab intersection of the relative swept segment with the Minkowski car box.
  // Includes exact edge contact; handles movement on BOTH axes, not just depth.
  function sweepContact(x0, z0, x1, z1, halfWidth = CONFIG.contactWidth, halfLength = CONFIG.contactLength) {
    let enter = 0,
      exit = 1;
    for (const [a, b, radius] of [
      [x0, x1, halfWidth],
      [z0, z1, halfLength],
    ]) {
      const delta = b - a;
      if (Math.abs(delta) < 1e-14) {
        if (Math.abs(a) > radius) return null;
        continue;
      }
      const t0 = (-radius - a) / delta,
        t1 = (radius - a) / delta;
      enter = Math.max(enter, Math.min(t0, t1));
      exit = Math.min(exit, Math.max(t0, t1));
      if (enter > exit) return null;
    }
    return enter;
  }
  function create({ seed = 1, mode = "normal" } = {}) {
    if (!Object.hasOwn(MODE_CONFIG, mode)) throw new TypeError("invalid mode");
    const rules = MODE_CONFIG[mode];
    if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff)
      throw new TypeError("seed must be uint32");
    let randomState, state, input, wave, nextId;
    function random() {
      randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
      return randomState / 4294967296;
    }
    function spawn(z) {
      const open = Math.floor(random() * 3) - 1;
      const lanes = [-1, 0, 1].filter((x) => x !== open);
      const count = random() < 0.32 ? 1 : 2;
      wave++;
      // Preserve the two introductory waves, then vary static wave placement
      // without consuming RNG calls. This closes permanent inter-lane corridors
      // while each original open lane center retains ample collision clearance.
      const offset = wave <= 2 ? 0 : (((wave - 3) % 3) - 1) * CONFIG.trafficOffset;
      const type = Object.keys(VEHICLES)[Math.floor(random() * 3)];
      for (let i = 0; i < count; i++)
        state.traffic.push({
          id: ++nextId,
          wave,
          type,
          ...VEHICLES[type],
          x: lanes[i] + offset,
          z,
          passed: false,
          clearance: 2,
          color: Math.floor(random() * 3),
        });
    }
    function reset(phase) {
      randomState = seed;
      input = neutral();
      wave = 0;
      nextId = 0;
      state = {
        phase,
        mode,
        elapsed: 0,
        distance: 0,
        speed: rules.startSpeed,
        score: 0,
        nitro: CONFIG.initialNitro,
        nearMisses: 0,
        combo: 0,
        multiplier: 1,
        comboRemaining: 0,
        bestCombo: 0,
        nearMissBonus: 0,
        lastNearMiss: null,
        playerX: 0,
        boosting: false,
        traffic: [],
        crash: null,
      };
      spawn(CONFIG.spawnZ);
      spawn(CONFIG.spawnZ + rules.spacing);
    }
    reset("ready");
    function step(seconds) {
      if (
        typeof seconds !== "number" ||
        !Number.isFinite(seconds) ||
        seconds < 0
      )
        throw new TypeError("delta must be finite nonnegative seconds");
      if (state.phase !== "running") return;
      let remaining = Math.min(seconds, CONFIG.maxDelta);
      while (remaining > 1e-12 && state.phase === "running") {
        let dt = Math.min(CONFIG.fixedStep, remaining);
        const boosting = input.nitro && !input.brake && state.nitro > 1e-10;
        if (boosting) dt = Math.min(dt, state.nitro / CONFIG.nitroDrain);
        remaining -= dt;
        const target = input.brake
          ? CONFIG.brakeSpeed
          : boosting
            ? CONFIG.maxSpeed
            : Math.min(
                rules.maxCruiseSpeed,
                rules.cruiseSpeed + state.elapsed * rules.difficultyRate,
              );
        const rate =
          target < state.speed ? CONFIG.deceleration : CONFIG.acceleration;
        const speed1 =
          state.speed + clamp(target - state.speed, -rate * dt, rate * dt);
        // Each bounded step is a constant mean-velocity segment. Contact truncates
        // this very segment: time, distance, nitro and every car stop together.
        const meanSpeed = (state.speed + speed1) / 2;
        const travel = meanSpeed * dt;
        // Higher-z traffic leads lower-z traffic in world coordinates. Integrate
        // leaders first and cap follower velocity by available gap / dt. This
        // preserves the run's floor even for mixed types, without teleporting.
        const waves = [...new Set(state.traffic.map(c => c.wave))]
          .map(w => state.traffic.filter(c => c.wave === w))
          .sort((a, b) => b[0].z - a[0].z);
        let leader = null;
        for (const group of waves) {
          const car = group[0];
          const speed = Math.min(VEHICLES[car.type].speed, leader
            ? leader.speed + Math.max(0, car.z < leader.z ? leader.z - car.z - rules.minGap : 0) / dt
            : Infinity);
          for (const member of group) member.speed = speed;
          leader = car;
        }
        const x0 = state.playerX;
        const x1 = clamp(
          x0 +
            (Number(input.right) - Number(input.left)) * CONFIG.steerRate * dt,
          -1,
          1,
        );
        let fraction = 1,
          hit = null;
        for (const car of state.traffic) {
          const contact = sweepContact(
            x0 - car.x,
            car.z,
            x1 - car.x,
            car.z - travel + car.speed * dt,
            (CONFIG.playerWidth + car.width) / 2,
            (CONFIG.playerLength + car.length) / 2,
          );
          if (contact !== null && (hit === null || contact < fraction)) {
            fraction = contact;
            hit = car;
          }
        }
        state.playerX = x0 + (x1 - x0) * fraction;
        state.speed += (speed1 - state.speed) * fraction;
        state.distance += travel * fraction;
        state.elapsed += dt * fraction;
        state.comboRemaining = state.lastNearMiss
          ? Math.max(0, 8 - (state.elapsed - state.lastNearMiss.elapsed)) : 0;
        if (state.comboRemaining === 0) {
          state.combo = 0;
          state.multiplier = 1;
        }
        state.nitro = clamp(
          state.nitro - (boosting ? CONFIG.nitroDrain * dt * fraction : 0),
          0,
          100,
        );
        if (state.nitro < 1e-10) state.nitro = 0;
        state.boosting = boosting && state.nitro > 0 && !hit;
        for (const car of state.traffic) {
          const z0 = car.z;
          const halfLength = (CONFIG.playerLength + car.length) / 2;
          const halfWidth = (CONFIG.playerWidth + car.width) / 2;
          car.z -= (travel - car.speed * dt) * fraction;
          if (z0 >= -halfLength && car.z <= halfLength) {
            const depth = z0 - car.z;
            const begin =
              depth > 0 ? clamp((z0 - halfLength) / depth, 0, 1) : 0;
            const end =
              depth > 0 ? clamp((z0 + halfLength) / depth, 0, 1) : 1;
            const a = x0 + (state.playerX - x0) * begin - car.x;
            const b = x0 + (state.playerX - x0) * end - car.x;
            car.clearance = Math.min(
              car.clearance,
              a * b <= 0 ? 0 : Math.min(Math.abs(a), Math.abs(b)),
            );
          }
          if (!hit && !car.passed && car.z < -halfLength) {
            car.passed = true;
            if (
              car.clearance > halfWidth &&
              car.clearance <= halfWidth + .16
            ) {
              state.nearMisses++;
              const nitroAdded = Math.min(CONFIG.nitroRecharge, 100 - state.nitro);
              state.nitro += nitroAdded;
              state.combo++;
              state.multiplier = Math.min(4, state.combo);
              state.comboRemaining = 8;
              state.bestCombo = Math.max(state.bestCombo, state.combo);
              const bonus = CONFIG.nearMissPoints * state.multiplier;
              state.nearMissBonus += bonus;
              state.lastNearMiss = { id: state.nearMisses, elapsed: state.elapsed,
                nitroAdded, bonus, combo: state.combo, multiplier: state.multiplier };
            }
          }
        }
        if (hit) {
          state.phase = "results";
          input = neutral();
          state.crash = {
            id: hit.id,
            x: state.playerX,
            z: hit.z,
            elapsed: state.elapsed,
          };
        }
        state.traffic = state.traffic.filter((c) => c.z > -20);
        const furthest = Math.max(...state.traffic.map((c) => c.z));
        if (
          furthest <= CONFIG.spawnZ &&
          state.traffic.length <= CONFIG.maxTraffic - 2
        )
          spawn(furthest + rules.spacing - (rules.spacing - rules.minGap) * Math.min(1, state.elapsed / rules.rampSeconds));
        state.score =
          Math.floor(state.distance * CONFIG.distancePoints) +
          state.nearMissBonus;
      }
    }
    return Object.freeze({
      start() {
        reset("running");
      },
      setInput(value) {
        if (!value || typeof value !== "object" || Array.isArray(value))
          throw new TypeError("input must be an object");
        for (const key of Object.keys(value))
          if (!Object.hasOwn(input, key) || typeof value[key] !== "boolean")
            throw new TypeError("input flags must be boolean");
        input = { ...neutral(), ...value };
      },
      step,
      pause() {
        if (state.phase === "running") {
          state.phase = "paused";
          input = neutral();
          state.boosting = false;
        }
      },
      resume() {
        if (state.phase === "paused") {
          state.phase = "running";
          input = neutral();
        }
      },
      snapshot() {
        return Object.freeze({
          ...state,
          lastNearMiss: state.lastNearMiss && Object.freeze({ ...state.lastNearMiss }),
          traffic: Object.freeze(state.traffic.map((c) => Object.freeze({ ...c }))),
          crash: state.crash && Object.freeze({ ...state.crash }),
        });
      },
    });
  }
  return Object.freeze({
    Engine: Object.freeze({ create }),
    CONFIG,
    MODE_CONFIG,
    VEHICLES,
    sweepContact,
  });
});
