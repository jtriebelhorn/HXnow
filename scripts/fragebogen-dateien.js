// Erzeugt die eingecheckten Dateien zur Fragebogen-Definition neu:
//   docs/codebuch/codebuch_<definitionVersion>.csv  (Codebuch der freigegebenen Version)
//   tests/fixtures/paar_items_snapshot.json          (nur mit --snapshot: bewusst aktualisieren, Grund in CHANGELOG.md)
// Aufruf: npm run codebuch   bzw.   npm run codebuch -- --snapshot
import { writeFileSync } from 'node:fs';
import { FRAGEBOGEN_DEFINITION as DEF } from '../js/frageboegen.js';
import { codebuchDatei, paarSchnappschuss } from '../js/fb/codebuch.js';

const ziel = new URL(`../docs/codebuch/codebuch_${DEF.definitionVersion}.csv`, import.meta.url);
writeFileSync(ziel, codebuchDatei(DEF).inhalt);
console.log(`Codebuch: ${ziel.pathname}`);
if (process.argv.includes('--snapshot')) {
  const s = new URL('../tests/fixtures/paar_items_snapshot.json', import.meta.url);
  writeFileSync(s, `${JSON.stringify({ definitionVersion: DEF.definitionVersion, paare: paarSchnappschuss(DEF) }, null, 2)}\n`);
  console.log(`Paar-Schnappschuss: ${s.pathname}`);
}
