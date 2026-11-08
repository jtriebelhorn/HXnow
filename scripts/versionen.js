// Trägt die aktuellen Versionen von Kodierschema, Fragebogen-Definition und Exportformat mit Fingerabdruck in
// tests/fixtures/versionen.json ein. Nur nach einer bewussten Versionserhöhung ausführen: Bereits eingetragene
// Versionen werden nie überschrieben (geänderter Inhalt unter alter Nummer → Fehler).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { FRAGEBOGEN_DEFINITION } from '../js/frageboegen.js';
import { aktuelleVersionen } from './versionsabdruck.js';

const datei = new URL('../tests/fixtures/versionen.json', import.meta.url);
const schema = JSON.parse(readFileSync(new URL('../kodierschema.json', import.meta.url), 'utf8'));
const bisher = existsSync(datei) ? JSON.parse(readFileSync(datei, 'utf8')) : { kodierschema: {}, fragebogen: {}, exportformat: {} };
let fehler = false;
for (const [art, { version, hash }] of Object.entries(aktuelleVersionen(schema, FRAGEBOGEN_DEFINITION))) {
  const alt = bisher[art][version];
  if (alt && alt !== hash) { console.error(`${art} ${version}: Inhalt geändert, Version aber nicht erhöht.`); fehler = true; continue; }
  if (!alt) { bisher[art][version] = hash; console.log(`${art} ${version}: eingetragen.`); }
}
if (fehler) process.exit(1);
writeFileSync(datei, `${JSON.stringify(bisher, null, 2)}\n`);
