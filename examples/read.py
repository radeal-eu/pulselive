"""Polls the Pulse Monitor Live API once per second (Python 3, requests).

Usage: PULSE_HOST=192.168.1.15:8765 PULSE_KEY=K7MH3RAW python read.py

PULSE_HOST is the address shown in Pulse Monitor under Settings > Live API. https:// is assumed;
write http://192.168.1.15:8765 when the encryption was turned off there.
Pulse Monitor makes its own (self-signed) certificate, so this example does not verify it.
A production reader should compare the certificate with the SHA-256 fingerprint shown in Settings > Live API.
"""
import json
import os
import re
import sys
import time

import requests
import urllib3

HOST = os.environ.get("PULSE_HOST")
KEY = os.environ.get("PULSE_KEY")
if not HOST or not KEY:
    sys.exit("Set PULSE_HOST (address:port shown in Pulse Monitor, Settings > Live API) and PULSE_KEY")
BASE = HOST.rstrip("/") if re.match(r"^https?://", HOST, re.I) else f"https://{HOST}"
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

while True:
    try:
        res = requests.get(f"{BASE}/live", params={"key": KEY}, timeout=5, verify=False)
        if res.status_code == 401:
            sys.exit("wrong key")
        if res.status_code == 429:
            wait = int(res.headers.get("Retry-After", 60))
            print(f"too many wrong keys, waiting {wait} s", file=sys.stderr)
            time.sleep(wait)
            continue
        if res.status_code == 503:
            print("(no data yet)", file=sys.stderr)
        elif res.ok:
            print(json.dumps(res.json(), ensure_ascii=False))
        else:
            print(f"HTTP {res.status_code}: {res.text}", file=sys.stderr)
    except requests.RequestException as err:
        print(f"cannot connect: {err}", file=sys.stderr)
        time.sleep(4)
    time.sleep(1)
