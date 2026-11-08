// Development-only browser transport. Production desktop uses the restricted IPC bridge.
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { Store, UserError } from '../backend/store.js';
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const port = 8314,
  host = `127.0.0.1:${port}`,
  origin = `http://${host}`;
const store = new Store(
  join(root, process.argv.includes('--test-data') ? '.test-data/preview' : '.local-data'),
  { aiDevelopment: true },
);
const token = randomBytes(32).toString('hex');
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
};
function json(res, status, value) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(value));
}
const server = createServer(async (req, res) => {
  if (
    req.headers.host !== host ||
    (req.headers.origin && req.headers.origin !== origin) ||
    req.headers['sec-fetch-site'] === 'cross-site'
  )
    return json(res, 403, { ok: false });
  const url = new URL(req.url, origin);
  if (req.method === 'GET' && url.pathname === '/api/session') return json(res, 200, { token });
  if (req.method === 'POST' && url.pathname === '/api/command') {
    const provided = req.headers['x-practicum-token'];
    if (
      typeof provided !== 'string' ||
      Buffer.byteLength(provided) !== Buffer.byteLength(token) ||
      !timingSafeEqual(Buffer.from(provided), Buffer.from(token)) ||
      req.headers['content-type'] !== 'application/json'
    )
      return json(res, 403, { ok: false });
    try {
      const chunks = [];
      let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 16 * 1024 * 1024) {
          json(res, 413, { ok: false, error: 'Слишком большой запрос.' });
          return;
        }
        chunks.push(chunk);
      }
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      json(res, 200, { ok: true, data: await store.dispatch(body.command, body.payload) });
    } catch (error) {
      json(res, 200, {
        ok: false,
        error:
          error instanceof UserError
            ? error.message
            : 'Не удалось выполнить действие. Данные не изменены.',
      });
    }
    return;
  }
  if (req.method !== 'GET') return json(res, 405, { ok: false });
  const pathname = url.pathname === '/' ? '/index.html' : url.pathname;
  if (!/^\/[a-zA-Z0-9_./-]+$/.test(pathname) || pathname.includes('..'))
    return json(res, 404, { ok: false });
  const file = join(root, 'build', pathname);
  if (!existsSync(file) || !mime[extname(file)]) return json(res, 404, { ok: false });
  try {
    res.writeHead(200, {
      'Content-Type': mime[extname(file)],
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy':
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; object-src 'none'; frame-ancestors 'none'; base-uri 'none'",
    });
    res.end(readFileSync(file));
  } catch {
    if (!res.headersSent) json(res, 500, { ok: false });
    else res.end();
  }
});
server.listen(port, '127.0.0.1', () => console.log(`Практикум: ${origin}`));
function stop() {
  server.close(() => {
    store.close();
    process.exit(0);
  });
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
