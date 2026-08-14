import './style.css';
import { sanitizeControls } from './game/physics.js';
import { Simulation, STEP_SECONDS } from './game/simulation.js';
import { CanvasRenderer } from './render/canvas-renderer.js';
import { PlayerRuntime } from './runtime/player-runtime.js';
import { SAMPLE_PROGRAM } from './sample-program.js';
import { formatProgram } from './format-program.js';

const PROGRAM_STORAGE_KEY = 'lander-program-v2';
const CLOCK_STORAGE_KEY = 'lander-clock-speed';
const CLOCK_SPEEDS = [0.5, 1, 2, 4, 8];

const elements = {
  appShell: document.querySelector('.app-shell'),
  splash: document.querySelector('#startup-splash'),
  canvas: document.querySelector('#game-canvas'),
  editor: document.querySelector('#code-editor'),
  lineNumbers: document.querySelector('#line-numbers'),
  run: document.querySelector('#run-button'),
  format: document.querySelector('#format-button'),
  pause: document.querySelector('#pause-button'),
  step: document.querySelector('#step-button'),
  reset: document.querySelector('#reset-button'),
  missionStatus: document.querySelector('#mission-status'),
  statusText: document.querySelector('#status-text'),
  runtimeMessage: document.querySelector('#runtime-message'),
  resultCard: document.querySelector('#result-card'),
  resultKicker: document.querySelector('#result-kicker'),
  resultTitle: document.querySelector('#result-title'),
  resultScore: document.querySelector('#result-score'),
  resultDetail: document.querySelector('#result-detail'),
  scoreBreakdown: document.querySelector('#score-breakdown'),
  scoreTime: document.querySelector('#score-time'),
  scoreFuel: document.querySelector('#score-fuel'),
  scoreAccuracy: document.querySelector('#score-accuracy'),
  scoreTotal: document.querySelector('#score-total'),
  simTime: document.querySelector('#sim-time'),
  altitude: document.querySelector('#altitude'),
  verticalSpeed: document.querySelector('#vertical-speed'),
  horizontalSpeed: document.querySelector('#horizontal-speed'),
  angle: document.querySelector('#angle'),
  fuel: document.querySelector('#fuel'),
  clockIndicator: document.querySelector('#clock-indicator'),
  clockRate: document.querySelector('#clock-rate'),
  clockControls: [...document.querySelectorAll('input[name="clock-speed"]')],
  tabs: [...document.querySelectorAll('[role="tab"]')],
  panels: [...document.querySelectorAll('[role="tabpanel"]')],
};

const simulation = new Simulation();
const renderer = new CanvasRenderer(elements.canvas);
const runtime = new PlayerRuntime({ onError: showRuntimeError });
let mode = 'idle';
let controls = { throttle: 0, rotation: 0 };
let previousTime = performance.now();
let accumulator = 0;
let clockSpeed = 1;
let appReady = false;

function markAppReady() {
  if (appReady) return;
  appReady = true;
  window.clearTimeout(window.__landerLoadingWatchdog);
  document.documentElement.classList.add('app-ready');
  elements.appShell.removeAttribute('inert');
  elements.appShell.removeAttribute('aria-hidden');
  elements.splash.setAttribute('aria-hidden', 'true');
  elements.splash.remove();
}

try {
  elements.editor.value = localStorage.getItem(PROGRAM_STORAGE_KEY) || SAMPLE_PROGRAM;
} catch {
  elements.editor.value = SAMPLE_PROGRAM;
}
updateLineNumbers();

try {
  const savedClockSpeed = Number(localStorage.getItem(CLOCK_STORAGE_KEY));
  if (CLOCK_SPEEDS.includes(savedClockSpeed)) clockSpeed = savedClockSpeed;
} catch {
  // Storage may be unavailable; the default clock still works.
}
setClockSpeed(clockSpeed, { persist: false });

function updateLineNumbers() {
  const count = elements.editor.value.split('\n').length;
  elements.lineNumbers.textContent = Array.from({ length: count }, (_, index) => index + 1).join('\n');
}

function activateTab(name, { focus = false } = {}) {
  for (const tab of elements.tabs) {
    const active = tab.dataset.tab === name;
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
    if (active && focus) tab.focus();
  }

  for (const panel of elements.panels) {
    panel.hidden = panel.getAttribute('aria-labelledby') !== `${name}-tab`;
  }

  if (name === 'simulation') {
    requestAnimationFrame(() => {
      renderer.resize();
      renderer.render(simulation);
    });
  }
}

