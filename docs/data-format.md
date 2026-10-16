# Data format

Schema version: `1`

This document describes the JSON snapshot returned by [`GET /live`](../README.md#get-live) and pushed over the WebSocket [`/ws`](../README.md#get-ws-websocket).

## Contents

- [Overview](#overview)
- [Example](#example)
- [Snapshot object](#snapshot-object)
- [Training object](#training-object)
- [Participant object](#participant-object)
- [Guidelines for readers](#guidelines-for-readers)
- [Versioning](#versioning)

## Overview

The Pulse Monitor application publishes a snapshot during a training, in both the classic and the Drop-in mode.
Each snapshot contains the **complete state** of every participant shown on the screen, so a reader only ever needs the most recent one.
There is no history and no delta encoding.

When there is no snapshot yet, `/live` answers `503` with `{"status":"no data yet"}`. See [Is the training running?](../README.md#is-the-training-running).

## Example

```json
{
  "v": 1,
  "seq": 1234,
  "sentAt": "2026-10-15T18:30:01Z",
  "training": {
    "name": "Spinning 18:00",
    "elapsedSec": 1834
  },
  "participants": [
    {
      "nick": "Ania",
      "color": "#FF8800",
      "hr": 142,
      "pctMax": 78,
      "kcal": 312,
      "signal": true,
      "checkBelt": false
    },
    {
      "nick": "Bartek",
      "color": "#808080",
      "hr": 0,
      "pctMax": 0,
      "kcal": 287,
      "signal": false,
      "checkBelt": false
    }
  ]
}
```

## Snapshot object

| Field | Type | Description |
|---|---|---|
| `v` | integer | Schema version. Currently `1`. |
| `seq` | integer | Snapshot counter. Starts at 1 each time the server starts (a training or Drop-in screen is opened). Gaps are normal. |
| `sentAt` | string | Time the snapshot was taken: UTC, format `yyyy-MM-ddTHH:mm:ssZ`. Changes with every snapshot. |
| `training` | object | Information about the running training. See [Training object](#training-object). |
| `participants` | array | Participants in display order, at most 42. May be empty. See [Participant object](#participant-object). |

`sentAt` is the only signal that a training is still being transmitted. See [Is the training running?](../README.md#is-the-training-running).

## Training object

| Field | Type | Description |
|---|---|---|
| `name` | string | Name of the training. `"Drop-in"` in Drop-in mode. |
| `elapsedSec` | integer | Training time in seconds. Classic mode: registered time, which stands still during a pause. Drop-in mode: time since the screen was opened. |

## Participant object

| Field | Type | Description |
|---|---|---|
| `nick` | string | Participant nickname. Not guaranteed to be unique. |
| `color` | string | Current heart-rate zone colour as `#RRGGBB`. Grey when there is no signal. |
| `hr` | integer | Heart rate in beats per minute, smoothed over 3 seconds as on the screen. `0` means no value. |
| `pctMax` | integer | Heart rate as a percentage of the maximum heart rate, usually up to 100. `0` when there is no heart rate. |
| `kcal` | integer | Calories burned since the start of the training (cumulative). |
| `signal` | boolean | `false` when the sensor has lost its signal. `hr` and `pctMax` are then `0`. |
| `checkBelt` | boolean | `true` when the heart rate has not changed for a long time, so the strap may have lost skin contact: the "check the belt" warning of the application. Always `false` when "Monitor sensor contact" is switched off in its Settings. May be missing in data from older versions; treat missing as `false`. |

## Guidelines for readers

**Use the latest snapshot only.** Do not rebuild history from earlier snapshots.

**Treat "no signal" as a state, not a measurement.** A participant with `signal: false` stays in the list with `hr: 0`, `pctMax: 0` and a grey `color`. Display "no signal" rather than a heart rate of 0.

**Show "check the belt" as a hint, not as a fault.** `checkBelt` appears and disappears on its own (it is shown for a limited time and can return if the value stays unchanged); it is not a measurement.

**Do not rely on list position.** Participants can appear or disappear between snapshots and the order can change. `nick` is the best available key, but it may not be unique.

**Decode JSON normally.** Non-ASCII characters are written as `\uXXXX` escapes. This is valid JSON, and any JSON parser returns the correct text.

**Handle health data with care.** Heart rate combined with a nickname is health data. Do not write snapshots to logs.

## Versioning

The `v` field identifies the schema version. New fields may be added without changing `v`, so readers should ignore fields they do not recognise.
