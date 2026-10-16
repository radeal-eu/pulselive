# Web client

A small live view for the browser, written in plain JavaScript (ES modules, no build step, no dependencies).
It shows the participants as tiles, like the training screen of the Pulse Monitor application.
The same page is built into Pulse Monitor and served at `/` of its Live API server (open `https://<address>:<port>/?key=<key>`), so for normal use you do not have to host it yourself.
A hosted copy is available at [www.pulsemonitor.net/webclient](https://www.pulsemonitor.net/webclient/) (see [Built-in viewer](../README.md#built-in-viewer)); it is a copy of this repository and collects no data.
It reads the data from the Pulse Monitor computer on your local network with
[`GET /live`](../README.md#get-live) and the WebSocket [`/ws`](../README.md#get-ws-websocket).

## Run

ES modules do not work from `file://`, so serve the folder with any static web server, for example:

```bash
python -m http.server --directory webclient
```

Pulse Monitor encrypts by default, so the page talks `https`/`wss`. Pulse Monitor makes its own (self-signed) certificate: the
first time, open the Pulse Monitor address once in the same browser and accept it ([Encryption and the certificate](../README.md#encryption-and-the-certificate)),
otherwise the status line says "cannot connect" and tells you to do so. (The page that Pulse Monitor serves itself has no such step
after the first warning.) If the encryption was turned off in Pulse Monitor the page must itself be opened over `http://`:
a page served over `https://` cannot read from a plain-HTTP server (mixed content) - the status line then says
"open this page over http://".
Then either:

- enter the **address and port** of the Pulse Monitor computer (for example `https://192.168.1.15:8765`; `https://` is assumed, write `http://` when the encryption is off) and the **access key**
  (both are shown in Pulse Monitor under **Settings → Live API**, [how to enable it](../README.md#enabling-the-api)) and press **Connect**, or
- open a link that carries them: `index.html?host=https://192.168.1.15:8765&key=K7MH3RAW`.

The address and the key are stored in the browser (`localStorage`); the link is removed from the address bar after it is read,
so the key does not stay in the history. A page opened from a link, or just configured, starts at once.
After a plain reload it waits for the blue **Start** button; **Stop** ends the connection.

The folder includes an `.htaccess` that sets `Cache-Control: no-cache` for the scripts and styles (Apache with `mod_headers`).
On other servers set the same header, otherwise a browser may keep running a stale copy of the modules after an update.

## Status indicator

| Colour | Meaning |
|---|---|
| Grey | Initial state: not started, or stopped, no response received yet |
| Blue | Connecting, or waiting for the training to send data |
| Green | Data is flowing |
| Orange | Cannot connect, wrong key, too many wrong keys, or no new data |

The exit icon in the top bar forgets the stored address and key (after a confirmation) and returns to the connection screen.

## Behaviour

- The client first asks `GET /live` (this tells a wrong key from "no data yet" from a server that is not there), then opens the
  WebSocket and receives every new snapshot as it is published.
- When the connection drops it starts again after 5 s, then 15 s, then 60 s. A wrong key stops it (retrying would only lock the address out);
  fix the key and press **Start**.
- With no new snapshot for 10 seconds the status changes to "no new data" and the last values stay on screen.
- The tile grid is rebuilt only when the list of participants changes; otherwise only changed values are updated.
- The page sends the key only to the address you entered, encrypted (or over plain HTTP if you chose `http://` because the encryption in
  Pulse Monitor is off - then use it on a network you trust).
- Anyone with access to your browser profile can read the stored key, so use the client only on devices you trust.

## Tile layout

The tiles are laid out by `js/layout.js` and adapt to the screen:

- The available area decides the number of columns and rows, so landscape and portrait screens both work.
- The layout gives the biggest tiles that fit. A tile is never narrower than 120 px or lower than 96 px, and its shape stays between 0.85 and 1.5 (width / height).
- The grid has at least 4 places. With fewer participants the tiles keep the size they would have in that grid.
- At most 42 tiles are shown. If they do not fit at the minimum size, the grid scrolls.
- Fonts inside a tile scale with the size of the tile (CSS container units). The top and bottom bars are not scaled.
- The layout is recalculated when the window size, orientation or zoom changes and when the number of participants changes.

The limits are in `LAYOUT` in `js/config.js`.

## Files

| File | Purpose |
|---|---|
| `index.html` | Page, connection form, tile template, Content Security Policy |
| `js/client.js` | `PulseLiveClient`: `/live` check, WebSocket, back-off, connection state |
| `js/connection.js` | Normalising and checking the address and the key |
| `js/view.js` | Rendering of the tiles and the status |
| `js/storage.js` | Safe access to `localStorage` |
| `js/config.js` | Default port and timings |
| `css/style.css` | Styles |
