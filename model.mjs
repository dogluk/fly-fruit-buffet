import { FLYWIRE_PN_KC } from './flywire_pn_kc.mjs';
import { DISHES, MODEL, ODORANTS, PHASES } from './config.mjs';
import { DOOR_RESPONSES } from './door_responses.mjs';
import { MB_OUTPUT } from './mb_output.mjs';

export const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
export function randomGenerator(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Odorant name -> row in the measured response matrix. Anything this world
// names must actually have been measured; a typo must fail loudly, not read
// as an odorant nobody can smell.
export const ODORANT_ROW = ODORANTS.map(name => {
  const i = DOOR_RESPONSES.odorants.indexOf(name);
  if (i < 0) throw new Error(`odorant "${name}" is not in DoOR's measured set`);
  return i;
});
const GLOM = DOOR_RESPONSES.glomeruli;

// Each uniglomerular PN is named by the glomerulus it innervates ("DM1_lPN"),
// which is the join key into DoOR. PNs whose glomerulus DoOR does not measure
// well enough get no drive -- they stay in the circuit, silent, rather than
// being quietly deleted or fed a made-up number.
function pnGlomerulusRows(cellTypes) {
  return cellTypes.map(t => GLOM.indexOf(String(t).split('_')[0]));
}

// Measured response of every glomerulus to a mixture. Linear summation is a
// simplification: real mixtures show masking and competitive binding at the
// receptor. null in DoOR means NOT MEASURED, and is skipped rather than read
// as a zero response.
export function glomerulusResponse(amounts) {
  const out = new Float64Array(GLOM.length);
  for (let k = 0; k < ODORANT_ROW.length; k++) {
    const a = amounts[k];
    if (!a) continue;
    const row = DOOR_RESPONSES.responses[ODORANT_ROW[k]];
    for (let g = 0; g < GLOM.length; g++) if (row[g] !== null) out[g] += a * row[g];
  }
  return out;
}

// The value readout is the real mushroom body output layer. Each MBON's pull
// toward approach is DERIVED -- from which dopaminergic cluster writes to its
// compartment and what transmitter it releases -- not chosen. There is no
// per-odor or per-glomerulus valence table anywhere in this model any more.
const APPROACH = Float64Array.from(MB_OUTPUT.approachDrive);

// Real wiring, or the same degree sequence with partners shuffled. The rewired
// arm preserves each KC's claw count and each PN's out-degree, so any difference
// is due to WHICH cells connect, not how many.
function connectivityMatrix(mode, rng) {
  if (mode === 'random') {
    // v0 control: same number of inputs as the real PN set, wired at random.
    const n = FLYWIRE_PN_KC.meta.n_pn;
    return { nInputs: n, pnGlom: pnGlomerulusRows(FLYWIRE_PN_KC.pnGlomerulus),
      rows: Array.from({ length: MODEL.kenyonCells }, () => {
        const w = Array(n).fill(0);
        for (let c = 0; c < 5; c++) w[Math.floor(rng() * n)] = .25 + rng();
        return w;
      }) };
  }
  const { pnGlomerulus, edgePn, edgeKc, edgeSyn, meta } = FLYWIRE_PN_KC;
  const rows = Array.from({ length: meta.n_kc }, () => Array(meta.n_pn).fill(0));
  let pn = edgePn;
  if (mode === 'rewired') {
    pn = [...edgePn];
    for (let i = pn.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [pn[i], pn[j]] = [pn[j], pn[i]];
    }
  }
  for (let i = 0; i < edgeKc.length; i++) rows[edgeKc[i]][pn[i]] += edgeSyn[i];
  return { nInputs: meta.n_pn, rows, pnGlom: pnGlomerulusRows(pnGlomerulus) };
}

// Indices of the k+1 largest values, sorted descending. Quickselect partitions
// in O(n), then only those k+1 are sorted -- same winners as a full sort, but
// the full sort of 2597 cells ran on every simulation frame.
export function selectTopK(values, k) {
  const n = values.length;
  const ix = new Int32Array(n);
  for (let i = 0; i < n; i++) ix[i] = i;
  const want = Math.min(k + 1, n);
  let lo = 0, hi = n - 1;
  while (lo < hi) {
    const pivot = values[ix[(lo + hi) >> 1]];
    let i = lo, j = hi;
    while (i <= j) {
      while (values[ix[i]] > pivot) i++;
      while (values[ix[j]] < pivot) j--;
      if (i <= j) { const t = ix[i]; ix[i] = ix[j]; ix[j] = t; i++; j--; }
    }
    if (want - 1 <= j) hi = j;
    else if (want - 1 >= i) lo = i;
    else break;
  }
  return Array.from(ix.slice(0, want))
    .sort((a, b) => values[b] - values[a]);
}

export class OdorBrain {
  constructor({ connectivity = MODEL.connectivity,
                connectivitySeed = MODEL.connectivitySeed } = {}) {
    // Seed is overridable so the rewired control can be run many times; a
    // single shuffle is one sample, not a null distribution.
    const rng = randomGenerator(connectivitySeed);
    this.connectivitySeed = connectivitySeed;
    const { rows, nInputs, pnGlom } = connectivityMatrix(connectivity, rng);
    this.connectivity = connectivity;
    this.nInputs = nInputs;
    this.pnGlom = pnGlom;
    this.pnsWithoutResponseData = pnGlom.filter(g => g < 0).length;
    // L2-normalise each KC's claw weights, as v0 did: a KC with more or stronger
    // inputs must not win the top-k purely on input count.
    this.projections = rows.map(w => {
      const norm = Math.hypot(...w);
      return norm > 1e-9 ? w.map(x => x / norm) : w;
    });
    // The real matrix is 3% dense, so hold it as CSR: ~10.8k multiply-adds per
    // encode instead of 139 x 2597 = 361k. Dense was ~30x slower and made the
    // test suite unrunnable at full scale.
    this.rowPtr = new Int32Array(this.projections.length + 1);
    const cols = [], vals = [];
    this.projections.forEach((w, r) => {
      for (let c = 0; c < w.length; c++) if (w[c] !== 0) { cols.push(c); vals.push(w[c]); }
      this.rowPtr[r + 1] = cols.length;
    });
    this.colIdx = Int32Array.from(cols);
    this.val = Float64Array.from(vals);
    this.kenyonCells = this.projections.length;
    this.activeKenyonCells = Math.max(1,
      Math.round(this.kenyonCells * MODEL.activeKenyonFraction));
    // KC -> MBON: 13,112 measured connections onto 48 real output neurons.
    // Synapse counts set the starting weights; experience changes them.
    const { edgeKc, edgeMbon, edgeSyn } = MB_OUTPUT;
    this.mbEdgeKc = Int32Array.from(edgeKc);
    this.mbEdgeMbon = Int32Array.from(edgeMbon);
    const scale = Math.max(...edgeSyn);
    this.mbW0 = Float64Array.from(edgeSyn, s => s / scale);
    this.mbW = Float64Array.from(this.mbW0);
    this.nMbon = MB_OUTPUT.mbons.length;
  }

  // `amounts` is one value per entry of ODORANTS -- how much of each real
  // odorant is in the air here.
  encode(amounts) {
    return this.encodeResponses(glomerulusResponse(amounts));
  }

  // Entry point for an arbitrary measured glomerulus response vector, so the
  // ablation can use all 204 DoOR odorants rather than this world's subset.
  encodeResponses(receptors) {
    let total = 0;
    for (let i = 0; i < receptors.length; i++) total += receptors[i];
    // Divisive antennal-lobe normalization; separates identity from intensity.
    const pn = Array.from(receptors, x => x / (.22 + total / receptors.length));
    const norm = Math.hypot(...pn);
    const identity = pn.map(x => norm > 1e-9 ? x / norm : 0);
    // Each PN carries its own glomerulus's activity. PNs whose glomerulus DoOR
    // does not measure stay silent rather than being fed an invented value.
    const input = this.pnGlom.map(g => g >= 0 ? identity[g] : 0);
    const inNorm = Math.hypot(...input);
    if (inNorm > 1e-9) for (let i = 0; i < input.length; i++) input[i] /= inNorm;
    const { rowPtr, colIdx, val, activeKenyonCells: k } = this;
    const expansion = new Float64Array(this.kenyonCells);
    for (let r = 0; r < this.kenyonCells; r++) {
      let acc = 0;
      for (let j = rowPtr[r]; j < rowPtr[r + 1]; j++) acc += val[j] * input[colIdx[j]];
      expansion[r] = acc;
    }
    // APL stand-in: keep the top k, subtract the (k+1)th. Selecting the k-th
    // largest beats sorting all 2597 every frame; the winning set is identical.
    const ranked = selectTopK(expansion, k);
    const threshold = expansion[ranked[k]];
    const kc = Array(this.kenyonCells).fill(0);
    if (norm > 1e-9) {
      for (let i = 0; i < k; i++) kc[ranked[i]] = expansion[ranked[i]] - threshold;
      let kcNorm = 0;
      for (let i = 0; i < k; i++) kcNorm += kc[ranked[i]] ** 2;
      kcNorm = Math.sqrt(kcNorm);
      if (kcNorm > 1e-9) for (let i = 0; i < k; i++) kc[ranked[i]] /= kcNorm;
    }
    // Read out through the real output layer, twice: once with the anatomical
    // weights (what she brings to the dish) and once with the current ones
    // (what experience has made of it).
    const mbon = this.mbonActivity(kc, this.mbW);
    const innate = MODEL.valueGain * this.approach(this.mbonActivity(kc, this.mbW0));
    const value = MODEL.valueGain * this.approach(mbon);
    const intensity = 1 - Math.exp(-total / 1.8);
    return { receptors, pn, kc, mbon, innate, learned: value - innate,
      intensity, value };
  }

  // How far each Kenyon cell's output synapses have moved from the anatomy.
  // This is the visible trace of a memory, per cell.
  kcMemory() {
    const out = new Float64Array(this.kenyonCells);
    for (let e = 0; e < this.mbW.length; e++)
      out[this.mbEdgeKc[e]] += this.mbW0[e] - this.mbW[e];
    return out;
  }

  mbonActivity(kc, w) {
    const out = new Float64Array(this.nMbon);
    for (let e = 0; e < w.length; e++) {
      const a = kc[this.mbEdgeKc[e]];
      if (a) out[this.mbEdgeMbon[e]] += w[e] * a;
    }
    return out;
  }

  approach(mbon) {
    let v = 0, n = 0;
    for (let m = 0; m < mbon.length; m++) { v += APPROACH[m] * mbon[m]; n += Math.abs(mbon[m]); }
    return n > 1e-9 ? v / n : 0;
  }

  // Dopamine depresses the KC->MBON synapses that were just active, but only in
  // the compartments its own cluster writes to: reward engages the PAM-written
  // compartments, punishment the PPL1-written ones. Nothing here says which
  // odor is good -- only that something happened and which compartment heard.
  reinforce(kc, reward) {
    const error = reward - this.approach(this.mbonActivity(kc, this.mbW));
    const teaching = Math.sign(error);
    for (let e = 0; e < this.mbW.length; e++) {
      const a = kc[this.mbEdgeKc[e]];
      if (!a) continue;
      const m = this.mbEdgeMbon[e];
      // does this compartment's dopaminergic cluster carry this kind of news?
      if (Math.sign(MB_OUTPUT.danBias[m]) !== teaching) continue;
      this.mbW[e] = clamp(this.mbW[e] - MODEL.learningRate * Math.abs(error) * a, 0, 2);
    }
    return error;
  }
}

// Dish recipes are written as {odorantName: amount}; the model wants a dense
// vector aligned to ODORANTS.
export function recipeVector(recipe) {
  const v = new Float64Array(ODORANTS.length);
  for (const [name, amount] of Object.entries(recipe)) {
    const i = ODORANTS.indexOf(name);
    if (i < 0) throw new Error(`recipe names "${name}", which is not in ODORANTS`);
    v[i] = amount;
  }
  return v;
}

export class BuffetSimulation {
  constructor({ seed = MODEL.seed, learning = true } = {}) {
    this.seed = seed;
    this.rng = randomGenerator(seed);
    this.brain = new OdorBrain();
    this.learning = learning;
    this.dishes = DISHES.map(d => ({ ...d, amounts: recipeVector(d.recipe) }));
    this.time = 0;
    this.phase = 'baseline';
    this.phaseStart = 0;
    this.round = 1;
    this.fly = { x: 0, z: 3.2, heading: -Math.PI / 2, turn: 0, speed: 0,
      eating: 0, escape: 0, walk: 0 };
    this.visits = { baseline: [0, 0, 0], training: [0, 0, 0], probe: [0, 0, 0] };
    this.occupancy = { baseline: [0, 0, 0], training: [0, 0, 0], probe: [0, 0, 0] };
    this.phaseElapsed = { baseline: 0, training: 0, probe: 0 };
    this.contact = -1;
    this.mealPosition = null;
    this.lastEvent = { text: 'A new nose at the buffet.', time: 0, reward: 0 };
    this.events = [];
    this.history = [];
    this.trail = [];
    this.observation = this.brain.encode(this.chemicalsAt(this.fly.x, this.fly.z));
    this.rewardPulse = 0;
    this.lastPredictionError = 0;
    this.record();
    this.initialValues = this.standardizedValues();
  }

  chemicalsAt(x, z) {
    const amounts = new Float64Array(ODORANTS.length);
    for (const dish of this.dishes) {
      const dx = x - dish.x, dz = z - dish.z;
      // Static isotropic diffusion-like field, not a fluid dynamics simulation.
      const concentration = Math.exp(-(dx * dx + dz * dz) / (2 * MODEL.plumeSigma ** 2));
      for (let i = 0; i < amounts.length; i++) amounts[i] += dish.amounts[i] * concentration;
    }
    return amounts;
  }

  sense(x, z) {
    const obs = this.brain.encode(this.chemicalsAt(x, z));
    let utility = obs.intensity * (.35 + obs.value);
    // Short-lived location fatigue encourages departure; it does not alter odor memory.
    if (this.mealPosition) {
      const d2 = (x - this.mealPosition.x) ** 2 + (z - this.mealPosition.z) ** 2;
      utility -= 1.6 * Math.exp(-d2 / 5) * Math.exp(-(this.time - this.mealPosition.time) / 13);
    }
    return { ...obs, utility };
  }

  standardizedValues() {
    // An in-silico standardized odor test, not a probability of choosing a dish.
    return this.dishes.map(d => {
      const { innate, learned, value } = this.brain.encode(d.amounts);
      return { innate, learned, value };
    });
  }

  setReward(index, reward) {
    if (!this.dishes[index] || !Number.isFinite(reward)) throw new Error('Invalid reward');
    this.dishes[index].reward = clamp(reward, 0, 1);
    this.events.push({ time: this.time, type: 'reward-setting', dish: this.dishes[index].id,
      reward: this.dishes[index].reward });
  }

  setLearning(enabled) {
    this.learning = Boolean(enabled);
    this.events.push({ time: this.time, type: 'learning-setting', enabled: this.learning });
  }

  trainAgain() {
    this.round++;
    this.phase = 'training';
    this.phaseStart = this.time;
    this.visits.training = [0, 0, 0]; this.visits.probe = [0, 0, 0];
    this.occupancy.training = [0, 0, 0]; this.occupancy.probe = [0, 0, 0];
    this.phaseElapsed.training = 0; this.phaseElapsed.probe = 0;
    this.contact = -1;
    this.events.push({ time: this.time, type: 'new-training-round', round: this.round });
  }

  step() {
    if (this.phase === 'complete') return;
    const dt = MODEL.dt, f = this.fly;
    this.time += dt;
    this.phaseElapsed[this.phase] += dt;
    this.rewardPulse *= Math.exp(-dt * 2);
    this.observation = this.sense(f.x, f.z);
    const distances = this.dishes.map(d => Math.hypot(d.x - f.x, d.z - f.z));
    distances.forEach((d, i) => { if (d < 1.6) this.occupancy[this.phase][i] += dt; });

    if (f.eating > 0) {
      f.eating -= dt;
      f.speed = 0;
      if (f.eating <= 0) {
        f.heading += Math.PI * (.7 + .6 * this.rng());
        f.escape = 2.7;
      }
    } else {
      // The controller gets local chemical activity, geometry and noise, NOT dish IDs.
      const distance = .8, spread = .7;
      const left = this.sense(f.x + distance * Math.cos(f.heading - spread),
        f.z + distance * Math.sin(f.heading - spread));
      const right = this.sense(f.x + distance * Math.cos(f.heading + spread),
        f.z + distance * Math.sin(f.heading + spread));
      const chemotaxis = f.escape > 0 ? 0 : 8 * (right.utility - left.utility);
      f.escape = Math.max(0, f.escape - dt);
      f.turn = .91 * f.turn + .09 * (this.rng() - .5) * 8;
      f.heading += (clamp(chemotaxis, -1.8, 1.8) + f.turn) * dt;
      f.speed = f.escape > 0 ? 1.65 : 1.35;
      f.x += Math.cos(f.heading) * f.speed * dt;
      f.z += Math.sin(f.heading) * f.speed * dt;
      f.walk += f.speed * dt;
      if (Math.abs(f.x) > MODEL.bounds.x) {
        f.x = clamp(f.x, -MODEL.bounds.x, MODEL.bounds.x);
        f.heading = Math.atan2(Math.sin(f.heading), -Math.cos(f.heading));
      }
      if (Math.abs(f.z) > MODEL.bounds.z) {
        f.z = clamp(f.z, -MODEL.bounds.z, MODEL.bounds.z);
        f.heading = Math.atan2(-Math.sin(f.heading), Math.cos(f.heading));
      }
    }

    if (this.contact >= 0 && distances[this.contact] > 1.5) this.contact = -1;
    const near = distances.findIndex(d => d < 1.05);
    if (near >= 0 && this.contact < 0 && f.eating <= 0 && f.escape <= 0) {
      this.contact = near;
      this.visits[this.phase][near]++;
      const dish = this.dishes[near];
      const reward = this.phase === 'training' ? dish.reward : 0;
      if (this.phase === 'training' && this.learning) {
        this.lastPredictionError = this.brain.reinforce(this.observation.kc, reward);
      }
      f.eating = this.phase === 'training' ? 1.5 : .7;
      this.mealPosition = { x: f.x, z: f.z, time: this.time };
      this.rewardPulse = reward;
      this.lastEvent = { time: this.time, reward, dish: near,
        text: this.phase === 'training' ? `${dish.name}: ${reward > .5 ? 'a good meal' : reward > 0 ? 'a little snack' : 'no food reward'}.`
          : `${dish.name}: just a sniff.` };
      this.events.push({ time: this.time, type: 'contact', phase: this.phase, round: this.round,
        dish: dish.id, reward, learning: this.learning });
    }

    if (Math.floor(this.time * 4) > Math.floor((this.time - dt) * 4)) {
      this.trail.push({ x: f.x, z: f.z });
      if (this.trail.length > 180) this.trail.shift();
    }
    if (Math.floor(this.time) > Math.floor(this.time - dt)) this.record();
    if (this.time - this.phaseStart + 1e-8 >= MODEL.durations[this.phase]) {
      this.phase = { baseline: 'training', training: 'probe', probe: 'complete' }[this.phase];
      this.phaseStart = this.time;
      // No carry-over meal or contact suppression in the new test condition.
      f.eating = 0; this.contact = -1;
      this.lastEvent = { text: PHASES[this.phase].description, time: this.time, reward: 0 };
      this.events.push({ time: this.time, type: 'phase', phase: this.phase });
      this.record();
    }
  }

  advance(seconds) {
    // Fixed-step API for deterministic offline rendering and test experiments.
    for (let i = 0; i < Math.round(seconds / MODEL.dt); i++) this.step();
  }

  record() {
    this.history.push({ time: this.time, phase: this.phase,
      values: this.standardizedValues().map(x => x.value) });
  }

  export() {
    return {
      schema: 'fruit-buffet-toy/v1', seed: this.seed, connectivitySeed: MODEL.connectivitySeed,
      assumptions: 'MEASURED: PN->KC wiring (FlyWire 783) and odorant->glomerulus responses (DoOR 2.0). SYNTHETIC: dish recipe proportions, innate valence gain, movement rules, and the top-k stand-in for APL.',
      model: MODEL, glomeruli: DOOR_RESPONSES.glomeruli,
      mbons: MB_OUTPUT.mbons, approachDrive: MB_OUTPUT.approachDrive,
      dishes: this.dishes, time: this.time,
      phase: this.phase, round: this.round, learning: this.learning,
      initialValues: this.initialValues, finalValues: this.standardizedValues(),
      visits: this.visits, occupancySeconds: this.occupancy, phaseElapsedSeconds: this.phaseElapsed,
      weights: this.brain.weights, history: this.history, events: this.events,
    };
  }
}
