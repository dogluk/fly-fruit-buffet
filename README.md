# The poop buffet / toy v0

A local interactive fly-olfaction model. A 3D fly explores three fecal-inspired
odor sources, encounters food rewards, and takes an odor-only test afterward.
Its decisions come from local chemical sensing and an odor-associated memory.

**Wiring and receptors are both measured now. Nothing is predicted or docked.**

| layer | source | what it is |
|---|---|---|
| odorant -> glomerulus | DoOR 2.0 (CC-BY) | 41 glomeruli x 204 odorants. Single-sensillum recordings and calcium imaging. Someone put an electrode in a fly. |
| PN -> Kenyon cell | FlyWire release 783 (CC-BY-4.0) | 139 uniglomerular PNs, 2,597 KCs, 10,821 connections at >=3 synapses, right hemisphere |

Regenerate both with `python3 scripts/build_door_responses.py` and
`python3 scripts/build_flywire_pn_kc.py`.

**No AlphaFold, no docking, no structure prediction anywhere.** For dogs you have
to predict receptor activation because there is no measurement; for flies forty
years of electrophysiology already did it. Predicting here would replace a
measurement with a worse estimate of that same measurement.

99 of 139 PNs are driven by measured data. The other 40 innervate glomeruli DoOR
does not measure well enough (including DA1, the cVA channel) and stay silent
rather than being fed an invented value.

Still synthetic: dish recipe proportions, the innate-valence gain, movement rules,
and the uniform top-k stand-in for APL.

### Nobody tells her what a smell is worth

There is no innate-valence table. `INNATE_VALENCE` is deleted.

The value readout is the real mushroom body output layer: 13,112 measured
KC -> MBON connections onto 48 output neurons. Each MBON's pull toward approach
is derived from **which dopaminergic cluster writes to its compartment** -- the
PAM cluster carries reward, PPL1 carries punishment, and that split is legible in
the connectome's own cell types (153 PAM, 8 PPL1 on the right side). Appetitive
training depresses KC->MBON synapses in PAM-written compartments, so a
PAM-compartment MBON drives *avoidance* while intact. Hence
`approach_drive = -dan_bias`.

The compartments turn out to be **cleanly partitioned**: every MBON with
dopaminergic input gets PAM or PPL1, never both. 44 of 48 have such input.

**Transmitter is recorded but deliberately unused for the sign.** Folding it in
(`-dan_bias * output_sign`) made the behavioural sign depend on an assumption
about downstream integration that this extraction cannot support, and it left
reward *decreasing* value. Compartment identity alone is the defensible claim.

### What deleting the numbers did

Innate valence across three chemically very different dishes:

| | with hand-set numbers | derived from the connectome |
|---|---|---|
| Giraffe | +0.081 | +0.279 |
| Zebra | +0.284 | +0.263 |
| Lion | +0.056 | +0.314 |

**They collapsed to nearly the same value.** A spread of 0.05 across indole-heavy
carnivore dung, terpene-heavy herbivore dung, and a mixed one.

That is not a bug and it is the most interesting thing in this build. A naive
mushroom body has almost no opinion about a smell it has never encountered,
because innate valence in a real fly is not stored there -- it is largely a
**lateral horn** pathway, and the lateral horn is not in this extraction. The
mushroom body is the learning machine. Asked what it wants before any experience,
it correctly answers: not much.

Learning still works. `node scripts/does-she-learn.mjs`, rewarding the
least-preferred dish:

| | learned value | probe shift |
|---|---|---|
| rewarded dish | +0.414 | +6.6pp |
| others | +0.169 / +0.046 | -- |
| plasticity disabled | 0.000 | +0.8pp |

The behavioural shift is much smaller than the +38.8pp seen with hand-set
preferences, precisely because the dishes now start out nearly equal and the
learned signal competes with plume geometry rather than with a stacked deck.

**Next:** the lateral horn. That is where "what the fly wants before it wants
anything" actually lives, and it is in FlyWire.

### One trap worth knowing about

`build_door_responses.py` picks each glomerulus's *best-measured* DoOR column,
which is sometimes a **sensillum** recording (`ab4B`, `ac1`) rather than a named
receptor. A sensillum column reports a neuron, not a receptor.

