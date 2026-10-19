/*! Pulse Monitor Live web client | (c) 2026 Radeal sp. z o.o. | MIT License */
import { loadConnection, saveConnection, clearConnection } from './storage.js';
import { parseAddress, normalizeKey, isServedByPulseMonitor } from './connection.js';
import { PulseLiveClient } from './client.js';
import { LiveView } from './view.js';

const $ = (id) => document.getElementById(id);

let keyFromUrl = ''; // a key in the link of a page that cannot say which computer it belongs to

// A link like  https://192.168.1.15:8765/?key=K7MH3RAW  (the page served by the application itself) or
// webclient/index.html?host=https://192.168.1.15:8765&key=K7MH3RAW  carries the connection with it.
// It is remembered and removed from the address bar, so it does not stay in the history.
function connectionFromUrl() {
  const params = new URLSearchParams(location.search);
  const key = normalizeKey(params.get('key'));
  if (!key) return null;
  // `host` may carry the scheme (https://host:port); without it https is assumed. Without `host` the page talks to the
  // server it came from, with the same scheme - but only when that is Pulse Monitor itself (an IP address), not
  // a domain such as the hosted copy.
  const parsed = params.get('host')
    ? parseAddress(params.get('host'))
    : isServedByPulseMonitor() ? parseAddress(location.origin) : null;
  history.replaceState(null, '', location.pathname);
  if (!parsed) keyFromUrl = key; // the connection screen offers it, the address still has to be typed
  return parsed ? { ...parsed, key } : null;
}

function showConnectionScreen() {
  $('key-screen').hidden = false;
  const addressInput = $('address-input');
  const keyInput = $('key-input');
  // Offer the address of this page only when Pulse Monitor itself serves it (an IP address); the placeholder shows the format.
  const defaultAddress = isServedByPulseMonitor() ? location.origin : '';
  addressInput.value = defaultAddress;
  keyInput.value = keyFromUrl;
  (defaultAddress ? keyInput : addressInput).focus();

  for (const input of [addressInput, keyInput]) {
    input.addEventListener('input', () => input.setCustomValidity(''));
  }

  $('key-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const parsed = parseAddress(addressInput.value);
    const key = normalizeKey(keyInput.value);
    if (!parsed) {
      addressInput.setCustomValidity('Enter the address as host:port, for example 192.168.1.15:8765.');
      addressInput.reportValidity();
      return;
    }
    if (!key) return;
    const connection = { ...parsed, key };
    saveConnection(connection); // when browser storage is unavailable the connection just lasts until the page is closed
    $('key-screen').hidden = true;
    showLiveScreen(connection, true);
  });
}

function showLiveScreen(connection, autostart) {
  $('live-screen').hidden = false;

  const view = new LiveView();
  const client = new PulseLiveClient(connection);

  client.addEventListener('snapshot', (e) => view.render(e.detail.snapshot));
  client.addEventListener('state', (e) => {
    view.setState(e.detail);
    view.setRunning(client.running);
  });
  view.setState({ state: 'stopped' });
  view.setRunning(false);

  $('toggle').addEventListener('click', () => (client.running ? client.stop() : client.start()));
  const dialog = $('logout-dialog');
  $('logout').addEventListener('click', () => dialog.showModal());
  $('logout-cancel').addEventListener('click', () => dialog.close());
  $('logout-confirm').addEventListener('click', () => {
    client.stop();
    clearConnection();
    location.reload();
  });

  // A page opened from a link, or just configured, starts at once; after a plain reload it waits for Start.
  if (autostart) client.start();
}

const fromUrl = connectionFromUrl();
if (fromUrl) {
  saveConnection(fromUrl);
  showLiveScreen(fromUrl, true);
} else {
  const stored = loadConnection();
  if (stored) {
    showLiveScreen(stored, false);
  } else {
    showConnectionScreen();
  }
}
