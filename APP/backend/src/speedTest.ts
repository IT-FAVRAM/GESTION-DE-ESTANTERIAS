import * as functions from 'firebase-functions';

/**
 * Speed Test endpoint — serves random data payloads for download speed measurement.
 *
 * Query params:
 *   - size: number of bytes to return (default: 256KB, max: 4MB)
 */
export const speedTest = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  const requestedSize = parseInt(req.query.size as string) || 256 * 1024;
  const size = Math.min(Math.max(requestedSize, 1024), 4 * 1024 * 1024);

  const chunkSize = 64 * 1024;
  const chunks = Math.ceil(size / chunkSize);

  res.set('Content-Type', 'application/octet-stream');
  res.set('Content-Length', String(size));
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.set('Pragma', 'no-cache');

  const buf = Buffer.alloc(chunkSize);
  for (let i = 0; i < chunkSize; i++) {
    buf[i] = (i * 7 + chunks) & 0xff;
  }

  for (let i = 0; i < chunks; i++) {
    const remaining = size - i * chunkSize;
    const toWrite = Math.min(chunkSize, remaining);
    if (toWrite === chunkSize) {
      res.write(buf);
    } else {
      res.write(buf.slice(0, toWrite));
    }
  }

  res.end();
});

/**
 * Quick ping endpoint for latency measurement.
 */
export const ping = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.set('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  res.status(200).json({ t: Date.now() });
});
