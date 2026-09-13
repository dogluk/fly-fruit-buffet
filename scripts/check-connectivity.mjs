// Does the swap preserve sparse-expansion coding, and does real wiring differ
// from a degree-preserving rewiring? Green unit tests barely touch connectivity.
import { OdorBrain, recipeVector } from '../model.mjs';
import { DISHES, MODEL, ODORANTS } from '../config.mjs';
const RECIPE = DISHES.map(d => recipeVector(d.recipe));

const cos = (a, b) => {
  let d = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; na += a[i] ** 2; nb += b[i] ** 2; }
  return na && nb ? d / Math.sqrt(na * nb) : 0;
};

for (const mode of ['flywire', 'rewired', 'random']) {
  const brain = new OdorBrain({ connectivity: mode });
  const codes = RECIPE.map(v => brain.encode(v).kc);
  const active = codes.map(c => c.filter(x => x > 0).length);
  const sparsity = active.map(a => 100 * a / brain.kenyonCells);
  const overlaps = [[0, 1], [0, 2], [1, 2]].map(([i, j]) => cos(codes[i], codes[j]));

  console.log(`\n${mode}`);
  console.log(`  ${brain.kenyonCells} KCs x ${brain.nInputs} inputs, top-k ${brain.activeKenyonCells}`);
  console.log(`  active cells: ${active.join(', ')}  (${sparsity.map(s => s.toFixed(1) + '%').join(', ')})`);
  console.log('  code overlap (cosine), lower = better separation:');
  console.log(`    giraffe~zebra ${overlaps[0].toFixed(3)}   giraffe~lion ${overlaps[1].toFixed(3)}` +
              `   zebra~lion ${overlaps[2].toFixed(3)}`);
  console.log(`    mean ${(overlaps.reduce((s, x) => s + x, 0) / 3).toFixed(3)}`);

  // Every active cell must be above the k+1-th, and no cell active with no odor.
  const silent = brain.encode(new Float64Array(ODORANTS.length)).kc.filter(x => x > 0).length;
  const ok = active.every(a => a <= brain.activeKenyonCells) && silent === 0;
  console.log(`  invariants: top-k respected and silent on no odor -> ${ok ? 'PASS' : 'FAIL'}`);
  if (!ok) process.exitCode = 1;
}

console.log(`\nsparsity target ${(100 * MODEL.activeKenyonFraction).toFixed(1)}% ` +
            '(v0 was 14/144); biological mushroom body is ~5-10%.');
