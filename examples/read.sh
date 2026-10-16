#!/usr/bin/env bash
# Polls the Pulse Monitor Live API once per second.
# Usage: PULSE_HOST=192.168.1.15:8765 PULSE_KEY=K7MH3RAW ./read.sh
#
# PULSE_HOST is the address shown in Pulse Monitor under Settings > Live API. https:// is assumed;
# write http://192.168.1.15:8765 when the encryption was turned off there.
# The certificate is made by Pulse Monitor itself (self-signed), so curl runs with -k. For a
# production reader compare the certificate with the SHA-256 fingerprint shown in the same tab.
set -u

: "${PULSE_HOST:?Set PULSE_HOST (address:port shown in Pulse Monitor, Settings > Live API)}"
: "${PULSE_KEY:?Set PULSE_KEY}"

case "$PULSE_HOST" in
  http://*|https://*) BASE="$PULSE_HOST" ;;
  *)                  BASE="https://$PULSE_HOST" ;;
esac

while true; do
  response=$(curl -sk -m 5 -w '\n%{http_code}' "$BASE/live?key=$PULSE_KEY")
  status=${response##*$'\n'}
  body=${response%$'\n'*}

  case "$status" in
    200) echo "$body" ;;
    503) echo "(no data yet)" >&2 ;;
    401) echo "wrong key" >&2; exit 1 ;;
    429) echo "too many wrong keys, waiting 60 s" >&2; sleep 60 ;;
    000) echo "cannot connect to $BASE" >&2; sleep 4 ;;
    *)   echo "HTTP $status: $body" >&2 ;;
  esac
  sleep 1
done
