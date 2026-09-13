// Can experience overturn an innate preference?
//
// As configured, zebra is BOTH the innately preferred dish AND the rewarded one,
// so a shift toward zebra proves nothing -- she was already going there. The
// test that means something is to reward the dish she likes LEAST and ask
// whether the memory beats the instinct.
import { BuffetSimulation, OdorBrain, recipeVector } from '../model.mjs';
import { DISHES } from '../config.mjs';

const NAMES = DISHES.map(d => d.name);

function run({ rewardOn, learning = true, seeds = 12 }) {
  const first = [0, 0, 0], test = [0, 0, 0];
  let learned = [0, 0, 0];
  for (let s = 0; s < seeds; s++) {
    const sim = new BuffetSimulation({ seed: 17 + s * 101, learning });
    sim.dishes.forEach((d, i) => { d.reward = i === rewardOn ? 1 : 0; });
    while (sim.phase !== 'complete') sim.step();
    sim.occupancy.baseline.forEach((v, i) => { first[i] += v; });
    sim.occupancy.probe.forEach((v, i) => { test[i] += v; });
    const vals = sim.standardizedValues();
    learned = learned.map((x, i) => x + vals[i].learned / seeds);
  }
  const share = a => { const t = a.reduce((x, y) => x + y, 0) || 1; return a.map(x => x / t); };
  return { first: share(first), test: share(test), learned };
}

const pct = a => a.map(x => (100 * x).toFixed(1).padStart(5) + '%').join('  ');

const innate = (() => { const b = new OdorBrain();
  return DISHES.map(d => b.encode(recipeVector(d.recipe)).innate); })();

console.log('innate valence (before any experience)');
console.log('  ' + NAMES.map((n, i) =>
  `${n} ${innate[i] >= 0 ? '+' : ''}${innate[i].toFixed(3)}`).join('   '));
const worst = innate.indexOf(Math.min(...innate));
console.log(`\nleast-liked dish: ${NAMES[worst]} -- that is the one we will reward.\n`);

for (const [label, cfg] of [
  [`reward on ${NAMES[worst]} (the least-liked dish)`, { rewardOn: worst }],
  [`same, plasticity DISABLED (control)`, { rewardOn: worst, learning: false }],
]) {
  const r = run(cfg);
  console.log(label);
  console.log(`            ${NAMES.map(n => n.padStart(6)).join('  ')}`);
  console.log(`  before    ${pct(r.first)}`);
  console.log(`  after     ${pct(r.test)}`);
  console.log(`  shift     ${r.test.map((x, i) =>
    ((x - r.first[i]) * 100 >= 0 ? '+' : '') +
    ((x - r.first[i]) * 100).toFixed(1).padStart(5) + 'pp').join('  ')}`);
  console.log(`  learned   ${r.learned.map(x =>
    (x >= 0 ? '+' : '') + x.toFixed(3).padStart(6)).join('  ')}\n`);
}
console.log('Occupancy share during the odor-only probe: rewards are switched off,');
console.log('so anything that moved is memory, not food.');
