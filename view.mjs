import * as THREE from './node_modules/three/build/three.module.js';
import { DISHES, MODEL, PHASES } from './config.mjs';
import { DOOR_RESPONSES } from './door_responses.mjs';
import { nose, palate, score, finish, complexity, appellation } from './tasting.mjs';
import { clamp, randomGenerator } from './model.mjs';

const W = 1440, H = 810;
const COLORS = { text: '#e4e9e9', muted: '#91a5af', dim: '#526773', line: '#253944' };
const mono = 'Menlo, Consolas, monospace';

function line3(points, color, opacity = 1) {
  const geometry = new THREE.BufferGeometry().setFromPoints(points.map(p => new THREE.Vector3(...p)));
  return new THREE.Line(geometry, new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
}

export class BuffetView {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
    this.renderer.setSize(960, 510);
    this.renderer.setPixelRatio(1);
    this.renderer.setClearColor('#080f15');
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog('#080f15', 23, 50);
    this.camera = new THREE.PerspectiveCamera(39, 960 / 510, .1, 100);
    this.camera.position.set(2.8, 10.2, 13.3);
    this.camera.lookAt(0, 0, -.6);
    this.scene.add(new THREE.HemisphereLight('#bce6ef', '#242322', 2.3));
    const sun = new THREE.DirectionalLight('#ffdfab', 3.5);
    sun.position.set(-5, 12, 7); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 1, far: 40 });
    sun.shadow.bias = -.0005;
    this.scene.add(sun);
    const rim = new THREE.DirectionalLight('#7dced7', 2);
    rim.position.set(3, 5, -7); this.scene.add(rim);

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(50, 50),
      new THREE.MeshStandardMaterial({ color: '#0b141b', roughness: 1 }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -.04; ground.receiveShadow = true;
    this.scene.add(ground);
    const grid = new THREE.GridHelper(40, 40, '#38525e', '#243b48');
    grid.material.transparent = true; grid.material.opacity = .35; this.scene.add(grid);
    const boundary = [[-7.8, .02, -4.8], [7.8, .02, -4.8], [7.8, .02, 4.8], [-7.8, .02, 4.8], [-7.8, .02, -4.8]];
    this.scene.add(line3(boundary, '#506875', .45));
    this.dishGroups = DISHES.map((dish, i) => this.makeDish(dish, i));
    this.makeFly();
    this.makeOdorParticles();
    this.trailGeometry = new THREE.BufferGeometry();
    this.trailBuffer = new Float32Array(180 * 3);
    this.trailGeometry.setAttribute('position', new THREE.BufferAttribute(this.trailBuffer, 3));
    this.trailLine = new THREE.Line(this.trailGeometry,
      new THREE.LineBasicMaterial({ color: '#a6c4c4', transparent: true, opacity: .23 }));
    this.trailLine.frustumCulled = false; this.scene.add(this.trailLine);
    this.kcPoints = null;
    this.kcIndex = null;
  }

  // The panel holds ~180 dots; the real mushroom body has 2597 Kenyon cells.
  // Draw an evenly spaced sample of the real population and label the true
  // counts, rather than silently showing a 144-cell brain.
  ensureCircuitLayout(brain) {
    if (this.kcPoints && this.kcTotal === brain.kenyonCells) return;
    this.kcTotal = brain.kenyonCells;
    const shown = Math.min(180, brain.kenyonCells);
    const stride = brain.kenyonCells / shown;
    this.kcIndex = Array.from({ length: shown }, (_, d) => Math.floor(d * stride));
    const rng = randomGenerator(900);
    this.kcPoints = this.kcIndex.map((_, i) => {
      const side = i % 2 === 0 ? -1 : 1;
      const angle = rng() * Math.PI * 2, radius = Math.sqrt(rng());
      return { x: 1193 + side * 73 + Math.cos(angle) * radius * 69,
        y: 320 + Math.sin(angle) * radius * 65, r: 1.5 + rng() * 1.2 };
    });
  }

  sphere(parent, position, scale, material, detail = 24) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, detail, 16), material);
    mesh.position.set(...position); mesh.scale.set(...scale);
    mesh.castShadow = true; parent.add(mesh); return mesh;
  }

  makeDish(dish, index) {
    const group = new THREE.Group(); group.position.set(dish.x, .04, dish.z);
    const steel = new THREE.MeshStandardMaterial({ color: '#41515c', roughness: .38, metalness: .7 });
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.01, .1, 64), steel);
    bowl.receiveShadow = true; bowl.castShadow = true; group.add(bowl);
    const inside = new THREE.Mesh(new THREE.CylinderGeometry(.97, .97, .025, 64),
      new THREE.MeshStandardMaterial({ color: '#19252a', metalness: .3, roughness: .5 }));
    inside.position.y = .065; inside.receiveShadow = true; group.add(inside);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.01, .028, 8, 64),
      new THREE.MeshStandardMaterial({ color: dish.color, emissive: dish.color, emissiveIntensity: .22, roughness: .5 }));
    ring.rotation.x = Math.PI / 2; ring.position.y = .09; group.add(ring);
    const rng = randomGenerator(400 + index);
    // Flesh tone per dish: overripe banana pulp, cherry flesh, citrus segment.
    const flesh = new THREE.MeshStandardMaterial({ color: ['#6e1524', '#e8d27a', '#f3a24e'][index], roughness: .85 });
    if (index === 2) {
      // Citrus: three curved wedges standing in for peeled segments.
      for (let i = 0; i < 3; i++) this.sphere(group, [(i - 1) * .29, .22 + i * .015, .06 * (i % 2)], [.24, .16, .48], flesh);
    } else {
      // Banana / cherry: a scatter of diced fruit chunks.
      for (let i = 0; i < 12; i++) {
        const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * .53;
        this.sphere(group, [Math.cos(a) * r, .17 + rng() * .15, Math.sin(a) * r], [.2, .16, .17], flesh, 12);
      }
    }
    for (let i = 0; i < 38; i++) {
      const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * .6;
      this.sphere(group, [Math.cos(a) * r, .18 + .24 * (1 - r), Math.sin(a) * r], [.025, .028, .023], flesh, 6);
    }
    this.scene.add(group); return group;
  }

  makeFly() {
    this.fly = new THREE.Group(); this.fly.scale.setScalar(1.1);
    this.scene.add(this.fly);
    const tan = new THREE.MeshStandardMaterial({ color: '#c6a365', roughness: .8 });
    const gold = new THREE.MeshStandardMaterial({ color: '#deb980', roughness: .72 });
    const dark = new THREE.MeshStandardMaterial({ color: '#312b23', roughness: .8 });
    const eye = new THREE.MeshStandardMaterial({ color: '#d63b1e', roughness: .66 });
    this.sphere(this.fly, [0, .65, 0], [.45, .36, .3], tan);
    this.sphere(this.fly, [-.58, .55, 0], [.58, .28, .26], tan);
    for (let i = 0; i < 5; i++) {
      const x = -.26 - .17 * i;
      const rad = Math.sqrt(Math.max(.1, 1 - ((x + .58) / .6) ** 2));
      const stripe = new THREE.Mesh(new THREE.TorusGeometry(.265 * rad, .032, 8, 40), dark);
      stripe.rotation.y = Math.PI / 2; stripe.position.set(x, .55, 0); this.fly.add(stripe);
    }
    this.sphere(this.fly, [.48, .7, 0], [.32, .3, .33], gold);
    for (const side of [-1, 1]) {
      const e = this.sphere(this.fly, [.58, .76, side * .235], [.22, .255, .145], eye);
      e.rotation.x = side * .2;
      const facets = new THREE.Group();
      const facetMat = new THREE.MeshStandardMaterial({ color: '#f04b27', roughness: .76 });
      for (let j = 0; j < 110; j++) {
        const v = (j + .5) / 110, a = j * 2.39996;
        const yy = 1 - 2 * v, r = Math.sqrt(1 - yy * yy);
        const zz = Math.sin(a) * r;
        if (zz * side > .1) this.sphere(facets, [.58 + .222 * Math.cos(a) * r, .76 + .257 * yy, side * .235 + .15 * zz], [.012, .012, .009], facetMat, 6);
      }
      this.fly.add(facets);
      this.sphere(this.fly, [.76, .63, side * .095], [.07, .1, .07], tan, 12);
      this.fly.add(line3([[.76, .73, side * .12], [.91, .85, side * .2], [1.05, .89, side * .24]], '#bda376'));
      for (let i = 0; i < 5; i++) this.fly.add(line3([[.9 + i * .027, .85 + i * .008, side * (.2 + i * .008)], [.94 + i * .027, .97, side * (.26 + i * .008)]], '#bda376', .8));
      // Translucent wings and fine veins make the silhouette read as a fruit fly.
      const wing = new THREE.Group(); wing.position.set(-.1, .92, side * .15);
      const wingMat = new THREE.MeshPhysicalMaterial({ color: '#d9e6df', transparent: true,
        opacity: .35, roughness: .3, metalness: .05, side: THREE.DoubleSide, depthWrite: false });
      this.sphere(wing, [-.5, 0, side * .24], [.88, .014, .29], wingMat, 32);
      for (let i = 0; i < 5; i++) {
        const z = side * (.05 + i * .08);
        wing.add(line3([[.1, .019, 0], [-.45, .019, z], [-1.21 + Math.abs(i - 2) * .06, .019, side * (.14 + i * .045)]], '#9eae9f', .55));
      }
      wing.rotation.y = side * .13;
      this.fly.add(wing);
      if (!this.wings) this.wings = [];
      this.wings.push(wing);
    }
    this.proboscis = this.sphere(this.fly, [.72, .43, 0], [.09, .14, .09], gold);
    this.legs = [];
    for (let row = 0; row < 3; row++) for (const side of [-1, 1]) {
      const segments = Array.from({ length: 3 }, () => {
        const mesh = new THREE.Mesh(new THREE.CylinderGeometry(.019, .031, 1, 8), gold);
        mesh.castShadow = true; this.fly.add(mesh); return mesh;
      });
      this.legs.push({ row, side, segments });
    }
    const rng = randomGenerator(56);
    const hairPoints = [];
    for (let i = 0; i < 230; i++) {
      const a = rng() * Math.PI * 2, b = Math.acos(2 * rng() - 1);
      const p = new THREE.Vector3(.42 * Math.sin(b) * Math.cos(a), .65 + .36 * Math.cos(b), .3 * Math.sin(b) * Math.sin(a));
      if (p.y < .56) continue;
      const normal = new THREE.Vector3(p.x / .42, (p.y - .65) / .36, p.z / .3).normalize();
      const end = p.clone().addScaledVector(normal, .07 + rng() * .08);
      hairPoints.push(p, end);
    }
    this.fly.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(hairPoints),
      new THREE.LineBasicMaterial({ color: '#342d22', transparent: true, opacity: .88 })));
  }

  makeOdorParticles() {
    const rng = randomGenerator(4);
    this.particles = DISHES.map(d => {
      const seeds = Array.from({ length: 65 }, () => [rng(), rng(), rng()]);
      const geometry = new THREE.BufferGeometry();
      const positions = new Float32Array(seeds.length * 3);
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const mesh = new THREE.Points(geometry, new THREE.PointsMaterial({ color: d.color,
        size: .045, transparent: true, opacity: .35, depthWrite: false }));
      mesh.frustumCulled = false; this.scene.add(mesh);
      return { seeds, positions, mesh, dish: d };
    });
  }

  segment(mesh, a, b) {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b);
    mesh.position.copy(start).add(end).multiplyScalar(.5);
    mesh.scale.y = start.distanceTo(end);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.sub(start).normalize());
  }

  updateFly(sim) {
    const f = sim.fly;
    this.fly.position.set(f.x, f.eating > 0 ? -.015 : .014 * Math.sin(f.walk * 13), f.z);
    this.fly.rotation.y = -f.heading;
    for (const leg of this.legs) {
      const { row, side, segments } = leg;
      const phase = f.walk * 11 + ((row + (side > 0 ? 1 : 0)) % 2) * Math.PI;
      const swing = f.eating > 0 ? 0 : Math.cos(phase) * .2;
      const lift = f.eating > 0 ? 0 : Math.max(0, Math.sin(phase)) * .13;
      const root = [.3 - row * .3, .62, side * .2];
      const elbow = [.65 - row * .63 + swing * .3, .49, side * .58];
      const ankle = [.9 - row * .88 + swing, .12 + lift, side * .94];
      const foot = [ankle[0] + .15, .025 + lift, side * 1.08];
      this.segment(segments[0], root, elbow); this.segment(segments[1], elbow, ankle); this.segment(segments[2], ankle, foot);
    }
    this.proboscis.scale.y = f.eating > 0 ? .22 : .11;
    this.proboscis.position.y = f.eating > 0 ? .34 + Math.sin(sim.time * 16) * .02 : .47;
    this.wings.forEach((wing, i) => {
      wing.rotation.x = (i === 0 ? -1 : 1) * (.04 + .015 * Math.sin(sim.time * 9));
    });
    for (const particle of this.particles) {
      particle.seeds.forEach(([a, b, c], i) => {
        const t = (a + sim.time * .045) % 1;
        const angle = b * Math.PI * 2 + sim.time * .035;
        const r = .4 + t * 2.7;
        particle.positions[i * 3] = particle.dish.x + Math.cos(angle) * r;
        particle.positions[i * 3 + 1] = .2 + t * (1.7 + c * .5);
        particle.positions[i * 3 + 2] = particle.dish.z + Math.sin(angle) * r;
      });
      particle.mesh.geometry.attributes.position.needsUpdate = true;
    }
    sim.trail.forEach((p, i) => {
      this.trailBuffer[i * 3] = p.x; this.trailBuffer[i * 3 + 1] = .035; this.trailBuffer[i * 3 + 2] = p.z;
    });
    this.trailGeometry.setDrawRange(0, sim.trail.length);
    this.trailGeometry.attributes.position.needsUpdate = true;
  }

  text(text, x, y, size = 14, color = COLORS.text, align = 'left', font = mono) {
    const c = this.ctx;
    c.font = `${size}px ${font}`; c.fillStyle = color; c.textAlign = align;
    c.fillText(text, x, y); c.textAlign = 'left';
  }
  line(x1, y1, x2, y2, color = COLORS.line, width = 1) {
    const c = this.ctx; c.strokeStyle = color; c.lineWidth = width;
    c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
  }
  circle(x, y, r, color) {
    const c = this.ctx; c.fillStyle = color; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
  }
  project(x, y, z) {
    const p = new THREE.Vector3(x, y, z).project(this.camera);
    return { x: (p.x + 1) / 2 * 960, y: (1 - p.y) / 2 * 510 + 86 };
  }

  drawCircuit(sim) {
    this.ensureCircuitLayout(sim.brain);
    const c = this.ctx, obs = sim.observation;
    this.text('INSIDE THE TOY BRAIN', 994, 42, 14);
    this.text('Schematic · simulated activity', 994, 65, 11, COLORS.muted);
    this.text('01  GLOMERULI  ·  measured, DoOR 2.0', 994, 115, 11, COLORS.muted);
    // 41 glomeruli will not fit as labelled dots. Show the most active few by
    // name -- they are real glomeruli, so the label is worth more than a grid.
    const peak = Math.max(...obs.receptors, 1e-6);
    const order = Array.from(obs.receptors.keys())
      .sort((a, b) => obs.receptors[b] - obs.receptors[a]).slice(0, 6);
    const receptorPoints = new Array(obs.receptors.length);
    order.forEach((g, i) => {
      const x = 1010 + i * 66, y = 164, r = obs.receptors[g] / peak;
      receptorPoints[g] = { x, y };
      this.circle(x, y, 12, '#192e38');
      this.circle(x, y, 3 + 8 * r, `rgba(135,199,202,${.25 + .75 * r})`);
      this.text(DOOR_RESPONSES.glomeruli[g], x, 193, 10, COLORS.muted, 'center');
    });
    // Unshown glomeruli still drive Kenyon cells; anchor their claws off-panel.
    for (let g = 0; g < receptorPoints.length; g++)
      if (!receptorPoints[g]) receptorPoints[g] = { x: 1193, y: 164 };
    this.text('02  SPARSE ODOR PATTERN', 994, 237, 11, COLORS.muted);
    // Lines are this brain's real claws: each Kenyon cell's actual presynaptic
    // PNs, grouped to the channel that drives them (brain.pnChannel).
    c.save(); c.beginPath(); c.rect(988, 251, 425, 148); c.clip();
    this.kcPoints.forEach((p, d) => {
      const i = this.kcIndex[d], active = obs.kc[i];
      if (active < .06 && d % 12 !== 0) return;
      sim.brain.projections[i].forEach((weight, j) => {
        const anchor = receptorPoints[sim.brain.pnGlom[j]];
        if (weight > 0 && anchor) this.line(anchor.x, 205, p.x, p.y,
          active > .06 ? `rgba(125,183,183,${.04 + active * .14})` : '#162732');
      });
    });
    c.restore();
    const memoryTrace = sim.brain.kcMemory();
    this.kcPoints.forEach((p, d) => {
      const i = this.kcIndex[d];
      const a = obs.kc[i], memory = memoryTrace[i];
      if (a > .04) this.circle(p.x, p.y, 5 + a * 5, `rgba(232,181,106,${a * .13})`);
      this.circle(p.x, p.y, p.r + a * 2, a > .04 ? '#e5b56a' : memory > .08 ? '#576a6f' : '#2d454f');
      if (a > .04) this.line(p.x, p.y + 4, 1160, 437, `rgba(229,181,106,${a * .35})`);
    });
    this.text(`${obs.kc.filter(x => x > 0).length} / ${sim.brain.kenyonCells} cells active` +
      (this.kcIndex.length < sim.brain.kenyonCells ? `  ·  showing ${this.kcIndex.length}` : ''),
      1193, 408, 11, COLORS.muted, 'center');
    this.circle(1160, 445, 13, '#204047');
    this.circle(1160, 445, 4 + Math.max(0, obs.learned) * 7, '#71c8bf');
    this.text('LEARNED VALUE', 1160, 480, 10, COLORS.muted, 'center');
    this.text(`${obs.learned >= 0 ? '+' : ''}${obs.learned.toFixed(2)}`, 1160, 507, 22, '#71c8bf', 'center');
    this.circle(1348, 445, 9 + sim.rewardPulse * 7, sim.rewardPulse > .05 ? '#e5b56a' : '#34454e');
    this.line(1333, 445, 1179, 445, `rgba(229,181,106,${.15 + sim.rewardPulse * .65})`);
    this.text('REWARD', 1348, 480, 10, COLORS.muted, 'center');
    this.text(sim.phase === 'training' ? sim.rewardPulse.toFixed(2) : 'OFF', 1348, 507, 22,
      sim.rewardPulse > .05 ? '#e5b56a' : COLORS.dim, 'center');
    this.text(sim.learning ? 'Plasticity enabled during meals' : 'CONTROL: plasticity disabled', 994, 551, 11,
      sim.learning ? COLORS.muted : '#e5b56a');
  }

  drawChart(sim) {
    const x = 70, y = 649, width = 821, height = 105;
    this.text('DOES EXPERIENCE CHANGE ODOR VALUE?', 40, 613, 12);
    this.text('Isolated odor · fixed dose · arbitrary units', 40, 634, 10, COLORS.muted);
    const maxTime = Math.max(300, Math.ceil((sim.time - 1e-7) / 60) * 60);
    const sx = t => x + t / maxTime * width;
    const sy = value => y + height - (value + .6) / 2.5 * height;
    const c = this.ctx;
    const trainingWindows = [];
    let start = null;
    for (const event of sim.events) {
      if (event.type === 'new-training-round' || event.type === 'phase' && event.phase === 'training') start = event.time;
      if (start !== null && event.type === 'phase' && event.phase === 'probe') {
        trainingWindows.push([start, event.time]); start = null;
      }
    }
    if (start !== null) trainingWindows.push([start, start + MODEL.durations.training]);
    if (sim.time < MODEL.durations.baseline) trainingWindows.push([42, 252]);
    c.fillStyle = '#101e27';
    for (const [a, b] of trainingWindows) c.fillRect(sx(a), y, sx(Math.min(b, maxTime)) - sx(a), height);
    for (const tick of [-.5, 0, .5, 1, 1.5]) {
      this.line(x, sy(tick), x + width, sy(tick), tick === 0 ? '#40515a' : '#1b2d38');
      this.text(tick.toFixed(1), x - 12, sy(tick) + 4, 10, COLORS.muted, 'right');
    }
    const tickStep = Math.max(60, Math.ceil(maxTime / 360) * 60);
    for (let tick = 0; tick <= maxTime; tick += tickStep) {
      this.text(String(tick), sx(tick), y + height + 19, 10, COLORS.muted, 'center');
    }
    this.text('Simulation time (s)', x + width, 796, 10, COLORS.muted, 'right');
    c.save(); c.beginPath(); c.rect(x, y, width, height); c.clip();
    DISHES.forEach((dish, index) => {
      c.strokeStyle = dish.color; c.lineWidth = 2.4; c.beginPath();
      sim.history.forEach((p, i) => {
        if (i === 0) c.moveTo(sx(p.time), sy(p.values[index]));
        else c.lineTo(sx(p.time), sy(p.values[index]));
      });
      c.stroke();
      const value = sim.standardizedValues()[index].value;
      this.circle(sx(sim.time), sy(value), 3.5, dish.color);
    });
    c.restore();
    for (const [a, b] of trainingWindows) {
      for (const t of [a, b].filter(t => t <= maxTime)) this.line(sx(t), y, sx(t), y + height, '#3b4d58');
      this.text('TRAINING', sx((a + Math.min(b, maxTime)) / 2), y + 14, 9, '#69808d', 'center');
    }
    DISHES.forEach((dish, i) => {
      const lx = 40 + i * 130;
      this.line(lx, 791, lx + 17, 791, dish.color, 2);
      this.text(dish.name, lx + 25, 795, 11, dish.color);
    });
  }

  drawVisits(sim) {
    // The tasting card. Every line is read off model state -- see tasting.mjs.
    this.text('THE FLIGHT', 994, 613, 13);
    this.text('three expressions · served at ambient', 994, 634, 10, COLORS.muted);
    const vals = sim.standardizedValues();
    sim.dishes.forEach((d, i) => {
      const y = 668 + i * 46;
      const s = score(vals[i].value);
      this.circle(999, y - 4, 3, d.color);
      this.text(d.name.toUpperCase(), 1013, y, 13, d.color);
      this.text(appellation(d), 1013, y + 15, 9, COLORS.dim);
      // score, set right, in the register of a wine list
      this.text(String(s), 1412, y + 2, 21, s >= 90 ? '#e5b56a' : COLORS.text, 'right');
      this.text('NOSE', 1108, y, 8, COLORS.dim);
      this.text(nose(d, 2).join(', '), 1140, y, 10, COLORS.muted);
      this.text('PALATE', 1108, y + 15, 8, COLORS.dim);
      this.text(palate(d).join(' · ') + '  ' + complexity(d), 1152, y + 15, 10, COLORS.muted);
      this.text(`visits ${sim.visits.baseline[i]} / ${sim.visits.probe[i]}`, 1412, y + 17, 9, COLORS.dim, 'right');
    });
    this.text('FINISH  ' + finish(Math.max(...vals.map(v => v.learned))), 994, 806, 10, COLORS.dim);
  }

  render(sim, { paused = false, speed = 4, recording = false } = {}) {
    this.updateFly(sim); this.renderer.render(this.scene, this.camera);
    const c = this.ctx;
    c.fillStyle = '#080f15'; c.fillRect(0, 0, W, H);
    c.drawImage(this.renderer.domElement, 0, 86, 960, 510);
    this.text(PHASES[sim.phase].title.toUpperCase(), 40, 42, 22);
    this.text(PHASES[sim.phase].description, 40, 68, 12, COLORS.muted);
    const clockSeconds = Math.floor(sim.time + 1e-7);
    this.text(`${Math.floor(clockSeconds / 60).toString().padStart(2, '0')}:${(clockSeconds % 60).toString().padStart(2, '0')}`, 904, 40, 22, COLORS.text, 'right');
    this.text(`${paused ? 'PAUSED' : sim.phase === 'complete' ? 'COMPLETE' : speed + '× TIME'} · SEED ${sim.seed}`, 904, 63, 10, COLORS.muted, 'right');
    const phaseIndex = ['baseline', 'training', 'probe', 'complete'].indexOf(sim.phase);
    ['NOSING', 'PAIRING', 'BLIND'].forEach((name, i) => {
      const px = 40 + i * 133;
      const active = i === phaseIndex;
      this.line(px, 88, px + 115, 88, i < phaseIndex ? '#789c9c' : '#233640', 3);
      if (active) this.line(px, 88, px + 115 * clamp((sim.time - sim.phaseStart) / MODEL.durations[sim.phase], 0, 1), 88, '#e5b56a', 3);
      this.text(name, px, 111, 9, active ? '#e5b56a' : COLORS.muted);
    });
    if (sim.phase === 'complete') {
      const counts = sim.visits.probe, total = counts.reduce((a, b) => a + b, 0);
      const largest = Math.max(...counts), winners = counts.map((n, i) => n === largest ? i : -1).filter(i => i >= 0);
      this.text('MOST VISITED IN THE ODOR-ONLY TEST', 40, 155, 11, COLORS.muted);
      if (total && winners.length === 1) {
        const winner = sim.dishes[winners[0]];
        this.text(`${winner.name} / ${largest} of ${total} contacts`, 40, 190, 25, winner.color);
      } else {
        this.text(total ? 'A tie. More exploring needed.' : 'No dish contacts this time.', 40, 190, 22);
      }
    }
    this.line(957, 25, 957, 575);
    this.line(25, 584, 1415, 584);
    for (const dish of sim.dishes) {
      const p = this.project(dish.x, .15, dish.z + 1.38);
      const measured = sim.phase === 'training' ? `FOOD ${dish.reward.toFixed(2)}` : 'ODOR ONLY';
      const labelWidth = 114;
      c.fillStyle = 'rgba(8,15,21,.9)'; c.fillRect(p.x - labelWidth / 2, p.y - 14, labelWidth, 43);
      this.text(dish.name.toUpperCase(), p.x, p.y + 1, 13, dish.color, 'center');
      this.text(measured, p.x, p.y + 19, 9, COLORS.muted, 'center');
    }
    if (sim.fly.eating > 0) {
      const p = this.project(sim.fly.x, 1.8, sim.fly.z);
      this.text(sim.phase === 'training' ? sim.lastEvent.reward > .5 ? 'GOOD STUFF.' : 'SAMPLING...' : 'SNIFF.', p.x, p.y, 11, '#e5b56a', 'center');
    }
    c.fillStyle = 'rgba(8,15,21,.85)'; c.fillRect(26, 541, 897, 31);
    this.circle(42, 556, 3, sim.phase === 'training' ? '#e5b56a' : '#71c8bf');
    this.text(sim.lastEvent.text, 55, 560, 12, '#b6c6ce');
    this.text('MEASURED WIRING + RECEPTORS · FLYWIRE 783 · DoOR 2.0', 905, 560, 9, COLORS.muted, 'right');
    this.drawCircuit(sim); this.drawChart(sim); this.drawVisits(sim);
    if (recording) { this.circle(927, 42, 4, '#ea8d7d'); }
  }
}