DA2 was initially given Stensmyr's geosmin aversion (-1.2). Its best column is
`ab4B`, which reports a 0.31 response to limonene -- something a near-exclusively
geosmin-tuned receptor should not show. The result was that limonene became the
most aversive odorant in the world, for entirely the wrong reason. DA2 is now
excluded, and `model.mjs` throws if any innate valence rests on a column that is
not a named `Or`/`Ir`/`Gr` receptor.

### Ablation 1: does real wiring beat a degree-preserving rewiring?

`node scripts/ablation.mjs` -- 204 DoOR odorants, 20,706 pairs, 8 shuffle seeds,
measuring mean pairwise Kenyon-cell code overlap (lower = better separation):

| | mean overlap |
|---|---|
| real FlyWire wiring | 0.1470 |
| degree-preserving rewiring | 0.1454 +/- 0.0029 |
| random expansion | 0.1493 +/- 0.0155 |

**No effect.** Real wiring is 1.1% *worse* than the shuffled control, about half
of one standard deviation -- indistinguishable. An earlier run on 3 dish pairs at
one seed showed real beating rewired by 7%; that was noise, and it is why the
proper version uses every measured odorant and multiple seeds.

Read it narrowly. This measures pairwise decorrelation, not few-shot learning
performance, which is the actual Dasgupta/Stevens claim. Roughly 29% of the input
layer is silent for want of DoOR coverage. And APL is still a uniform top-k rather
than the real non-uniform inhibition. Any of those could hide an effect.

## Run

Requires Node.js 22+ and a browser supporting WebGL.

From this directory:

```sh
npm install
npm start
```

Open http://127.0.0.1:4173. From the parent `flywire` directory, the equivalent is
`npm --prefix toy-buffet start`. Set `PORT=4180 npm start` to use another port.
All runtime assets are local; no CDN is required. The server binds to localhost.

## Play

- The default run begins with **42 simulation seconds** of unrewarded exploration.
- During **210 seconds** of training, giraffe gives a small reward (0.12), zebra
  a full reward (1.00), and lion none. Change these with the sliders.
- The final **48-second** test removes rewards and freezes learning.
- Use **1× / 4× / 12× / 30×** speed. At 4×, the five-minute toy experiment takes
  about 75 real seconds, subject to browser performance.
- **Replay seed** resets memory and position with the same random seed and current
  reward/learning settings. **New fly** changes the trajectory seed. Circuit
  connectivity stays fixed so behavioral comparisons use the same toy brain.
- For a fixed-memory control, turn learning off and replay the seed. Turning it
  off mid-run freezes existing memory rather than erasing it.
- After the test, change rewards and choose **Train again** to keep the learned
  weights and start another training/probe round. New training and probe counts
  reset; original baseline counts and the full history remain.
- **Save run** downloads JSON containing parameters, recipes, tuning, weights,
  settings changes, phases, rewards, value traces, visits and occupancy.
- **Record 20s** captures the whole animated figure, including its plots and labels.
  Click again to stop early. Chromium produces WebM; other supported browsers may
  produce MP4. Recording is real-time, with the selected simulation speed.
- Reduced-motion preferences start the model paused.

## Read the picture

The left panel is a simplified 3D arena. Floating particles are illustrative odor
tracers, not samples from a physical fluid solver. The fly's faint trail records
its recent simulated positions.

The right panel is a **schematic** of the synthetic model: six odor channels,
144 sparse Kenyon-like cells, a learned scalar value readout and a reward signal.
Highlighted cells and connections reflect model activity. This is not a full-brain
anatomical rendering, and the six channels are not six fitted biological receptors.

The line plot shows each isolated recipe's model value at a standardized dose,
in arbitrary units. It does **not** show choice probabilities, food intake, or
measured neural firing. Contact counters show actual visits; phase durations
differ, so raw counts should not be compared as rates. JSON includes exposure time
and occupancy for more careful analyses. Visits are correlated within a trajectory,
not independent biological replicates.

Simulation time is uncalibrated. Five toy minutes are not a claim about a real
fly's learning speed. No satiety, lifespan or reproductive state is modeled.

