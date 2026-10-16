/*! Pulse Monitor Live web client | (c) 2026 Radeal sp. z o.o. | MIT License */
import { STALE_MS, REQUEST_TIMEOUT_MS, BACKOFF_MS, RETRY_ERROR_MS } from './config.js';
import { isBlockedByMixedContent, isSameOrigin, originOf } from './connection.js';

/**
 * Connects to the Pulse Monitor Live API of one computer on the local network and reports what it finds.
 *
 * It talks https/wss, or http/ws when the encryption of Pulse Monitor is off (see the connection's `scheme`).
 * It first asks `GET /live` (which tells apart a wrong key, "no data yet" and a working server, something
 * a browser WebSocket cannot do), then opens `/ws` and receives every new snapshot as it is published.
 * When the connection drops it starts again after a pause (5 s, 15 s, 60 s).
 *
 * Events (CustomEvent, see `detail`):
 *   state     { state, retryInMs? }   connection state, see below
 *   snapshot  { snapshot }            every snapshot received
 *
 * States: connecting | live | waiting | stale | rate_limited | unavailable | error | unauthorized | blocked | stopped
 */
export class PulseLiveClient extends EventTarget {
  #connection;
  #key;
  #staleMs;
  #running = false;
  #timer = 0;
  #staleTimer = 0;
  #abort = null;
  #socket = null;
  #failures = 0;
  #lastSentAt = null;
  #lastChangeAt = 0;
  #live = false; // the last state reported was live

  constructor({ scheme, address, key, staleMs = STALE_MS }) {
    super();
    this.#connection = { scheme, address };
    this.#key = key;
    this.#staleMs = staleMs;
  }

  get running() {
    return this.#running;
  }

  start() {
    if (this.#running) return;
    this.#running = true;
    this.#failures = 0;
    this.#lastSentAt = null;
    this.#live = false;
    this.#emitState('connecting');
    // Without new snapshots nothing else would notice that the transmission has stopped.
    this.#staleTimer = setInterval(() => this.#checkStale(), 1000);
    this.#connect();
  }

  stop() {
    if (!this.#running) return;
    this.#halt('stopped');
  }

  #halt(state) {
    this.#running = false;
    clearTimeout(this.#timer);
    clearInterval(this.#staleTimer);
    this.#abort?.abort();
    this.#closeSocket();
    this.#emitState(state);
  }

  #closeSocket() {
    const socket = this.#socket;
    this.#socket = null; // so its close handler knows it was closed on purpose
    if (socket) socket.close();
  }

  #emitState(state, extra = {}) {
    this.#live = state === 'live';
    this.dispatchEvent(new CustomEvent('state', { detail: { state, ...extra } }));
  }

  // Only for an encrypted connection to ANOTHER server than the one that served this page: the browser may be
  // refusing its self-signed certificate until it is accepted once.
  #certificateHint() {
    return this.#connection.scheme === 'https' && !isSameOrigin(this.#connection) ? 'certificate' : '';
  }

  // Failures back off 5 s, 15 s, 60 s (the last value repeats).
  #backoff() {
    return BACKOFF_MS[Math.min(this.#failures - 1, BACKOFF_MS.length - 1)];
  }

  #fail(state, delayMs = this.#backoff(), hint = '') {
    this.#emitState(state, { retryInMs: delayMs, hint });
    if (this.#running) this.#timer = setTimeout(() => this.#connect(), delayMs);
  }

  async #connect() {
    if (!this.#running) return;
    if (isBlockedByMixedContent(this.#connection)) {
      // Retrying cannot help: the browser forbids it.
      return this.#halt('blocked');
    }

    this.#abort = new AbortController();
    const signal = AbortSignal.any([this.#abort.signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]);

    let res;
    try {
      res = await fetch(`${originOf(this.#connection)}/live?key=${encodeURIComponent(this.#key)}`, {
        headers: { Accept: 'application/json' },
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        signal,
      });
    } catch {
      if (!this.#running) return; // stopped by the user
      this.#failures++;
      // With a certificate the browser has not accepted yet this fails like an unreachable server; say so.
      return this.#fail('error', RETRY_ERROR_MS, this.#certificateHint());
    }
    if (!this.#running) return;

    if (res.status === 401) {
      // The key is wrong; retrying will not help.
      return this.#halt('unauthorized');
    }
    if (res.status === 429) {
      this.#failures++;
      const retryAfter = Number(res.headers.get('Retry-After'));
      return this.#fail('rate_limited', retryAfter > 0 ? retryAfter * 1000 : this.#backoff());
    }
    if (res.status === 200) {
      let body = null;
      try {
        body = await res.json();
      } catch {
        /* handled below: not a snapshot */
      }
      if (!this.#running) return;
      if (!isSnapshot(body)) {
        this.#failures++;
        return this.#fail('error', RETRY_ERROR_MS);
      }
      this.#handleSnapshot(body);
    } else if (res.status === 503) {
      // "No data yet": the server runs but the training screen has not produced a snapshot.
      this.#emitState('waiting');
    } else {
      this.#failures++;
      return this.#fail('unavailable');
    }

    this.#failures = 0;
    this.#openSocket();
  }

  #openSocket() {
    if (!this.#running) return;
    const wsScheme = this.#connection.scheme === 'https' ? 'wss' : 'ws';
    const socket = new WebSocket(`${wsScheme}://${this.#connection.address}/ws?key=${encodeURIComponent(this.#key)}`);
    this.#socket = socket;

    socket.onmessage = (event) => {
      let body;
      try {
        body = JSON.parse(event.data);
      } catch {
        return;
      }
      if (isSnapshot(body)) {
        this.#failures = 0;
        this.#handleSnapshot(body);
      }
    };

    socket.onclose = () => {
      if (this.#socket !== socket || !this.#running) return; // closed on purpose
      this.#socket = null;
      this.#failures++;
      this.#fail('error');
    };
  }

  #handleSnapshot(snapshot) {
    // Liveness is judged by `sentAt` changing, measured on the local clock,
    // so it does not depend on the reader's clock being exact.
    const now = Date.now();
    if (snapshot.sentAt !== this.#lastSentAt) {
      this.#lastSentAt = snapshot.sentAt;
      this.#lastChangeAt = now;
    }
    const stale = now - this.#lastChangeAt > this.#staleMs || now - Date.parse(snapshot.sentAt) > 60000;

    this.dispatchEvent(new CustomEvent('snapshot', { detail: { snapshot } }));
    this.#emitState(stale ? 'stale' : 'live');
  }

  #checkStale() {
    if (this.#live && Date.now() - this.#lastChangeAt > this.#staleMs) {
      this.#emitState('stale');
    }
  }
}

function isSnapshot(body) {
  return (
    body !== null &&
    typeof body === 'object' &&
    typeof body.sentAt === 'string' &&
    Array.isArray(body.participants)
  );
}
