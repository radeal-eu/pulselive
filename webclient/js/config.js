/*! Pulse Monitor Live web client | (c) 2026 Radeal sp. z o.o. | MIT License */
export const STORAGE_KEY = 'pulselive.connection';
export const STOPPED_KEY = 'pulselive.stopped'; // set while the user has pressed Stop
export const DEFAULT_PORT = 8765;
export const DEFAULT_SCHEME = 'https'; // Pulse Monitor encrypts by default
export const STALE_MS = 10000;
export const REQUEST_TIMEOUT_MS = 4000;
export const BACKOFF_MS = [5000, 15000, 60000];
export const RETRY_ERROR_MS = 5000; // network errors are always retried after this delay

// Tile layout (see layout.js). Sizes in CSS pixels; ratios are width / height.
export const LAYOUT = { minW: 120, minH: 96, minAr: 0.85, maxAr: 1.5, minSlots: 4 };
export const MAX_TILES = 42; // the format allows at most 42 participants