## Model

1. Each dish releases a static Gaussian chemical field. Four channels represent
   phenol, indole, p-cresol and benzaldehyde. Recipes are arbitrary relative values.
2. Synthetic receptor responses saturate with concentration. Divisive normalization
   approximates antennal-lobe processing.
3. A fixed random sparse projection expands six channels into 144 cells. An
   APL-inspired sparsity constraint keeps up to 14 active. This is not an explicit
   APL neuron simulation or connectome-derived wiring.
4. An assumed innate readout and a learned readout determine local odor value.
5. At food contact during training, a scalar prediction-error delta rule updates
   weights of odor-active cells. It is a toy analogue of reward-gated mushroom-body
   learning, not a compartment-resolved KC–MBON–DAN physiological model.
6. Bilateral local samples steer a persistent noisy walker. Boundaries reflect it.
   A brief post-contact departure and decaying spatial fatigue encourage exploration.
   The controller receives no dish names, IDs, target coordinates or reward map.
   Coordinates are used by the environment to construct fields and detect contacts.

The model may learn an odor's value without producing a clear visit winner in one
short test. That variability is retained. Generalization between similar blends is
possible because learning operates on odor patterns rather than dish labels.

## Verify

```sh
npm test
npx playwright install chromium
npm run check:browser
```

Eight model tests cover zero-odor behavior, explicit innate biases, paired versus
unpaired rewards, deterministic replay, invariance to dish labels/order, a
learning-disabled control, bounded navigation across seeds, and reward reversal.
The 12-seed test also verifies that learning changes observed probe contacts.

For the checked default model, pooled zebra probe contacts were 32/63 with learning
versus 14/39 with learning disabled across seeds 1–12. These are software behavior
checks on synthetic trajectories, not biological results or a statistical study.

The browser check uses its own localhost server on port 4174 and tests 3D rendering,
controls, JSON downloads, actual video recording and mobile overflow. It saves
screenshots in `artifacts/` and closes its server/browser afterward.

## Render a reproducible video

Requires ffmpeg and the Playwright Chromium install above.

```sh
npm run render:preview
```

Produces `artifacts/poop-buffet-preview.mp4` (28 s, 1440×810, 30 fps), plus
`artifacts/preview-run.json`. The same seed-17 simulation is advanced at a fixed
12× rate, with a one-second opening hold and two-second closing hold. Frames are
piped directly to ffmpeg, not stored as thousands of images. The renderer uses
port 4175 and closes its server/browser afterward.

For a compact GIF from the resulting MP4:

```sh
ffmpeg -y -i artifacts/poop-buffet-preview.mp4 -filter_complex "fps=15,scale=960:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=3" -loop 0 artifacts/poop-buffet-preview.gif
```

The repeat is an experimental replay, not a continuous-life loop: the fly's memory
starts fresh on each replay. MP4 preserves small labels much better than GIF.

## Files and upgrade points

- `config.mjs`: odor recipes, synthetic receptor tuning, innate coefficients and
  time constants. Replace with measured headspace and receptor data here.
- `model.mjs`: headless fixed-step model. `OdorBrain` owns encoding and learning;
  `BuffetSimulation` owns environment, movement, contacts and experiment phases.
- `view.mjs`: procedural 3D assets plus a recordable canvas figure. Independent of
  the simulation state updates.
- `app.mjs`: UI and real-time stepping; `window.buffet` exposes deterministic
  offline inspection/rendering methods.
- `server.mjs`: minimal localhost static server.
- `tests/` and `scripts/`: verification and rendering.

Next scientific upgrades are measured recipes and receptor responses, realistic
mixture/dose handling, FlyWire PN→KC and relevant downstream connectivity, and
behavioral calibration. The current working data cache remains in the parent folder.

Scientific sources and distinctions between egg-laying, feeding and navigation
are documented in `../POOP_BUFFET_RESEARCH.md`. The biological motivations are
[Mansourian et al. (2016)](https://doi.org/10.1016/j.cub.2016.07.065) and
[Huetteroth et al. (2015)](https://doi.org/10.1016/j.cub.2015.01.036).
