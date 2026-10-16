/*! Pulse Monitor Live web client | (c) 2026 Radeal sp. z o.o. | MIT License */
import { LAYOUT, MAX_TILES } from './config.js';
import { computeLayout } from './layout.js';

const ZONE_COLOR = /^#[0-9a-f]{6}$/i;
const NO_SIGNAL_COLOR = '#808080';

const STATUS = {
  stopped: { label: 'idle', tone: 'idle' },
  connecting: { label: 'connecting', tone: 'info' },
  waiting: { label: 'waiting for training', tone: 'info' },
  live: { label: 'ok', tone: 'ok' },
  stale: { label: 'no new data', tone: 'warn' },
  rate_limited: { label: 'too many attempts', tone: 'warn' },
  unavailable: { label: 'server unavailable', tone: 'warn' },
  error: { label: 'cannot connect', tone: 'warn' },
  unauthorized: { label: 'wrong key', tone: 'warn' },
  blocked: { label: 'open this page over http://', tone: 'warn' },
};

/**
 * Renders snapshots into the tile grid.
 * The grid is rebuilt only when the list of participants changes;
 * otherwise only the values that actually changed are written to the DOM.
 */
export class LiveView {
  #grid = document.getElementById('grid');
  #template = document.getElementById('tile-template');
  #toggle = document.getElementById('toggle');
  #dot = document.getElementById('status-dot');
  #label = document.getElementById('status-label');
  #elapsed = document.getElementById('elapsed');
  #name = document.getElementById('training-name');
  #signature = null;
  #tiles = [];
  #area = null; // available size of the grid (content box)
  #frame = 0;

  constructor() {
    // Any change of the available space (window resize, rotation, full screen, zoom) re-lays out the tiles.
    new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      this.#area = { width, height };
      this.#scheduleLayout();
    }).observe(this.#grid);
  }

  setRunning(running) {
    this.#toggle.textContent = running ? 'Stop' : 'Start';
    this.#toggle.classList.toggle('btn-start', !running); // blue Start: listening has to be switched on
  }

  setState({ state, retryInMs, hint }) {
    const { label, tone } = STATUS[state] ?? STATUS.error;
    this.#dot.dataset.tone = tone;
    const retry = retryInMs ? ` (retry in ${Math.round(retryInMs / 1000)} s)` : '';
    const advice = hint === 'certificate' ? ' - open the address once in this browser and accept the certificate' : '';
    this.#label.textContent = `${label}${retry}${advice}`;
  }

  render(snapshot) {
    const participants = snapshot.participants.filter((p) => p && typeof p === 'object').slice(0, MAX_TILES);
    const { training } = snapshot;
    this.#name.textContent = training?.name ? String(training.name) : 'Pulse Monitor Live';
    this.#elapsed.textContent = formatElapsed(training?.elapsedSec);

    // The signature (nicknames in display order) tells whether the set of tiles changed.
    const signature = JSON.stringify(participants.map((p) => String(p.nick ?? '')));
    if (signature !== this.#signature) {
      this.#signature = signature;
      this.#rebuild(participants);
    }
    participants.forEach((p, i) => this.#update(this.#tiles[i], p));
  }

  #rebuild(participants) {
    const fragment = document.createDocumentFragment();
    this.#tiles = participants.map((p) => {
      const node = this.#template.content.firstElementChild.cloneNode(true);
      node.querySelector('.nick').textContent = String(p.nick ?? '');
      fragment.append(node);
      return {
        node,
        hr: node.querySelector('.hr'),
        kcal: node.querySelector('.kcal'),
        pct: node.querySelector('.pct-value'),
        shown: {}, // what is currently written to the DOM
      };
    });
    this.#grid.replaceChildren(fragment);
    this.#scheduleLayout(); // the number of tiles changed
  }

  #scheduleLayout() {
    cancelAnimationFrame(this.#frame);
    this.#frame = requestAnimationFrame(() => this.#layout());
  }

  #layout() {
    if (!this.#area) return;
    const style = getComputedStyle(this.#grid);
    const layout = computeLayout({
      ...LAYOUT,
      ...this.#area,
      count: this.#tiles.length,
      gap: parseFloat(style.columnGap) || 0,
    });
    if (!layout) return;
    this.#grid.style.gridTemplateColumns = `repeat(${layout.cols}, ${layout.tileW}px)`;
    this.#grid.style.gridTemplateRows = `repeat(${layout.rows}, ${layout.tileH}px)`;
    this.#grid.classList.toggle('scroll', layout.scroll);
  }

  #update(tile, p) {
    const hasSignal = p.signal !== false && Number(p.hr) > 0;
    const color = hasSignal && ZONE_COLOR.test(p.color) ? p.color : NO_SIGNAL_COLOR;
    const { shown } = tile;

    if (shown.color !== color) {
      shown.color = color;
      tile.node.style.setProperty('--zone', color);
    }
    const checkBelt = p.checkBelt === true; // missing (older versions) means false
    if (shown.checkBelt !== checkBelt) {
      shown.checkBelt = checkBelt;
      tile.node.classList.toggle('check-belt', checkBelt);
    }
    if (shown.hasSignal !== hasSignal) {
      shown.hasSignal = hasSignal;
      tile.node.classList.toggle('no-signal', !hasSignal);
    }
    write(tile, 'hr', hasSignal ? String(Math.round(p.hr)) : '--');
    write(tile, 'pct', hasSignal ? String(Math.round(Number(p.pctMax) || 0)) : '--');
    write(tile, 'kcal', String(Math.round(Number(p.kcal) || 0)));
  }
}

// Touches the DOM only when the value changed.
function write(tile, field, text) {
  if (tile.shown[field] === text) return;
  tile.shown[field] = text;
  tile[field].textContent = text;
}

function formatElapsed(sec) {
  const s = Number.isFinite(sec) && sec > 0 ? Math.floor(sec) : 0;
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}
