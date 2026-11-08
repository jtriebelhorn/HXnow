// Festschreibung (ENTSCHEIDUNGEN Nr. 47): Kodierschema, Fragebogen-Definition und Exportformat dürfen sich nur mit neuer
// Versionsnummer ändern. Schlägt dieser Test fehl: Version erhöhen (kodierschema.json „schemaVersion“,
// js/frageboegen.js „definitionVersion“, js/export.js EXPORT_FORMAT), Codebuch/Kodierhandbuch/CHANGELOG nachziehen,
// dann `npm run versionen`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FRAGEBOGEN_DEFINITION } from '../../js/frageboegen.js';
import { aktuelleVersionen } from '../../scripts/versionsabdruck.js';
import { SCHEMA } from './hilfen.js';

const fest = JSON.parse(readFileSync(new URL('../fixtures/versionen.json', import.meta.url), 'utf8'));

for (const [art, { version, hash }] of Object.entries(aktuelleVersionen(SCHEMA, FRAGEBOGEN_DEFINITION))) {
  test(`${art} ${version}: Inhalt entspricht der festgeschriebenen Version`, () => {
    assert.ok(fest[art][version], `${art} ${version} ist nicht eingetragen – nach bewusster Versionserhöhung „npm run versionen“ ausführen.`);
    assert.equal(hash, fest[art][version], `${art} wurde geändert, die Version ${version} aber nicht erhöht.`);
  });
}

test('Ab der Festschreibung: Versionen mindestens 1.0', () => {
  const v = aktuelleVersionen(SCHEMA, FRAGEBOGEN_DEFINITION);
  for (const art of Object.keys(v)) assert.ok(Number.parseInt(v[art].version, 10) >= 1, `${art} ${v[art].version}`);
});
