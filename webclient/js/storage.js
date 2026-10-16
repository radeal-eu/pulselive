/*! Pulse Monitor Live web client | (c) 2026 Radeal sp. z o.o. | MIT License */
import { STORAGE_KEY } from './config.js';

// localStorage can throw (private mode, blocked storage), so every access is guarded.
// The stored connection is { scheme: 'https', address: 'host:port', key: 'ABCDEFGH' }.
export function loadConnection() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (stored && typeof stored.address === 'string' && typeof stored.key === 'string' && stored.address && stored.key) {
      return { scheme: stored.scheme === 'http' ? 'http' : 'https', address: stored.address, key: stored.key };
    }
  } catch {
    /* unavailable or damaged: treat as not stored */
  }
  return null;
}

export function saveConnection(connection) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ scheme: connection.scheme, address: connection.address, key: connection.key }));
    return true;
  } catch {
    return false;
  }
}

export function clearConnection() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* nothing to do */
  }
}
