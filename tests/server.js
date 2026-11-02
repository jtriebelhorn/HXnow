// Minimaler statischer Entwicklungsserver (nur für Entwicklung und Tests, ohne Abhängigkeiten).
// Aufruf: node tests/server.js [port]
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const WURZEL = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PORT = Number(process.argv[2] ?? process.env.PORT ?? 8080);

const TYPEN = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.md': 'text/markdown; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
};

createServer(async (req, res) => {
  try {
    let pfad = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (pfad.endsWith('/')) pfad += 'index.html';
    const datei = normalize(join(WURZEL, pfad));
    if (!datei.startsWith(WURZEL + sep)) throw new Error('außerhalb');
    if (!(await stat(datei)).isFile()) throw new Error('kein File');
    let inhalt = await readFile(datei);
    // Nur für E2E-Tests: Cookie „sw-test-version“ simuliert eine neue App-Version (geänderte CACHE_VERSION).
    const testVersion = /(?:^|;\s*)sw-test-version=([\w.-]+)/.exec(req.headers.cookie ?? '')?.[1];
    if (testVersion && pfad === '/sw.js') {
      inhalt = inhalt.toString('utf8').replace(/const CACHE_VERSION = '[^']+'/, `const CACHE_VERSION = '${testVersion}'`);
    }
    res.writeHead(200, { 'Content-Type': TYPEN[extname(datei)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(inhalt);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Nicht gefunden');
  }
}).listen(PORT, '127.0.0.1', () => console.log(`HX Now Beobachtung: http://localhost:${PORT}/`));
