// v0.4. Receptor responses and PN->KC wiring are MEASURED. Dish recipes,
// movement and the APL stand-in are not. Keep that boundary here.
//
// The world is a set of real odorants. A dish is a mixture of them. Receptor
// activation is looked up from DoOR (measured), never predicted from structure.
//
// She is a fruit fly. v0.3 fed her dung -- carrion and dung volatiles happen to
// be exactly where 1980s-2000s single-sensillum electrophysiology looked, so
// they were densely measured, but they are not her ecology. Fermenting fruit is.
// Becher et al. 2012 (Funct. Ecol.) showed it is specifically YEAST volatiles on
// the fruit, not the fruit's own smell, that drive attraction, oviposition and
// larval development -- these dishes are read as fermenting fruit, sugar plus
// yeast, not raw produce.

// Odorants present in this world. Every name must exist in door_responses.mjs.
// Chosen from esters, ethanol and acetic acid -- the yeast-fermentation
// signature -- plus the terpenes of intact citrus peel as a contrast class.
// DoOR's coverage of these is dense: it was built largely from Hallem & Carlson
// 2006, whose whole point was profiling D. melanogaster's own receptor
// repertoire against its own ecologically relevant odors.
export const ODORANTS = [
  'ethyl acetate', 'isopentyl acetate', 'ethyl butyrate', 'ethanol',
  'acetic acid', '2,3-butanedione', 'hexyl acetate', '1-hexanol',
  'benzaldehyde', 'limonene', 'linalool', 'geraniol',
];

// Dish recipes remain ILLUSTRATIVE: proportions are not measured headspace.
// Banana and cherry share the yeast-fermentation esters (ethanol, acetic acid,
// fruity acetate/butyrate esters) that Semmelhack & Wang 2009 (Nature) showed
// drive innate vinegar attraction through two glomeruli, DM1 (Or42b) and VA2
// (Or92a) -- both of which ethyl acetate, ethyl butyrate and 2,3-butanedione
// activate strongly in DoOR (checked directly against door_responses.mjs).
// Citrus instead carries whole-peel terpenes (limonene, linalool, geraniol)
// with almost no ester signature -- the intact-fruit contrast to the other two
// dishes' fermenting-fruit chemistry. Note the honest caveat: D-limonene is a
// documented oviposition deterrent for D. suzukii, a close relative, but the
// melanogaster-specific evidence is thinner -- treat "citrus repels" as a
// hypothesis this model can test, not an imported fact.
export const DISHES = [
  { id: 'cherry', name: 'Cherry', color: '#9c2b44', x: -4.6, z: -1.25,
    reward: .12, recipe: {
      'ethyl butyrate': .45, '2,3-butanedione': .30, 'ethanol': .35,
      'acetic acid': .20, 'benzaldehyde': .25 } },
  { id: 'banana', name: 'Banana', color: '#eec53f', x: 0, z: -2.6,
    reward: 1, recipe: {
      'isopentyl acetate': .70, 'ethyl acetate': .50, 'ethanol': .40,
      'acetic acid': .20, 'hexyl acetate': .15 } },
  { id: 'citrus', name: 'Citrus', color: '#e8892e', x: 4.6, z: -1.25,
    reward: 0, recipe: {
      'limonene': .65, 'linalool': .35, 'geraniol': .30, '1-hexanol': .10 } },
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
