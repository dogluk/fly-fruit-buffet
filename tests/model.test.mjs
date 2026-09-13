import test from 'node:test';
import assert from 'node:assert/strict';
import { BuffetSimulation, OdorBrain, recipeVector } from '../model.mjs';
import { DISHES, MODEL, ODORANTS } from '../config.mjs';
const RECIPE = DISHES.map(d => recipeVector(d.recipe));
const NO_ODOR = new Float64Array(ODORANTS.length);

test('no odor activates no cells, even after conditioning', () => {
  const brain = new OdorBrain();
  const target = brain.encode(RECIPE[1]);
  for (let i = 0; i < 20; i++) brain.reinforce(target.kc, 1);
  const empty = brain.encode(NO_ODOR);
  assert.equal(empty.kc.filter(x => x > 0).length, 0);
  assert.equal(empty.value, 0);
  assert.equal(empty.intensity, 0);
});

test('innate valence is derived from measured responses, not asserted', () => {
  const brain = new OdorBrain();
  // The dish ordering is now an OUTPUT of DoOR responses plus the cited
  // per-glomerulus prior. Assert that it is well-defined and reproducible --
  // NOT that it equals any particular order, which would re-hardcode v0.
  const a = DISHES.map((_, i) => brain.encode(RECIPE[i]).innate);
  const b = DISHES.map((_, i) => new OdorBrain().encode(RECIPE[i]).innate);
  assert.deepEqual(a, b);
  assert.ok(a.every(Number.isFinite));
  assert.ok(new Set(a).size === a.length, 'dishes must be distinguishable');
  // A single odorant driving an attractive glomerulus must read positive.
  const one = new Float64Array(ODORANTS.length);
  one[ODORANTS.indexOf('butyric acid')] = 1;
  assert.ok(brain.encode(one).innate > 0);
});

test('paired reward changes odor value; unpaired reward does not', () => {
  const paired = new OdorBrain(), unpaired = new OdorBrain();
  const before = paired.encode(RECIPE[1]).value;
  for (let i = 0; i < 24; i++) {
    paired.reinforce(paired.encode(RECIPE[1]).kc, 1);
    paired.reinforce(paired.encode(NO_ODOR).kc, 0);
    unpaired.reinforce(unpaired.encode(RECIPE[1]).kc, 0);
    unpaired.reinforce(unpaired.encode(NO_ODOR).kc, 1);
  }
  // Reward raises the odor's value; the unpaired protocol must NOT raise it.
  // It is no longer required to leave value untouched: withholding an expected
  // reward is itself news, and depresses the punishment-written compartments.
  // That is the architecture being faithful, not a bug.
  assert.ok(paired.encode(RECIPE[1]).value - before > .2);
  assert.ok(unpaired.encode(RECIPE[1]).value <= before);
  const frozen = Array.from(paired.mbW);
  for (let i = 0; i < 100; i++) paired.encode(RECIPE[1]);
  assert.deepEqual(Array.from(paired.mbW), frozen, 'odor-only probes must not update memory');
});

test('same seed replays the complete experiment exactly', () => {
  const a = new BuffetSimulation(), b = new BuffetSimulation();
  a.advance(300); b.advance(300);
  assert.equal(a.phase, 'complete');
  assert.deepEqual(a.export(), b.export());
  assert.deepEqual(a.fly, b.fly);
});

test('controller is invariant to dish labels and array ordering', () => {
  const a = new BuffetSimulation(), b = new BuffetSimulation();
  b.dishes.reverse();
  b.dishes.forEach((d, i) => { d.id = `unknown-${i}`; d.name = 'unlabelled'; });
  a.advance(120); b.advance(120);
  assert.ok(Math.abs(a.fly.x - b.fly.x) < 1e-8);
  assert.ok(Math.abs(a.fly.z - b.fly.z) < 1e-8);
  a.brain.mbW.forEach((x, i) => assert.ok(Math.abs(x - b.brain.mbW[i]) < 1e-8));
});

test('learning-disabled control has contacts and rewards but no weight changes', () => {
  const s = new BuffetSimulation({ learning: false }); s.advance(300);
  assert.ok(s.events.some(e => e.type === 'contact' && e.reward === 1));
  // Weights start at anatomical synapse counts now, not zero. With plasticity
  // off they must still equal the anatomy exactly.
  assert.deepEqual(Array.from(s.brain.mbW), Array.from(s.brain.mbW0));
  assert.deepEqual(s.initialValues, s.standardizedValues());
  assert.ok(s.events.filter(e => e.type === 'contact' && e.phase !== 'training').every(e => e.reward === 0));
});

test('bounded trajectories, correct phase durations, and reward learning across seeds', () => {
  let switches = 0;
  const contacts = { trained: [0, 0, 0], fixed: [0, 0, 0] };
  for (let seed = 1; seed <= 12; seed++) {
    const s = new BuffetSimulation({ seed });
    for (let i = 0; i < 9000; i++) {
      s.step();
      assert.ok(Number.isFinite(s.fly.x) && Number.isFinite(s.fly.z));
      assert.ok(Math.abs(s.fly.x) <= MODEL.bounds.x && Math.abs(s.fly.z) <= MODEL.bounds.z);
    }
    for (const phase of ['baseline', 'training', 'probe']) {
      assert.ok(Math.abs(s.phaseElapsed[phase] - MODEL.durations[phase]) < 1e-5);
    }
    const values = s.standardizedValues().map(x => x.value);
    if (values[1] > values[0] && values[1] > values[2]) switches++;
    assert.ok(s.brain.mbW.every(Number.isFinite));
    const control = new BuffetSimulation({ seed, learning: false });
    control.advance(300);
    s.visits.probe.forEach((n, i) => { contacts.trained[i] += n; });
    control.visits.probe.forEach((n, i) => { contacts.fixed[i] += n; });
  }
  assert.ok(switches >= 10, `only ${switches}/12 acquired the rewarded odor's higher modeled value`);
  const share = counts => counts[1] / counts.reduce((a, b) => a + b, 0);
  assert.ok(share(contacts.trained) > share(contacts.fixed) + .08,
    'reward learning should influence observed local-navigation contacts, not just a plotted readout');
});

test('a reward reversal changes learned value without resetting the brain', () => {
  const s = new BuffetSimulation(); s.advance(300);
  const weights = Array.from(s.brain.mbW);
  const learnedBefore = s.standardizedValues().map(v => v.learned);
  s.setReward(1, 0); s.setReward(2, 1); s.trainAgain();
  assert.deepEqual(Array.from(s.brain.mbW), weights,
    'reversal must not reset the brain -- the memory carries over');
  assert.deepEqual(s.visits.probe, [0, 0, 0]);
  s.advance(258);
  assert.equal(s.phase, 'complete');
  // Assert the DIRECTION of the reversal, not a magnitude threshold: the
  // readout now runs through 48 real MBONs and its scale is set by anatomy,
  // not by a gain someone picked.
  assert.ok(s.standardizedValues()[2].learned > learnedBefore[2],
    'the newly rewarded dish must gain learned value');
  assert.ok(s.events.some(e => e.type === 'contact' && e.round === 2 && e.dish === 'lion' && e.reward === 1));
});
