/*! Pulse Monitor Live web client | (c) 2026 Radeal sp. z o.o. | MIT License */
import { DEFAULT_PORT, DEFAULT_SCHEME } from './config.js';

/** What a person typed or pasted: case, spaces, dashes and underscores do not matter. */
export function normalizeKey(raw) {
  return String(raw ?? '').replace(/[\s_-]+/g, '').toUpperCase();
}

/**
 * "192.168.1.15", "192.168.1.15:8765", "https://192.168.1.15:8765/" -> { scheme: 'https', address: '192.168.1.15:8765' }.
 * Pulse Monitor encrypts by default (https), so that is assumed when no scheme is typed; "http://" is kept for a
 * Pulse Monitor on which the encryption was turned off. A path is dropped, the default port is added.
 * Returns null when nothing usable is left.
 */
export function parseAddress(raw, defaultScheme = DEFAULT_SCHEME) {
  const text = String(raw ?? '').trim();
  const schemeMatch = /^([a-z][a-z0-9+.-]*):\/\//i.exec(text);
  const scheme = schemeMatch ? schemeMatch[1].toLowerCase() : defaultScheme;
  if (scheme !== 'http' && scheme !== 'https') return null;

  let address = text.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '').replace(/\/.*$/, '');
  if (!address) return null;
  const hasPort = address.startsWith('[') ? /\]:\d+$/.test(address) : /:\d+$/.test(address);
  if (!hasPort) address += `:${DEFAULT_PORT}`;
  return isValidAddress(address) ? { scheme, address } : null;
}

/** host:port with a plausible host (name, IPv4 or [IPv6]) and a port in range. */
export function isValidAddress(address) {
  const match = /^(\[[0-9a-f:.]+\]|[a-z0-9]([a-z0-9.-]*[a-z0-9])?):(\d{1,5})$/i.exec(address);
  return !!match && Number(match[3]) >= 1 && Number(match[3]) <= 65535;
}

/** `https://host:port` of a connection (the WebSocket uses wss:// for it, ws:// for http). */
export function originOf({ scheme, address }) {
  return `${scheme}://${address}`;
}

/** Is this connection to the very server this page came from? Then the browser has already accepted its certificate. */
export function isSameOrigin(connection) {
  return originOf(connection) === location.origin;
}

/** A page served over HTTPS may not talk to a plain-HTTP server (mixed content), except to this very computer. */
export function isBlockedByMixedContent({ scheme, address }) {
  if (location.protocol !== 'https:' || scheme === 'https') return false;
  const host = address.replace(/:\d+$/, '').replace(/^\[|\]$/g, '');
  return !(host === 'localhost' || host === '127.0.0.1' || host === '::1');
}

/** Is this host an IP address (IPv4, or IPv6 in brackets as `location.hostname` gives it)? */
export function isIpHost(hostname) {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) || /^\[[0-9a-f:.]+\]$/i.test(hostname);
}

/**
 * Was this page served by Pulse Monitor itself? Its address is an IP address on the local network
 * (https://192.168.1.15:8765/). A page from a domain (the hosted copy, a development server) is not, and
 * must not pretend that its own address is the Pulse Monitor computer.
 */
export function isServedByPulseMonitor() {
  return location.protocol.startsWith('http') && isIpHost(location.hostname);
}
