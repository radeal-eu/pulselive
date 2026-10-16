<?php
// Polls the Pulse Monitor Live API once per second (PHP 8+, ext-curl).
// Usage: PULSE_HOST=192.168.1.15:8765 PULSE_KEY=K7MH3RAW php read.php
//
// PULSE_HOST is the address shown in Pulse Monitor under Settings > Live API. https:// is assumed;
// write http://192.168.1.15:8765 when the encryption was turned off there.
// Pulse Monitor makes its own (self-signed) certificate, so this example does not verify it.
// A production reader should compare the certificate with the SHA-256 fingerprint shown in Settings > Live API.

$host = getenv('PULSE_HOST');
$key = getenv('PULSE_KEY');
if (!$host || !$key) {
    fwrite(STDERR, "Set PULSE_HOST (address:port shown in Pulse Monitor, Settings > Live API) and PULSE_KEY\n");
    exit(1);
}
$base = preg_match('#^https?://#i', $host) ? rtrim($host, '/') : "https://$host";

while (true) {
    $retryAfter = 60;
    $ch = curl_init("$base/live?key=" . rawurlencode($key));
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 5,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_SSL_VERIFYHOST => 0,
        CURLOPT_HEADERFUNCTION => function ($ch, $header) use (&$retryAfter) {
            if (stripos($header, 'Retry-After:') === 0) {
                $retryAfter = max(1, (int) trim(substr($header, 12)));
            }
            return strlen($header);
        },
    ]);
    $body = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);

    if ($body === false) {
        fwrite(STDERR, "cannot connect to $base\n");
        sleep(4);
    } elseif ($status === 401) {
        fwrite(STDERR, "wrong key\n");
        exit(1);
    } elseif ($status === 429) {
        fwrite(STDERR, "too many wrong keys, waiting $retryAfter s\n");
        sleep($retryAfter);
        continue;
    } elseif ($status === 503) {
        fwrite(STDERR, "(no data yet)\n");
    } elseif ($status === 200) {
        echo $body . "\n";
    } else {
        fwrite(STDERR, "HTTP $status: $body\n");
    }
    sleep(1);
}