function setClockSpeed(value, { persist = true } = {}) {
  const nextSpeed = Number(value);
  if (!CLOCK_SPEEDS.includes(nextSpeed)) return;

  clockSpeed = nextSpeed;
  for (const control of elements.clockControls) {
    control.checked = Number(control.value) === clockSpeed;
  }
  elements.clockIndicator.textContent = `${clockSpeed}\u00d7`;
  elements.clockRate.textContent = `${clockSpeed}\u00d7 realtime`;

  if (persist) {
    try {
      localStorage.setItem(CLOCK_STORAGE_KEY, String(clockSpeed));
    } catch {
      // Clock changes do not depend on storage being available.
    }
  }
}

function setMode(nextMode, message) {
  mode = nextMode;
  const displayStatus = ['landed', 'crashed', 'lost'].includes(simulation.status) ? simulation.status : nextMode;
  elements.missionStatus.dataset.status = displayStatus;
  elements.statusText.textContent = message || {
    idle: 'Awaiting program',
    compiling: 'Checking program',
    running: 'Guidance active',
    paused: 'Simulation paused',
    error: 'Program fault',
  }[nextMode];
  elements.pause.disabled = !['running', 'paused'].includes(nextMode);
  elements.pause.textContent = nextMode === 'paused' ? 'Resume' : 'Pause';
  elements.step.disabled = nextMode !== 'paused';
}

function showRuntimeError(message) {
  setMode('error');
  activateTab('program');
  elements.runtimeMessage.classList.add('error');
  elements.runtimeMessage.textContent = message;
  controls = { throttle: 0, rotation: 0 };
}

function resetMission() {
  runtime.dispose();
  simulation.reset();
  controls = { throttle: 0, rotation: 0 };
  accumulator = 0;
  elements.resultCard.hidden = true;
  elements.resultScore.hidden = true;
  elements.resultScore.textContent = '';
  elements.scoreBreakdown.hidden = true;
  for (const row of [elements.scoreTime, elements.scoreFuel, elements.scoreAccuracy, elements.scoreTotal]) {
    row.textContent = '';
  }
  elements.runtimeMessage.classList.remove('error');
  elements.runtimeMessage.innerHTML = 'Return <code>{ throttle, rotation }</code> from <code>update(state)</code>.';
  setMode('idle');
  updateDisplay();
}

async function runProgram() {
  resetMission();
  setMode('compiling');
  elements.runtimeMessage.textContent = 'Compiling guidance program...';
  try {
    await runtime.compile(elements.editor.value);
    try {
      localStorage.setItem(PROGRAM_STORAGE_KEY, elements.editor.value);
    } catch {
      // Storage may be unavailable in privacy modes; the mission can still run.
    }
    simulation.start();
    elements.runtimeMessage.textContent = 'Program running. Telemetry link is nominal.';
    setMode('running');
    activateTab('simulation');
    requestControls();
  } catch {
    // PlayerRuntime reports the useful error and disposes the worker.
  }
}

async function formatEditorProgram() {
  const source = elements.editor.value;
  elements.format.disabled = true;

  try {
    const formatted = await formatProgram(source);
    elements.editor.value = formatted;
    updateLineNumbers();
    elements.runtimeMessage.classList.remove('error');
    elements.runtimeMessage.textContent = 'Program formatted. Review it before running.';
    elements.editor.focus();
  } catch (error) {
    elements.runtimeMessage.classList.add('error');
    elements.runtimeMessage.textContent = `Formatting failed: ${error instanceof Error ? error.message : String(error)}`;
  } finally {
    elements.format.disabled = false;
  }
}

function requestControls(callback) {
  runtime.request(simulation.telemetry(), (nextControls) => {
    controls = sanitizeControls(nextControls);
    callback?.();
  });
}

