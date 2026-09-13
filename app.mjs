import { BuffetSimulation } from './model.mjs';
import { BuffetView } from './view.mjs';
import { DISHES, MODEL } from './config.mjs';

const $ = id => document.getElementById(id);
let sim = new BuffetSimulation();
let paused = matchMedia('(prefers-reduced-motion: reduce)').matches;
let speed = 4;
let view;
let accumulator = 0;
let recorder = null;
let recordingTimer = null;
let recordingStart = 0;
let offline = new URLSearchParams(location.search).has('offline');

function download(blob, name) {
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

function updateControls() {
  $('play').textContent = paused ? 'Play' : 'Pause';
  $('play').setAttribute('aria-label', paused ? 'Play simulation' : 'Pause simulation');
  $('play').disabled = sim.phase === 'complete';
  $('train-again').disabled = sim.phase !== 'complete';
  $('seed-label').textContent = `SEED ${sim.seed}`;
  $('learning').checked = sim.learning;
  sim.dishes.forEach((dish, i) => {
    $(`reward-${i}`).value = dish.reward;
    $(`value-${i}`).value = dish.reward.toFixed(2);
  });
}

function reset(seed) {
  sim = new BuffetSimulation({ seed, learning: $('learning').checked });
  DISHES.forEach((_, i) => { sim.setReward(i, Number($(`reward-${i}`).value)); });
  accumulator = 0;
  $('run-status').textContent = 'Fresh memory. Same recipes. Let her explore.';
  updateControls();
}

DISHES.forEach((dish, i) => {
  const row = document.createElement('div');
  row.className = 'reward-row'; row.style.setProperty('--dish-color', dish.color);
  row.innerHTML = `<label for="reward-${i}">${dish.name}</label><input id="reward-${i}" type="range" min="0" max="1" step="0.01" value="${dish.reward}" aria-label="${dish.name} food reward"><output id="value-${i}" for="reward-${i}">${dish.reward.toFixed(2)}</output>`;
  $('reward-controls').append(row);
  $(`reward-${i}`).addEventListener('input', event => {
    sim.setReward(i, Number(event.target.value)); updateControls();
    $('run-status').textContent = sim.phase === 'complete' ? 'Rewards changed. Train again to keep her memories and offer a new menu.'
      : 'Reward setting updated. It takes effect on contact during training.';
  });
});

$('play').addEventListener('click', () => { paused = !paused; accumulator = 0; updateControls(); });
$('reset').addEventListener('click', () => reset(sim.seed));
$('new-seed').addEventListener('click', () => reset(crypto.getRandomValues(new Uint32Array(1))[0] % 100000));
$('speed').addEventListener('change', e => { speed = Number(e.target.value); });
$('learning').addEventListener('change', e => {
  sim.setLearning(e.target.checked);
  $('run-status').textContent = sim.learning ? 'Future meals can update memory.' : 'Memory is frozen. Replay seed to start a fresh no-learning control.';
});
$('train-again').addEventListener('click', () => {
  sim.trainAgain(); paused = false; accumulator = 0; updateControls();
  $('run-status').textContent = `Training round ${sim.round}. Previous memories retained; test counts reset.`;
});
$('export').addEventListener('click', () => {
  download(new Blob([JSON.stringify(sim.export(), null, 2)], { type: 'application/json' }), `fruit-buffet-seed-${sim.seed}.json`);
});

function finishRecording() {
  if (recorder?.state === 'recording') recorder.stop();
}
$('record').addEventListener('click', () => {
  if (recorder?.state === 'recording') { finishRecording(); return; }
  if (!window.MediaRecorder || !$('stage').captureStream) {
    $('run-status').textContent = 'Recording is unavailable in this browser. Try Chrome or use npm run render:preview.'; return;
  }
  const mimeType = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/mp4'].find(x => MediaRecorder.isTypeSupported(x));
  if (!mimeType) { $('run-status').textContent = 'No supported video encoder. Use npm run render:preview.'; return; }
  const stream = $('stage').captureStream(30);
  const chunks = [], seed = sim.seed;
  try {
    recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 6000000 });
    recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
    recorder.onstop = () => {
      clearTimeout(recordingTimer);
      stream.getTracks().forEach(t => t.stop());
      download(new Blob(chunks, { type: mimeType }), `fruit-buffet-${seed}.${mimeType.startsWith('video/mp4') ? 'mp4' : 'webm'}`);
      $('record').textContent = 'Record 20s'; $('record').classList.remove('recording');
      $('run-status').textContent = 'Clip saved. It includes the stage, live circuit, value trace and contact counts.';
      recorder = null;
    };
    recorder.start(); paused = false; updateControls();
    recordingStart = performance.now(); $('record').classList.add('recording');
    recordingTimer = setTimeout(finishRecording, 20000);
  } catch (error) {
    stream.getTracks().forEach(t => t.stop()); recorder = null;
    $('run-status').textContent = `Recording failed: ${error.message}`;
  }
});

try {
  view = new BuffetView($('stage'));
  updateControls();
  let lastTime = performance.now(), previousPhase = sim.phase;
  function frame(now) {
    const elapsed = Math.min((now - lastTime) / 1000, .1); lastTime = now;
    if (!offline && !paused && sim.phase !== 'complete' && !document.hidden) {
      accumulator += elapsed * speed;
      while (accumulator >= MODEL.dt) { sim.step(); accumulator -= MODEL.dt; }
    }
    if (previousPhase !== sim.phase) {
      updateControls(); previousPhase = sim.phase;
      if (sim.phase === 'complete') $('run-status').textContent = 'Test complete. Compare odor values and observed contacts. Change rewards and train again, or replay with learning off.';
    }
    if (recorder?.state === 'recording') $('record').textContent = `Stop · ${Math.min(20, Math.floor((now - recordingStart) / 1000))}s`;
    if (!offline) view.render(sim, { paused, speed, recording: recorder?.state === 'recording' });
    requestAnimationFrame(frame);
  }
  view.render(sim, { paused, speed }); requestAnimationFrame(frame);
  // Explicit deterministic inspection/rendering API. Not used by the agent controller.
  window.buffet = {
    get simulation() { return sim; },
    get ready() { return true; },
    setOffline(value = true) { offline = value; accumulator = 0; },
    advance(seconds) { sim.advance(seconds); updateControls(); view.render(sim, { speed }); return sim.export(); },
    reset(seed = MODEL.seed) { reset(seed); view.render(sim, { paused, speed }); },
    render() { view.render(sim, { paused, speed }); },
    snapshot() { return $('stage').toDataURL('image/png'); },
  };
} catch (error) {
  $('render-error').hidden = false;
  $('render-error').textContent = `Could not start the 3D view: ${error.message}. Open this app in a browser with WebGL enabled.`;
  console.error(error);
}
