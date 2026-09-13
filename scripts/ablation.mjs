// Does the real PN->KC wiring separate odors better than a degree-preserving
// rewiring? Uses all measured DoOR odorants, not just the three dishes, and
// several rewiring seeds -- three dish pairs on one seed proves nothing.
import { OdorBrain } from '../model.mjs';
import { ODORANTS } from '../config.mjs';
import { DOOR_RESPONSES } from '../door_responses.mjs';

const SEEDS = 8;
const cos = (a, b) => {
  let d = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; na += a[i] ** 2; nb += b[i] ** 2; }
  return na && nb ? d / Math.sqrt(na * nb) : 0;
};

// Every odorant DoOR measures, not just the 12 this world serves. null means
// not measured and is read as no contribution HERE only because a missing
// measurement cannot drive a glomerulus; the fill rate is reported alongside.
const stimuli = DOOR_RESPONSES.responses.map((row, i) => ({
  name: DOOR_RESPONSES.odorants[i],
  v: Float64Array.from(row, x => x === null ? 0 : x),
}));

function meanOverlap(brain) {
  const codes = stimuli.map(s => brain.encodeResponses(s.v).kc);
  let sum = 0, n = 0;
  for (let i = 0; i < codes.length; i++)
    for (let j = i + 1; j < codes.length; j++) { sum += cos(codes[i], codes[j]); n++; }
  return sum / n;
}

const real = meanOverlap(new OdorBrain({ connectivity: 'flywire' }));
const rewired = [], random = [];
for (let s = 0; s < SEEDS; s++) {
  rewired.push(meanOverlap(new OdorBrain(
    { connectivity: 'rewired', connectivitySeed: 1000 + s * 7919 })));
  random.push(meanOverlap(new OdorBrain(
    { connectivity: 'random', connectivitySeed: 1000 + s * 7919 })));
}

const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
const sd = a => Math.sqrt(mean(a.map(x => (x - mean(a)) ** 2)));

console.log(`${stimuli.length} DoOR odorants, ${stimuli.length * (stimuli.length - 1) / 2} pairs`);
console.log(`matrix fill ${(100 * DOOR_RESPONSES.meta.matrix_fill).toFixed(0)}%, ` +
            `${DOOR_RESPONSES.meta.n_glomeruli} glomeruli measured\n`);
console.log(`real FlyWire wiring : ${real.toFixed(4)}`);
console.log(`degree-preserving   : ${mean(rewired).toFixed(4)} ± ${sd(rewired).toFixed(4)}` +
            `  (n=${SEEDS} shuffles)`);
const delta = mean(rewired) - real;
console.log(`\ndifference          : ${delta > 0 ? '+' : ''}${delta.toFixed(4)} ` +
            `(positive = real wiring separates odors better)`);
console.log(`relative            : ${(100 * delta / mean(rewired)).toFixed(1)}%`);
console.log(`\nrandom expansion    : ${mean(random).toFixed(4)} ± ${sd(random).toFixed(4)}`);
if (sd(rewired) === 0) console.log('\nWARNING: zero spread -- the shuffles did not vary.');
