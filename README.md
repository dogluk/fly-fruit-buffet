# The fruit buffet / toy v0

A local interactive fly-olfaction model. A 3D fly explores three
fermenting-fruit odor sources, encounters food rewards, and takes an
odor-only test afterward. Its decisions come from local chemical sensing and
an odor-associated memory.

*(An earlier pass ran this same circuit on dung volatilomes -- a weekend detour
into "can a fly brain smell shit." She's a* Drosophila*, and fermenting fruit,
not dung, is her actual ecology, so the dishes were replaced. The wiring, the
receptors and the mushroom-body readout underneath did not change.)*

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

Innate valence, derived from the connectome, across three dishes with a real
chemical fault line between them:

| dish | dominant chemistry | innate valence |
|---|---|---|
| Cherry | fermentation esters (ethyl butyrate, diacetyl) | +0.430 |
| Banana | fermentation esters (isoamyl/ethyl acetate) | +0.437 |
| Citrus | intact-peel terpenes (limonene, linalool, geraniol) | +0.146 |

**The two fermenting-fruit dishes read almost identically appetitive, and
citrus reads three times lower.** That split lines up with real biology rather
than chemical similarity: ethyl acetate, ethyl butyrate and 2,3-butanedione all
drive DM1 (Or42b) and VA2 (Or92a) strongly in DoOR -- the same two glomeruli
Semmelhack & Wang (2009) showed are necessary and sufficient for innate vinegar
attraction. Limonene, linalool and geraniol barely touch either one. The model
was never told this circuit exists; it fell out of measured PN&rarr;KC wiring
and measured receptor responses lining up with each other.

Learning still works, and can beat the innate order. `node
scripts/does-she-learn.mjs` finds citrus is the least-preferred dish and rewards
it -- the harder test, since citrus starts out roughly a third as appetitive as
the other two:

| | learned value | probe shift |
|---|---|---|
| citrus (rewarded) | +0.445 | +17.3pp |
| cherry | -0.201 | -2.5pp |
| banana | -0.174 | -14.8pp |
| plasticity disabled | 0.000 | +/-0.5pp |

Reward flips citrus from the least- to the most-visited dish during the
odor-only probe, a bigger swing than the innate gap it had to close. Nobody
told her fermentation smells better than peel, and nobody told her reward beats
that prior either.

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
- During **210 seconds** of training, cherry gives a small reward (0.12), banana
  a full reward (1.00), and citrus none. Change these with the sliders.
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
   ethyl acetate, isopentyl acetate, benzaldehyde and limonene. Recipes are
   arbitrary relative values.
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

For the checked default model, pooled banana probe contacts were 26/44 with learning
versus 18/37 with learning disabled across seeds 1–12. These are software behavior
checks on synthetic trajectories, not biological results or a statistical study.

The browser check uses its own localhost server on port 4174 and tests 3D rendering,
controls, JSON downloads, actual video recording and mobile overflow. It saves
screenshots in `artifacts/` and closes its server/browser afterward.

## Render a reproducible video

Requires ffmpeg and the Playwright Chromium install above.

```sh
npm run render:preview
```

Produces `artifacts/fruit-buffet-preview.mp4` (28 s, 1440×810, 30 fps), plus
`artifacts/preview-run.json`. The same seed-17 simulation is advanced at a fixed
12× rate, with a one-second opening hold and two-second closing hold. Frames are
piped directly to ffmpeg, not stored as thousands of images. The renderer uses
port 4175 and closes its server/browser afterward.

For a compact GIF from the resulting MP4:

```sh
ffmpeg -y -i artifacts/fruit-buffet-preview.mp4 -filter_complex "fps=15,scale=960:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=3" -loop 0 artifacts/fruit-buffet-preview.gif
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

The dish chemistry and its biological motivation:
[Semmelhack & Wang (2009)](https://doi.org/10.1038/nature07983) on the DM1/VA2
vinegar-attraction circuit,
[Becher et al. (2012)](https://doi.org/10.1111/j.1365-2435.2012.02006.x) on
yeast (not fruit) volatiles driving attraction, and Hallem & Carlson (2006,
*Cell* 125:143-160) for the receptor-deorphanization data underlying much of
DoOR. On the citrus caveat: citrus and
other essential oils, D-limonene included, repel *D. suzukii*
([Renkema et al., 2016](https://doi.org/10.1038/srep21432)) -- the closest
published evidence, in a close relative, not a *D. melanogaster* measurement.
