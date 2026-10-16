// Receives every snapshot over the WebSocket as it is published (Node.js 22+, built-in WebSocket).
// Usage: PULSE_HOST=192.168.1.15:8765 PULSE_KEY=K7MH3RAW node ws.mjs
//
// PULSE_HOST is the address shown in Pulse Monitor under Settings > Live API. https:// is assumed
// (the stream is then wss://); write http://192.168.1.15:8765 when the encryption was turned off there.
const host = process.env.PULSE_HOST;
const key = process.env.PULSE_KEY;
if (!host || !key) {
  console.error('Set PULSE_HOST (address:port shown in Pulse Monitor, Settings > Live API) and PULSE_KEY');
  process.exit(1);
}
const secure = !/^http:\/\//i.test(host);
const address = host.replace(/^https?:\/\//i, '').replace(/\/+$/, '');

// Pulse Monitor makes its own (self-signed) certificate, so this example does not verify it.
// A production reader should compare the certificate with the SHA-256 fingerprint shown in Settings > Live API.
if (secure) process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const backoff = [5000, 15000, 60000]; // pause after each failed attempt; the last value repeats
let failures = 0;

while (true) {
  await new Promise((resolve) => {
    const ws = new WebSocket(`${secure ? 'wss' : 'ws'}://${address}/ws?key=${encodeURIComponent(key)}`);
    ws.onmessage = (event) => {
      failures = 0;
      console.log(event.data); // one complete snapshot per message
    };
    ws.onclose = resolve;
    ws.onerror = () => {}; // `close` follows
  });

  // A refused handshake (wrong key, locked out, too many clients) looks the same as a missing server.
  // Ask GET /live if you need to know which.
  console.error('disconnected');
  await sleep(backoff[Math.min(failures++, backoff.length - 1)]);
}
