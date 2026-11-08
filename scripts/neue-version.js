// Neue App-Version eintragen: js/version.js, sw.js (CACHE_VERSION und Dateiliste) und version.json.
// Aufruf: npm run version -- 0.9.0 "Kurzer Hinweis für die Update-Meldung"
// Die Dateiliste DATEIEN im Service Worker wird aus den Stammdateien und allen js/**/*.js neu erzeugt
// (ohne js/auswertung/: nur für das Zusammenführungstool am Rechner).
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const [version, hinweis] = process.argv.slice(2);
if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(version ?? '')) {
  console.error('Aufruf: npm run version -- <MAJOR.MINOR.PATCH> "Hinweis"');
  process.exit(1);
}
const wurzel = new URL('..', import.meta.url).pathname;
const datei = (p) => join(wurzel, p);

const js = (dir) => readdirSync(datei(dir)).flatMap((n) => {
  const p = join(dir, n);
  if (statSync(datei(p)).isDirectory()) return p === 'js/auswertung' ? [] : js(p);
  return n.endsWith('.js') ? [p] : [];
});
const liste = ['./', 'index.html', 'manifest.webmanifest', 'kodierschema.json', 'version.json', 'css/app.css',
  'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png', ...js('js').map((p) => relative(wurzel, datei(p))).sort()];

writeFileSync(datei('js/version.js'), readFileSync(datei('js/version.js'), 'utf8').replace(/APP_VERSION = '[^']+'/, `APP_VERSION = '${version}'`));
let sw = readFileSync(datei('sw.js'), 'utf8').replace(/CACHE_VERSION = '[^']+'/, `CACHE_VERSION = '${version}'`);
sw = sw.replace(/const DATEIEN = \[[\s\S]*?\];/, `const DATEIEN = [\n${liste.map((d) => `  '${d}',`).join('\n')}\n];`);
writeFileSync(datei('sw.js'), sw);
const alt = JSON.parse(readFileSync(datei('version.json'), 'utf8'));
const heute = new Date();
const datum = `${heute.getFullYear()}-${String(heute.getMonth() + 1).padStart(2, '0')}-${String(heute.getDate()).padStart(2, '0')}`;
writeFileSync(datei('version.json'), `${JSON.stringify({ appVersion: version, datum, hinweis: hinweis ?? alt.hinweis }, null, 2)}\n`);
console.log(`Version ${version}: ${liste.length} Dateien im Cache.`);
