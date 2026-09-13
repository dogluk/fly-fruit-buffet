# Fruit buffet / toy v0

## Narrative

A fly encounters three different odors. Its first choices reflect an assumed
innate odor bias. Repeated meals let it associate an initially less-preferred
odor with food. An odor-only probe asks whether that experience changed its
choices. The reveal is that smelling an odor and learning its value are separate
processes. A switch is an outcome to measure, not an animation cue.

## Deliverable

A local interactive browser model with a 3D fly and buffet, a schematic neural
activity view, fast-forward, controllable food rewards, and reproducible seeds.
Save a short preview recording after validating the browser and model.

## Model scope

This first version uses explicitly synthetic fermenting-fruit-inspired recipes, receptor
tuning, sparse Kenyon-cell connectivity, and a reward-plastic value readout.
The architecture is inspired by fly olfaction; this version does not load the
FlyWire graph or DoOR measurements. Keep these assumptions in one configuration
module so measured inputs and connectivity can replace them later.

Movement senses the local chemical field; it must not choose a dish by its name
or teleport between sources. Learning operates on odor activity, not dish ID.
Station identity is used only for collision/contact rewards and reporting.

## Visual direction

Dark technical stage, a warm tan fly with red compound eyes and articulated legs,
three shallow dishes, modest odor particles, and a separate schematic circuit.
The fly and dishes are primary; grid and unactivated neurons are quiet context.
Use wine-red, gold and citrus-orange consistently for the three odor sources.

Sequence: FIRST IMPRESSIONS / MEALS & MEMORIES / ODOR-ONLY TEST.
Show phase progress, simulation time, contact events, neural activity and
model-estimated odor values. Distinguish model value from observed visits.

## Verification

Deterministic replay; bounded finite state; local sensing; a reward-paired versus
unpaired odor-learning experiment; plasticity-disabled control; behavior across
seeds; browser console and responsive-layout checks. Inspect a rendered still
before recording the preview.
