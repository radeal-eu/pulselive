// Polls the Pulse Monitor Live API once per second (Node.js 18+).
// Usage: PULSE_HOST=192.168.1.15:8765 PULSE_KEY=K7MH3RAW node read.mjs
//
// PULSE_HOST is the address shown in Pulse Monitor under Settings > Live API. https:// is assumed;
// write http://192.168.1.15:8765 when the encryption was turned off there.
const host = process.env.PULSE_HOST;
const key = process.env.PULSE_KEY;
if (!host || !key) {
  console.error('Set PULSE_HOST (address:port shown in Pulse Monitor, Settings > Live API) and PULSE_KEY');
  process.exit(1);
}
const base = /^https?:\/\//i.test(host) ? host.replace(/\/+$/, '') : `https://${host}`;

// Pulse Monitor makes its own (self-signed) certificate, so this example does not verify it.
// A production reader should compare the certificate with the SHA-256 fingerprint shown in Settings > Live API.
if (base.startsWith('https://')) process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

while (true) {
  try {
    const res = await fetch(`${base}/live?key=${encodeURIComponent(key)}`, {
      signal: AbortSignal.timeout(5000),
    });

    if (res.status === 401) {
      console.error('wrong key');
      process.exit(1);
    }
    if (res.status === 429) {
      const wait = Number(res.headers.get('Retry-After') ?? 60);
      console.error(`too many wrong keys, waiting ${wait} s`);
      await sleep(wait * 1000);
      continue;
    }

    const data = await res.json();
    if (res.ok) {
      console.log(JSON.stringify(data));
    } else if (res.status === 503) {
      console.error('(no data yet)');
    } else {
      console.error(`HTTP ${res.status}`, data);
    }
  } catch (err) {
    console.error('cannot connect:', err.message);
    await sleep(4000);
  }
  await sleep(1000);
}