function finishMission() {
  runtime.dispose();
  const landed = simulation.status === 'landed';
  setMode(simulation.status, landed ? 'Touchdown confirmed' : simulation.status === 'lost' ? 'Signal lost' : 'Hull contact');
  elements.resultKicker.textContent = landed ? 'Mission accomplished' : 'Mission ended';
  elements.resultTitle.textContent = landed ? 'Soft landing' : simulation.status === 'lost' ? 'Lander lost' : 'Impact detected';
  elements.resultScore.hidden = !landed;
  elements.resultScore.textContent = landed ? `Score ${simulation.score.toLocaleString('en-US')}` : '';
  elements.scoreBreakdown.hidden = !landed;
  if (landed) {
    const breakdown = simulation.scoreBreakdown;
    const points = (value) => `${value.toLocaleString('en-US', { maximumFractionDigits: 6 })} pts`;
    elements.scoreTime.textContent = points(breakdown.timePoints);
    elements.scoreFuel.textContent = points(breakdown.fuelPoints);
    elements.scoreAccuracy.textContent = points(breakdown.accuracyPoints);
    elements.scoreTotal.textContent = `${breakdown.score.toLocaleString('en-US')} pts`;
  }
  elements.resultDetail.textContent = landed
    ? `Touchdown at T+${formatTime(simulation.elapsed)} with ${simulation.lander.fuel.toFixed(0)}% fuel.`
    : 'Adjust your guidance program, reset, and fly again.';
  elements.resultCard.hidden = false;
}

function advanceOneStep() {
  simulation.step(controls, STEP_SECONDS);
  if (simulation.status !== 'running') finishMission();
  updateDisplay();
}

function frame(timestamp) {
  const frameSeconds = Math.min((timestamp - previousTime) / 1000, 0.1);
  previousTime = timestamp;

  if (mode === 'running') {
    accumulator += frameSeconds * clockSpeed;
    while (accumulator >= STEP_SECONDS && simulation.status === 'running') {
      simulation.step(controls, STEP_SECONDS);
      accumulator -= STEP_SECONDS;
    }
    requestControls();
    if (simulation.status !== 'running') finishMission();
  }

  updateDisplay();
  requestAnimationFrame(frame);
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
  const remainder = (seconds % 60).toFixed(1).padStart(4, '0');
  return `${minutes}:${remainder}`;
}

function updateDisplay() {
  const state = simulation.telemetry();
  renderer.render(simulation);
  elements.simTime.textContent = `T+ ${formatTime(state.elapsed)}`;
  elements.altitude.textContent = state.altitude.toFixed(1);
  elements.verticalSpeed.textContent = state.vy.toFixed(1);
  elements.horizontalSpeed.textContent = state.vx.toFixed(1);
  elements.angle.textContent = ((state.angle * 180) / Math.PI).toFixed(1);
  elements.fuel.textContent = state.fuel.toFixed(0);
}

elements.editor.addEventListener('input', updateLineNumbers);
elements.editor.addEventListener('scroll', () => {
  elements.lineNumbers.scrollTop = elements.editor.scrollTop;
});
elements.editor.addEventListener('keydown', (event) => {
  if (event.key === 'Tab') {
    event.preventDefault();
    const start = elements.editor.selectionStart;
    elements.editor.setRangeText('  ', start, elements.editor.selectionEnd, 'end');
    updateLineNumbers();
  }
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') runProgram();
});
elements.run.addEventListener('click', runProgram);
elements.format.addEventListener('click', formatEditorProgram);
elements.reset.addEventListener('click', resetMission);
elements.pause.addEventListener('click', () => {
  if (mode === 'running') setMode('paused');
  else if (mode === 'paused') setMode('running');
});
elements.step.addEventListener('click', () => requestControls(advanceOneStep));
elements.clockControls.forEach((control) => {
  control.addEventListener('change', () => setClockSpeed(control.value));
});
elements.tabs.forEach((tab, index) => {
  tab.addEventListener('click', () => activateTab(tab.dataset.tab));
  tab.addEventListener('keydown', (event) => {
    let targetIndex = index;
    if (event.key === 'ArrowRight') targetIndex = (index + 1) % elements.tabs.length;
    else if (event.key === 'ArrowLeft') targetIndex = (index - 1 + elements.tabs.length) % elements.tabs.length;
    else if (event.key === 'Home') targetIndex = 0;
    else if (event.key === 'End') targetIndex = elements.tabs.length - 1;
    else return;

    event.preventDefault();
    activateTab(elements.tabs[targetIndex].dataset.tab, { focus: true });
  });
});

setMode('idle');
activateTab('simulation');
updateDisplay();
markAppReady();
requestAnimationFrame(frame);
