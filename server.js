// Tiny zero-dependency server: serves public/ and POST /api/reading.
// Run: npm start. Binds 127.0.0.1 and rate-limits readings, because every
// request spends Anthropic credit.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

try { process.loadEnvFile(); } catch { /* no .env: rely on real env vars */ }
const { getReading, UserFacingError } = await import('./lib/astrologer.js');

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '127.0.0.1';
const PUBLIC = new URL('./public/', import.meta.url).pathname;
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript' };

const SECURITY_HEADERS = {
  'Content-Security-Policy': "default-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
};

// Sliding one-minute window per client IP.
const WINDOW_MS = 60_000;
const PER_IP_LIMIT = 10;
const hitsByIp = new Map();

createServer(async (req, res) => {
  try {
    if (req.method === 'POST' && req.url === '/api/reading') {
      if (rateLimited(req.socket.remoteAddress ?? 'unknown')) return send(res, 429, { error: 'Too many readings, try again in a minute.' });

      let body;
      try { body = JSON.parse(await readBody(req)); } catch { return send(res, 400, { error: 'invalid JSON body' }); }
      const birthday = body?.birthday;
      if (!isValidBirthday(birthday)) return send(res, 400, { error: 'Enter a real date between 1900 and today.' });

      const { reading, usage } = await getReading(birthday);
      console.log(`[reading] ${birthday} — ${usage.input} in / ${usage.output} out tokens`);
      return send(res, 200, { reading });
    }

    const path = normalize(join(PUBLIC, req.url === '/' ? 'index.html' : req.url.split('?')[0]));
    if (!path.startsWith(PUBLIC)) return send(res, 403, { error: 'forbidden' });
    const file = await readFile(path).catch(() => null);
    if (!file) return send(res, 404, { error: 'not found' });
    res.writeHead(200, { ...SECURITY_HEADERS, 'Content-Type': TYPES[extname(path)] ?? 'application/octet-stream' });
    res.end(file);
  } catch (err) {
    console.error(err);
    send(res, 500, { error: err instanceof UserFacingError ? err.message : 'internal error' });
  }
}).listen(PORT, HOST, () => console.log(`Celestial Birthday Reader on http://${HOST}:${PORT}`));

// "YYYY-MM-DD", a real calendar date, 1900-01-01 through today.
function isValidBirthday(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) return false;
  return s >= '1900-01-01' && d.getTime() <= Date.now();
}

function rateLimited(ip) {
  const now = Date.now();
  const mine = (hitsByIp.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  const limited = mine.length >= PER_IP_LIMIT;
  if (!limited) mine.push(now);
  hitsByIp.set(ip, mine);
  return limited;
}

function send(res, status, obj) {
  res.writeHead(status, { ...SECURITY_HEADERS, 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 10_000) req.destroy(); });
    req.on('end', () => resolve(data || '{}'));
    req.on('error', reject);
  });
}
