// v0.3. Receptor responses and PN->KC wiring are MEASURED. Dish recipes,
// movement and the APL stand-in are not. Keep that boundary here.
//
// The world is a set of real odorants. A dish is a mixture of them. Receptor
// activation is looked up from DoOR (measured), never predicted from structure.

// Odorants present in this world. Every name must exist in door_responses.mjs.
// Chosen from compounds actually reported in faecal/dung volatilomes that DoOR
// measures across enough glomeruli to be usable.
export const ODORANTS = [
  'indole', '4-methylphenol', '2-methylphenol', 'butyric acid', '2-butanone',
  'acetic acid', 'dimethyl sulfide', 'limonene', 'p-cymene', '1-pentanol',
  '2-heptanone', 'benzaldehyde',
];

// Dish recipes remain ILLUSTRATIVE: proportions are not measured headspace.
// The chemistry follows the standard carnivore/herbivore contrast -- carnivore
// faeces runs high in indole, cresols and sulfur; herbivore dung carries more
// short-chain acids and plant-derived terpenes. What each dish SMELLS LIKE to
// the model, and whether the fly approaches it, now comes out of DoOR and the
// connectome rather than a hand-set number per dish.
export const DISHES = [
  { id: 'giraffe', name: 'Giraffe', color: '#e5b56a', x: -4.6, z: -1.25,
    reward: .12, recipe: {
      'butyric acid': .45, 'limonene': .40, 'p-cymene': .35, 'acetic acid': .30,
      '4-methylphenol': .12, '2-heptanone': .10, 'indole': .05 } },
  { id: 'zebra', name: 'Zebra', color: '#71c8bf', x: 0, z: -2.6,
    reward: 1, recipe: {
      'butyric acid': .30, 'limonene': .22, '1-pentanol': .35, '2-butanone': .30,
      'benzaldehyde': .25, '4-methylphenol': .18, 'indole': .10 } },
  { id: 'lion', name: 'Lion', color: '#aaa0d7', x: 4.6, z: -1.25,
    reward: 0, recipe: {
      'indole': .70, '4-methylphenol': .60, '2-methylphenol': .40,
      'dimethyl sulfide': .55, '2-butanone': .20, 'butyric acid': .25 } },
];

// There is no innate-valence table any more. What a smell is worth is read out
// of the real mushroom body output layer -- 48 MBONs whose pull toward approach
// is derived from which dopaminergic cluster writes to their compartment and
// what transmitter they release. See scripts/build_mb_output.py.

export const MODEL = Object.freeze({
  dt: 1 / 30,
  seed: 17,
  connectivitySeed: 710,
  // 'flywire'  real PN->KC wiring, FlyWire release 783 (flywire_pn_kc.mjs)
  // 'rewired'  the same degree sequence, shuffled -- the ablation control
  // 'random'   the original v0 toy expansion
  connectivity: 'flywire',
  kenyonCells: 144,          // only used by 'random'
  activeKenyonFraction: 14 / 144,
  learningRate: .34,
  learnedGain: 1.7,
  valueGain: 1.6,
  plumeSigma: 2.25,
  bounds: { x: 7.5, z: 4.5 },
  durations: { baseline: 42, training: 210, probe: 48 },
});

export const PHASES = {
  baseline: { title: 'First nosing', description: 'Aroma only. Nothing served. No memory formed.' },
  training: { title: 'The pairing', description: 'Each expression served with its course. The palate may develop.' },
  probe: { title: 'Blind tasting', description: 'Plates cleared. Only the nose remains.' },
  complete: { title: 'The verdict', description: 'First nosing against blind tasting. Did the palate change?' },
};
