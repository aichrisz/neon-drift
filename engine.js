/* DOM-free domain. World units: lane centers for x, metres for z, seconds for t. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else Object.assign(root.Neon = root.Neon || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const CONFIG = Object.freeze({
    fixedStep: 1 / 120, maxDelta: 0.25, steerRate: 1.6,
    startSpeed: 36, cruiseSpeed: 46, maxCruiseSpeed: 58, difficultyRate: 0.12,
    maxSpeed: 84, brakeSpeed: 22, acceleration: 24, deceleration: 48,
    trafficSpeed: 20, playerWidth: 0.32, trafficWidth: 0.34,
    contactWidth: 0.33, playerLength: 4.4, trafficLength: 4.4, contactLength: 4.4,
    nearWidth: 0.49, spawnZ: 310, waveSpacing: 125, maxTraffic: 10,
    initialNitro: 55, nitroDrain: 26, nitroRecharge: 16,
    distancePoints: 2, nearMissPoints: 150, viewDistance: 440
  });
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const neutral = () => ({left: false, right: false, brake: false, nitro: false});
  function create({seed = 1} = {}) {
    if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new TypeError('seed must be uint32');
    let randomState, state, input, wave, nextId;
    function random() {
      randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
      return randomState / 4294967296;
    }
    function spawn(z) {
      const open = Math.floor(random() * 3) - 1;
      const lanes = [-1, 0, 1].filter(x => x !== open);
      const count = random() < 0.32 ? 1 : 2;
      wave++;
      for (let i = 0; i < count; i++) state.traffic.push({id: ++nextId, wave, x: lanes[i], z, passed: false, clearance: 2, color: Math.floor(random() * 3)});
    }
    function reset(phase) {
      randomState = seed; input = neutral(); wave = 0; nextId = 0;
      state = {phase, elapsed: 0, distance: 0, speed: CONFIG.startSpeed,
        score: 0, nitro: CONFIG.initialNitro, nearMisses: 0, playerX: 0,
        boosting: false, traffic: [], crash: null};
      spawn(CONFIG.spawnZ); spawn(CONFIG.spawnZ + CONFIG.waveSpacing);
    }
    reset('ready');
    function step(seconds) {
      if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0) throw new TypeError('delta must be finite nonnegative seconds');
      if (state.phase !== 'running') return;
      let remaining = Math.min(seconds, CONFIG.maxDelta);
      while (remaining > 1e-12 && state.phase === 'running') {
        const dt = Math.min(CONFIG.fixedStep, remaining); remaining -= dt;
        const target = input.brake ? CONFIG.brakeSpeed : Math.min(CONFIG.maxCruiseSpeed, CONFIG.cruiseSpeed + state.elapsed * CONFIG.difficultyRate);
        const rate = target < state.speed ? CONFIG.deceleration : CONFIG.acceleration;
        state.speed += clamp(target - state.speed, -rate * dt, rate * dt);
        const travel = state.speed * dt;
        state.playerX = clamp(state.playerX + (Number(input.right) - Number(input.left)) * CONFIG.steerRate * dt, -1, 1);
        state.distance += travel; state.elapsed += dt;
        for (const car of state.traffic) car.z -= travel - CONFIG.trafficSpeed * dt;
        state.traffic = state.traffic.filter(c => c.z > -20);
        const furthest = Math.max(...state.traffic.map(c => c.z));
        if (furthest <= CONFIG.spawnZ && state.traffic.length <= CONFIG.maxTraffic - 2) spawn(furthest + CONFIG.waveSpacing);
        state.score = Math.floor(state.distance * CONFIG.distancePoints) + state.nearMisses * CONFIG.nearMissPoints;
      }
    }
    return Object.freeze({
      start() {reset('running');},
      setInput(value) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('input must be an object');
        for (const key of Object.keys(value)) if (!Object.hasOwn(input, key) || typeof value[key] !== 'boolean') throw new TypeError('input flags must be boolean');
        input = {...neutral(), ...value};
      },
      step,
      pause() {if (state.phase === 'running') {state.phase = 'paused'; input = neutral(); state.boosting = false;}},
      resume() {if (state.phase === 'paused') {state.phase = 'running'; input = neutral();}},
      snapshot() {return {...state, traffic: state.traffic.map(c => ({...c})), crash: state.crash && {...state.crash}};}
    });
  }
  return Object.freeze({Engine: Object.freeze({create}), CONFIG});
});
